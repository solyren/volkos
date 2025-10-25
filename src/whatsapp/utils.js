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
