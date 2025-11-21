import { createLogger } from './logger.js';
import { validateConfig } from './config.js';
import { createBot, startBot } from './telegram/bot.js';
import { autoConnectAllUsers } from './whatsapp/socket-pool.js';
import { initRedis } from './db/redis.js';
import { cleanupCorruptKeys } from './db/cleanup.js';

const log = createLogger('Main');

// -- main --
const main = async () => {
  try {
    log.info('Starting VOLKOS Bot...');

    validateConfig();

    log.info('Initializing Redis connection...');
    initRedis();

    log.info('Cleaning up corrupt Redis keys...');
    await cleanupCorruptKeys();

    log.info('Starting WhatsApp auto-reconnect in background...');
    autoConnectAllUsers().catch((err) => {
      log.error({ error: err }, 'Error during background auto-connect');
    });

    const bot = createBot();

    await startBot(bot);
  } catch (error) {
    log.error({ error }, 'Fatal error');
    process.exit(1);
  }
};

// -- Handle uncaught exceptions --
process.on('unhandledRejection', (reason, promise) => {
  log.error({ reason, promise }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (error) => {
  log.error({ error }, 'Uncaught Exception');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

main();
