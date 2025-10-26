import { DisconnectReason } from '@whiskeysockets/baileys';
import { createLogger } from '../../logger.js';
import { socketPool } from '../../db/sockets.js';
import { setWhatsAppPairing, removeWhatsAppPairing } from '../../db/users.js';
import { deleteUserAuth } from '../auth-manager.js';

const log = createLogger('WAConnection');

// -- handleConnectionUpdate --
export const handleConnectionUpdate = (update, setupFn, socket, userId, phoneNumber = null) => {
  const { connection, lastDisconnect, qr } = update;

  if (connection === 'close') {
    const statusCode = (lastDisconnect?.error)?.output?.statusCode;
    const errorMsg = lastDisconnect?.error?.message || 'Connection failed';

    const msg = `[DEBUG] Connection CLOSED: user=${userId}, status=${statusCode}`;
    log.error({ errorMsg }, msg);

    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

    if (shouldReconnect) {
      log.info(`[DEBUG] Will reconnect user ${userId} in 3 seconds (status not loggedOut)`);
      // eslint-disable-next-line no-undef
      setTimeout(() => setupFn(), 3000);
    } else {
      log.warn(`[DEBUG] Device logged out for user ${userId}, cleaning up`);
      socketPool.clearPairingCode(userId);
      socketPool.removeSocket(userId);

      removeWhatsAppPairing(userId).catch((err) => {
        log.error({ error: err }, `[DEBUG] Failed to clear pairing for ${userId}`);
      });

      deleteUserAuth(userId).catch((err) => {
        log.error({ error: err }, `[DEBUG] Failed to delete auth for ${userId}`);
      });

      log.info(`[DEBUG] Cleanup completed for logged out user ${userId}`);
    }
  } else if (connection === 'open') {
    log.info(`[DEBUG] Connection OPEN for user ${userId}, phoneNumber: ${phoneNumber}`);

    if (phoneNumber) {
      log.info(`[DEBUG] Calling setWhatsAppPairing for ${userId} with ${phoneNumber}`);
      setWhatsAppPairing(userId, phoneNumber)
        .then(() => {
          log.info(`[DEBUG] setWhatsAppPairing SUCCESS for ${userId}`);
        })
        .catch((err) => {
          log.error({ error: err }, `[DEBUG] setWhatsAppPairing FAILED for ${userId}`);
        });

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
    } else {
      log.error(`[DEBUG] CONNECTION OPEN BUT PHONENUMBER IS NULL FOR USER ${userId}!`);

      if (socket && socket.user && socket.user.id) {
        const extractedPhone = socket.user.id.split(':')[0];
        log.info(`[DEBUG] Fallback: Extracted phone from socket.user: ${extractedPhone}`);
        setWhatsAppPairing(userId, extractedPhone)
          .then(() => {
            log.info(`[DEBUG] Fallback setWhatsAppPairing SUCCESS for ${userId}`);
          })
          .catch((err) => {
            log.error({ error: err }, '[DEBUG] Fallback setWhatsAppPairing FAILED');
          });
      } else {
        log.error('[DEBUG] Cannot extract phone from socket.user either!');
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
