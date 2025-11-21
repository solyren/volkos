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
    let message = '🎉 *Selamat Datang di VOLKSBOT!*\n\n';
    message += '✅ Akun lo udah diaktifkan sama owner.\n\n';
    message += `📋 *Role:* ${role.toUpperCase()}\n\n`;
    message += '💡 Ketik /start untuk mulai!';

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
    const message = '⚠️ *Trial Hampir Habis!*\n\n' +
      `Akses trial lo bakal expire dalam *${minutesLeft} menit*.\n\n` +
      '📩 Hubungi owner untuk perpanjang akses lo.\n\n' +
      '💡 Makasih udah pake VOLKSBOT!';

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
    const message = '❌ *Trial Sudah Habis*\n\n' +
      'Periode trial lo udah selesai.\n\n' +
      '📩 Hubungi owner untuk perpanjang akses lo.\n\n' +
      '💡 Makasih udah pake VOLKSBOT!';

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

    const message = '🎉 *Akses Diperpanjang!*\n\n' +
      '✅ Akses lo udah diperpanjang sama owner.\n\n' +
      `➕ Ditambah: *${additionalDays} hari*\n` +
      `📅 Expire Baru: ${newExpiry.toLocaleString('id-ID')}\n` +
      `⏳ Total Sisa: *${remainingDays} hari*\n\n` +
      '💡 Makasih udah pake VOLKSBOT!';

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
    const message = '❌ *Akses Dicabut*\n\n' +
      'Akses lo ke VOLKSBOT udah dicabut sama owner.\n\n' +
      '🔌 Koneksi WhatsApp udah diputus.\n' +
      '🗑️ Akun lo udah dihapus.\n\n' +
      '📩 Hubungi owner kalau lo yakin ini salah.\n\n' +
      '💡 Makasih udah pake VOLKSBOT!';

    await sendNotification(bot, userId, message);
    return true;
  } catch (error) {
    log.error({ error, userId }, 'Failed to send user removed notification');
    return false;
  }
};
