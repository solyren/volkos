import { createLogger } from '../logger.js';
import { getRedis } from './redis.js';

const log = createLogger('UserDB');

// -- createUser --
export const createUser = async (userId, role = 'trial', expiryDays = null) => {
  try {
    const redis = getRedis();
    const now = Date.now();

    let expiryTime = null;

    if (expiryDays !== null && expiryDays > 0) {
      expiryTime = now + expiryDays * 24 * 60 * 60 * 1000;
    }

    const userData = {
      userId: String(userId),
      role,
      createdAt: now,
      expiryTime,
      whatsappPhone: null,
      whatsappPaired: false,
      isActive: true,
    };

    const jsonString = JSON.stringify(userData);
    await redis.set(`user:${userId}`, jsonString);
    const expMsg = expiryTime ? `expiry: ${new Date(expiryTime).toISOString()}` : 'permanent';
    log.info(`User created: ${userId} with role ${role}, ${expMsg}`);
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
    log.info(`[DEBUG GETUSER] Fetching user:${userId} using JSON GET...`);
    const response = await redis.get(`user:${userId}`);

    log.info(`[DEBUG GETUSER] Response type: ${typeof response}`);
    log.info(`[DEBUG GETUSER] Response: ${JSON.stringify(response)}`);

    if (!response) {
      log.warn(`[DEBUG GETUSER] User ${userId} not found!`);
      return null;
    }

    let userData;
    if (typeof response === 'object') {
      log.info('[DEBUG GETUSER] Upstash auto-parsed, using directly');
      userData = response;
    } else if (typeof response === 'string') {
      log.info('[DEBUG GETUSER] Got string, parsing JSON');
      userData = JSON.parse(response);
    } else {
      log.error(`[DEBUG GETUSER] Unexpected type: ${typeof response}`);
      return null;
    }

    log.info(`[DEBUG GETUSER] Final user: ${JSON.stringify(userData)}`);
    return userData;
  } catch (error) {
    log.error({ error, message: error.message }, `Failed to get user ${userId}`);
    throw error;
  }
};

// -- updateUser --
export const updateUser = async (userId, updates) => {
  try {
    const redis = getRedis();
    log.info(`[DEBUG UPDATE] Getting user ${userId} before update`);
    let user = await getUser(userId);

    if (!user) {
      log.error(`[DEBUG UPDATE] User ${userId} NOT FOUND IN REDIS! Creating default user...`);
      user = await createUser(userId, 'owner', 0);
      log.info(`[DEBUG UPDATE] Created default owner user: ${JSON.stringify(user)}`);
    }

    log.info(`[DEBUG UPDATE] Current user: ${JSON.stringify(user)}`);
    log.info(`[DEBUG UPDATE] Updates: ${JSON.stringify(updates)}`);

    const updatedData = { ...user, ...updates };
    log.info(`[DEBUG UPDATE] Merged data: ${JSON.stringify(updatedData)}`);

    log.info(`[DEBUG UPDATE] Writing as JSON string to user:${userId}...`);
    const jsonString = JSON.stringify(updatedData);
    log.info(`[DEBUG UPDATE] JSON to write: ${jsonString}`);

    await redis.set(`user:${userId}`, jsonString);
    log.info('[DEBUG UPDATE] JSON SET complete');

    log.info('[DEBUG UPDATE] Immediate read test...');
    const testRead = await redis.get(`user:${userId}`);
    log.info(`[DEBUG UPDATE] Test read type: ${typeof testRead}`);

    let testParsed;
    if (!testRead) {
      testParsed = null;
    } else if (typeof testRead === 'object') {
      testParsed = testRead;
    } else if (typeof testRead === 'string') {
      testParsed = JSON.parse(testRead);
    }

    log.info(`[DEBUG UPDATE] Parsed test: ${JSON.stringify(testParsed)}`);

    if (testParsed?.whatsappPaired === updatedData.whatsappPaired) {
      log.info('[DEBUG UPDATE] SUCCESS: Data persisted correctly!');
    } else {
      log.error('[DEBUG UPDATE] FAIL: Data mismatch after write!');
    }

    return updatedData;
  } catch (error) {
    log.error({ error }, `[DEBUG UPDATE] FAILED to update user ${userId}`);
    throw error;
  }
};

// -- extendUser --
export const extendUser = async (userId, additionalDays) => {
  try {
    const user = await getUser(userId);
    if (!user) {
      log.warn(`Attempted to extend non-existent user: ${userId}`);
      return null;
    }

    if (user.role === 'owner') {
      log.warn(`Cannot extend owner user: ${userId}`);
      return null;
    }

    const now = Date.now();
    const currentExpiry = user.expiryTime || now;
    const additionalMs = additionalDays * 24 * 60 * 60 * 1000;
    const newExpiry = Math.max(currentExpiry, now) + additionalMs;

    const updatedUser = { ...user, expiryTime: newExpiry, isActive: true };
    const redis = getRedis();
    await redis.set(`user:${userId}`, JSON.stringify(updatedUser));
    log.info({ userId, additionalDays, newExpiry }, 'User extended and reactivated');
    return updatedUser;
  } catch (error) {
    log.error({ error, userId }, 'Failed to extend user');
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
    log.info('[DEBUG GETALL] Fetching all user keys with SCAN...');

    const keys = await redis.keys('user:*');
    log.info(`[DEBUG GETALL] Found ${keys.length} keys`);

    const users = [];

    for (const key of keys) {
      try {
        const response = await redis.get(key);
        if (response) {
          let userData;
          if (typeof response === 'object') {
            userData = response;
          } else if (typeof response === 'string') {
            userData = JSON.parse(response);
          } else {
            throw new Error(`Unexpected type: ${typeof response}`);
          }
          users.push(userData);
        }
      } catch (parseError) {
        log.warn({ error: parseError, key }, `Failed to parse user data for ${key}`);
      }
    }

    log.info(`[DEBUG GETALL] Successfully loaded ${users.length} users`);
    return users;
  } catch (error) {
    log.error({
      error,
      message: error.message,
      stack: error.stack,
    }, 'Failed to get all users');

    log.warn('[DEBUG GETALL] Returning empty array due to error');
    return [];
  }
};

// -- getUserByPhone --
export const getUserByPhone = async (phoneNumber) => {
  try {
    const redis = getRedis();
    const keys = await redis.keys('user:*');

    for (const key of keys) {
      const response = await redis.get(key);
      if (response) {
        let userData;
        if (typeof response === 'object') {
          userData = response;
        } else if (typeof response === 'string') {
          userData = JSON.parse(response);
        }

        if (userData?.whatsappPhone === phoneNumber) {
          return userData;
        }
      }
    }

    return null;
  } catch (error) {
    log.error({
      error,
      message: error.message,
    }, `Failed to get user by phone ${phoneNumber}`);
    return null;
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
    const msg = `[DEBUG PAIRING] Setting whatsappPaired=true for user ${userId}`;
    log.info(msg, { phoneNumber });

    await updateUser(userId, {
      whatsappPhone: phoneNumber,
      whatsappPaired: true,
    });

    log.info('[DEBUG PAIRING] Update completed, verifying immediately...');
    const verifyUser = await getUser(userId);
    const paired = verifyUser?.whatsappPaired;
    const phone = verifyUser?.whatsappPhone;
    log.info(`[DEBUG PAIRING] Verify: paired=${paired}, phone=${phone}`);

    if (!verifyUser?.whatsappPaired) {
      log.error('[DEBUG PAIRING] CRITICAL: Database update FAILED! Value not persisted!');
      log.error('[DEBUG PAIRING] This may be Redis REST API lag or connection issue');
    } else {
      log.info(`[DEBUG PAIRING] SUCCESS: Database update confirmed for user ${userId}`);
    }
  } catch (error) {
    log.error({ error }, `[DEBUG PAIRING] ERROR in setWhatsAppPairing for user ${userId}`);
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
