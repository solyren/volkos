import NodeCache from 'node-cache';
import { createLogger } from '../logger.js';

const log = createLogger('WhatsAppCache');

// -- createBioCache --
export const createBioCache = () => {
  const cache = new NodeCache({
    stdTTL: 3600,
    checkperiod: 600,
    useClones: false,
  });

  cache.on('set', (key) => {
    log.info(`[CACHE] Bio cached: ${key}`);
  });

  cache.on('expired', (key) => {
    log.info(`[CACHE] Bio expired: ${key}`);
  });

  return cache;
};

export const bioCache = createBioCache();

// -- getCachedBio --
export const getCachedBio = (phoneNumber) => {
  const cached = bioCache.get(phoneNumber);
  if (cached) {
    log.info(`[CACHE HIT] ${phoneNumber}`);
    return cached;
  }
  log.info(`[CACHE MISS] ${phoneNumber}`);
  return null;
};

// -- setCachedBio --
export const setCachedBio = (phoneNumber, bioData, ttl = 3600) => {
  bioCache.set(phoneNumber, bioData, ttl);
};

// -- clearBioCache --
export const clearBioCache = () => {
  const keys = bioCache.keys();
  bioCache.flushAll();
  log.info(`[CACHE CLEAR] Cleared ${keys.length} entries`);
};
