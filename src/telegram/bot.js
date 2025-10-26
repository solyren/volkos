import { Bot, session } from 'grammy';
import { createLogger } from '../logger.js';
import { config } from '../config.js';
import { checkUserExists, checkUserActive, requireOwner } from '../middleware/auth.js';
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
  handleAdminUsersList,
  handleAdminAddUserStart,
  handleAdminStatus,
} from './handlers/admin-buttons.js';
import { handleError } from './handlers/errors.js';
import {
  mainAdminMenu,
  ownerMainMenu,
  ownerPanelMenu,
  ownerPairingMenu,
  addUserRoleKeyboard,
} from './keyboards.js';

const log = createLogger('TelegramBot');

// -- createBot --
export const createBot = () => {
  const bot = new Bot(config.telegram.token);

  bot.use(session({ initial: () => ({}) }));

  bot.use(checkUserExists);

  bot.command('start', handleStartCommand);
  bot.command('help', checkUserActive, handleHelpCommand);
  bot.command('status', checkUserActive, handleStatusCommand);
  bot.command('pair', checkUserActive, handlePairCommand);
  bot.command('disconnect', checkUserActive, handleDisconnectCommand);

  bot.command('admin', requireOwner, async (ctx) => {
    const message = '🛠️ *Admin Panel*\n\nSelect an action:';
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: mainAdminMenu(),
    });
  });



  bot.on('message:text', async (ctx) => {
    try {
      const text = ctx.message.text.trim();

      if (text === '🔙 Cancel') {
        ctx.session.waitingForPhone = false;
        ctx.session.adminAddUserId = undefined;
        await ctx.reply('✅ Command cancelled');
        return;
      }

      if (ctx.session?.waitingForPhone) {
        if (text !== 'trial (1 day)' && text !== 'user (permanent)' && text !== 'owner') {
          await handlePhoneInput(ctx);
        }
      } else if (ctx.session?.adminAddUserId === null) {
        const userId = Number(text);

        if (!userId || isNaN(userId)) {
          await ctx.reply('❌ Invalid ID. Please enter numeric user ID only.');
          return;
        }

        ctx.session.adminAddUserId = userId;
        const message = '*User ID Confirmed*\n\n' +
          `ID: \`${userId}\`\n\n` +
          'Select role:';

        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: addUserRoleKeyboard(),
        });
      } else if (text === '🛠️ Owner Panel') {
        ctx.session.waitingForPhone = false;
        ctx.session.adminAddUserId = undefined;
        await ctx.reply('🛠️ Admin Panel\n\nSelect an action:', {
          reply_markup: ownerPanelMenu(),
        });
      } else if (text === '📱 Pairing') {
        ctx.session.waitingForPhone = false;
        ctx.session.adminAddUserId = undefined;
        await ctx.reply('📱 Pairing Menu\n\nSelect an action:', {
          reply_markup: ownerPairingMenu(),
        });
      } else if (text === '🔙 Back') {
        ctx.session.waitingForPhone = false;
        ctx.session.adminAddUserId = undefined;
        const user = await getUser(ctx.from?.id);
        if (user.role === 'owner') {
          await ctx.reply('👋 Welcome, Owner!\n\nSelect what you want to do:', {
            reply_markup: ownerMainMenu(),
          });
        }
      } else if (text === '👥 View Users') {
        ctx.session.waitingForPhone = false;
        ctx.session.adminAddUserId = undefined;
        ctx.match = [null, 0];
        await handleAdminUsersList(ctx);
      } else if (text === '➕ Add User') {
        ctx.session.waitingForPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleAdminAddUserStart(ctx);
      } else if (text === '📊 System Status') {
        ctx.session.waitingForPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleAdminStatus(ctx);
      } else if (text === '📱 Pair WhatsApp') {
        ctx.session.waitingForPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handlePairCommand(ctx);
      } else if (text === '📊 Status') {
        ctx.session.waitingForPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleStatusCommand(ctx);
      } else if (text === '❌ Disconnect') {
        ctx.session.waitingForPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleDisconnectCommand(ctx);
      } else if (text === '❓ Help') {
        ctx.session.waitingForPhone = false;
        ctx.session.adminAddUserId = undefined;
        await handleHelpCommand(ctx);
      } else {
        await handleTextMessage(ctx);
      }
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
