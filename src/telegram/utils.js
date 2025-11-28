// -- escapeMarkdown --
export const escapeMarkdown = (text) => {
  return text
    .replace(/[_*[\]()~`>#+\-.!]/g, '\\$&')
    .replace(/\n/g, '\n');
};

// -- formatStatusMessage --
export const formatStatusMessage = (status) => {
  const telegramStatus = status.telegram ? 'Active' : '❌';
  const whatsappStatus = status.whatsapp ? 'Active' : '❌';
  const paired = status.paired ? 'Paired' : '❌';

  let message = '*Status Bot*\n\n';
  message += `Telegram: ${telegramStatus}\n`;
  message += `WhatsApp: ${whatsappStatus}\n`;
  message += `Paired: ${paired}`;

  if (status.phoneNumber) {
    message += `\nNomor: ${status.phoneNumber}`;
  }

  return message;
};

// -- formatErrorMessage --
export const formatErrorMessage = (error) => {
  let message = 'An error occurred';
  if (error) {
    if (typeof error === 'string') {
      message = error;
    } else if (error.message) {
      message = error.message;
    } else if (error.toString) {
      message = error.toString();
    }
  }
  return `❌ *Error*\n\n${escapeMarkdown(message)}`;
};

// -- formatPairingMessage --
export const formatPairingMessage = (code, phone) => {
  let message = '🤖 *VOLKSBOT PAIRING*\n\n';
  message += `📱 Nomor: ${phone}\n\n`;
  message += '🔐 *Your Code:*\n';
  message += `*${code}*\n\n`;
  message += '─────────────────────\n\n';
  message += '📖 *Steps:*\n';
  message += '1️⃣ Open WhatsApp on Phone\n';
  message += '2️⃣ Settings → Linked Devices\n';
  message += '3️⃣ Tap "Link a Device"\n';
  message += '4️⃣ Enter the code above\n';
  message += '5️⃣ Wait for connection confirmation\n\n';
  message += '⏳ Do not proceed until bot shows "VOLKSBOT Connected!"';

  return message;
};

// -- isAdminUser --
export const isAdminUser = (userId, adminId) => {
  return userId === adminId;
};
