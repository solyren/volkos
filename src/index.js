import { createLogger } from './logger.js';
import { validateConfig } from './config.js';
import { createBot, startBot } from './telegram/bot.js';
import { autoConnectAllUsers } from './whatsapp/socket-pool.js';
import { initRedis } from './db/redis.js';
import { startTrialExpiryJob } from './jobs/trial-expiry.js';

const log = createLogger('Main');

// -- main --
const main = async () => {
  try {
    log.info('Starting VOLKOS Bot...');

    validateConfig();

    log.info('Initializing Redis connection...');
    initRedis();

    log.info('Checking for existing WhatsApp credentials...');
    await autoConnectAllUsers();

    log.info('Starting trial expiry background job...');
    startTrialExpiryJob();

    const bot = createBot();

    await startBot(bot);
  } catch (error) {
    log.error({ error }, 'Fatal error');
    process.exit(1);
  }
};

main();
