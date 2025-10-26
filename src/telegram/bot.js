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
  handleCheckBioCommand,
  handleBioPhoneInput,
} from './handlers/check-bio.js';
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
  bot.command('disconnect', checkUserActive, handleDisconnectCommand);

  bot.command('admin', requireOwner, async (ctx) => {
    const message = '🛠️ *Admin Panel*\n\nSelect an action:';
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: mainAdminMenu(),
    });
  });



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
        await ctx.reply('✅ Command cancelled');
        return;
      }

      if (ctx.session?.waitingForPhone) {
        if (text === '🔙 Cancel') {
          ctx.session.waitingForPhone = false;
          await ctx.reply('✅ Pairing cancelled');
          return;
        }
        if (text !== 'trial (1 day)' && text !== 'user (permanent)' && text !== 'owner') {
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



      if (ctx.session?.adminAddUserId === null) {
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
        return;
      }

      if (text === '🛠️ Owner Panel') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await ctx.reply('🛠️ Admin Panel\n\nSelect an action:', {
          reply_markup: ownerPanelMenu(),
        });
        return;
      }

      if (text === '📱 Pairing') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        await ctx.reply('📱 Pairing Menu\n\nSelect an action:', {
          reply_markup: ownerPairingMenu(),
        });
        return;
      }

      if (text === '🔙 Back') {
        ctx.session.waitingForPhone = false;
        ctx.session.waitingForBioPhone = false;
        ctx.session.adminAddUserId = undefined;
        const user = await getUser(ctx.from?.id);
        if (user.role === 'owner') {
          await ctx.reply('👋 Welcome, Owner!\n\nSelect what you want to do:', {
            reply_markup: ownerMainMenu(),
          });
        }
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
