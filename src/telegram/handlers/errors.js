import { createLogger } from '../../logger.js';

const log = createLogger('TelegramErrors');

// -- handleError --
export const handleError = async (ctx, error) => {
  try {
    log.error({
      error,
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      userId: ctx.from?.id,
      username: ctx.from?.username,
      text: ctx.message?.text,
    }, 'Error occurred in handler');
    await ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
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
