import { getRedis } from './redis.js';
import { createLogger } from '../logger.js';

const log = createLogger('NotificationDB');

// -- hasNotificationBeenSent --
export const hasNotificationBeenSent = async (userId, notificationType) => {
  try {
    const redis = getRedis();
    const key = `notification:${userId}:${notificationType}`;
    const result = await redis.get(key);
    return result === 'true';
  } catch (error) {
    log.error({ error, userId, notificationType }, 'Error checking notification');
    return false;
  }
};

// -- markNotificationSent --
export const markNotificationSent = async (userId, notificationType, ttlSeconds = 86400) => {
  try {
    const redis = getRedis();
    const key = `notification:${userId}:${notificationType}`;
    await redis.set(key, 'true');
    await redis.expire(key, ttlSeconds);
    log.info(`Notification marked sent: ${userId} - ${notificationType}`);
    return true;
  } catch (error) {
    log.error({ error, userId, notificationType }, 'Error marking notification');
    return false;
  }
};

// -- clearNotification --
export const clearNotification = async (userId, notificationType) => {
  try {
    const redis = getRedis();
    const key = `notification:${userId}:${notificationType}`;
    await redis.del(key);
    log.info(`Notification cleared: ${userId} - ${notificationType}`);
    return true;
  } catch (error) {
    log.error({ error, userId, notificationType }, 'Error clearing notification');
    return false;
  }
};
