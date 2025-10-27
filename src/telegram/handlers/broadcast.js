import { createLogger } from '../../logger.js';
import { getAllUsers } from '../../db/users.js';
import { ownerMainMenu, cancelKeyboard } from '../keyboards.js';

const log = createLogger('TelegramBroadcast');

// -- handleBroadcastStart --
export const handleBroadcastStart = async (ctx) => {
  try {
    const message = '📢 *Pesan Siaran*\n\n' +
      'Kirim pesan yang ingin kamu siarkan ke semua user.\n\n' +
      '*Catatan:*\n' +
      '• Hanya pesan teks\n' +
      '• Akan dikirim ke semua user aktif\n' +
      '• Mendukung format Markdown';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });

    ctx.session.waitingForBroadcast = true;
  } catch (error) {
    log.error({ error }, 'Error in broadcast start');
  }
};

// -- handleBroadcastMessage --
export const handleBroadcastMessage = async (ctx) => {
  try {
    if (!ctx.session?.waitingForBroadcast) {
      return;
    }

    const broadcastText = ctx.message.text;

    if (!broadcastText || broadcastText.trim() === '') {
      await ctx.reply('❌ Pesan kosong. Silakan kirim pesan yang valid.');
      ctx.session.waitingForBroadcast = false;
      return;
    }

    const users = await getAllUsers();
    const activeUsers = users.filter((u) => u.isActive && u.userId !== String(ctx.from?.id));

    if (activeUsers.length === 0) {
      await ctx.reply('❌ Tidak ada user aktif untuk disiarkan.', {
        reply_markup: ownerMainMenu(),
      });
      ctx.session.waitingForBroadcast = false;
      return;
    }

    await ctx.reply(
      '📢 *Menyiarkan...*\n\n' +
      `Mengirim ke ${activeUsers.length} user di background.\n\n` +
      'Kamu akan menerima ringkasan saat selesai.',
      {
        parse_mode: 'Markdown',
        reply_markup: ownerMainMenu(),
      },
    );

    ctx.session.waitingForBroadcast = false;

    // eslint-disable-next-line no-undef
    setTimeout(async () => {
      let successCount = 0;
      let failCount = 0;

      for (const user of activeUsers) {
        try {
          await ctx.api.sendMessage(user.userId, broadcastText, {
            parse_mode: 'Markdown',
          });
          successCount++;
          await new Promise((resolve) => globalThis.setTimeout(resolve, 100));
        } catch (error) {
          log.error({ error, userId: user.userId }, 'Failed to send broadcast');
          failCount++;
        }
      }

      const resultMessage = '✅ *Siaran Selesai!*\n\n' +
        `✅ Terkirim: ${successCount}\n` +
        `❌ Gagal: ${failCount}\n` +
        `📊 Total: ${activeUsers.length}`;

      await ctx.api.sendMessage(ctx.from.id, resultMessage, {
        parse_mode: 'Markdown',
      });

      log.info(`Broadcast completed: ${successCount} sent, ${failCount} failed`);
    }, 100);
  } catch (error) {
    log.error({ error }, 'Error handling broadcast message');
    await ctx.reply('❌ Siaran gagal. Silakan coba lagi.', {
      reply_markup: ownerMainMenu(),
    });
    ctx.session.waitingForBroadcast = false;
  }
};
