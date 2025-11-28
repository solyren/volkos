import { createLogger } from '../../logger.js';
import { getAllUsers } from '../../db/users.js';
import { ownerMainMenu, cancelKeyboard } from '../keyboards.js';

const log = createLogger('TelegramBroadcast');

// -- handleBroadcastStart --
export const handleBroadcastStart = async (ctx) => {
  try {
    const message = '*Broadcast Message*\n\n' +
      'Send the message you want to broadcast to all users.\n\n' +
      '*Note:*\n' +
      '• Text messages only\n' +
      '• Will be sent to all active users\n' +
      '• Supports Markdown formatting';

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
      await ctx.reply('Message is empty. Please send a valid message.');
      ctx.session.waitingForBroadcast = false;
      return;
    }

    const users = await getAllUsers();
    const activeUsers = users.filter((u) => u.isActive && u.userId !== String(ctx.from?.id));

    if (activeUsers.length === 0) {
      await ctx.reply('No active users to broadcast to.', {
        reply_markup: ownerMainMenu(),
      });
      ctx.session.waitingForBroadcast = false;
      return;
    }

    await ctx.reply(
      '*Broadcasting...*\n\n' +
      `Sending to ${activeUsers.length} users in background.\n\n` +
      'You will receive a summary when complete.',
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

      const resultMessage = '*Broadcast Complete*\n\n' +
        `Sent: ${successCount}\n` +
        `Failed: ${failCount}\n` +
        `Total: ${activeUsers.length}`;

      await ctx.api.sendMessage(ctx.from.id, resultMessage, {
        parse_mode: 'Markdown',
      });

      log.info(`Broadcast completed: ${successCount} sent, ${failCount} failed`);
    }, 100);
  } catch (error) {
    log.error({ error }, 'Error handling broadcast message');
    await ctx.reply('Broadcast failed. Please try again.', {
      reply_markup: ownerMainMenu(),
    });
    ctx.session.waitingForBroadcast = false;
  }
};
