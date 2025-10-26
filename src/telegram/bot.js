import { Bot, session } from 'grammy';
import { createLogger } from '../logger.js';
import { config } from '../config.js';
import { checkUserExists, checkUserActive } from '../middleware/auth.js';
import { getUser } from '../db/users.js';
import {
  handlePairCommand,
  handlePhoneInput,
  handleDisconnectCommand,
} from './handlers/pairing-multi.js';
import {
  handleStatusCommand,
  handleStartCommand,
  handleHelpCommand,
  handleTextMessage,
} from './handlers/messages.js';
import {
  handleCheckBioCommand,
  handleBioPhoneInput,
} from './handlers/check-bio.js';
import {
  handleAdminUsersList,
  handleAdminAddUserStart,
  handleAdminStatus,
  handleSetTrialDaysStart,
} from './handlers/admin-buttons.js';
import {
  handleBroadcastStart,
  handleBroadcastMessage,
} from './handlers/broadcast.js';
import { handleError } from './handlers/errors.js';
import {
  addUserRoleKeyboard,
  ownerMainMenu,
  ownerPairingMenu,
} from './keyboards.js';

const log = createLogger('TelegramBot');

// -- createBot --
export const createBot = () => {
  const bot = new Bot(config.telegram.token);

  bot.use(session({ initial: () => ({}) }));

  bot.use(checkUserExists);

  bot.use(async (ctx, next) => {
    if (ctx.from?.id === Number(process.env.TELEGRAM_ADMIN_ID)) {
      return next();
    }
    return checkUserActive(ctx, next);
  });

  bot.command('start', handleStartCommand);



  bot.on('message:document', async (ctx) => {
    try {
      if (ctx.session?.waitingForBioPhone) {
        await handleBioPhoneInput(ctx);
        return;
      }
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.on('message:text', async (ctx) => {
    try {
      const text = ctx.message.text.trim();

      if (text === '🔙 Cancel') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        ctx.session.adminAddUserDays = undefined;
        ctx.session.settingTrialDays = false;
        ctx.session.waitingForBroadcast = false;
        const user = await getUser(ctx.from?.id);
        const msg = '✅ Cancelled';
        if (user?.role === 'owner') {
          await ctx.reply(msg, {
            reply_markup: ownerMainMenu(),
          });
        } else {
          await ctx.reply(msg);
        }
        return;
      }

      if (ctx.session?.waitingForBroadcast) {
        await handleBroadcastMessage(ctx);
        return;
      }

      if (text === '📱 Pairing') {
        const user = await getUser(ctx.from?.id);
        if (user?.role === 'owner') {
          ctx.session.waitingForPhone = false;
          ctx.session.waitingForBioPhone = false;
          ctx.session.adminAddUserId = undefined;
          await ctx.reply('📱 WhatsApp Pairing\n\nSelect an action:', {
            reply_markup: ownerPairingMenu(),
          });
          return;
        }
      }

      if (text === '🔙 Back') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        const user = await getUser(ctx.from?.id);
        if (user?.role === 'owner') {
          await ctx.reply('👋 Welcome, Owner!\n\nSelect what you want to do:', {
            reply_markup: ownerMainMenu(),
          });
        }
        return;
      }

      if (ctx.session?.waitingForPhone) {
        if (text === '🔙 Cancel') {
          ctx.session.waitingForPhone = false;
          await ctx.reply('✅ Pairing cancelled');
          return;
        }
        if (text !== '👤 User' && text !== '👑 Owner') {
          await handlePhoneInput(ctx);
          return;
        }
      }

      if (ctx.session?.waitingForBioPhone) {
        if (text === '🔙 Cancel') {
          ctx.session.waitingForBioPhone = false;
          await ctx.reply('✅ Bio check cancelled');
          return;
        }
        await handleBioPhoneInput(ctx);
        return;
      }



      if (ctx.session?.settingTrialDays) {
        const days = Number(text);

        if (isNaN(days) || days < 1) {
          await ctx.reply('❌ Invalid. Please enter a positive number (minimum 1 day).');
          return;
        }

        const { setTrialDays } = await import('../db/system.js');
        await setTrialDays(days);
        ctx.session.settingTrialDays = false;

        await ctx.reply(`✅ Trial duration updated to ${days} day(s)`, {
          reply_markup: ownerMainMenu(),
        });
        return;
      }

      if (ctx.session?.extendingUser) {
        const parts = text.trim().split(/\s+/);

        if (parts.length !== 2) {
          await ctx.reply(
            '❌ Invalid format. Send: `<userId> <days>`\nExample: `123456789 7`',
            { parse_mode: 'Markdown' },
          );
          return;
        }

        const userId = parts[0];
        const additionalDays = Number(parts[1]);

        if (isNaN(additionalDays) || additionalDays <= 0) {
          await ctx.reply('❌ Invalid days. Must be a positive number.');
          return;
        }

        const { extendUser } = await import('../db/users.js');
        const targetUser = await getUser(userId);

        if (!targetUser) {
          await ctx.reply(`❌ User ${userId} not found.`, {
            reply_markup: ownerMainMenu(),
          });
          ctx.session.extendingUser = false;
          return;
        }

        if (targetUser.role === 'owner') {
          await ctx.reply('❌ Cannot extend owner access (already permanent).', {
            reply_markup: ownerMainMenu(),
          });
          ctx.session.extendingUser = false;
          return;
        }

        const updatedUser = await extendUser(userId, additionalDays);

        if (!updatedUser) {
          await ctx.reply('❌ Failed to extend user.', {
            reply_markup: ownerMainMenu(),
          });
          ctx.session.extendingUser = false;
          return;
        }

        const newExpiry = new Date(updatedUser.expiryTime);
        const remainingDays = Math.ceil(
          (updatedUser.expiryTime - Date.now()) / (24 * 60 * 60 * 1000),
        );

        const { notifyUserExtended } = await import('./utils/notifications.js');
        await notifyUserExtended(ctx.api, userId, additionalDays, updatedUser.expiryTime);

        await ctx.reply(
          '✅ *User Extended Successfully!*\n\n' +
          `User ID: \`${userId}\`\n` +
          `Added: *${additionalDays} day(s)*\n` +
          `New Expiry: ${newExpiry.toLocaleString()}\n` +
          `Total Remaining: *${remainingDays} day(s)*\n\n` +
          '📩 Notification sent to user.',
          {
            parse_mode: 'Markdown',
            reply_markup: ownerMainMenu(),
          },
        );

        ctx.session.extendingUser = false;
        return;
      }

      if (ctx.session?.removingUser) {
        const userId = text.trim();

        if (!userId || userId.length < 5) {
          await ctx.reply('❌ Invalid user ID.');
          return;
        }

        const { deleteUser } = await import('../db/users.js');
        const targetUser = await getUser(userId);

        if (!targetUser) {
          await ctx.reply(`❌ User ${userId} not found.`, {
            reply_markup: ownerMainMenu(),
          });
          ctx.session.removingUser = false;
          return;
        }

        const { notifyUserRemoved } = await import('./utils/notifications.js');
        await notifyUserRemoved(ctx.api, userId);

        if (targetUser.whatsappPaired) {
          const { disconnectUserSocket } = await import('../whatsapp/socket-pool.js');
          await disconnectUserSocket(userId);
        }

        await deleteUser(userId);

        await ctx.reply(
          '✅ *User Removed Successfully!*\n\n' +
          `User ID: \`${userId}\`\n` +
          `Role: *${targetUser.role.toUpperCase()}*\n\n` +
          '🔌 WhatsApp connection disconnected\n' +
          '🗑️ User data deleted\n\n' +
          '📩 Notification sent to user.',
          {
            parse_mode: 'Markdown',
            reply_markup: ownerMainMenu(),
          },
        );

        ctx.session.removingUser = false;
        return;
      }

      if (ctx.session?.adminAddUserId && typeof ctx.session.adminAddUserId === 'number') {
        const roleMap = {
          '👤 User': 'user',
          '👑 Owner': 'owner',
        };

        const role = roleMap[text];

        if (!role) {
          await ctx.reply('❌ Invalid role. Please select from the keyboard.');
          return;
        }

        const userId = ctx.session.adminAddUserId;
        const customDays = ctx.session.adminAddUserDays;
        const { createUser } = await import('../db/users.js');

        const existingUser = await getUser(userId);

        if (existingUser && existingUser.role !== 'trial') {
          const existingRole = existingUser.role.toUpperCase();
          await ctx.reply(`❌ User ${userId} already exists with role: ${existingRole}`, {
            reply_markup: ownerMainMenu(),
          });
          ctx.session.adminAddUserId = undefined;
          ctx.session.adminAddUserDays = undefined;
          return;
        }

        if (existingUser && existingUser.role === 'trial') {
          log.info(`Upgrading trial user ${userId} to ${role}`);
        }

        const expiryDays = role === 'owner' ? null : customDays;

        await createUser(userId, role, expiryDays);

        const { notifyUserAdded } = await import('../telegram/utils/notifications.js');
        await notifyUserAdded(ctx.api, String(userId), role, expiryDays);

        const durationText = role === 'owner' ? '♾️ Permanent' :
          customDays === 0 ? '♾️ Permanent' : `${expiryDays} day(s)`;

        await ctx.reply(
          '✅ User created successfully!\n\n' +
          `ID: \`${userId}\`\n` +
          `Role: *${role.toUpperCase()}*\n` +
          `Duration: ${durationText}\n\n` +
          '📩 Notification sent to user.',
          {
            parse_mode: 'Markdown',
            reply_markup: ownerMainMenu(),
          },
        );

        ctx.session.adminAddUserId = undefined;
        ctx.session.adminAddUserDays = undefined;
        return;
      }

      if (ctx.session?.adminAddUserId === null) {
        const parts = text.trim().split(/\s+/);

        if (parts.length !== 2) {
          await ctx.reply('❌ Invalid format. Send: `<userId> <days>`\nExample: `123456789 30`', {
            parse_mode: 'Markdown',
          });
          return;
        }

        const userId = Number(parts[0]);
        const days = Number(parts[1]);

        if (isNaN(userId) || userId <= 0) {
          await ctx.reply('❌ Invalid user ID. Must be a positive number.');
          return;
        }

        if (isNaN(days) || days < 0) {
          await ctx.reply('❌ Invalid days. Must be 0 (permanent) or positive number.');
          return;
        }

        ctx.session.adminAddUserId = userId;
        ctx.session.adminAddUserDays = days;

        const message = '*User Creation Confirmed*\n\n' +
          `User ID: \`${userId}\`\n` +
          `Duration: *${days === 0 ? 'Permanent' : `${days} day(s)`}*\n\n` +
          'Select role:';

        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: addUserRoleKeyboard(),
        });
        return;
      }

      if (text === '📢 Broadcast') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleBroadcastStart(ctx);
        return;
      }

      if (text === '👥 View Users') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        ctx.match = [null, 0];
        await handleAdminUsersList(ctx);
        return;
      }

      if (text === '➕ Add User') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleAdminAddUserStart(ctx);
        return;
      }

      if (text === '📊 System Status') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleAdminStatus(ctx);
        return;
      }

      if (text === '⚙️ Set Trial Days') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        ctx.session.settingTrialDays = false;
        await handleSetTrialDaysStart(ctx);
        return;
      }

      if (text === '🔄 Extend User') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        ctx.session.extendingUser = false;
        const { handleExtendUserStart } = await import('./handlers/admin-buttons.js');
        await handleExtendUserStart(ctx);
        return;
      }

      if (text === '🗑️ Remove User') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        ctx.session.removingUser = false;
        const { handleRemoveUserStart } = await import('./handlers/admin-buttons.js');
        await handleRemoveUserStart(ctx);
        return;
      }

      if (text === '📱 Pair WhatsApp') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handlePairCommand(ctx);
        return;
      }

      if (text === '📊 Status') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleStatusCommand(ctx);
        return;
      }

      if (text === '❌ Disconnect') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleDisconnectCommand(ctx);
        return;
      }

      if (text === '❓ Help') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleHelpCommand(ctx);
        return;
      }

      if (text === '🔍 Check Bio') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleCheckBioCommand(ctx);
        return;
      }

      await handleTextMessage(ctx);
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.catch(async (err) => {
    log.error({ error: err.error }, 'Bot error');
  });

  return bot;
};

// -- startBot --
export const startBot = async (bot) => {
  try {
    log.info('Bot started successfully');
    await bot.start({
      onStart: async (botInfo) => {
        log.info(`Bot started as @${botInfo.username}`);
      },
    });
  } catch (error) {
    log.error({ error }, 'Failed to start bot');
    throw error;
  }
};
