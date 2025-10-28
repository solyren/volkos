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
import { removeWhatsAppPairing } from '../db/users.js';
import { getUserAuthPath, deleteUserAuth } from './auth-manager.js';
import { removeSocketLimiter } from './socket-limiter.js';

const log = createLogger('WhatsAppSocketPool');

// -- createUserSocket --
export const createUserSocket = async (userId, phoneNumber = null) => {
  try {
    const userAuthPath = getUserAuthPath(userId);
    const { state, saveCreds } = await useMultiFileAuthState(userAuthPath);
    const { version } = await fetchLatestBaileysVersion();

    log.info(`[DEBUG] Creating socket for user ${userId}, phoneNumber param: ${phoneNumber}`);

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

    let derivedPhoneNumber = phoneNumber;
    if (!derivedPhoneNumber && state.creds?.me?.id) {
      derivedPhoneNumber = state.creds.me.id.split(':')[0];
      log.info(`[DEBUG] Derived phone from creds: ${derivedPhoneNumber}`);
    } else if (derivedPhoneNumber) {
      log.info(`[DEBUG] Using provided phone: ${derivedPhoneNumber}`);
    } else {
      log.warn(`[DEBUG] NO PHONE NUMBER for user ${userId}!`);
    }

    socket.ev.on('creds.update', (update) => handleCredsUpdate(update, saveCreds));
    socket.ev.on('connection.update', (update) => {
      log.info(`[DEBUG] Connection update for ${userId}, passing phone: ${derivedPhoneNumber}`);
      const reconnectFn = () => createUserSocket(userId, derivedPhoneNumber);
      handleConnectionUpdate(update, reconnectFn, socket, userId, derivedPhoneNumber);
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
    const formatted = formatPhoneNumber(phoneNumber);

    if (!socket) {
      socket = await createUserSocket(userId, formatted);
      log.info(`Waiting 8 seconds for socket initialization for user ${userId}`);
      await new Promise((resolve) => {
        // eslint-disable-next-line no-undef
        setTimeout(resolve, 8000);
      });
    }

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
    log.info(`[DEBUG] Starting disconnect for user ${userId}`);
    const socket = socketPool.getSocket(userId);

    if (socket) {
      try {
        log.info(`[DEBUG] Attempting socket.logout() for user ${userId}`);
        await socket.logout();
        log.info(`[DEBUG] socket.logout() SUCCESS for user ${userId}`);
      } catch (logoutError) {
        const msg = 'socket.logout() failed, device may be already removed. Continuing cleanup...';
        log.warn({ error: logoutError }, `[DEBUG] ${msg}`);
      }

      log.info(`[DEBUG] Cleaning up resources for user ${userId}`);
      socketPool.removeSocket(userId);
      removeSocketLimiter(userId);

      await removeWhatsAppPairing(userId);
      log.info(`[DEBUG] Database whatsappPaired cleared for user ${userId}`);

      await deleteUserAuth(userId);
      log.info(`[DEBUG] Auth files deleted for user ${userId}`);

      log.info(`WhatsApp socket disconnected and cleaned for user ${userId}`);
    } else {
      log.warn(`[DEBUG] No socket found for user ${userId}, cleaning up database only`);
      removeSocketLimiter(userId);
      await removeWhatsAppPairing(userId);
      await deleteUserAuth(userId);
    }
  } catch (error) {
    log.error({ error }, `Critical error during disconnect for user ${userId}`);
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

    if (!isPaired) {
      log.debug(`No paired credentials found for user ${userId}`);
      return;
    }

    const phoneNumber =
      authState.creds.me?.id?.split(':')[0] ||
      authState.creds.me?.jid?.split('@')[0];

    if (!phoneNumber) {
      log.warn(`Could not extract phone number from creds for user ${userId}`);
      return;
    }

    log.info(`Auto-connecting WhatsApp socket for user ${userId} with phone ${phoneNumber}`);
    await createUserSocket(userId, phoneNumber);

    log.info(`Auto-connect initiated for user ${userId}, connection handler will update database`);
  } catch (error) {
    log.warn({ error }, `Error during auto-connect for user ${userId}`);
  }
};

// -- autoConnectAllUsers --
export const autoConnectAllUsers = async () => {
  try {
    const { getAllUsers } = await import('../db/users.js');
    const users = await getAllUsers();

    log.info(`[DEBUG] Checking ${users.length} total users for auto-connect`);

    const activeUsers = users.filter((user) => user.isActive);
    log.info(`[DEBUG] Found ${activeUsers.length} active users`);

    const usersToConnect = [];
    for (const user of activeUsers) {
      const hasCreds = await checkIfUserPaired(user.userId);
      const paired = user.whatsappPaired;
      log.info(`[DEBUG] User ${user.userId}: paired=${paired}, hasCreds=${hasCreds}`);

      if (hasCreds) {
        usersToConnect.push(user);
      }
    }

    if (usersToConnect.length === 0) {
      log.info('[DEBUG] No users with valid credentials found for auto-connect');
      return;
    }

    log.info(`[DEBUG] Auto-connecting ${usersToConnect.length} users with valid credentials...`);

    const results = await Promise.allSettled(
      usersToConnect.map((user) => autoConnectUserSocket(user.userId)),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    log.info(
      `Auto-connect completed: ${successful} connected, ${failed} failed`,
    );
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
