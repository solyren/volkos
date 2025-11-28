import PQueue from 'p-queue';
import { InputFile } from 'grammy';
import { createLogger } from '../../logger.js';
import { getUserSocket } from '../../whatsapp/socket-pool.js';
import { fetchBioForUser } from '../../whatsapp/utils.js';
import { formatErrorMessage } from '../utils.js';
import { getUser } from '../../db/users.js';
import { checkCooldown } from '../../db/cooldown.js';
import { cancelKeyboard, ownerMainMenu, userMainMenu } from '../keyboards.js';

const log = createLogger('TelegramCheckBio');

// -- AdaptiveRateLimiter --
class AdaptiveRateLimiter {
  constructor() {
    this.currentRate = 20;
    this.minRate = 5;
    this.maxRate = 30;
    this.errorCount = 0;
    this.successCount = 0;
    this.baseDelay = 50;
    this.backoffMultiplier = 1;
  }

  recordSuccess() {
    this.successCount++;
    this.errorCount = 0;
    if (this.currentRate < this.maxRate && this.successCount > 5) {
      this.currentRate = Math.min(this.maxRate, this.currentRate + 1);
      this.successCount = 0;
      log.info(`[RATE] Increased to ${this.currentRate}/sec`);
    }
  }

  recordError(isRateLimit = false) {
    this.errorCount++;
    this.successCount = 0;
    if (isRateLimit) {
      this.currentRate = Math.max(this.minRate, this.currentRate - 2);
      this.backoffMultiplier = Math.pow(2, Math.min(this.errorCount, 4));
      log.warn(
        '[RATE] Rate limit detected! ' +
        `Reduced to ${this.currentRate}/sec, backoff: ${this.backoffMultiplier}x`,
      );
    }
  }

  getDelay() {
    const interval = 1000 / this.currentRate;
    const jitter = Math.random() * 0.2 * interval;
    const backoffDelay = this.baseDelay * this.backoffMultiplier;
    return Math.max(interval, backoffDelay) + jitter;
  }

  resetBackoff() {
    if (this.errorCount === 0) {
      this.backoffMultiplier = 1;
    }
  }
}

// -- RequestCache --
class RequestCache {
  constructor() {
    this.pending = new Map();
  }

  async getOrFetch(key, fetchFn) {
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }
    const promise = fetchFn().finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
}

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

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();

    if (!content || content.trim().length === 0) {
      throw new Error('Empty file');
    }

    return content;
  } catch (error) {
    log.error({
      error: error.message,
      stack: error.stack,
      fileId,
    }, 'Failed to read file content');
    throw new Error(`Failed to read file: ${error.message}`);
  }
};

// -- processBulkBioAdvanced --
const processBulkBioAdvanced = async (
  ctx,
  socket,
  numbers,
  userId,
  noProgress = false,
) => {
  const total = numbers.length;
  const results = {
    hasBio: [],
    noBio: [],
    unregistered: [],
    rateLimit: [],
    hasWebsite: [],
    hasEmail: [],
  };

  const rateLimiter = new AdaptiveRateLimiter();
  const cache = new RequestCache();

  let processed = 0;
  let lastProgressText = '';
  const startTime = Date.now();

  let progressMsg = null;
  if (!noProgress) {
    progressMsg = await ctx.reply(
      `🚀 Processing ${total} numbers...\n` +
      'Processing: Optimized mode (20/sec start)...\n' +
      `📊 0/${total} (0%)\n` +
      '⚡ Parallel API + Smart rate limiting',
    );
  }

  const updateProgress = async () => {
    if (noProgress) {
      return;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const percent = Math.round((processed / total) * 100);
    const speed = (processed / (Date.now() - startTime)) * 1000;

    const progressText =
      `🚀 Processing ${total} numbers...\n` +
      `Has Bio: ${results.hasBio.length}\n` +
      `⚪ No Bio: ${results.noBio.length}\n` +
      `⚠️ Unregistered: ${results.unregistered.length}\n` +
      `⏸️ Rate Limited: ${results.rateLimit.length}\n` +
      `📊 ${processed}/${total} (${percent}%)\n` +
      `⚡ Rate: ${rateLimiter.currentRate}/sec | Speed: ${speed.toFixed(1)}/sec\n` +
      `⏱️ Time: ${elapsed}s`;

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

  const fetchBioAdaptive = async (number, userIdContext) => {
    return cache.getOrFetch(number, async () => {
      try {
        const result = await fetchBioForUser(socket, number, true, userIdContext);

        if (result.category === 'hasBio') {
          results.hasBio.push({
            phone: result.phone,
            bio: result.bio,
            setAt: result.setAt,
            accountType: result.accountType,
            isBusiness: result.isBusiness,
          });

          if (result.isBusiness && result.websites && result.websites.length > 0) {
            results.hasWebsite.push({
              phone: result.phone,
              websites: result.websites,
              email: result.email,
            });
          }

          if (result.isBusiness && result.email) {
            results.hasEmail.push({
              phone: result.phone,
              email: result.email,
              websites: result.websites || [],
            });
          }

          rateLimiter.recordSuccess();
          return result;
        }

        if (result.category === 'noBio') {
          results.noBio.push({
            phone: number,
            accountType: result.accountType,
            isBusiness: result.isBusiness,
          });

          if (result.isBusiness && result.websites && result.websites.length > 0) {
            results.hasWebsite.push({
              phone: result.phone,
              websites: result.websites,
              email: result.email,
            });
          }

          if (result.isBusiness && result.email) {
            results.hasEmail.push({
              phone: result.phone,
              email: result.email,
              websites: result.websites || [],
            });
          }

          rateLimiter.recordSuccess();
          return result;
        }

        if (result.category === 'unregistered') {
          results.unregistered.push(number);
          rateLimiter.recordSuccess();
          return result;
        }

        if (result.category === 'rateLimit') {
          results.rateLimit.push(number);
          rateLimiter.recordError(true);
          throw new Error('Rate limit - will retry');
        }

        results.rateLimit.push(number);
        rateLimiter.recordError(false);
        return result;
      } catch (error) {
        results.rateLimit.push(number);
        rateLimiter.recordError(true);
        throw error;
      }
    });
  };

  const processBatch = async (batch, userIdContext) => {
    const queue = new PQueue({
      concurrency: 3,
      interval: 100,
      intervalCap: 3,
    });

    for (const number of batch) {
      queue.add(async () => {
        await fetchBioAdaptive(number, userIdContext);
        processed++;

        if (processed % Math.ceil(total / 20) === 0 || processed === total) {
          await updateProgress();
        }

        const delay = rateLimiter.getDelay();
        await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
      });

      await new Promise((resolve) => globalThis.setImmediate(resolve));
    }

    await queue.onIdle();
  };

  const batchSize = 50;
  const batches = [];
  for (let i = 0; i < total; i += batchSize) {
    batches.push(numbers.slice(i, i + batchSize));
  }

  log.info(`[ADVANCED] Split ${total} numbers into ${batches.length} batches (50 per batch)`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    log.info(`[BATCH ${i + 1}/${batches.length}] Processing ${batch.length} numbers`);
    await processBatch(batch, userId);

    if (i < batches.length - 1) {
      const batchDelay = 200;
      log.info(`[BATCH] Yielding ${batchDelay}ms for other requests...`);
      await new Promise((resolve) => globalThis.setTimeout(resolve, batchDelay));
      await new Promise((resolve) => globalThis.setImmediate(resolve));
    }
  }

  await updateProgress();
  return results;
};



// -- extractYearsFromBio --
const extractYearsFromBio = (bioText) => {
  if (!bioText) {
    return [];
  }

  const yearPattern = /\b(19\d{2}|20\d{2})\b/g;
  const matches = bioText.match(yearPattern);

  if (!matches) {
    return [];
  }

  const years = matches.map(y => parseInt(y, 10));
  return [...new Set(years)].sort((a, b) => b - a);
};

// -- generateBioTxt --
const generateBioTxt = (results) => {
  const lines = [];
  const yearStats = {};

  results.hasBio.forEach((r) => {
    let badge = '';
    if (r.isBusiness) {
      badge = ' 💼 [WhatsApp Business]';
    }
    lines.push(`${r.phone}${badge}`);
    lines.push(`Bio: ${r.bio}`);
    lines.push(`Set: ${r.setAt}`);

    const setAtYears = extractYearsFromBio(r.setAt);
    if (setAtYears.length > 0) {
      const year = setAtYears[0];
      yearStats[year] = (yearStats[year] || 0) + 1;
    }

    lines.push('');
  });

  if (Object.keys(yearStats).length > 0) {
    lines.push('=== BIO SET YEAR STATISTICS ===');
    const sortedYears = Object.keys(yearStats).sort((a, b) => b - a);
    sortedYears.forEach(year => {
      lines.push(`${year}: ${yearStats[year]} bios`);
    });
  }

  return lines.join('\n');
};

// -- generateNoBioTxt --
const generateNoBioTxt = (results) => {
  const lines = [];

  results.noBio.forEach((r) => {
    const phone = typeof r === 'string' ? r : r.phone;
    let badge = '';

    if (typeof r === 'object') {
      if (r.isBusiness) {
        badge = ' 💼 [WhatsApp Business]';
      }
    }

    lines.push(`${phone}${badge}`);
  });

  return lines.join('\n');
};

// -- generateNotRegisterTxt --
const generateNotRegisterTxt = (results) => {
  const lines = [];

  results.unregistered.forEach((phone) => {
    lines.push(phone);
  });

  results.rateLimit.forEach((phone) => {
    lines.push(phone);
  });

  return lines.join('\n');
};

// -- generateWebsiteTxt --
const generateWebsiteTxt = (results) => {
  const lines = [];

  results.hasWebsite.forEach((r) => {
    lines.push(`${r.phone} 💼`);
    lines.push(`Website: ${r.websites.join(', ')}`);
    if (r.email) {
      lines.push(`Email: ${r.email}`);
    }
    lines.push('');
  });

  return lines.join('\n');
};

// -- generateEmailTxt --
const generateEmailTxt = (results) => {
  const lines = [];

  results.hasEmail.forEach((r) => {
    lines.push(`${r.phone} 💼`);
    lines.push(`Email: ${r.email}`);
    if (r.websites && r.websites.length > 0) {
      lines.push(`Website: ${r.websites.join(', ')}`);
    }
    lines.push('');
  });

  return lines.join('\n');
};

// -- generateRemainingNumbersTxt --
const generateRemainingNumbersTxt = (remainingNumbers) => {
  const lines = ['=== UNPROCESSED NUMBERS ==='];
  lines.push(`Total: ${remainingNumbers.length} numbers`);
  lines.push('');
  lines.push('Resend the numbers below to continue bio check:');
  lines.push('');
  remainingNumbers.forEach((phone) => {
    lines.push(phone);
  });
  lines.push('');
  lines.push('--- COPY FROM HERE ---');
  return lines.join('\n');
};

// -- handleCheckBioCommand --
export const handleCheckBioCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    log.info(`[CHECK-BIO] User ${userId} requested check bio`);

    const cooldown = await checkCooldown(userId, 'checkbio', 20);
    if (cooldown.onCooldown) {
      await ctx.reply(
        'Processing: *Cooldown Active*\n\n' +
        `Wait ${cooldown.remainingSeconds} seconds before check bio again.`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const user = await getUser(userId);

    if (!user || !user.whatsappPaired) {
      await ctx.reply('⚠️ You need to pair WhatsApp first. Press the 📱 Pair WhatsApp button.');
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
      '*Upload File:*\n' +
      'Upload file .txt containing numbers\n' +
      '💡 *Output Logic:*\n' +
      '• ≤10 numbers (text) → Telegram Message\n' +
      '• >10 numbers → 2 .txt files\n' +
      '• Upload file → 2 .txt files';

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

// -- processBioInBackground --
const processBioInBackground = async (ctx, socket, numbers, userId, isFromFile) => {
  try {
    let numbersToProcess = numbers;
    let remainingNumbers = [];

    if (numbers.length > 500) {
      numbersToProcess = numbers.slice(0, 500);
      remainingNumbers = numbers.slice(500);
      log.info(`[BG] Split: processing 500, remaining ${remainingNumbers.length}`);
    }

    const username = ctx.from?.username || `User${userId}`;
    log.info(
      `[BG-${userId}] Starting background check bio for ` +
      `${numbersToProcess.length} numbers (@${username})`,
    );

    const results = await processBulkBioAdvanced(
      ctx,
      socket,
      numbersToProcess,
      userId,
      true,
    );

    const user = await getUser(userId);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();

    const bioBizCount = results.hasBio.filter(r => r.isBusiness).length;
    const noBioBizCount = results.noBio.filter(r => r.isBusiness).length;
    const totalBizCount = bioBizCount + noBioBizCount;

    let summaryMsg = `*Bio:* ${results.hasBio.length}\n` +
      `⚪ *No bio:* ${results.noBio.length}\n` +
      `🌐 *Has Website:* ${results.hasWebsite.length}\n` +
      `📧 *Has Email:* ${results.hasEmail.length}\n` +
      `⚠️ *Not register:* ${results.unregistered.length + results.rateLimit.length}`;

    if (totalBizCount > 0) {
      summaryMsg += `\n\n💼 *Total WA Business:* ${totalBizCount}`;
    }

    if (numbersToProcess.length <= 10 && !isFromFile && remainingNumbers.length === 0) {
      await ctx.api.sendMessage(userId, summaryMsg, {
        parse_mode: 'Markdown',
        reply_markup: menu,
      });
    } else {
      await ctx.api.sendMessage(userId, summaryMsg, { parse_mode: 'Markdown' });

      if (results.hasBio.length > 0) {
        const bioTxt = generateBioTxt(results);
        const bioBuffer = globalThis.Buffer.from(bioTxt, 'utf-8');

        const yearStats = {};
        results.hasBio.forEach(r => {
          const setAtYear = extractYearsFromBio(r.setAt);
          if (setAtYear.length > 0) {
            const year = setAtYear[0];
            yearStats[year] = (yearStats[year] || 0) + 1;
          }
        });

        log.info('[YEAR-STATS] Year statistics from setAt:', yearStats);

        let bioCaption = `*Bio* (${results.hasBio.length})`;
        if (bioBizCount > 0) {
          bioCaption += `\n💼 ${bioBizCount} business accounts`;
        }

        if (Object.keys(yearStats).length > 0) {
          const sortedYears = Object.keys(yearStats).sort((a, b) => b - a);
          const yearSummary = sortedYears.map(year => {
            return `${year} (${yearStats[year]})`;
          }).join(', ');
          bioCaption += `\n📅 ${yearSummary}`;
        }

        log.info(`[CAPTION] Final bio caption: ${bioCaption}`);

        await ctx.api.sendDocument(
          userId,
          new InputFile(bioBuffer, `bio_${Date.now()}.txt`),
          {
            caption: bioCaption,
            parse_mode: 'Markdown',
          },
        );
      }

      if (results.noBio.length > 0) {
        const noBioTxt = generateNoBioTxt(results);
        const noBioBuffer = globalThis.Buffer.from(noBioTxt, 'utf-8');
        let noBioCaption = `⚪ *No bio* (${results.noBio.length})`;
        if (noBioBizCount > 0) {
          noBioCaption += `\n💼 ${noBioBizCount} business accounts`;
        }
        await ctx.api.sendDocument(
          userId,
          new InputFile(noBioBuffer, `tanpabio_${Date.now()}.txt`),
          {
            caption: noBioCaption,
            parse_mode: 'Markdown',
          },
        );
      }

      if (results.hasWebsite.length > 0) {
        const websiteTxt = generateWebsiteTxt(results);
        const websiteBuffer = globalThis.Buffer.from(websiteTxt, 'utf-8');
        await ctx.api.sendDocument(
          userId,
          new InputFile(websiteBuffer, `website_${Date.now()}.txt`),
          {
            caption: `🌐 *Has Website* (${results.hasWebsite.length})`,
            parse_mode: 'Markdown',
          },
        );
      }

      if (results.hasEmail.length > 0) {
        const emailTxt = generateEmailTxt(results);
        const emailBuffer = globalThis.Buffer.from(emailTxt, 'utf-8');
        await ctx.api.sendDocument(
          userId,
          new InputFile(emailBuffer, `email_${Date.now()}.txt`),
          {
            caption: `📧 *Has Email* (${results.hasEmail.length})`,
            parse_mode: 'Markdown',
          },
        );
      }

      if (results.unregistered.length > 0 || results.rateLimit.length > 0) {
        const notRegisterTxt = generateNotRegisterTxt(results);
        const notRegisterBuffer = globalThis.Buffer.from(
          notRegisterTxt,
          'utf-8',
        );
        const totalNotReg = results.unregistered.length + results.rateLimit.length;
        await ctx.api.sendDocument(
          userId,
          new InputFile(notRegisterBuffer, `unregistered_${Date.now()}.txt`),
          {
            caption: `⚠️ *Not register* (${totalNotReg})`,
            parse_mode: 'Markdown',
          },
        );
      }

      if (remainingNumbers.length > 0) {
        const remaining = remainingNumbers.length;
        const caption = `📌 ${remaining} numbers...remaining\nSend to continue`;
        const remainingTxt = generateRemainingNumbersTxt(remainingNumbers);
        const remainingBuffer = globalThis.Buffer.from(remainingTxt, 'utf-8');
        await ctx.api.sendDocument(
          userId,
          new InputFile(remainingBuffer, `remaining_numbers_${Date.now()}.txt`),
          {
            caption,
            reply_markup: menu,
          },
        );
      } else {
        await ctx.api.sendMessage(userId, 'Done! Select menu below:', {
          reply_markup: menu,
        });
      }
    }

    log.info(
      `[BG-${userId}] Check bio completed! ` +
      `HasBio: ${results.hasBio.length}, ` +
      `NoBio: ${results.noBio.length}, ` +
      `Unregistered: ${results.unregistered.length}, ` +
      `RateLimit: ${results.rateLimit.length}`,
    );
  } catch (error) {
    log.error({ error }, '[BG] Error in background check bio');
    try {
      await ctx.api.sendMessage(userId, `⚠️ Error: ${error.message || 'Failed cek bio'}`);
    } catch (replyErr) {
      log.error({ error: replyErr }, '[BG] Failed to send error message');
    }
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
      await ctx.reply('⚠️ WhatsApp connection disconnected. Please pair again.');
      ctx.session.waitingForBioPhone = false;
      return;
    }

    let numbers = [];
    let isFromFile = false;

    if (ctx.message?.document) {
      const doc = ctx.message.document;

      if (!doc.file_name?.endsWith('.txt')) {
        await ctx.reply('⚠️ Please upload a .txt file.');
        ctx.session.waitingForBioPhone = false;
        return;
      }

      await ctx.reply('📥 Reading file...');
      try {
        const content = await readFileContent(ctx, doc.file_id);
        numbers = parsePhoneNumbers(content);
        isFromFile = true;
      } catch (fileError) {
        log.error({
          error: fileError.message,
          stack: fileError.stack,
          docId: doc.file_id,
        }, 'Failed to read uploaded document');
        await ctx.reply(`⚠️ ${fileError.message}`);
        ctx.session.waitingForBioPhone = false;
        return;
      }
    } else if (ctx.message?.reply_to_message?.document) {
      const doc = ctx.message.reply_to_message.document;

      if (!doc.file_name?.endsWith('.txt')) {
        await ctx.reply('⚠️ Please reply to a .txt file.');
        ctx.session.waitingForBioPhone = false;
        return;
      }

      await ctx.reply('📥 Reading file...');
      try {
        const content = await readFileContent(ctx, doc.file_id);
        numbers = parsePhoneNumbers(content);
        isFromFile = true;
      } catch (fileError) {
        await ctx.reply(`⚠️ Failed to read file: ${fileError.message}`);
        ctx.session.waitingForBioPhone = false;
        return;
      }
    } else if (ctx.message?.text) {
      numbers = parsePhoneNumbers(ctx.message.text);
    }

    if (numbers.length === 0) {
      await ctx.reply('⚠️ No valid numbers found. Please send phone numbers correctly.', {
        reply_markup: cancelKeyboard(),
      });
      ctx.session.waitingForBioPhone = false;
      return;
    }

    const user = await getUser(userId);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();

    if (numbers.length === 1) {
      await ctx.reply('Processing: Fetching bio information...');

      const result = await fetchBioForUser(socket, numbers[0]);

      let message = '';
      let badge = '';

      if (result.isVerified) {
        badge = ' [Official Business]';
      } else if (result.isBusiness) {
        badge = ' 💼 [WhatsApp Business]';
      }

      if (result.category === 'hasBio') {
        message = `*Bio:* \`${result.phone}\`${badge}\n${result.bio}\n_Set: ${result.setAt}_`;

        if (result.isBusiness) {
          const extras = [];
          if (result.websites && result.websites.length > 0) {
            extras.push(`🌐 Web: ${result.websites.join(', ')}`);
          }
          if (result.email) {
            extras.push(`📧 ${result.email}`);
          }

          if (extras.length > 0) {
            message += `\n\n${extras.join('\n')}`;
          }
        }

        log.info(`[SINGLE] Bio fetched for ${result.phone}`);
      } else if (result.category === 'noBio') {
        message = `⚪ *No bio:* \`${result.phone}\`${badge}`;

        if (result.isBusiness) {
          const extras = [];
          if (result.websites && result.websites.length > 0) {
            extras.push(`🌐 Web: ${result.websites.join(', ')}`);
          }
          if (result.email) {
            extras.push(`📧 ${result.email}`);
          }

          if (extras.length > 0) {
            message += `\n\n${extras.join('\n')}`;
          }
        }

        log.warn(`[SINGLE] No bio for ${result.phone}`);
      } else if (result.category === 'unregistered') {
        message = `⚠️ *Not register:* \`${result.phone}\``;
        log.warn(`[SINGLE] Unregistered ${result.phone}`);
      } else {
        message = `⚠️ Error: ${result.error || 'Failed'}`;
        log.error(`[SINGLE] Error for ${result.phone}: ${result.error}`);
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: menu,
      });
    } else {
      if (numbers.length > 500) {
        await ctx.reply(
          '⚠️ *Too Many Numbers*\n\n' +
          `You sent ${numbers.length} numbers.\n\n` +
          'Bot can only process 500 per session.\n\n' +
          'Bot will process the first 500 numbers, ' +
          `the rest (${numbers.length - 500} numbers) ` +
          'will be returned in text format.\n\n' +
          'Continue?',
          { reply_markup: cancelKeyboard() },
        );
        ctx.session.waitingForBioPhone = false;
        return;
      }

      await ctx.reply(
        'Processing: *Starting Bio Check*\n\n' +
        `Processing ${numbers.length} numbers...\n` +
        'Results will be sent soon when complete.',
        { parse_mode: 'Markdown' },
      );

      log.info(`[HANDLER] User ${userId} started check bio for ${numbers.length} numbers`);
      log.info('[HANDLER] Spawning background task, returning to event loop');

      processBioInBackground(ctx, socket, numbers, userId, isFromFile)
        .catch((err) => {
          log.error({ error: err }, '[BG] Unhandled error in background task');
        });
    }

    ctx.session.waitingForBioPhone = false;
  } catch (error) {
    log.error({
      error: error.message,
      stack: error.stack,
      telegramId: ctx.from?.id,
      hasMessage: !!ctx.message,
      hasDocument: !!ctx.message?.document,
    }, 'Error handling bio phone input');
    await ctx.reply(`⚠️ Error: ${error.message || 'Failed to check bio'}`);
    ctx.session.waitingForBioPhone = false;
  }
};
