import { createLogger } from '../logger.js';
import { getAllUsers, isUserExpired } from '../db/users.js';
import { notifyTrialExpired, notifyTrialExpiring } from '../telegram/utils/notifications.js';
import { hasNotificationBeenSent, markNotificationSent } from '../db/notifications.js';

const log = createLogger('TrialExpiryJob');

// -- startTrialExpiryJob --
export const startTrialExpiryJob = (bot, interval = 60000) => {
  log.info(`Trial expiry job started with ${interval}ms interval`);

  // eslint-disable-next-line no-undef
  setInterval(async () => {
    try {
      const users = await getAllUsers();
      const trialUsers = users.filter((u) => u.role === 'trial' && u.isActive);

      for (const user of trialUsers) {
        const now = Date.now();
        const expiryTime = user.expiryTime || 0;
        const remainingMs = expiryTime - now;
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

        if (remainingMinutes <= 20 && remainingMinutes > 0) {
          const alreadySent = await hasNotificationBeenSent(user.userId, 'trial-expiring');

          if (!alreadySent) {
            await notifyTrialExpiring(bot, user.userId, remainingMinutes);
            await markNotificationSent(user.userId, 'trial-expiring', 3600);
            const logMsg = `Trial expiring notification sent to ${user.userId}`;
            log.info(logMsg);
          }
        }

        const expired = await isUserExpired(user.userId);

        if (expired) {
          const expiredNotifSent = await hasNotificationBeenSent(user.userId, 'trial-expired');

          if (!expiredNotifSent) {
            await notifyTrialExpired(bot, user.userId);
            await markNotificationSent(user.userId, 'trial-expired', 86400);
            log.info(`Trial user ${user.userId} expired and notification sent`);
          }
        }
      }
    } catch (error) {
      log.error({ error }, 'Error in trial expiry job');
    }
  }, interval);
};
