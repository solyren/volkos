import { createLogger } from '../../logger.js';
import { socketPool } from '../../db/sockets.js';
import { requestPairingCodeForUser } from '../../whatsapp/socket-pool.js';
import { isValidPhoneNumber } from '../../whatsapp/utils.js';
import { formatErrorMessage, formatPairingMessage } from '../utils.js';
import { getUser } from '../../db/users.js';
import { deleteUserAuth } from '../../whatsapp/auth-manager.js';
import { cancelKeyboard, ownerMainMenu, userMainMenu } from '../keyboards.js';

const log = createLogger('TelegramPairingMulti');

// -- handlePairCommand --
export const handlePairCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const user = await getUser(userId);

    if (user?.whatsappPaired) {
      await ctx.reply(
        '⚠️ You have already paired WhatsApp. Press the ⚠️ Disconnect button first.',
      );
      return;
    }

    log.info(`Starting fresh pairing for user ${userId}, deleting old auth`);
    await deleteUserAuth(userId);
    socketPool.removeSocket(userId);

    const msg = 'Send your WhatsApp number starting with country code ' +
      '(example: 62812345678, 1234567890, 442071838750):';
    await ctx.reply(msg, {
      reply_markup: cancelKeyboard(),
    });
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
    const user = await getUser(userId);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();
    const phone = ctx.message.text.trim();

    if (!isValidPhoneNumber(phone)) {
      await ctx.reply(
        '⚠️ Invalid number format. Send with country code ' +
        '(example: 62812345678 or 1234567890).',
        {
          reply_markup: cancelKeyboard(),
        },
      );
      ctx.session.waitingForPhone = false;
      return;
    }

    await ctx.reply('Processing: Preparing WhatsApp connection...');

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
        {
          parse_mode: 'Markdown',
          reply_markup: menu,
        },
      );
      const phone = pairingResult.phone;
      const code = pairingResult.code;
      log.info(`Pairing code sent for user ${userId}: ${phone}: ${code}`);
    } else {
      await ctx.reply('⚠️ Failed to generate pairing code. Please try again.', {
        reply_markup: menu,
      });
    }

    ctx.session.waitingForPhone = false;
  } catch (error) {
    log.error({ error }, 'Error handling phone input');
    const user = await getUser(ctx.from?.id);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();
    const errorMsg = formatErrorMessage(error);
    await ctx.reply(errorMsg, {
      parse_mode: 'Markdown',
      reply_markup: menu,
    });
    ctx.session.waitingForPhone = false;
  }
};

// -- handleDisconnectCommand --
export const handleDisconnectCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const user = await getUser(userId);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();
    const { disconnectUserSocket } = await import('../../whatsapp/socket-pool.js');
    await disconnectUserSocket(userId);
    socketPool.clearPairingCode(userId);
    await ctx.reply('WhatsApp successfully disconnected.', {
      reply_markup: menu,
    });
    log.info(`WhatsApp disconnected for user ${userId}`);
  } catch (error) {
    log.error({ error }, 'Error disconnecting');
    const user = await getUser(ctx.from?.id);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();
    await ctx.reply(formatErrorMessage(error), {
      reply_markup: menu,
    });
  }
};
