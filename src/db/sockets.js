import { createLogger } from '../logger.js';

const log = createLogger('SocketPool');

class SocketPool {
  // -- constructor --
  constructor() {
    this.sockets = new Map();
    this.pairingCodes = new Map();
  }

  // -- setSocket --
  setSocket(userId, socket) {
    this.sockets.set(String(userId), socket);
    log.debug(`Socket set for user ${userId}`);
  }

  // -- getSocket --
  getSocket(userId) {
    return this.sockets.get(String(userId));
  }

  // -- removeSocket --
  removeSocket(userId) {
    this.sockets.delete(String(userId));
    log.debug(`Socket removed for user ${userId}`);
  }

  // -- hasSocket --
  hasSocket(userId) {
    return this.sockets.has(String(userId));
  }

  // -- getAllSockets --
  getAllSockets() {
    return Array.from(this.sockets.entries());
  }

  // -- setPairingCode --
  setPairingCode(userId, code, phone, ctx) {
    this.pairingCodes.set(String(userId), {
      code,
      phone,
      ctx,
      timestamp: Date.now(),
    });
    log.debug(`Pairing code set for user ${userId}`);
  }

  // -- getPairingCode --
  getPairingCode(userId) {
    return this.pairingCodes.get(String(userId));
  }

  // -- clearPairingCode --
  clearPairingCode(userId) {
    this.pairingCodes.delete(String(userId));
    log.debug(`Pairing code cleared for user ${userId}`);
  }

  // -- clearAllPairingCodes --
  clearAllPairingCodes() {
    this.pairingCodes.clear();
  }
}

export const socketPool = new SocketPool();
