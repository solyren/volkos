import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { createLogger } from '../logger.js';
import { config } from '../config.js';
import { handleConnectionUpdate, handleCredsUpdate } from './handlers/connection.js';
import { handleMessagesUpsert } from './handlers/messages.js';
import { formatPhoneNumber } from './utils.js';
import { socketPool } from '../db/sockets.js';
import { setWhatsAppPairing, removeWhatsAppPairing } from '../db/users.js';
import { getUserAuthPath, deleteUserAuth } from './auth-manager.js';

const log = createLogger('WhatsAppSocketPool');

// -- createUserSocket --
export const createUserSocket = async (userId) => {
  try {
    const userAuthPath = getUserAuthPath(userId);
    const { state, saveCreds } = await useMultiFileAuthState(userAuthPath);
    const { version } = await fetchLatestBaileysVersion();

    log.info(`Creating WhatsApp socket for user ${userId}`, { version: version.join('.') });

    const socket = makeWASocket({
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

    socket.userId = userId;

    socket.ev.on('creds.update', (update) => handleCredsUpdate(update, saveCreds));
    socket.ev.on('connection.update', (update) => {
      handleConnectionUpdate(update, () => createUserSocket(userId), socket, userId);
    });
    socket.ev.on('messages.upsert', (messages) => handleMessagesUpsert(messages, socket, userId));

    socketPool.setSocket(userId, socket);
    log.info(`WhatsApp socket created for user ${userId}`);
    return socket;
  } catch (error) {
    log.error({ error }, `Failed to create WhatsApp socket for user ${userId}`);
    throw error;
  }
};

// -- requestPairingCodeForUser --
export const requestPairingCodeForUser = async (userId, phoneNumber) => {
  try {
    let socket = socketPool.getSocket(userId);

    if (!socket) {
      socket = await createUserSocket(userId);
      log.info(`Waiting 8 seconds for socket initialization for user ${userId}`);
      await new Promise((resolve) => {
        // eslint-disable-next-line no-undef
        setTimeout(resolve, 8000);
      });
    }

    const formatted = formatPhoneNumber(phoneNumber);
    log.info(`Requesting pairing code for user ${userId}: ${formatted}`);

    const customCode = config.whatsapp.customPairingCode;
    await socket.requestPairingCode(formatted, customCode);

    log.info(`VOLKSBOT Pairing Code requested for user ${userId}`);

    return {
      code: customCode,
      phone: formatted,
      userId,
    };
  } catch (error) {
    const errorMsg = error?.message || error?.toString?.() || 'Unknown error';
    log.error({ error: errorMsg }, `Failed to request pairing code for user ${userId}`);
    throw error;
  }
};

// -- getUserSocket --
export const getUserSocket = (userId) => {
  return socketPool.getSocket(userId);
};

// -- isUserSocketConnected --
export const isUserSocketConnected = (userId) => {
  const socket = socketPool.getSocket(userId);
  return socket && socket.user;
};

// -- disconnectUserSocket --
export const disconnectUserSocket = async (userId) => {
  try {
    const socket = socketPool.getSocket(userId);

    if (socket) {
      socket.logout();
      socketPool.removeSocket(userId);
      await removeWhatsAppPairing(userId);
      await deleteUserAuth(userId);
      log.info(`WhatsApp socket disconnected for user ${userId}`);
    }
  } catch (error) {
    log.error({ error }, `Error disconnecting socket for user ${userId}`);
  }
};

// -- checkIfUserPaired --
export const checkIfUserPaired = async (userId) => {
  try {
    const userAuthPath = getUserAuthPath(userId);
    const { state } = await useMultiFileAuthState(userAuthPath);
    const isPaired = state.creds && state.creds.registered;

    if (isPaired) {
      log.info(`Found existing WhatsApp credentials for user ${userId}`);
      return true;
    }

    return false;
  } catch (error) {
    log.debug({ error }, `Could not check pairing status for user ${userId}`);
    return false;
  }
};

// -- autoConnectUserSocket --
export const autoConnectUserSocket = async (userId) => {
  try {
    const userAuthPath = getUserAuthPath(userId);
    const { state: authState } = await useMultiFileAuthState(userAuthPath);
    const isPaired = authState.creds && authState.creds.registered;

    if (isPaired) {
      log.info(`Auto-connecting WhatsApp socket for user ${userId}`);
      await createUserSocket(userId);
      const phoneNumber = authState.creds.me.jid.split('@')[0];
      await setWhatsAppPairing(userId, phoneNumber);
      log.info(`WhatsApp auto-reconnected for user ${userId}`);
    }
  } catch (error) {
    log.debug({ error }, `Error during auto-connect for user ${userId}`);
  }
};

// -- autoConnectAllUsers --
export const autoConnectAllUsers = async () => {
  try {
    const { getAllUsers } = await import('../db/users.js');
    const users = await getAllUsers();

    for (const user of users) {
      if (user.whatsappPaired && user.isActive) {
        try {
          await autoConnectUserSocket(user.userId);
        } catch (error) {
          log.warn({ error }, `Failed to auto-connect user ${user.userId}`);
        }
      }
    }

    log.info('Auto-connect check completed for all users');
  } catch (error) {
    log.error({ error }, 'Error during auto-connect for all users');
  }
};

// -- disconnectAllUserSockets --
export const disconnectAllUserSockets = async () => {
  try {
    const sockets = socketPool.getAllSockets();

    for (const [userId] of sockets) {
      try {
        await disconnectUserSocket(userId);
      } catch (error) {
        log.warn({ error }, `Failed to disconnect user socket ${userId}`);
      }
    }

    log.info('All user sockets disconnected');
  } catch (error) {
    log.error({ error }, 'Error disconnecting all user sockets');
  }
};
