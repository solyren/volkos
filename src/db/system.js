import { createLogger } from '../logger.js';
import { getRedis } from './redis.js';
import { config } from '../config.js';

const log = createLogger('SystemDB');

// -- getTrialDays --
export const getTrialDays = async () => {
  try {
    const redis = getRedis();
    const stored = await redis.get('system:trialDays');

    log.info(`[TRIAL] Redis stored value: "${stored}", type: ${typeof stored}`);

    if (stored) {
      const days = Number(stored);
      if (isNaN(days) || days < 1) {
        log.warn(
          `[TRIAL] Invalid stored value: ${stored}, using default: ${config.system.defaultTrialDays}`,
        );
        return config.system.defaultTrialDays;
      }
      log.info(`[TRIAL] Using Redis value: ${days} days`);
      return days;
    }

    log.info(`[TRIAL] No Redis value, using config default: ${config.system.defaultTrialDays} days`);
    return config.system.defaultTrialDays;
  } catch (error) {
    log.error({ error }, '[TRIAL] Failed to get trial days, using default');
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
