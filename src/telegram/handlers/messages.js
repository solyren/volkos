import { createLogger } from '../../logger.js';
import { getUser } from '../../db/users.js';
import { isUserSocketConnected } from '../../whatsapp/socket-pool.js';
import { ownerMainMenu, userMainMenu } from '../keyboards.js';
import { config } from '../../config.js';
import {
  checkGroupMembership,
  getGroupVerificationMessage,
  getGroupVerificationMarkup,
} from '../../db/groups.js';

const log = createLogger('TelegramMessages');

// -- handleStatusCommand --
export const handleStatusCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const user = await getUser(userId);

    if (!user) {
      const menu = ownerMainMenu();
      await ctx.reply('⚠️ User profile not found', {
        reply_markup: menu,
      });
      return;
    }

    const whatsappConnected = isUserSocketConnected(userId);
    const role = user.role === 'owner' ? 'OWNER' : 'USER';
    const phoneStatus = user.whatsappPhone ? `${user.whatsappPhone}` : '⚠️ Not paired';
    const connectionStatus = whatsappConnected ? 'Connected' : '⚠️ Disconnected';

    const message = '📊 *Your Status:*\n\n' +
      `Role: *${role}*\n` +
      `WhatsApp: ${phoneStatus}\n` +
      `Connection: ${connectionStatus}\n` +
      `Active: ${user.isActive ? 'Active' : 'Inactive'}`;

    const menu = user.role === 'owner' ? ownerMainMenu() : userMainMenu();
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: menu,
    });
    log.debug(`Status command executed for user ${userId}`);
  } catch (error) {
    log.error({ error }, 'Error in status command');
    const menu = ownerMainMenu();
    await ctx.reply('⚠️ Failed to retrieve status', {
      reply_markup: menu,
    });
  }
};

// -- handleStartCommand --
export const handleStartCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const ownerId = Number(process.env.TELEGRAM_ADMIN_ID);
    const isOwner = userId === ownerId;

    const groupCheck = await checkGroupMembership(ctx, userId);
    if (!groupCheck.isMember) {
      const message = getGroupVerificationMessage(groupCheck.missingGroups);
      const keyboard = getGroupVerificationMarkup(groupCheck.missingGroups);
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    }

    const { createUser, updateUser } = await import('../../db/users.js');
    let user = await getUser(userId);

    if (!user) {
      const role = isOwner ? 'owner' : 'user';
      log.info(`New ${role} detected: ${userId}`);
      await createUser(userId, role);
      user = { userId, role, isNew: true };
    } else if (isOwner && user.role !== 'owner') {
      log.info(`Updating user ${userId} role to owner`);
      await updateUser(userId, { role: 'owner' });
      user.role = 'owner';
    }

    let message = '';
    let thumbnail = '';

    if (user.role === 'owner') {
      message = '*Welcome, Owner*\n\n' +
        'You have *unlimited access* to all features.\n\n' +
        '*Control Panel:*\n' +
        '• Manage all users\n' +
        '• Configure system settings\n' +
        '• Send broadcast messages\n' +
        '• Full bot administration\n\n' +
        'Select an option from the menu below.';
      thumbnail = config.thumbnails.welcomeOwner;
    } else {
      message = '*Welcome to VOLKSBOT*\n\n' +
        'All features are available for your use.\n\n' +
        '*Features:*\n' +
        '• Connect WhatsApp account\n' +
        '• Check bio information (bulk support)\n' +
        '• Full connection access\n' +
        '• Priority support\n\n' +
        'Select an option from the menu below.';
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
      message = '*VOLKSBOT - Owner Guide*\n\n' +
        '*Owner Features:*\n' +
        '• *View Users* - List all users with status\n' +
        '• *Add User* - Create new user accounts\n' +
        '• *System Status* - View system statistics\n' +
        '• *Broadcast* - Send messages to all users\n' +
        '• *Pair WhatsApp* - Connect WhatsApp account\n' +
        '• *Check Bio* - Check WhatsApp bio (bulk support)\n\n' +
        '*Adding Users:*\n' +
        '• Send the user ID you wish to add\n' +
        '• Select role: User or Owner\n\n' +
        '*Using Check Bio:*\n' +
        '• Send 1 number → Single check\n' +
        '• Send multiple numbers → Bulk check\n' +
        '• Upload .txt file → Bulk check from file\n' +
        '• Results: ≤10 (message), >10 (file)\n\n' +
        '*Tip:* Use the Cancel button anytime to exit';
    } else {
      message = '*VOLKSBOT - User Guide*\n\n' +
        '*Available Features:*\n' +
        '• *Pair WhatsApp* - Connect your WhatsApp account\n' +
        '• *Status* - Check your connection status\n' +
        '• *Check Bio* - Check single or multiple numbers\n' +
        '• *Disconnect* - Remove WhatsApp connection\n\n' +
        '*Using Check Bio:*\n' +
        '• Send 1 number → Single check\n' +
        '• Send multiple numbers → Bulk check\n' +
        '• Upload .txt file → Bulk check from file\n' +
        '• ≤10 numbers (text) → Results in message\n' +
        '• >10 numbers OR file → 2 .txt files\n\n' +
        '*Tip:* Use the Cancel button anytime to exit';
    }

    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: menu,
    });
  } catch (error) {
    log.error({ error }, 'Error in help command');
    const menu = ownerMainMenu();
    await ctx.reply('Failed to load help information', {
      reply_markup: menu,
    });
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
