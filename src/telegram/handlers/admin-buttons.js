import { createLogger } from '../../logger.js';
import { getAllUsers } from '../../db/users.js';
import { mainAdminMenu } from '../keyboards.js';

const log = createLogger('TelegramAdminButtons');

// -- handleAdminUsersList --
export const handleAdminUsersList = async (ctx) => {
  try {
    const users = await getAllUsers();

    if (users.length === 0) {
      await ctx.reply('📋 No users yet', {
        reply_markup: mainAdminMenu(),
      });
      return;
    }

    let message = '👥 All Users:\n\n';

    for (const user of users) {
      const role = user.role.toUpperCase();
      const status = user.isActive ? '✅' : '❌';
      const phone = user.whatsappPhone || 'No number';
      message += `${status} ID: ${user.userId}\n`;
      message += `   Role: ${role}\n`;
      message += `   Phone: ${phone}\n\n`;
    }

    await ctx.reply(message, {
      reply_markup: mainAdminMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error in users list');
  }
};

// -- handleAdminStatus --
export const handleAdminStatus = async (ctx) => {
  try {
    const users = await getAllUsers();
    const activeUsers = users.filter((u) => u.isActive).length;
    const pairedUsers = users.filter((u) => u.whatsappPaired).length;
    const trialUsers = users.filter((u) => u.role === 'trial').length;
    const permanentUsers = users.filter((u) => u.role === 'user').length;

    const message = '📊 System Status\n\n' +
      `Total Users: ${users.length}\n` +
      `Active Users: ${activeUsers}\n` +
      `Paired Users: ${pairedUsers}\n\n` +
      `Trial Users: ${trialUsers}\n` +
      `Permanent Users: ${permanentUsers}`;

    await ctx.reply(message, {
      reply_markup: mainAdminMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error in admin status');
  }
};

// -- handleAdminMainMenu --
export const handleAdminMainMenu = async (ctx) => {
  try {
    const message = '🛠️ Admin Panel\n\nSelect an action:';
    await ctx.reply(message, {
      reply_markup: mainAdminMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error in admin main menu');
  }
};

// -- handleAdminAddUserStart --
export const handleAdminAddUserStart = async (ctx) => {
  try {
    const message = 'Send the user Telegram ID (numeric only)\nExample: 123456789';
    await ctx.reply(message, {
      reply_markup: mainAdminMenu(),
    });
    ctx.session.adminAddUserId = null;
  } catch (error) {
    log.error({ error }, 'Error in add user start');
  }
};
