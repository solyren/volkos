import { createLogger } from '../logger.js';
import { getRedis } from './redis.js';

const log = createLogger('UserDB');

// -- createUser --
export const createUser = async (userId, role = 'trial', expiryDays = 1) => {
  try {
    const redis = getRedis();
    const now = Date.now();
    const expiryMs = role === 'trial' ? expiryDays * 24 * 60 * 60 * 1000 : null;
    const expiryTime = expiryMs ? now + expiryMs : null;

    const userData = {
      userId: String(userId),
      role,
      createdAt: now,
      expiryTime,
      whatsappPhone: null,
      whatsappPaired: false,
      isActive: true,
    };

    await redis.hset(`user:${userId}`, userData);
    log.info(`User created: ${userId} with role ${role}`);
    return userData;
  } catch (error) {
    log.error({ error }, `Failed to create user ${userId}`);
    throw error;
  }
};

// -- getUser --
export const getUser = async (userId) => {
  try {
    const redis = getRedis();
    const userData = await redis.hgetall(`user:${userId}`);

    if (!userData || Object.keys(userData).length === 0) {
      return null;
    }

    return {
      userId: userData.userId,
      role: userData.role,
      createdAt: Number(userData.createdAt),
      expiryTime: userData.expiryTime ? Number(userData.expiryTime) : null,
      whatsappPhone: userData.whatsappPhone,
      whatsappPaired: userData.whatsappPaired === 'true',
      isActive: userData.isActive === 'true' || userData.isActive === true,
    };
  } catch (error) {
    log.error({ error }, `Failed to get user ${userId}`);
    throw error;
  }
};

// -- updateUser --
export const updateUser = async (userId, updates) => {
  try {
    const redis = getRedis();
    const user = await getUser(userId);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const updatedData = { ...user, ...updates };
    await redis.hset(`user:${userId}`, updatedData);
    log.info(`User updated: ${userId}`);
    return updatedData;
  } catch (error) {
    log.error({ error }, `Failed to update user ${userId}`);
    throw error;
  }
};

// -- deleteUser --
export const deleteUser = async (userId) => {
  try {
    const redis = getRedis();
    await redis.del(`user:${userId}`);
    log.info(`User deleted: ${userId}`);
  } catch (error) {
    log.error({ error }, `Failed to delete user ${userId}`);
    throw error;
  }
};

// -- getAllUsers --
export const getAllUsers = async () => {
  try {
    const redis = getRedis();
    const keys = await redis.keys('user:*');
    const users = [];

    for (const key of keys) {
      const userData = await redis.hgetall(key);
      if (userData && Object.keys(userData).length > 0) {
        users.push({
          userId: userData.userId,
          role: userData.role,
          createdAt: Number(userData.createdAt),
          expiryTime: userData.expiryTime ? Number(userData.expiryTime) : null,
          whatsappPhone: userData.whatsappPhone,
          whatsappPaired: userData.whatsappPaired === 'true',
          isActive: userData.isActive === 'true' || userData.isActive === true,
        });
      }
    }

    return users;
  } catch (error) {
    log.error({ error }, 'Failed to get all users');
    throw error;
  }
};

// -- getUserByPhone --
export const getUserByPhone = async (phoneNumber) => {
  try {
    const redis = getRedis();
    const keys = await redis.keys('user:*');

    for (const key of keys) {
      const userData = await redis.hgetall(key);
      if (userData?.whatsappPhone === phoneNumber) {
        return {
          userId: userData.userId,
          role: userData.role,
          createdAt: Number(userData.createdAt),
          expiryTime: userData.expiryTime ? Number(userData.expiryTime) : null,
          whatsappPhone: userData.whatsappPhone,
          whatsappPaired: userData.whatsappPaired === 'true',
          isActive: userData.isActive === 'true' || userData.isActive === true,
        };
      }
    }

    return null;
  } catch (error) {
    log.error({ error }, `Failed to get user by phone ${phoneNumber}`);
    throw error;
  }
};

// -- isUserExpired --
export const isUserExpired = async (userId) => {
  try {
    const user = await getUser(userId);

    if (!user || !user.expiryTime) {
      return false;
    }

    const now = Date.now();
    const expired = now > user.expiryTime;

    if (expired) {
      await updateUser(userId, { isActive: false });
      log.info(`User ${userId} trial expired`);
    }

    return expired;
  } catch (error) {
    log.error({ error }, `Failed to check expiry for user ${userId}`);
    throw error;
  }
};

// -- setWhatsAppPairing --
export const setWhatsAppPairing = async (userId, phoneNumber) => {
  try {
    await updateUser(userId, {
      whatsappPhone: phoneNumber,
      whatsappPaired: true,
    });
    log.info(`WhatsApp pairing set for user ${userId}: ${phoneNumber}`);
  } catch (error) {
    log.error({ error }, `Failed to set WhatsApp pairing for user ${userId}`);
    throw error;
  }
};

// -- removeWhatsAppPairing --
export const removeWhatsAppPairing = async (userId) => {
  try {
    await updateUser(userId, {
      whatsappPhone: null,
      whatsappPaired: false,
    });
    log.info(`WhatsApp pairing removed for user ${userId}`);
  } catch (error) {
    log.error({ error }, `Failed to remove WhatsApp pairing for user ${userId}`);
    throw error;
  }
};
