import { getRedis } from './redis.js';
import { createLogger } from '../logger.js';
import crypto from 'crypto';
import { Buffer } from 'buffer';

const log = createLogger('EmailDB');

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY ||
  'volkos-default-key-32-chars!!';
const IV_LENGTH = 16;

// -- encryptPassword --
const encryptPassword = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// -- decryptPassword --
const decryptPassword = (text) => {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

// -- saveUserEmail --
export const saveUserEmail = async (userId, email, appPassword, nama) => {
  try {
    const redis = getRedis();
    const encrypted = encryptPassword(appPassword);
    const data = {
      email,
      appPassword: encrypted,
      nama,
      createdAt: Date.now(),
    };
    await redis.set(`email:${userId}`, JSON.stringify(data));
    log.info(`Email saved for user ${userId}`);
    return true;
  } catch (error) {
    log.error({ error }, `Failed to save email for user ${userId}`);
    return false;
  }
};

// -- getUserEmail --
export const getUserEmail = async (userId) => {
  try {
    const redis = getRedis();
    const data = await redis.get(`email:${userId}`);
    if (!data) {
      return null;
    }
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    parsed.appPassword = decryptPassword(parsed.appPassword);
    return parsed;
  } catch (error) {
    log.error({ error }, `Failed to get email for user ${userId}`);
    return null;
  }
};

// -- deleteUserEmail --
export const deleteUserEmail = async (userId) => {
  try {
    const redis = getRedis();
    await redis.del(`email:${userId}`);
    log.info(`Email deleted for user ${userId}`);
    return true;
  } catch (error) {
    log.error({ error }, `Failed to delete email for user ${userId}`);
    return false;
  }
};

// -- setEmailTemplate --
export const setEmailTemplate = async (template) => {
  try {
    const redis = getRedis();
    await redis.set('email:template', template);
    log.info('Email template updated');
    return true;
  } catch (error) {
    log.error({ error }, 'Failed to set email template');
    return false;
  }
};

// -- getEmailTemplate --
export const getEmailTemplate = async () => {
  try {
    const redis = getRedis();
    const template = await redis.get('email:template');
    return template;
  } catch (error) {
    log.error({ error }, 'Failed to get email template');
    return null;
  }
};
