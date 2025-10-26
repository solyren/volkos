import { DisconnectReason } from '@whiskeysockets/baileys';
import { createLogger } from '../../logger.js';
import { socketPool } from '../../db/sockets.js';
import { setWhatsAppPairing } from '../../db/users.js';

const log = createLogger('WAConnection');

// -- handleConnectionUpdate --
export const handleConnectionUpdate = (update, setupFn, socket, userId) => {
  const { connection, lastDisconnect, qr } = update;

  if (connection === 'close') {
    const statusCode = (lastDisconnect?.error)?.output?.statusCode;
    const errorMsg = lastDisconnect?.error?.message || 'Connection failed';

    log.error(`Connection closed for user ${userId} with status ${statusCode}: ${errorMsg}`);

    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

    if (shouldReconnect) {
      log.info(`Attempting to reconnect user ${userId} in 3 seconds...`);
      // eslint-disable-next-line no-undef
      setTimeout(() => setupFn(), 3000);
    } else {
      log.info(`Connection closed and logged out for user ${userId}`);
      socketPool.clearPairingCode(userId);
    }
  } else if (connection === 'open') {
    log.info(`WhatsApp connection opened and authenticated for user ${userId}`);

    if (socket && socket.user) {
      const phoneNumber = socket.user.id?.split(':')[0];
      if (phoneNumber) {
        setWhatsAppPairing(userId, phoneNumber);
        const pairingCode = socketPool.getPairingCode(userId);
        if (pairingCode?.ctx) {
          const msg = `✅ *VOLKSBOT Connected!*\n\nSuccessfully paired WhatsApp with ${phoneNumber}`;
          pairingCode.ctx.reply(msg, {
            parse_mode: 'Markdown',
          }).catch((err) => {
            const msg2 = 'Failed to send pairing success notification';
            log.error({ error: err }, msg2);
          });
        }
        socketPool.clearPairingCode(userId);
      }
    }
  } else if (connection === 'connecting') {
    log.debug(`WhatsApp connecting for user ${userId}...`);
  }

  if (qr) {
    log.debug(`QR code available for user ${userId}`);
  }
};

// -- handleCredsUpdate --
export const handleCredsUpdate = (update, saveCreds) => {
  saveCreds();
};

// -- handleQRUpdate --
export const handleQRUpdate = (_qr) => {
  log.debug('QR code generated');
};
