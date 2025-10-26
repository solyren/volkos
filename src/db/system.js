import { createLogger } from '../logger.js';
import { getRedis } from './redis.js';
import { config } from '../config.js';

const log = createLogger('SystemDB');

// -- getTrialDays --
export const getTrialDays = async () => {
  try {
    const redis = getRedis();
    const stored = await redis.get('system:trialDays');

    if (stored) {
      const days = Number(stored);
      log.info(`[TRIAL DAYS] Using stored value: ${days}`);
      return days;
    }

    log.info(`[TRIAL DAYS] Using config default: ${config.system.defaultTrialDays}`);
    return config.system.defaultTrialDays;
  } catch (error) {
    log.error({ error }, 'Failed to get trial days, using default');
    return config.system.defaultTrialDays;
  }
};

// -- setTrialDays --
export const setTrialDays = async (days) => {
  try {
    const redis = getRedis();
    await redis.set('system:trialDays', String(days));
    log.info(`[TRIAL DAYS] Updated to: ${days}`);
    return true;
  } catch (error) {
    log.error({ error }, 'Failed to set trial days');
    throw error;
  }
};
