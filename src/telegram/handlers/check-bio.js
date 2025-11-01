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
    this.currentRate = 10;
    this.minRate = 3;
    this.maxRate = 10;
    this.errorCount = 0;
    this.successCount = 0;
    this.baseDelay = 100;
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
    const content = await response.text();

    return content;
  } catch (error) {
    log.error({ error }, 'Failed to read file content');
    throw new Error('Failed to read file');
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
      '⏳ Adaptive mode (10/sec start)...\n' +
      `📊 0/${total} (0%)\n` +
      '⚡ Smart rate limiting active',
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
      `✅ Ada Bio: ${results.hasBio.length}\n` +
      `⚪ Gak Ada Bio: ${results.noBio.length}\n` +
      `❌ Tidak Terdaftar: ${results.unregistered.length}\n` +
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
          });
          rateLimiter.recordSuccess();
          return result;
        }

        if (result.category === 'noBio') {
          results.noBio.push(number);
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
      concurrency: 1,
      interval: 200,
      intervalCap: 1,
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

  const batchSize = 20;
  const batches = [];
  for (let i = 0; i < total; i += batchSize) {
    batches.push(numbers.slice(i, i + batchSize));
  }

  log.info(`[ADVANCED] Split ${total} numbers into ${batches.length} batches (20 per batch)`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    log.info(`[BATCH ${i + 1}/${batches.length}] Processing ${batch.length} numbers`);
    await processBatch(batch, userId);

    if (i < batches.length - 1) {
      const batchDelay = 500;
      log.info(`[BATCH] Yielding ${batchDelay}ms for other requests...`);
      await new Promise((resolve) => globalThis.setTimeout(resolve, batchDelay));
      await new Promise((resolve) => globalThis.setImmediate(resolve));
    }
  }

  await updateProgress();
  return results;
};



// -- generateBioTxt --
const generateBioTxt = (results) => {
  const lines = [];

  results.hasBio.forEach((r) => {
    lines.push(r.phone);
  });

  return lines.join('\n');
};

// -- generateNoBioTxt --
const generateNoBioTxt = (results) => {
  const lines = [];

  results.noBio.forEach((phone) => {
    lines.push(phone);
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

// -- generateRemainingNumbersTxt --
const generateRemainingNumbersTxt = (remainingNumbers) => {
  const lines = ['=== NOMOR YANG BELUM DIPROSES ==='];
  lines.push(`Total: ${remainingNumbers.length} nomor`);
  lines.push('');
  lines.push('Kirim ulang nomor di bawah untuk lanjut check bio:');
  lines.push('');
  remainingNumbers.forEach((phone) => {
    lines.push(phone);
  });
  lines.push('');
  lines.push('--- COPY DARI SINI ---');
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
        '⏳ *Cooldown Aktif*\n\n' +
        `Tunggu ${cooldown.remainingSeconds} detik lagi sebelum check bio lagi.`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const user = await getUser(userId);

    if (!user || !user.whatsappPaired) {
      await ctx.reply('❌ Lo perlu pair WhatsApp dulu. Tekan tombol 📱 Pair WhatsApp.');
      return;
    }

    log.info(`[CHECK-BIO] User ${userId} is paired, showing options`);
    const msg = '🔍 *Check Bio*\n\n' +
      '*Nomor Tunggal:*\n' +
      'Kirim 1 nomor telepon\n' +
      'Contoh: `6281234567890`\n\n' +
      '*Banyak Nomor:*\n' +
      'Kirim nomor (satu per baris)\n' +
      'Contoh:\n' +
      '```\n' +
      '6281234567890\n' +
      '6289876543210\n' +
      '```\n\n' +
      '*Upload File:*\n' +
      'Upload file .txt yang isi nomor\n\n' +
      '💡 *Logika Output:*\n' +
      '• ≤10 nomor (text) → Pesan Telegram\n' +
      '• >10 nomor → 2 file .txt\n' +
      '• Upload file → 2 file .txt';

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

    if (numbersToProcess.length <= 10 && !isFromFile && remainingNumbers.length === 0) {
      await ctx.api.sendMessage(userId,
        `✅ *Bio:* ${results.hasBio.length}\n` +
        `⚪ *No bio:* ${results.noBio.length}\n` +
        `❌ *Not register:* ${results.unregistered.length + results.rateLimit.length}`,
        {
          parse_mode: 'Markdown',
          reply_markup: menu,
        },
      );
    } else {
      await ctx.api.sendMessage(
        userId,
        `✅ *Bio:* ${results.hasBio.length}\n` +
        `⚪ *No bio:* ${results.noBio.length}\n` +
        `❌ *Not register:* ${results.unregistered.length + results.rateLimit.length}`,
        { parse_mode: 'Markdown' },
      );

      if (results.hasBio.length > 0) {
        const bioTxt = generateBioTxt(results);
        const bioBuffer = globalThis.Buffer.from(bioTxt, 'utf-8');
        await ctx.api.sendDocument(
          userId,
          new InputFile(bioBuffer, `bio_${Date.now()}.txt`),
          {
            caption: `✅ *Bio* (${results.hasBio.length})`,
            parse_mode: 'Markdown',
          },
        );
      }

      if (results.noBio.length > 0) {
        const noBioTxt = generateNoBioTxt(results);
        const noBioBuffer = globalThis.Buffer.from(noBioTxt, 'utf-8');
        await ctx.api.sendDocument(
          userId,
          new InputFile(noBioBuffer, `nobio_${Date.now()}.txt`),
          {
            caption: `⚪ *No bio* (${results.noBio.length})`,
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
          new InputFile(notRegisterBuffer, `notregister_${Date.now()}.txt`),
          {
            caption: `❌ *Not register* (${totalNotReg})`,
            parse_mode: 'Markdown',
          },
        );
      }

      if (remainingNumbers.length > 0) {
        const remaining = remainingNumbers.length;
        const caption = `📌 ${remaining} nomor belum diproses\nKirim ulang untuk lanjut`;
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
        await ctx.api.sendMessage(userId, '✅ Selesai! Pilih menu di bawah:', {
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
      await ctx.api.sendMessage(userId, `❌ Error: ${error.message || 'Gagal cek bio'}`);
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
      await ctx.reply('❌ Koneksi WhatsApp putus. Pair lagi dong.');
      ctx.session.waitingForBioPhone = false;
      return;
    }

    let numbers = [];
    let isFromFile = false;

    if (ctx.message?.document) {
      const doc = ctx.message.document;

      if (!doc.file_name?.endsWith('.txt')) {
        await ctx.reply('❌ Upload file .txt dong');
        ctx.session.waitingForBioPhone = false;
        return;
      }

      await ctx.reply('📥 Baca file dulu...');
      const content = await readFileContent(ctx, doc.file_id);
      numbers = parsePhoneNumbers(content);
      isFromFile = true;
    } else if (ctx.message?.reply_to_message?.document) {
      const doc = ctx.message.reply_to_message.document;

      if (!doc.file_name?.endsWith('.txt')) {
        await ctx.reply('❌ Reply ke file .txt dong');
        ctx.session.waitingForBioPhone = false;
        return;
      }

      await ctx.reply('📥 Baca file dulu...');
      try {
        const content = await readFileContent(ctx, doc.file_id);
        numbers = parsePhoneNumbers(content);
        isFromFile = true;
      } catch (fileError) {
        await ctx.reply(`❌ Gagal baca file: ${fileError.message}`);
        ctx.session.waitingForBioPhone = false;
        return;
      }
    } else if (ctx.message?.text) {
      numbers = parsePhoneNumbers(ctx.message.text);
    }

    if (numbers.length === 0) {
      await ctx.reply('❌ Gak ada nomor yang valid. Kirim nomor telepon yang bener.', {
        reply_markup: cancelKeyboard(),
      });
      ctx.session.waitingForBioPhone = false;
      return;
    }

    const user = await getUser(userId);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();

    if (numbers.length === 1) {
      await ctx.reply('⏳ Ambil info bio dulu...');

      const result = await fetchBioForUser(socket, numbers[0]);

      let message = '';

      if (result.category === 'hasBio') {
        message = `✅ *Bio:* \`${result.phone}\`\n${result.bio}`;
        log.info(`[SINGLE] Bio fetched for ${result.phone}`);
      } else if (result.category === 'noBio') {
        message = `⚪ *No bio:* \`${result.phone}\``;
        log.warn(`[SINGLE] No bio for ${result.phone}`);
      } else if (result.category === 'unregistered') {
        message = `❌ *Not register:* \`${result.phone}\``;
        log.warn(`[SINGLE] Unregistered ${result.phone}`);
      } else {
        message = `⚠️ Error: ${result.error || 'Gagal'}`;
        log.error(`[SINGLE] Error for ${result.phone}: ${result.error}`);
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: menu,
      });
    } else {
      if (numbers.length > 500) {
        await ctx.reply(
          '⚠️ *Terlalu Banyak!*\n\n' +
          `Lo kirim ${numbers.length} nomor\n` +
          'Bot hanya bisa process 500 per session.\n\n' +
          'Bot akan proses 500 nomor dulu, ' +
          `sisanya (${numbers.length - 500} nomor) ` +
          'akan dikembaliin dalam format teks.\n\n' +
          'Lanjut?',
          { reply_markup: cancelKeyboard() },
        );
        ctx.session.waitingForBioPhone = false;
        return;
      }

      await ctx.reply(
        '⏳ *Mulai Check Bio*\n\n' +
        `Processing ${numbers.length} nomor...\n` +
        'Hasil akan dikirim segera setelah selesai.',
        { parse_mode: 'Markdown' },
      );

      log.info(`[HANDLER] User ${userId} started check bio for ${numbers.length} nomor`);
      log.info('[HANDLER] Spawning background task, returning to event loop');

      processBioInBackground(ctx, socket, numbers, userId, isFromFile)
        .catch((err) => {
          log.error({ error: err }, '[BG] Unhandled error in background task');
        });
    }

    ctx.session.waitingForBioPhone = false;
  } catch (error) {
    log.error({ error }, 'Error handling bio phone input');
    await ctx.reply(`❌ Error: ${error.message || 'Gagal cek bio'}`);
    ctx.session.waitingForBioPhone = false;
  }
};
