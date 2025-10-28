import { createLogger } from '../logger.js';

const log = createLogger('SocketLimiter');

// -- SocketLimiter (Semaphore) --
class SocketLimiter {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.currentConcurrent = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.currentConcurrent < this.maxConcurrent) {
      this.currentConcurrent++;
      return;
    }

    log.debug(
      `Socket limiter queue: waiting (current: ${this.currentConcurrent}/${this.maxConcurrent})`,
    );

    await new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release() {
    this.currentConcurrent--;
    const resolve = this.queue.shift();
    if (resolve) {
      this.currentConcurrent++;
      resolve();
    }
  }

  async run(fn) {
    await this.acquire();
    try {
      const result = await fn();
      return result;
    } finally {
      this.release();
    }
  }
}

// -- Socket Limiters per user --
const socketLimiters = new Map();

// -- getSocketLimiter --
export const getSocketLimiter = (userId) => {
  if (!socketLimiters.has(userId)) {
    socketLimiters.set(userId, new SocketLimiter(3));
    log.debug(`Created socket limiter for user ${userId}`);
  }
  return socketLimiters.get(userId);
};

// -- removeSocketLimiter --
export const removeSocketLimiter = (userId) => {
  socketLimiters.delete(userId);
  log.debug(`Removed socket limiter for user ${userId}`);
};
