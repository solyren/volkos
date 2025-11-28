import { Bot, session } from 'grammy';
import { createLogger } from '../logger.js';
import { config } from '../config.js';
import { checkUserExists, checkUserActive } from '../middleware/auth.js';
import { getUser } from '../db/users.js';
import { checkGroupMembership } from '../db/groups.js';
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
  handleDebugCommand,
  handleDebugPhoneInput,
} from './handlers/debug-number.js';
import {
  handleAdminUsersList,
  handleAdminAddUserStart,
  handleAdminStatus,
  handleViewUserDetail,
  handleBackToUsersList,
} from './handlers/admin-buttons.js';
import {
  handleBroadcastStart,
  handleBroadcastMessage,
} from './handlers/broadcast.js';
import {
  handleOwnerEmailMenuStart,
  handleOwnerSetTemplateStart,
  handleOwnerEmailTemplateInput,
  handleOwnerViewTemplate,
  handleOwnerDeleteTemplate,
  handleUserSetupEmailStart,
  handleUserSetupEmailInput,
  handleUserFixNomorStart,
  handleUserFixNomorInput,
} from './handlers/email.js';
import { handleOwnerWAMenuStart } from './handlers/wa-menu.js';
import {
  handleConvertXlsxStart,
  handleXlsxFileInput,
} from './handlers/convert-xlsx.js';
import { handleError } from './handlers/errors.js';
import {
  addUserRoleKeyboard,
  ownerMainMenu,
  userMainMenu,
} from './keyboards.js';

const log = createLogger('TelegramBot');

// -- createBot --
export const createBot = () => {
  const bot = new Bot(config.telegram.token);

  bot.use(session({ initial: () => ({}) }));

  bot.use((ctx, next) => {
    if (ctx.chat?.type !== 'private') {
      return;
    }
    return next();
  });

  bot.use(checkUserExists);

  bot.use(async (ctx, next) => {
    const isOwner = ctx.from?.id === Number(process.env.TELEGRAM_ADMIN_ID);
    const isStartCommand = ctx.message?.text === '/start';
    if (isOwner || isStartCommand) {
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
      if (ctx.session?.convertingXlsx) {
        await handleXlsxFileInput(ctx);
        return;
      }
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.on('callback_query:data', async (ctx) => {
    try {
      const data = ctx.callbackQuery.data;

      if (data === 'verify_group') {
        const userId = ctx.from?.id;
        const groupCheck = await checkGroupMembership(ctx, userId);

        if (groupCheck.isMember) {
          await ctx.answerCallbackQuery({
            text: 'Verification successful! Access granted.',
            show_alert: false,
          });
          await ctx.deleteMessage();
          await handleStartCommand(ctx);
        } else {
          await ctx.answerCallbackQuery({
            text: '❌ You have not joined all required groups. Please try again after joining.',
            show_alert: true,
          });
        }
        return;
      }

      if (data.startsWith('view_user:')) {
        await handleViewUserDetail(ctx);
        return;
      }

      if (data === 'back_to_users') {
        await handleBackToUsersList(ctx);
        return;
      }

      await ctx.answerCallbackQuery();
    } catch (error) {
      await handleError(ctx, error);
    }
  });

  bot.on('message:text', async (ctx) => {
    try {
      const text = ctx.message.text.trim();

      if (text === 'Cancel') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.waitingForDebugPhone = false;
        ctx.session.adminAddUserId = undefined;
        ctx.session.adminAddUserDays = undefined;
        ctx.session.waitingForBroadcast = false;
        ctx.session.settingEmailTemplate = false;
        ctx.session.setupEmail = undefined;
        ctx.session.fixingNomor = false;
        ctx.session.removingUser = false;
        const user = await getUser(ctx.from?.id);
        const msg = 'Cancelled';
        if (user?.role === 'owner') {
          await ctx.reply(msg, {
            reply_markup: ownerMainMenu(),
          });
        } else {
          await ctx.reply(msg, {
            reply_markup: userMainMenu(),
          });
        }
        return;
      }

      if (ctx.session?.waitingForDebugPhone) {
        if (text.startsWith('/')) {
          return;
        }
        await handleDebugPhoneInput(ctx);
        return;
      }

      if (ctx.session?.waitingForBroadcast) {
        await handleBroadcastMessage(ctx);
        return;
      }

      if (ctx.session?.settingEmailTemplate) {
        await handleOwnerEmailTemplateInput(ctx, text);
        return;
      }

      if (ctx.session?.setupEmail) {
        await handleUserSetupEmailInput(ctx, text);
        return;
      }

      if (ctx.session?.fixingNomor) {
        await handleUserFixNomorInput(ctx, text);
        return;
      }

      if (text === 'WhatsApp Menu') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleOwnerWAMenuStart(ctx);
        return;
      }

      if (text === 'Back') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.waitingForDebugPhone = false;
        ctx.session.adminAddUserId = undefined;
        const user = await getUser(ctx.from?.id);
        if (user?.role === 'owner') {
          await ctx.reply('👋 Hello, Owner.\n\nWhat would you like to do?', {
            reply_markup: ownerMainMenu(),
          });
        }
        return;
      }

      if (text === '/debug') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.waitingForDebugPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleDebugCommand(ctx);
        return;
      }

      if (ctx.session?.waitingForPhone) {
        if (text === 'Cancel') {
          ctx.session.waitingForPhone = false;
          await ctx.reply('Pairing cancelled');
          return;
        }
        if (text !== 'User' && text !== 'Owner') {
          await handlePhoneInput(ctx);
          return;
        }
      }

      if (ctx.session?.waitingForBioPhone) {
        if (text === 'Cancel') {
          ctx.session.waitingForBioPhone = false;
          await ctx.reply('Bio check cancelled');
          return;
        }
        await handleBioPhoneInput(ctx);
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
          '*User Removed Successfully!*\n\n' +
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
          'User': 'user',
          'Owner': 'owner',
        };

        const role = roleMap[text];

        if (!role) {
          await ctx.reply('❌ Invalid role. Please select from the keyboard.');
          return;
        }

        const userId = ctx.session.adminAddUserId;
        const { createUser } = await import('../db/users.js');

        const existingUser = await getUser(userId);

        if (existingUser) {
          const existingRole = existingUser.role.toUpperCase();
          await ctx.reply(`❌ User ${userId} already exists with role: ${existingRole}`, {
            reply_markup: ownerMainMenu(),
          });
          ctx.session.adminAddUserId = undefined;
          return;
        }

        await createUser(userId, role);

        const { notifyUserAdded } = await import('../telegram/utils/notifications.js');
        await notifyUserAdded(ctx.api, String(userId), role, null);

        await ctx.reply(
          'User created successfully!\n\n' +
          `ID: \`${userId}\`\n` +
          `Role: *${role.toUpperCase()}*\n\n` +
          '📩 Notification sent to user.',
          {
            parse_mode: 'Markdown',
            reply_markup: ownerMainMenu(),
          },
        );

        ctx.session.adminAddUserId = undefined;
        return;
      }

      if (ctx.session?.adminAddUserId === null) {
        const userId = Number(text.trim());

        if (isNaN(userId) || userId <= 0) {
          await ctx.reply('❌ Invalid user ID. Must be a positive number.');
          return;
        }

        ctx.session.adminAddUserId = userId;

        const message = '*User Creation Confirmed*\n\n' +
          `User ID: \`${userId}\`\n\n` +
          'Select role:';

        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: addUserRoleKeyboard(),
        });
        return;
      }

      if (text === 'Broadcast') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleBroadcastStart(ctx);
        return;
      }

      if (text === 'View Users') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        ctx.match = [null, 0];
        await handleAdminUsersList(ctx);
        return;
      }

      if (text === 'Add User') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleAdminAddUserStart(ctx);
        return;
      }

      if (text === 'System Status') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleAdminStatus(ctx);
        return;
      }



      if (text === 'Remove User') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        ctx.session.removingUser = false;
        const { handleRemoveUserStart } = await import('./handlers/admin-buttons.js');
        await handleRemoveUserStart(ctx);
        return;
      }

      if (text === 'Pair WhatsApp') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handlePairCommand(ctx);
        return;
      }

      if (text === 'Status') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleStatusCommand(ctx);
        return;
      }

      if (text === 'Disconnect') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleDisconnectCommand(ctx);
        return;
      }

      if (text === 'Help') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleHelpCommand(ctx);
        return;
      }

      if (text === 'Check Bio') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleCheckBioCommand(ctx);
        return;
      }

      if (text === 'Email Menu') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleOwnerEmailMenuStart(ctx);
        return;
      }

      if (text === 'Convert XLSX') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleConvertXlsxStart(ctx);
        return;
      }

      if (text === 'Set Template') {
        await handleOwnerSetTemplateStart(ctx);
        return;
      }

      if (text === 'View Template') {
        await handleOwnerViewTemplate(ctx);
        return;
      }

      if (text === 'Delete Template') {
        await handleOwnerDeleteTemplate(ctx);
        return;
      }

      if (text === 'Setup Email') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleUserSetupEmailStart(ctx);
        return;
      }

      if (text === 'Fix Number') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleUserFixNomorStart(ctx);
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
