import { createLogger } from './logger.js';
import { validateConfig } from './config.js';
import { createBot, startBot } from './telegram/bot.js';
import { autoConnectWhatsApp } from './whatsapp/socket.js';
import { state } from './bridge/state.js';

const log = createLogger('Main');

// -- main --
const main = async () => {
  try {
    log.info('Starting VOLKOS Bot...');

    validateConfig();

    log.info('Checking for existing WhatsApp credentials...');
    await autoConnectWhatsApp();

    const bot = createBot();

    state.setTelegramConnected(true);

    await startBot(bot);
  } catch (error) {
    log.error({ error }, 'Fatal error');
    process.exit(1);
  }
};

main();
