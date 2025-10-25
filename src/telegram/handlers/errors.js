import { createLogger } from '../../logger.js';

const log = createLogger('TelegramErrors');

// -- handleError --
export const handleError = async (ctx, error) => {
  try {
    log.error({ error }, 'Error occurred in handler');
    await ctx.reply('❌ An error occurred. Please try again.');
  } catch (err) {
    log.error({ err }, 'Failed to send error message');
  }
};

// -- setupErrorHandler --
export const setupErrorHandler = (composer) => {
  composer.catch(async (err) => {
    log.error({ error: err }, 'Uncaught error in middleware');
  });
};
