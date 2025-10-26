import { createLogger } from '../../logger.js';
import { getAllUsers } from '../../db/users.js';
import { mainAdminMenu, cancelKeyboard } from '../keyboards.js';
import { getTrialDays } from '../../db/system.js';

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

      let expiryText = '';
      if (user.expiryTime) {
        const expiryDate = new Date(user.expiryTime);
        const now = new Date();
        const isExpired = expiryDate < now;
        const dateStr = expiryDate.toLocaleDateString();
        expiryText = isExpired ? ` (⏰ Expired: ${dateStr})` : ` (⏳ Expires: ${dateStr})`;
      } else {
        expiryText = ' (♾️ Permanent)';
      }

      message += `${status} ID: ${user.userId}\n`;
      message += `   Role: ${role}${expiryText}\n`;
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
    const trialDays = await getTrialDays();

    const message = '📊 System Status\n\n' +
      `Total Users: ${users.length}\n` +
      `Active Users: ${activeUsers}\n` +
      `Paired Users: ${pairedUsers}\n\n` +
      `Trial Users: ${trialUsers}\n` +
      `Permanent Users: ${permanentUsers}\n\n` +
      `⚙️ Trial Duration: ${trialDays} day(s)`;

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
    const message = '*➕ Add New User*\n\n' +
      'Send format: `<userId> <days>`\n\n' +
      '*Examples:*\n' +
      '• `123456789 30` - User with 30 days access\n' +
      '• `987654321 0` - Permanent user\n\n' +
      '*Role Selection:*\n' +
      '👤 User - Regular user with custom expiry\n' +
      '👑 Owner - Full admin access (permanent)\n\n' +
      '*💡 Note:* Days only apply to User role';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });
    ctx.session.adminAddUserId = null;
  } catch (error) {
    log.error({ error }, 'Error in add user start');
  }
};

// -- handleSetTrialDaysStart --
export const handleSetTrialDaysStart = async (ctx) => {
  try {
    const currentDays = await getTrialDays();
    const message = '⚙️ *Set Trial Duration*\n\n' +
      `Current: *${currentDays} day(s)*\n\n` +
      'Send new duration (in days):\n' +
      'Example: `7` for 7 days';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });
    ctx.session.settingTrialDays = true;
  } catch (error) {
    log.error({ error }, 'Error in set trial days start');
  }
};

// -- handleExtendUserStart --
export const handleExtendUserStart = async (ctx) => {
  try {
    const message = '*🔄 Extend User Access*\n\n' +
      'Send format: `<userId> <additionalDays>`\n\n' +
      '*Examples:*\n' +
      '• `123456789 7` - Add 7 days\n' +
      '• `987654321 30` - Add 30 days\n\n' +
      '*Note:*\n' +
      '• Days will be added to current expiry\n' +
      '• Works for User and Trial roles\n' +
      '• Owner role always permanent';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });

    ctx.session.extendingUser = true;
  } catch (error) {
    log.error({ error }, 'Error in extend user start');
  }
};

// -- handleRemoveUserStart --
export const handleRemoveUserStart = async (ctx) => {
  try {
    const message = '*🗑️ Remove User*\n\n' +
      'Send the user ID to remove:\n' +
      'Example: `123456789`\n\n' +
      '*⚠️ Warning:*\n' +
      '• This will permanently delete the user\n' +
      '• WhatsApp connection will be disconnected\n' +
      '• User data cannot be recovered';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });

    ctx.session.removingUser = true;
  } catch (error) {
    log.error({ error }, 'Error in remove user start');
  }
};
