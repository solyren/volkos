import { DisconnectReason } from '@whiskeysockets/baileys';
import { createLogger } from '../../logger.js';
import { state } from '../../bridge/state.js';

const log = createLogger('WAConnection');

// -- handleConnectionUpdate --
export const handleConnectionUpdate = (update, setupFn, socket) => {
  const { connection, lastDisconnect, qr } = update;

  if (connection === 'close') {
    const statusCode = (lastDisconnect?.error)?.output?.statusCode;
    const errorMsg = lastDisconnect?.error?.message || 'Connection failed';

    log.error(`Connection closed with status ${statusCode}: ${errorMsg}`);

    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

    if (shouldReconnect) {
      log.info('Attempting to reconnect in 3 seconds...');
      state.setWhatsappConnected(false);
      state.notifyPairingError(errorMsg);
      setTimeout(() => setupFn(), 3000);
    } else {
      log.info('Connection closed. Logged out.');
      state.setWhatsappConnected(false);
      state.clearPairingCode();
    }
  } else if (connection === 'open') {
    log.info('WhatsApp connection opened and authenticated');
    state.setWhatsappConnected(true);

    if (socket && socket.user) {
      const phoneNumber = socket.user.id?.split(':')[0];
      if (phoneNumber) {
        state.loadPairedInfo(phoneNumber);
      }
    }

    state.notifyPairingSuccess();
  } else if (connection === 'connecting') {
    log.debug('WhatsApp connecting...');
  }

  if (qr) {
    log.debug('QR code available for scanning');
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
