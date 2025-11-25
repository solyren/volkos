import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { createLogger } from '../logger.js';
import { config } from '../config.js';
import { handleConnectionUpdate, handleCredsUpdate } from './handlers/connection.js';
import { handleMessagesUpsert } from './handlers/messages.js';
import { formatPhoneNumber } from './utils.js';

const log = createLogger('WhatsAppSocket');

let socket = null;

// -- createWhatsAppSocket --
export const createWhatsAppSocket = async () => {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(config.whatsapp.authPath);
    const { version } = await fetchLatestBaileysVersion();

    log.info('Creating WhatsApp socket with Baileys version', { version: version.join('.') });

    socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: config.debug ? 'debug' : 'silent' }),
      browser: ['Ubuntu', 'Chrome', '22.04.2'],
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      getMessage: async () => undefined,
    });

    socket.ev.on('creds.update', (update) => handleCredsUpdate(update, saveCreds));
    socket.ev.on('connection.update', (update) => {
      handleConnectionUpdate(update, createWhatsAppSocket, socket);
    });
    socket.ev.on('messages.upsert', (messages) => handleMessagesUpsert(messages, socket));

    log.info('WhatsApp socket created, waiting for connection...');
    return socket;
  } catch (error) {
    log.error({ error }, 'Failed to create WhatsApp socket');
    throw error;
  }
};

// -- requestPairingCode --
export const requestPairingCode = async (phoneNumber) => {
  try {
    if (!socket) {
      log.error('Socket not initialized before pairing request');
      throw new Error('WhatsApp socket not initialized. Please try again.');
    }

    const formatted = formatPhoneNumber(phoneNumber);
    log.info(`Requesting pairing code for ${formatted}`);

    await new Promise((resolve) => {
      // eslint-disable-next-line no-undef
      setTimeout(resolve, 1500);
    });

    const customCode = config.whatsapp.customPairingCode;
    await socket.requestPairingCode(formatted, customCode);

    log.info(`VOLKSBOT Pairing Code: ${customCode}`);

    return {
      code: customCode,
      phone: formatted,
    };
  } catch (error) {
    const errorMsg = error?.message || error?.toString?.() || 'Unknown error';
    log.error({ error: errorMsg }, 'Failed to request pairing code');
    throw error;
  }
};

// -- getSocket --
export const getSocket = () => {
  return socket;
};

// -- isSocketConnected --
export const isSocketConnected = () => {
  return socket && socket.user;
};

// -- disconnectSocket --
export const disconnectSocket = async () => {
  try {
    if (socket) {
      socket.logout();
      socket = null;
      log.info('WhatsApp socket disconnected');
    }
  } catch (error) {
    log.error({ error }, 'Error disconnecting socket');
  }
};

// -- checkIfPaired --
export const checkIfPaired = async () => {
  try {
    const { state } = await useMultiFileAuthState(config.whatsapp.authPath);
    const isPaired = state.creds && state.creds.registered;
    if (isPaired) {
      log.info('Found existing WhatsApp credentials');
      return true;
    }
    return false;
  } catch (error) {
    log.debug({ error }, 'Could not check pairing status');
    return false;
  }
};

// -- autoConnectWhatsApp --
export const autoConnectWhatsApp = async () => {
  try {
    const { state: authState } = await useMultiFileAuthState(config.whatsapp.authPath);
    const isPaired = authState.creds && authState.creds.registered;

    if (isPaired) {
      log.info('Found existing WhatsApp credentials. Auto-connecting...');
      await createWhatsAppSocket();
      log.info('WhatsApp auto-connect initiated');
    } else {
      log.info('No existing WhatsApp credentials found');
    }
  } catch (error) {
    log.debug({ error }, 'Error during auto-connect check');
  }
};
