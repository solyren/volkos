import { createLogger } from '../logger.js';
import { getCachedBio, setCachedBio } from './cache.js';
import { getSocketLimiter } from './socket-limiter.js';

const log = createLogger('WhatsAppUtils');

// -- formatPhoneNumber --
export const formatPhoneNumber = (phone) => {
  let formatted = phone.replace(/\D/g, '');
  if (!formatted.startsWith('62') && formatted.startsWith('0')) {
    formatted = '62' + formatted.substring(1);
  }
  if (!formatted.startsWith('62')) {
    formatted = '62' + formatted;
  }
  return formatted;
};

// -- isValidPhoneNumber --
export const isValidPhoneNumber = (phone) => {
  const formatted = formatPhoneNumber(phone);
  return formatted.length >= 10 && formatted.length <= 15;
};

// -- handleConnectionError --
export const handleConnectionError = (error, lastDisconnect) => {
  const reason = lastDisconnect?.error?.output?.statusCode;
  log.error({ reason, error }, 'Connection error');
  return reason;
};

// -- formatBioDate --
export const formatBioDate = (timestamp) => {
  if (!timestamp || timestamp === '1970-01-01T00:00:00.000Z') {
    return 'Gak diketahui';
  }
  const date = new Date(timestamp);
  return date.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
};

// -- fetchBioForUser --
export const fetchBioForUser = async (socket, phoneNumber, useCache = true, userId = null) => {
  try {
    if (!socket) {
      throw new Error('Socket gak connect');
    }

    if (useCache) {
      const cached = getCachedBio(phoneNumber);
      if (cached) {
        return cached;
      }
    }

    let jid = phoneNumber;
    if (!jid.includes('@')) {
      const cleaned = jid.replace(/\D/g, '');
      jid = `${cleaned}@s.whatsapp.net`;
    }

    log.info(`[DEBUG BIO] Fetching status for JID: ${jid}`);

    let statusResponse;
    if (userId) {
      const limiter = getSocketLimiter(userId);
      statusResponse = await limiter.run(async () => {
        return await socket.fetchStatus(jid);
      });
    } else {
      statusResponse = await socket.fetchStatus(jid);
    }
    log.info(`[DEBUG BIO] Status response: ${JSON.stringify(statusResponse)}`);

    if (!statusResponse || statusResponse.length === 0) {
      const errorResult = { error: 'User gak ketemu atau bio gak tersedia' };
      setCachedBio(phoneNumber, errorResult, 300);
      return errorResult;
    }

    const bioData = statusResponse[0];
    const bioText = bioData?.status?.status;
    const bioSetAt = bioData?.status?.setAt;

    if (!bioText || bioText.trim() === '') {
      const noBioResult = { error: 'User gak punya bio' };
      setCachedBio(phoneNumber, noBioResult, 600);
      return noBioResult;
    }

    const result = {
      phone: phoneNumber,
      bio: bioText,
      setAt: formatBioDate(bioSetAt),
      success: true,
    };

    setCachedBio(phoneNumber, result, 3600);
    return result;
  } catch (error) {
    log.error({ error }, `Failed to fetch bio for ${phoneNumber}`);
    const errorResult = { error: error?.message || 'Gagal ambil bio' };
    if (error?.message?.includes('rate') || error?.message?.includes('429')) {
      setCachedBio(phoneNumber, errorResult, 60);
    }
    return errorResult;
  }
};
