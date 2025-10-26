import { createLogger } from '../logger.js';

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
    return 'Unknown';
  }
  const date = new Date(timestamp);
  return date.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
};

// -- fetchBioForUser --
export const fetchBioForUser = async (socket, phoneNumber) => {
  try {
    if (!socket) {
      throw new Error('Socket not connected');
    }

    let jid = phoneNumber;
    if (!jid.includes('@')) {
      const cleaned = jid.replace(/\D/g, '');
      jid = `${cleaned}@s.whatsapp.net`;
    }

    log.info(`[DEBUG BIO] Fetching status for JID: ${jid}`);
    const statusResponse = await socket.fetchStatus(jid);
    log.info(`[DEBUG BIO] Status response: ${JSON.stringify(statusResponse)}`);

    if (!statusResponse || statusResponse.length === 0) {
      return { error: 'User not found or bio not available' };
    }

    const bioData = statusResponse[0];
    const bioText = bioData?.status?.status;
    const bioSetAt = bioData?.status?.setAt;

    if (!bioText || bioText.trim() === '') {
      return { error: 'User has no bio' };
    }

    return {
      phone: phoneNumber,
      bio: bioText,
      setAt: formatBioDate(bioSetAt),
      success: true,
    };
  } catch (error) {
    log.error({ error }, `Failed to fetch bio for ${phoneNumber}`);
    return { error: error?.message || 'Failed to fetch bio' };
  }
};
