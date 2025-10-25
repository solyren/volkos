import { createLogger } from '../logger.js';

const log = createLogger('State');

class StateManager {
  // -- constructor --
  constructor() {
    this.telegramConnected = false;
    this.whatsappConnected = false;
    this.pairedUsers = new Map();
    this.activeSessions = new Map();
    this.phoneNumber = null;
    this.pairingCode = null;
    this.pairingContext = null;
    this.connectionCallbacks = [];
    this.isPairingFlow = false;
  }

  // -- setTelegramConnected --
  setTelegramConnected(connected) {
    this.telegramConnected = connected;
    log.info(`Telegram connection: ${connected}`);
  }

  // -- setWhatsappConnected --
  setWhatsappConnected(connected) {
    this.whatsappConnected = connected;
    log.info(`WhatsApp connection: ${connected}`);
  }

  // -- setPairingCode --
  setPairingCode(code, phone) {
    this.pairingCode = code;
    this.phoneNumber = phone;
    this.isPairingFlow = true;
    log.info(`VOLKSBOT Pairing code set for ${phone}`);
  }

  // -- setPairingContext --
  setPairingContext(ctx) {
    this.pairingContext = ctx;
  }

  // -- clearPairingCode --
  clearPairingCode() {
    this.pairingCode = null;
    this.pairingContext = null;
    this.isPairingFlow = false;
    log.info('VOLKSBOT Pairing code cleared');
  }

  // -- notifyPairingSuccess --
  async notifyPairingSuccess() {
    if (this.pairingContext && this.isPairingFlow) {
      try {
        const message = '✅ *VOLKSBOT Connected!*\n\n' +
          `Successfully paired WhatsApp with ${this.phoneNumber}`;
        await this.pairingContext.reply(message, { parse_mode: 'Markdown' });
        log.info('Sent pairing success notification');
        this.isPairingFlow = false;
      } catch (error) {
        log.error({ error }, 'Failed to send pairing success notification');
      }
    } else if (this.whatsappConnected && !this.isPairingFlow) {
      log.info('WhatsApp reconnected to existing session');
    }
  }

  // -- notifyPairingError --
  async notifyPairingError(errorMsg) {
    if (this.pairingContext) {
      try {
        await this.pairingContext.reply(
          `❌ *WhatsApp Connection Failed*\n\n${errorMsg}`,
          { parse_mode: 'Markdown' },
        );
        log.info('Sent pairing error notification');
      } catch (error) {
        log.error({ error }, 'Failed to send pairing error notification');
      }
    }
  }

  // -- getPairingCode --
  getPairingCode() {
    return {
      code: this.pairingCode,
      phone: this.phoneNumber,
    };
  }

  // -- addSession --
  addSession(userId, sessionData) {
    this.activeSessions.set(userId, sessionData);
    log.debug(`Session added for user ${userId}`);
  }

  // -- removeSession --
  removeSession(userId) {
    this.activeSessions.delete(userId);
    log.debug(`Session removed for user ${userId}`);
  }

  // -- getSession --
  getSession(userId) {
    return this.activeSessions.get(userId);
  }

  // -- loadPairedInfo --
  loadPairedInfo(phoneNumber) {
    if (phoneNumber) {
      this.phoneNumber = phoneNumber;
      log.info(`Loaded paired phone number: ${phoneNumber}`);
    }
  }

  // -- getStatus --
  getStatus() {
    return {
      telegram: this.telegramConnected,
      whatsapp: this.whatsappConnected,
      paired: this.phoneNumber !== null,
      phoneNumber: this.phoneNumber,
    };
  }
}

export const state = new StateManager();
