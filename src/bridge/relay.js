import { createLogger } from '../logger.js';
import { state } from './state.js';

const log = createLogger('Relay');

// -- relayToTelegram --
export const relayToTelegram = async (_bot, _message) => {
  try {
    const status = state.getStatus();
    if (!status.telegram) {
      log.warn('Telegram not connected, cannot relay');
      return;
    }

    if (status.paired) {
      log.info('Relaying message to Telegram');
    }
  } catch (error) {
    log.error({ error }, 'Failed to relay to Telegram');
  }
};

// -- relayToWhatsapp --
export const relayToWhatsapp = async (_sock, _message, _senderName) => {
  try {
    const status = state.getStatus();
    if (!status.whatsapp) {
      log.warn('WhatsApp not connected, cannot relay');
      return;
    }

    if (status.paired) {
      log.info('Relaying message to WhatsApp');
    }
  } catch (error) {
    log.error({ error }, 'Failed to relay to WhatsApp');
  }
};
