import { createLogger } from '../../logger.js';
import { ownerWAMenu } from '../keyboards-wa.js';

const log = createLogger('WAMenuHandler');

// -- handleOwnerWAMenuStart --
export const handleOwnerWAMenuStart = async (ctx) => {
  try {
    const message = '📱 *WhatsApp Management*\n\n' +
      'Select an action:';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: ownerWAMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error in owner WA menu');
    await ctx.reply('❌ Error opening WA menu');
  }
};
