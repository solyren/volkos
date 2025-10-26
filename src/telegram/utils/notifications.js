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
export const notifyUserAdded = async (bot, userId, role, expiryDays) => {
  try {
    let message = '🎉 *Welcome to VOLKSBOT!*\n\n';
    message += '✅ Your account has been activated by the owner.\n\n';
    message += `📋 *Role:* ${role.toUpperCase()}\n`;

    if (role === 'owner') {
      message += '⏳ *Access:* Permanent (♾️)\n\n';
    } else if (role === 'trial') {
      message += `⏳ *Trial Duration:* ${expiryDays} day(s)\n\n`;
      message += `⚠️ Your trial will expire after ${expiryDays} day(s).\n`;
    } else if (expiryDays && expiryDays > 0) {
      message += `⏳ *Access Duration:* ${expiryDays} day(s)\n\n`;
      const expiryDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
      message += `📅 Expires: ${expiryDate.toLocaleDateString()}\n`;
    } else {
      message += '⏳ *Access:* Permanent (♾️)\n\n';
    }

    message += '\n💡 Use /start to begin!';

    const photo = role === 'trial' ?
      config.thumbnails.welcomeTrial :
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
    const message = '⚠️ *Trial Expiring Soon!*\n\n' +
      `Your trial access will expire in *${minutesLeft} minutes*.\n\n` +
      '📩 Contact the owner to extend your access.\n\n' +
      '💡 Thank you for using VOLKSBOT!';

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
      '📩 Please contact the owner to renew your access.\n\n' +
      '💡 Thank you for using VOLKSBOT!';

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
      '✅ Your access has been extended by the owner.\n\n' +
      `➕ Added: *${additionalDays} day(s)*\n` +
      `📅 New Expiry: ${newExpiry.toLocaleString()}\n` +
      `⏳ Total Remaining: *${remainingDays} day(s)*\n\n` +
      '💡 Thank you for using VOLKSBOT!';

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
      '🔌 WhatsApp connection has been disconnected.\n' +
      '🗑️ Your account has been removed.\n\n' +
      '📩 Contact the owner if you believe this is a mistake.\n\n' +
      '💡 Thank you for using VOLKSBOT!';

    await sendNotification(bot, userId, message);
    return true;
  } catch (error) {
    log.error({ error, userId }, 'Failed to send user removed notification');
    return false;
  }
};
