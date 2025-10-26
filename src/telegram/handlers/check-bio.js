import { InputFile } from 'grammy';
import PQueue from 'p-queue';
import { createLogger } from '../../logger.js';
import { getUserSocket } from '../../whatsapp/socket-pool.js';
import { fetchBioForUser } from '../../whatsapp/utils.js';
import { formatErrorMessage } from '../utils.js';
import { getUser } from '../../db/users.js';
import { cancelKeyboard } from '../keyboards.js';

const log = createLogger('TelegramCheckBio');

// -- parsePhoneNumbers --
const parsePhoneNumbers = (text) => {
  const numbers = text
    .split(/[\n,;\s]+/)
    .map((n) => n.trim())
    .filter((n) => /^\d+$/.test(n))
    .filter((n) => n.length >= 7 && n.length <= 15);

  return [...new Set(numbers)];
};

// -- readFileContent --
const readFileContent = async (ctx, fileId) => {
  try {
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

    const response = await globalThis.fetch(fileUrl);
    const content = await response.text();

    return content;
  } catch (error) {
    log.error({ error }, 'Failed to read file content');
    throw new Error('Failed to read file');
  }
};

// -- processBulkBio --
const processBulkBio = async (ctx, socket, numbers) => {
  const total = numbers.length;
  const results = {
    success: [],
    failed: [],
    noBio: [],
  };

  let processed = 0;
  let consecutiveErrors = 0;
  let rateLimitPauses = 0;
  let lastProgressText = '';

  const queue = new PQueue({
    concurrency: 12,
    interval: 1000,
    intervalCap: 25,
  });

  const progressMsg = await ctx.reply(
    `🚀 Processing ${total} numbers...\n` +
    '⏳ Turbo mode activated...\n' +
    `📊 0/${total} (0%)\n` +
    '⚡ Concurrency: 12 | Max: 25/sec',
  );

  const updateProgress = async () => {
    const percent = Math.round((processed / total) * 100);
    const speed = queue.concurrency * (queue.intervalCap / (queue.interval / 1000));
    const statusEmoji = consecutiveErrors >= 3 ? '⚠️' : '✅';

    const progressText =
      `${statusEmoji} Processing ${total} numbers...\n` +
      `✅ Success: ${results.success.length}\n` +
      `❌ Failed: ${results.failed.length}\n` +
      `⚪ No Bio: ${results.noBio.length}\n` +
      `📊 ${processed}/${total} (${percent}%)\n` +
      `⚡ Speed: ~${Math.round(speed)} checks/sec\n` +
      (rateLimitPauses > 0 ? `⏸️ Pauses: ${rateLimitPauses}` : '');

    if (progressText === lastProgressText) {
      return;
    }

    try {
      await ctx.api.editMessageText(ctx.chat.id, progressMsg.message_id, progressText);
      lastProgressText = progressText;
    } catch (err) {
      if (!err.message?.includes('message is not modified')) {
        log.warn({ err }, 'Failed to update progress');
      }
    }
  };

  const fetchWithRetry = async (number, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await fetchBioForUser(socket, number);

        if (result.success) {
          results.success.push({
            phone: result.phone,
            bio: result.bio,
            setAt: result.setAt,
          });
          consecutiveErrors = 0;
          return;
        }

        if (result.error === 'User has no bio') {
          results.noBio.push(number);
          consecutiveErrors = 0;
          return;
        }

        const isRateLimit = result.error?.includes('rate') ||
          result.error?.includes('429') ||
          result.error?.includes('Too many');

        if (isRateLimit && attempt < retries) {
          const backoffDelay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          log.warn(
            `[RETRY] Rate limit for ${number}, ` +
            `waiting ${backoffDelay}ms (attempt ${attempt}/${retries})`,
          );
          await new Promise((resolve) => globalThis.setTimeout(resolve, backoffDelay));
          consecutiveErrors++;
          continue;
        }

        results.failed.push({ phone: number, error: result.error });
        consecutiveErrors++;

        if (consecutiveErrors >= 3) {
          log.warn('[PAUSE] Rate limit detected! Pausing for 8 seconds...');
          queue.pause();
          rateLimitPauses++;
          await new Promise((resolve) => globalThis.setTimeout(resolve, 8000));
          consecutiveErrors = 0;
          queue.start();
          log.info('[RESUME] Queue resumed after rate limit pause');
        }

        return;
      } catch (error) {
        if (attempt === retries) {
          log.error({ error }, `Final attempt failed for ${number}`);
          results.failed.push({ phone: number, error: error.message });
        } else {
          const retryDelay = 1000 * attempt;
          log.warn(`[RETRY] Error for ${number}, retrying in ${retryDelay}ms`);
          await new Promise((resolve) => globalThis.setTimeout(resolve, retryDelay));
        }
      }
    }
  };

  const tasks = numbers.map((number) =>
    queue.add(async () => {
      await fetchWithRetry(number);
      processed++;

      if (processed % 10 === 0 || processed === total) {
        await updateProgress();
      }
    }),
  );

  await Promise.all(tasks);
  await updateProgress();

  return results;
};

// -- formatBulkResults --
const formatBulkResults = (results) => {
  const lines = [];

  lines.push('📋 *Bio Check Results*\n');
  lines.push(`✅ Success: ${results.success.length}`);
  lines.push(`❌ Failed: ${results.failed.length}`);
  lines.push(`⚪ No Bio: ${results.noBio.length}`);
  lines.push(`📊 Total: ${results.success.length + results.failed.length + results.noBio.length}\n`);

  if (results.success.length > 0) {
    lines.push('━━━━━━━━━━━━━━━━━━');
    lines.push('*✅ Found Bios:*\n');

    results.success.forEach((r, i) => {
      lines.push(`${i + 1}. \`${r.phone}\``);
      lines.push(`   📝 ${r.bio}`);
      lines.push(`   📅 ${r.setAt}\n`);
    });
  }

  if (results.noBio.length > 0) {
    lines.push('━━━━━━━━━━━━━━━━━━');
    lines.push('*⚪ No Bio:*');
    lines.push(results.noBio.map((n) => `\`${n}\``).join(', ') + '\n');
  }

  if (results.failed.length > 0) {
    lines.push('━━━━━━━━━━━━━━━━━━');
    lines.push('*❌ Failed:*');
    results.failed.forEach((f) => {
      lines.push(`\`${f.phone}\`: ${f.error}`);
    });
  }

  return lines.join('\n');
};

// -- generateWithBioTxt --
const generateWithBioTxt = (results) => {
  const lines = ['=== NOMOR DENGAN BIO ===\n'];

  if (results.success.length === 0) {
    lines.push('(Tidak ada nomor dengan bio)\n');
  } else {
    results.success.forEach((r) => {
      lines.push(`${r.phone}`);
      lines.push(`Bio: ${r.bio}`);
      lines.push(`Set: ${r.setAt}\n`);
    });
  }

  return lines.join('\n');
};

// -- generateNoBioTxt --
const generateNoBioTxt = (results) => {
  const lines = ['=== NOMOR TANPA BIO / FAILED ===\n'];

  if (results.noBio.length === 0 && results.failed.length === 0) {
    lines.push('(Semua nomor memiliki bio)\n');
  } else {
    if (results.noBio.length > 0) {
      lines.push('--- TIDAK ADA BIO ---');
      results.noBio.forEach((phone) => {
        lines.push(`${phone} - No Bio`);
      });
      lines.push('');
    }

    if (results.failed.length > 0) {
      lines.push('--- FAILED ---');
      results.failed.forEach((f) => {
        lines.push(`${f.phone} - ${f.error}`);
      });
      lines.push('');
    }
  }

  return lines.join('\n');
};

// -- handleCheckBioCommand --
export const handleCheckBioCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    log.info(`[CHECK-BIO] User ${userId} requested check bio`);

    const user = await getUser(userId);

    if (!user || !user.whatsappPaired) {
      await ctx.reply('❌ You need to pair WhatsApp first. Press 📱 Pair WhatsApp button.');
      return;
    }

    log.info(`[CHECK-BIO] User ${userId} is paired, showing options`);
    const msg = '🔍 *Check Bio*\n\n' +
      '*Single Number:*\n' +
      'Send 1 phone number\n' +
      'Example: `6281234567890`\n\n' +
      '*Multiple Numbers:*\n' +
      'Send numbers (one per line)\n' +
      'Example:\n' +
      '```\n' +
      '6281234567890\n' +
      '6289876543210\n' +
      '```\n\n' +
      '*File Upload:*\n' +
      'Upload .txt file with numbers\n\n' +
      '💡 *Output Logic:*\n' +
      '• ≤10 numbers (text) → Telegram message\n' +
      '• >10 numbers → 2 .txt files\n' +
      '• File upload → 2 .txt files';

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });
    ctx.session.waitingForBioPhone = true;
  } catch (error) {
    log.error({ error }, 'Error in check bio command');
    await ctx.reply(formatErrorMessage(error));
  }
};

// -- handleBioPhoneInput --
export const handleBioPhoneInput = async (ctx) => {
  try {
    if (!ctx.session?.waitingForBioPhone) {
      return;
    }

    const userId = ctx.from?.id;
    const socket = getUserSocket(userId);

    if (!socket || !socket.user) {
      await ctx.reply('❌ WhatsApp connection lost. Please pair again.');
      ctx.session.waitingForBioPhone = false;
      return;
    }

    let numbers = [];
    let isFromFile = false;

    if (ctx.message?.document) {
      const doc = ctx.message.document;

      if (!doc.file_name?.endsWith('.txt')) {
        await ctx.reply('❌ Please upload a .txt file');
        return;
      }

      await ctx.reply('📥 Reading file...');
      const content = await readFileContent(ctx, doc.file_id);
      numbers = parsePhoneNumbers(content);
      isFromFile = true;
    } else if (ctx.message?.reply_to_message?.document) {
      const doc = ctx.message.reply_to_message.document;

      if (!doc.file_name?.endsWith('.txt')) {
        await ctx.reply('❌ Please reply to a .txt file');
        return;
      }

      await ctx.reply('📥 Reading file...');
      const content = await readFileContent(ctx, doc.file_id);
      numbers = parsePhoneNumbers(content);
      isFromFile = true;
    } else if (ctx.message?.text) {
      numbers = parsePhoneNumbers(ctx.message.text);
    }

    if (numbers.length === 0) {
      await ctx.reply('❌ No valid numbers found. Please send valid phone numbers.', {
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    if (numbers.length > 1000) {
      await ctx.reply(`❌ Too many numbers! Maximum 1000, you sent ${numbers.length}`, {
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    if (numbers.length === 1) {
      await ctx.reply('⏳ Fetching bio information...');

      const result = await fetchBioForUser(socket, numbers[0]);

      if (result.success) {
        const message = '📋 *Bio Check Result*\n\n' +
          `📱 Phone: \`${result.phone}\`\n` +
          `📝 Bio: ${result.bio}\n` +
          `📅 Set Date: ${result.setAt}`;

        await ctx.reply(message, { parse_mode: 'Markdown' });
        log.info(`[SINGLE] Bio fetched for ${result.phone}`);
      } else {
        await ctx.reply(`❌ ${result.error}`);
        log.warn(`[SINGLE] Failed: ${result.error}`);
      }
    } else {
      log.info(`[BULK] Processing ${numbers.length} numbers for user ${userId}`);

      const results = await processBulkBio(ctx, socket, numbers);

      if (numbers.length <= 10 && !isFromFile) {
        const resultText = formatBulkResults(results);
        await ctx.reply(resultText, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply(
          '📋 *Results Summary*\n\n' +
          `✅ Success: ${results.success.length}\n` +
          `❌ Failed: ${results.failed.length}\n` +
          `⚪ No Bio: ${results.noBio.length}\n` +
          `📊 Total: ${numbers.length}\n\n` +
          '📄 Files attached below:',
          { parse_mode: 'Markdown' },
        );

        const withBioTxt = generateWithBioTxt(results);
        const withBioBuffer = globalThis.Buffer.from(withBioTxt, 'utf-8');
        await ctx.replyWithDocument(
          new InputFile(withBioBuffer, `with_bio_${Date.now()}.txt`),
          { caption: '✅ Nomor dengan bio' },
        );

        const noBioTxt = generateNoBioTxt(results);
        const noBioBuffer = globalThis.Buffer.from(noBioTxt, 'utf-8');
        await ctx.replyWithDocument(
          new InputFile(noBioBuffer, `no_bio_${Date.now()}.txt`),
          { caption: '❌ Nomor tanpa bio / failed' },
        );
      }
    }

    ctx.session.waitingForBioPhone = false;
  } catch (error) {
    log.error({ error }, 'Error handling bio phone input');
    await ctx.reply(`❌ Error: ${error.message || 'Failed to check bio'}`);
    ctx.session.waitingForBioPhone = false;
  }
};
