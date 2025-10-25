import { Bot, session } from 'grammy';
import { createLogger } from '../logger.js';
import { config } from '../config.js';
import { state } from '../bridge/state.js';
import {
  handlePairCommand,
  handlePhoneInput,
  handleDisconnectCommand,
} from './handlers/pairing.js';
import {
  handleStatusCommand,
  handleStartCommand,
  handleHelpCommand,
  handleTextMessage,
} from './handlers/messages.js';
import { handleError } from './handlers/errors.js';

const log = createLogger('TelegramBot');

// -- createBot --
export const createBot = () => {
  const bot = new Bot(config.telegram.token);

  bot.use(session({ initial: () => ({}) }));

  bot.command('start', handleStartCommand);
  bot.command('help', handleHelpCommand);
  bot.command('status', handleStatusCommand);
  bot.command('pair', handlePairCommand);
  bot.command('disconnect', handleDisconnectCommand);

  bot.on('message:text', async (ctx) => {
    try {
      if (ctx.session?.waitingForPhone) {
        await handlePhoneInput(ctx);
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
    state.setTelegramConnected(true);
    log.info('Bot started successfully');
    await bot.start({
      onStart: async (botInfo) => {
        log.info(`Bot started as @${botInfo.username}`);
      },
    });
  } catch (error) {
    log.error({ error }, 'Failed to start bot');
    state.setTelegramConnected(false);
    throw error;
  }
};
