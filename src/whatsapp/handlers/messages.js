import { createLogger } from '../../logger.js';

const log = createLogger('WAMessages');

// -- handleMessagesUpsert --
export const handleMessagesUpsert = async (messages, _sock) => {
  for (const msg of messages.messages) {
    if (!msg.message || msg.key.fromMe) {
      continue;
    }

    try {
      const sender = msg.key.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

      if (text) {
        log.info({ sender }, `Message received: ${text.substring(0, 50)}`);
      }
    } catch (error) {
      log.error({ error }, 'Error handling message');
    }
  }
};

// -- handleGroupsUpdate --
export const handleGroupsUpdate = async (groups) => {
  log.debug(`Groups update: ${groups.length} groups`);
};

// -- handlePresenceUpdate --
export const handlePresenceUpdate = async (_presences) => {
  log.debug('Presence update received');
};
