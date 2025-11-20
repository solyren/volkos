import { createLogger } from '../../logger.js';
import { getUserSocket } from '../../whatsapp/socket-pool.js';
import { formatErrorMessage } from '../utils.js';
import { getUser } from '../../db/users.js';
import { formatPhoneNumber } from '../../whatsapp/utils.js';
import { cancelKeyboard, ownerMainMenu } from '../keyboards.js';
import { InputFile } from 'grammy';

const log = createLogger('TelegramDebugNumber');

// -- fetchAllBaileysInfo --
const fetchAllBaileysInfo = async (socket, phoneNumber) => {
  let jid = phoneNumber;
  if (!jid.includes('@')) {
    const cleaned = jid.replace(/\D/g, '');
    jid = `${cleaned}@s.whatsapp.net`;
  }

  const info = {
    phone: phoneNumber,
    jid,
    timestamp: new Date().toISOString(),
    methods: {},
  };

  try {
    info.methods.onWhatsApp = await socket.onWhatsApp(jid).catch((err) => ({
      error: err.message,
    }));
  } catch (err) {
    info.methods.onWhatsApp = { error: err.message };
  }

  try {
    info.methods.getBusinessProfile = await socket.getBusinessProfile(jid).catch((err) => ({
      error: err.message,
    }));
  } catch (err) {
    info.methods.getBusinessProfile = { error: err.message };
  }

  try {
    info.methods.fetchStatus = await socket.fetchStatus(jid).catch((err) => ({
      error: err.message,
    }));
  } catch (err) {
    info.methods.fetchStatus = { error: err.message };
  }

  try {
    info.methods.profilePictureUrl = await socket.profilePictureUrl(jid).catch((err) => ({
      error: err.message,
    }));
  } catch (err) {
    info.methods.profilePictureUrl = { error: err.message };
  }

  try {
    info.methods.isOnWhatsApp = await socket.isOnWhatsApp(jid).catch((err) => ({
      error: err.message,
    }));
  } catch (err) {
    info.methods.isOnWhatsApp = { error: err.message };
  }

  return info;
};

// -- handleDebugCommand --
export const handleDebugCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const user = await getUser(userId);

    if (!user || user.role !== 'owner') {
      await ctx.reply('❌ Command ini hanya untuk owner.');
      return;
    }

    log.info(`[DEBUG] Owner ${userId} requested debug number`);

    if (!user.whatsappPaired) {
      await ctx.reply('❌ Lo perlu pair WhatsApp dulu. Tekan tombol 📱 Pair WhatsApp.');
      return;
    }

    const msg =
      '🔍 *Debug Number*\n\n' +
      '*Eksplorasi Full Baileys API*\n\n' +
      'Kirim 1 nomor telepon untuk debug:\n' +
      'Contoh: `6281234567890`\n\n' +
      '💡 *Output:*\n' +
      '• onWhatsApp()\n' +
      '• getBusinessProfile()\n' +
      '• fetchStatus()\n' +
      '• profilePictureUrl()\n' +
      '• isOnWhatsApp()\n\n' +
      'Format: JSON (message atau file)';

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });

    ctx.session.waitingForDebugPhone = true;
  } catch (error) {
    log.error({ error }, 'Error in debug command');
    await ctx.reply(formatErrorMessage(error));
  }
};

// -- handleDebugPhoneInput --
export const handleDebugPhoneInput = async (ctx) => {
  try {
    if (!ctx.session?.waitingForDebugPhone) {
      return;
    }

    const userId = ctx.from?.id;
    const socket = getUserSocket(userId);

    if (!socket || !socket.user) {
      await ctx.reply('❌ Koneksi WhatsApp putus. Pair lagi dong.');
      ctx.session.waitingForDebugPhone = false;
      return;
    }

    const input = ctx.message?.text?.trim();
    if (!input || !/^\d+$/.test(input)) {
      await ctx.reply('❌ Kirim nomor telepon yang valid (hanya angka).', {
        reply_markup: cancelKeyboard(),
      });
      return;
    }

    const phoneNumber = formatPhoneNumber(input);
    await ctx.reply(`⏳ Fetching Baileys API data untuk ${phoneNumber}...`);

    log.info(`[DEBUG] Fetching all info for ${phoneNumber}`);
    const info = await fetchAllBaileysInfo(socket, phoneNumber);

    const jsonStr = JSON.stringify(info, null, 2);
    log.info(`[DEBUG] Response size: ${jsonStr.length} chars`);

    if (jsonStr.length < 4000) {
      const msg = `🔍 *Debug Result*\n\n\`\`\`json\n${jsonStr}\n\`\`\``;
      await ctx.reply(msg, {
        parse_mode: 'Markdown',
        reply_markup: ownerMainMenu(),
      });
    } else {
      const buffer = globalThis.Buffer.from(jsonStr, 'utf-8');
      await ctx.replyWithDocument(
        new InputFile(buffer, `debug_${phoneNumber}_${Date.now()}.json`),
        {
          caption: `🔍 *Debug Result untuk ${phoneNumber}*`,
          parse_mode: 'Markdown',
          reply_markup: ownerMainMenu(),
        },
      );
    }

    log.info(`[DEBUG] Completed for ${phoneNumber}`);
    ctx.session.waitingForDebugPhone = false;
  } catch (error) {
    log.error({ error }, 'Error handling debug phone input');
    await ctx.reply(`❌ Error: ${error.message || 'Gagal debug nomor'}`);
    ctx.session.waitingForDebugPhone = false;
  }
};
