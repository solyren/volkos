import { createLogger } from '../../logger.js';
import { socketPool } from '../../db/sockets.js';
import { requestPairingCodeForUser } from '../../whatsapp/socket-pool.js';
import { isValidPhoneNumber } from '../../whatsapp/utils.js';
import { formatErrorMessage, formatPairingMessage } from '../utils.js';
import { getUser } from '../../db/users.js';
import { deleteUserAuth } from '../../whatsapp/auth-manager.js';

const log = createLogger('TelegramPairingMulti');

// -- handlePairCommand --
export const handlePairCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const user = await getUser(userId);

    if (user?.whatsappPaired) {
      await ctx.reply(
        '❌ You already have a WhatsApp number paired. Press ❌ Disconnect button first.',
      );
      return;
    }

    log.info(`Starting fresh pairing for user ${userId}, deleting old auth`);
    await deleteUserAuth(userId);
    socketPool.removeSocket(userId);

    const msg = 'Please enter your WhatsApp phone number with country code ' +
      '(e.g., +62812345678):';
    await ctx.reply(msg);
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

    const userId = ctx.from?.id;
    const phone = ctx.message.text.trim();

    if (!isValidPhoneNumber(phone)) {
      await ctx.reply('❌ Invalid phone number. Please try again with country code.');
      return;
    }

    await ctx.reply('⏳ Initializing WhatsApp connection...');

    const pairingResult = await requestPairingCodeForUser(userId, phone);

    if (pairingResult && pairingResult.code) {
      socketPool.setPairingCode(
        userId,
        pairingResult.code,
        pairingResult.phone,
        ctx,
      );
      await ctx.reply(
        formatPairingMessage(pairingResult.code, pairingResult.phone),
        { parse_mode: 'Markdown' },
      );
      const phone = pairingResult.phone;
      const code = pairingResult.code;
      log.info(`Pairing code sent for user ${userId}: ${phone}: ${code}`);
    } else {
      await ctx.reply('❌ Failed to generate pairing code. Try again.');
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
    const userId = ctx.from?.id;
    const { disconnectUserSocket } = await import('../../whatsapp/socket-pool.js');
    await disconnectUserSocket(userId);
    socketPool.clearPairingCode(userId);
    await ctx.reply('✅ WhatsApp disconnected successfully.');
    log.info(`WhatsApp disconnected for user ${userId}`);
  } catch (error) {
    log.error({ error }, 'Error disconnecting');
    await ctx.reply(formatErrorMessage(error));
  }
};
