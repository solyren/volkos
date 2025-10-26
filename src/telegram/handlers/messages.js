import { createLogger } from '../../logger.js';
import { getUser } from '../../db/users.js';
import { isUserSocketConnected } from '../../whatsapp/socket-pool.js';
import { ownerMainMenu, userMainMenu } from '../keyboards.js';
import { config } from '../../config.js';

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

      if (isOwner) {
        await createUser(userId, 'owner', null);
      } else {
        const { getTrialDays } = await import('../../db/system.js');
        const trialDays = await getTrialDays();
        await createUser(userId, 'trial', trialDays);
      }

      user = { userId, role, isNew: true };
    } else if (isOwner && user.role !== 'owner') {
      log.info(`Updating user ${userId} role to owner`);
      await updateUser(userId, { role: 'owner' });
      user.role = 'owner';
    }

    let message = '';
    let thumbnail = '';

    if (user.role === 'owner') {
      message = '👑 *Welcome, Owner!*\n\n' +
        '✨ You have *unlimited access* to all features.\n\n' +
        '⏳ *Access Status:* Permanent (♾️)\n\n' +
        '💼 *Control Panel:*\n' +
        '• Manage all users\n' +
        '• Configure system settings\n' +
        '• Broadcast messages\n' +
        '• Full bot access\n\n' +
        '💡 Select an option below to continue:';
      thumbnail = config.thumbnails.welcomeOwner;
    } else if (user.role === 'trial') {
      const now = Date.now();
      const expiryTime = user.expiryTime || 0;
      const remainingMs = expiryTime - now;
      const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));

      const timeText = remainingDays > 0 ?
        `${remainingDays} day(s)` :
        remainingHours > 0 ? `${remainingHours} hour(s)` : 'Expired';

      message = '🎉 *Welcome to VOLKSBOT!*\n\n' +
        '✨ You are using a *Trial Account*\n\n' +
        `⏳ *Time Remaining:* ${timeText}\n` +
        `📅 *Expires:* ${new Date(expiryTime).toLocaleString()}\n\n` +
        '🚀 *Available Features:*\n' +
        '• Pair WhatsApp account\n' +
        '• Check bio (bulk)\n' +
        '• Connection management\n\n' +
        '💡 Contact owner to upgrade your access!\n\n' +
        '👇 Select an option below:';
      thumbnail = config.thumbnails.welcomeTrial;
    } else {
      const now = Date.now();
      const expiryTime = user.expiryTime;

      if (expiryTime && expiryTime > 0) {
        const remainingMs = expiryTime - now;
        const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

        message = '🎉 *Welcome to VOLKSBOT!*\n\n' +
          '✨ You have *Premium Access*\n\n' +
          `⏳ *Access Duration:* ${remainingDays} day(s) remaining\n` +
          `📅 *Expires:* ${new Date(expiryTime).toLocaleString()}\n\n` +
          '🚀 *Available Features:*\n' +
          '• Pair WhatsApp account\n' +
          '• Check bio (bulk turbo mode)\n' +
          '• Full connection management\n' +
          '• Priority support\n\n' +
          '👇 Select an option below:';
      } else {
        message = '🎉 *Welcome to VOLKSBOT!*\n\n' +
          '✨ You have *Permanent Access*\n\n' +
          '⏳ *Access Status:* Unlimited (♾️)\n\n' +
          '🚀 *Available Features:*\n' +
          '• Pair WhatsApp account\n' +
          '• Check bio (bulk turbo mode)\n' +
          '• Full connection management\n' +
          '• Priority support\n\n' +
          '👇 Select an option below:';
      }
      thumbnail = config.thumbnails.welcomeUser;
    }

    if (thumbnail && thumbnail.trim() !== '') {
      try {
        await ctx.replyWithPhoto(thumbnail, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: user.role === 'owner' ? ownerMainMenu() : userMainMenu(),
        });
      } catch (photoError) {
        log.warn({ photoError }, 'Failed to send thumbnail, sending text only');
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: user.role === 'owner' ? ownerMainMenu() : userMainMenu(),
        });
      }
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: user.role === 'owner' ? ownerMainMenu() : userMainMenu(),
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
    const userId = ctx.from?.id;
    const user = await getUser(userId);

    let message = '';

    if (user?.role === 'owner') {
      message = '*VOLKOS Bot - Owner Guide*\n\n' +
        '*Owner Features:*\n' +
        '👥 View Users - List all users with status\n' +
        '➕ Add User - Create permanent user: `<id> <days>`\n' +
        '📊 System Status - View system statistics\n' +
        '⚙️ Set Trial Days - Configure auto trial duration\n' +
        '📢 Broadcast - Send message to all users\n' +
        '📱 Pairing - Link WhatsApp account\n' +
        '🔍 Check Bio - Check WhatsApp bios (bulk)\n\n' +
        '*Add User:*\n' +
        '• Format: `<id> <days>` (e.g. `123456789 30`)\n' +
        '• Roles: 👤 User (custom days) or 👑 Owner (permanent)\n' +
        '• Days=0 for permanent user\n\n' +
        '*Check Bio Usage:*\n' +
        '• Send 1 number → Single check\n' +
        '• Send multiple numbers → Bulk check (turbo mode)\n' +
        '• Upload .txt file → Bulk check\n' +
        '• Results: ≤10 (message), >10 (files)\n\n' +
        '*💡 Tip:* Use 🔙 Cancel button anytime to exit';
    } else {
      message = '*VOLKOS Bot - User Guide*\n\n' +
        '*Available Features:*\n' +
        '📱 Pair WhatsApp - Link your WhatsApp account\n' +
        '📊 Status - Check your connection status\n' +
        '🔍 Check Bio - Check single or multiple numbers\n' +
        '❌ Disconnect - Remove WhatsApp pairing\n\n' +
        '*How to use Check Bio:*\n' +
        '• Send 1 number → Single check\n' +
        '• Send multiple numbers → Bulk check (turbo mode)\n' +
        '• Upload .txt file → Bulk check\n' +
        '• ≤10 numbers (text) → Result in message\n' +
        '• >10 numbers OR file → 2 .txt files\n\n' +
        '*💡 Tip:* Use 🔙 Cancel button anytime to exit';
    }

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
