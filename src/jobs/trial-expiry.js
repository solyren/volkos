import { createLogger } from '../logger.js';
import { getAllUsers, isUserExpired } from '../db/users.js';

const log = createLogger('TrialExpiryJob');

// -- startTrialExpiryJob --
export const startTrialExpiryJob = (interval = 60000) => {
  log.info(`Trial expiry job started with ${interval}ms interval`);

  // eslint-disable-next-line no-undef
  setInterval(async () => {
    try {
      const users = await getAllUsers();
      const trialUsers = users.filter((u) => u.role === 'trial' && u.isActive);

      for (const user of trialUsers) {
        const expired = await isUserExpired(user.userId);

        if (expired) {
          log.info(`Trial user ${user.userId} expired and deactivated`);
        }
      }
    } catch (error) {
      log.error({ error }, 'Error in trial expiry job');
    }
  }, interval);
};
