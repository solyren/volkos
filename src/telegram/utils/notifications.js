import { createLogger } from '../../logger.js';
import { config } from '../../config.js';

const log = createLogger('Notifications');

// -- sendNotification --
export const sendNotification = async (bot, userId, message, photo = null) => {
  try {
    if (photo) {
      await bot.sendPhoto(userId, photo, {
        caption: message,
        parse_mode: 'Markdown',
      });
    } else {
      await bot.sendMessage(userId, message, {
        parse_mode: 'Markdown',
      });
    }
    log.info(`Notification sent to user ${userId}`);
    return true;
  } catch (error) {
    log.error({ error, userId }, 'Failed to send notification');
    return false;
  }
};

// -- notifyUserAdded --
export const notifyUserAdded = async (bot, userId, role) => {
  try {
    let message = '🎉 *Welcome to VOLKSBOT!*\n\n';
    message += 'Your account has been activated by the owner.\n\n';
    message += `📋 *Role:* ${role.toUpperCase()}\n\n`;
    message += '💡 Type /start to start!';

    const photo = role === 'owner' ?
      config.thumbnails.welcomeOwner :
      config.thumbnails.welcomeUser;

    await sendNotification(bot, userId, message, photo);
    return true;
  } catch (error) {
    log.error({ error, userId }, 'Failed to send user added notification');
    return false;
  }
};

// -- notifyTrialExpiring --
export const notifyTrialExpiring = async (bot, userId, minutesLeft) => {
  try {
    const message = '⚠️ *Trial Almost Expired!*\n\n' +
      `Your trial access will expire in *${minutesLeft} minutes*.\n\n` +
      '📩 Contact owner to extend your access.\n\n' +
      '💡 Thanks for using VOLKSBOT!';

    await sendNotification(bot, userId, message);
    return true;
  } catch (error) {
    log.error({ error, userId }, 'Failed to send trial expiring notification');
    return false;
  }
};

// -- notifyTrialExpired --
export const notifyTrialExpired = async (bot, userId) => {
  try {
    const message = '❌ *Trial Expired*\n\n' +
      'Your trial period has ended.\n\n' +
      '📩 Contact owner to extend your access.\n\n' +
      '💡 Thanks for using VOLKSBOT!';

    await sendNotification(bot, userId, message);
    return true;
  } catch (error) {
    log.error({ error, userId }, 'Failed to send trial expired notification');
    return false;
  }
};

// -- notifyUserExtended --
export const notifyUserExtended = async (bot, userId, additionalDays, newExpiryTime) => {
  try {
    const newExpiry = new Date(newExpiryTime);
    const remainingDays = Math.ceil((newExpiryTime - Date.now()) / (24 * 60 * 60 * 1000));

    const message = '🎉 *Access Extended!*\n\n' +
      'Your access has been extended by the owner.\n\n' +
      `➕ Added: *${additionalDays} days*\n` +
      `📅 New Expiry: ${newExpiry.toLocaleString('en-US')}\n` +
      `⏳ Remaining Total: *${remainingDays} days*\n\n` +
      '💡 Thanks for using VOLKSBOT!';

    await sendNotification(bot, userId, message);
    return true;
  } catch (error) {
    log.error({ error, userId }, 'Failed to send user extended notification');
    return false;
  }
};

// -- notifyUserRemoved --
export const notifyUserRemoved = async (bot, userId) => {
  try {
    const message = '❌ *Access Revoked*\n\n' +
      'Your access to VOLKSBOT has been revoked by the owner.\n\n' +
      '🔌 WhatsApp connection disconnected.\n' +
      '🗑️ Your account has been deleted.\n\n' +
      '📩 Contact owner if you believe this is a mistake.\n\n' +
      '💡 Thanks for using VOLKSBOT!';

    await sendNotification(bot, userId, message);
    return true;
  } catch (error) {
    log.error({ error, userId }, 'Failed to send user removed notification');
    return false;
  }
};
