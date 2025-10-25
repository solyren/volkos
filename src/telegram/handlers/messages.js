import { createLogger } from '../../logger.js';
import { state } from '../../bridge/state.js';
import { formatStatusMessage } from '../utils.js';

const log = createLogger('TelegramMessages');

// -- handleStatusCommand --
export const handleStatusCommand = async (ctx) => {
  try {
    const status = state.getStatus();
    await ctx.reply(formatStatusMessage(status), { parse_mode: 'Markdown' });
    log.debug('Status command executed');
  } catch (error) {
    log.error({ error }, 'Error in status command');
    await ctx.reply('❌ Error retrieving status');
  }
};

// -- handleStartCommand --
export const handleStartCommand = async (ctx) => {
  try {
    const message = `
Welcome to VOLKOS Bot! 🤖

Available commands:
/pair - Pair WhatsApp account
/status - Check connection status
/disconnect - Disconnect WhatsApp
/help - Show this message

This bot bridges Telegram and WhatsApp messages.
    `.trim();

    await ctx.reply(message);
    log.info(`User ${ctx.from.id} started bot`);
  } catch (error) {
    log.error({ error }, 'Error in start command');
  }
};

// -- handleHelpCommand --
export const handleHelpCommand = async (ctx) => {
  try {
    const message = `
*VOLKOS Bot Help*

*Commands:*
/pair - Start pairing with WhatsApp
/status - Show current connection status
/disconnect - Disconnect WhatsApp
/help - Show this message

*How to use:*
1. Use /pair to start
2. Enter your phone number
3. Scan the pairing code in WhatsApp
4. Messages will be relayed automatically

    `.trim();

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in help command');
  }
};

// -- handleTextMessage --
export const handleTextMessage = async (ctx) => {
  try {
    const message = ctx.message.text;
    log.debug(`Text message received: ${message.substring(0, 50)}`);
  } catch (error) {
    log.error({ error }, 'Error handling text message');
  }
};
