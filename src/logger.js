import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.debug ? 'debug' : 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      singleLine: false,
    },
  },
});

export const createLogger = (name) => {
  return logger.child({ module: name });
};
