import { createLogger } from '../logger.js';
import { config } from '../config.js';
import { promises as fs } from 'fs';
import { join } from 'path';

const log = createLogger('AuthManager');

// -- getUserAuthPath --
export const getUserAuthPath = (userId) => {
  return config.whatsapp.getAuthPath(userId);
};

// -- deleteUserAuth --
export const deleteUserAuth = async (userId) => {
  try {
    const authPath = getUserAuthPath(userId);
    const userAuthDir = join(authPath, '..');

    await fs.rm(userAuthDir, { recursive: true, force: true });
    log.info(`Deleted auth folder for user ${userId}: ${userAuthDir}`);
  } catch (error) {
    log.warn({ error }, `Failed to delete auth for user ${userId}`);
  }
};

// -- checkUserAuthExists --
export const checkUserAuthExists = async (userId) => {
  try {
    const authPath = getUserAuthPath(userId);
    await fs.access(authPath);
    return true;
  } catch {
    return false;
  }
};
