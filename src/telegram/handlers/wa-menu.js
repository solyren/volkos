import { createLogger } from '../../logger.js';
import { ownerWAMenu } from '../keyboards-wa.js';
import { ownerMainMenu } from '../keyboards.js';

const log = createLogger('WAMenuHandler');

// -- handleOwnerWAMenuStart --
export const handleOwnerWAMenuStart = async (ctx) => {
  try {
    const message = '📱 *Manajemen WhatsApp*\n\n' +
      'Pilih aksi:';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: ownerWAMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error in owner WA menu');
    await ctx.reply('❌ Gagal membuka menu WA', {
      reply_markup: ownerMainMenu(),
    });
  }
};
