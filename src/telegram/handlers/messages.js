import { createLogger } from '../../logger.js';
import { getUser } from '../../db/users.js';
import { isUserSocketConnected } from '../../whatsapp/socket-pool.js';
import { ownerMainMenu, userMainMenu } from '../keyboards.js';

const log = createLogger('TelegramMessages');

// -- handleStatusCommand --
export const handleStatusCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const user = await getUser(userId);

    if (!user) {
      await ctx.reply('❌ User profile not found');
      return;
    }

    const whatsappConnected = isUserSocketConnected(userId);
    const role = user.role.toUpperCase();
    const phoneStatus = user.whatsappPhone ? `✅ ${user.whatsappPhone}` : '❌ Not paired';
    const connectionStatus = whatsappConnected ? '✅ Connected' : '❌ Disconnected';

    const message = '📊 *Your Status:*\n\n' +
      `Role: *${role}*\n` +
      `WhatsApp: ${phoneStatus}\n` +
      `Connection: ${connectionStatus}\n` +
      `Active: ${user.isActive ? '✅' : '❌'}`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
    log.debug(`Status command executed for user ${userId}`);
  } catch (error) {
    log.error({ error }, 'Error in status command');
    await ctx.reply('❌ Error retrieving status');
  }
};

// -- handleStartCommand --
export const handleStartCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const ownerId = Number(process.env.TELEGRAM_ADMIN_ID);
    const isOwner = userId === ownerId;
    const { createUser, updateUser } = await import('../../db/users.js');
    let user = await getUser(userId);

    if (!user) {
      const role = isOwner ? 'owner' : 'trial';
      const msg = isOwner ? `Owner detected: ${userId}` : `New trial user: ${userId}`;
      log.info(msg);
      await createUser(userId, role, isOwner ? null : 1);
      user = { userId, role, isNew: true };
    } else if (isOwner && user.role !== 'owner') {
      log.info(`Updating user ${userId} role to owner`);
      await updateUser(userId, { role: 'owner' });
      user.role = 'owner';
    }

    if (user.role === 'owner') {
      const message = '👋 Welcome, Owner!\n\nSelect what you want to do:';
      await ctx.reply(message, {
        reply_markup: ownerMainMenu(),
      });
    } else {
      const message = 'Welcome to VOLKOS Bot!\n\nSelect an action:';
      await ctx.reply(message, {
        reply_markup: userMainMenu(),
      });
    }

    log.info(`User ${userId} started bot (role: ${user.role})`);
  } catch (error) {
    log.error({ error }, 'Error in start command');
  }
};

// -- handleHelpCommand --
export const handleHelpCommand = async (ctx) => {
  try {
    const message = '*VOLKOS Bot Help*\n\n' +
      '*Available Features:*\n' +
      '📱 Pair WhatsApp - Link your WhatsApp account\n' +
      '📊 Status - Check your connection status\n' +
      '🔍 Check Bio - Check single or multiple numbers\n' +
      '❌ Disconnect - Remove WhatsApp pairing\n\n' +
      '*How to use Check Bio:*\n' +
      '• Send 1 number → Single check\n' +
      '• Send multiple numbers → Bulk check\n' +
      '• Upload .txt file → Bulk check\n' +
      '• ≤10 numbers (text) → Result in message\n' +
      '• >10 numbers OR file → 2 .txt files';

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in help command');
  }
};

// -- handleTextMessage --
export const handleTextMessage = async (ctx) => {
  try {
    const message = ctx.message.text;
    log.debug(`Text message received: ${message.substring(0, 50)}`);
  } catch (error) {
    log.error({ error }, 'Error handling text message');
  }
};
