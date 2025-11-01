#!/usr/bin/env node

import { spawn } from 'child_process';
import { createLogger } from './src/logger.js';

const log = createLogger('Launcher');

// -- launchBot --
const launchBot = () => {
  log.info('Launching bot process...');

  const bot = spawn('node', ['src/index.js'], {
    stdio: 'inherit',
    detached: false,
  });

  bot.on('exit', (code, signal) => {
    log.error(`Bot exited with code ${code}, signal ${signal}`);
    log.info('Restarting bot in 5 seconds...');
    setTimeout(() => {
      launchBot();
    }, 5000);
  });

  bot.on('error', (error) => {
    log.error({ error }, 'Failed to launch bot');
    setTimeout(() => {
      launchBot();
    }, 5000);
  });

  return bot;
};

// -- handleSignals --
const handleSignals = () => {
  process.on('SIGTERM', () => {
    log.info('SIGTERM received, exiting...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    log.info('SIGINT received, exiting...');
    process.exit(0);
  });
};

log.info('Starting VOLKOS Bot Launcher...');
handleSignals();
launchBot();
