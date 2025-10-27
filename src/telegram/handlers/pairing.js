import { createLogger } from '../../logger.js';
import { state } from '../../bridge/state.js';
import {
  requestPairingCode,
  createWhatsAppSocket,
  isSocketConnected,
} from '../../whatsapp/socket.js';
import { isValidPhoneNumber } from '../../whatsapp/utils.js';
import { formatErrorMessage, formatPairingMessage } from '../utils.js';

const log = createLogger('TelegramPairing');

// -- handlePairCommand --
export const handlePairCommand = async (ctx) => {
  try {
    if (state.getStatus().whatsapp) {
      await ctx.reply('❌ Udah pair. Pake /disconnect dulu.');
      return;
    }

    await ctx.reply(
      'Kirim nomor WhatsApp kamu dengan kode negara (contoh: +62812345678):',
    );
    ctx.session.waitingForPhone = true;
  } catch (error) {
    log.error({ error }, 'Error in pair command');
    await ctx.reply(formatErrorMessage(error));
  }
};

// -- handlePhoneInput --
export const handlePhoneInput = async (ctx) => {
  try {
    if (!ctx.session?.waitingForPhone) {
      return;
    }

    const phone = ctx.message.text.trim();

    if (!isValidPhoneNumber(phone)) {
      await ctx.reply('❌ Nomor ga valid. Coba lagi pake kode negara.');
      return;
    }

    await ctx.reply('⏳ Nyiapin koneksi WhatsApp...');

    if (!isSocketConnected()) {
      await createWhatsAppSocket();
    }

    const pairingResult = await requestPairingCode(phone);

    if (pairingResult && pairingResult.code) {
      state.setPairingCode(pairingResult.code, pairingResult.phone);
      state.setPairingContext(ctx);
      await ctx.reply(
        formatPairingMessage(pairingResult.code, pairingResult.phone),
        { parse_mode: 'Markdown' },
      );
      log.info(`Pairing code sent for ${pairingResult.phone}: ${pairingResult.code}`);
    } else {
      await ctx.reply('❌ Gagal generate pairing code. Coba lagi.');
    }

    ctx.session.waitingForPhone = false;
  } catch (error) {
    log.error({ error }, 'Error handling phone input');
    const errorMsg = formatErrorMessage(error);
    await ctx.reply(errorMsg, { parse_mode: 'Markdown' });
    ctx.session.waitingForPhone = false;
  }
};

// -- handleDisconnectCommand --
export const handleDisconnectCommand = async (ctx) => {
  try {
    const { disconnectSocket } = await import('../../whatsapp/socket.js');
    await disconnectSocket();
    state.clearPairingCode();
    await ctx.reply('✅ WhatsApp berhasil di-disconnect.');
    log.info('WhatsApp disconnected');
  } catch (error) {
    log.error({ error }, 'Error disconnecting');
    await ctx.reply(formatErrorMessage(error));
  }
};
