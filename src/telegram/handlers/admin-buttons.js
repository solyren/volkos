import { createLogger } from '../../logger.js';
import { InlineKeyboard } from 'grammy';
import { getAllUsers, getUser } from '../../db/users.js';
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

    let message = `📊 Total: *${users.length}* user(s)\n\n`;

    const inlineKeyboard = new InlineKeyboard();
    let buttonCount = 0;

    for (const user of users) {
      const roleEmoji = user.role === 'owner' ? '👑' :
        user.role === 'user' ? '👤' : '⏳';
      const roleName = user.role === 'owner' ? 'Owner' :
        user.role === 'user' ? 'User' : 'Trial';
      const statusIcon = user.isActive ? '✅' : '❌';

      message += `${roleEmoji} ${roleName} ${statusIcon}\n`;
      message += `ID: \`${user.userId}\`\n\n`;

      inlineKeyboard.text(
        `🔍 ${user.userId}`,
        `view_user:${user.userId}`,
      );
      buttonCount++;

      if (buttonCount % 2 === 0) {
        inlineKeyboard.row();
      }
    }

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard,
    });
  } catch (error) {
    log.error({ error }, 'Error in users list');
  }
};

// -- handleViewUserDetail --
export const handleViewUserDetail = async (ctx) => {
  try {
    const callbackData = ctx.callbackQuery?.data;
    if (!callbackData || !callbackData.startsWith('view_user:')) {
      return;
    }

    const userId = Number(callbackData.split(':')[1]);
    const user = await getUser(userId);

    if (!user) {
      await ctx.answerCallbackQuery({
        text: '❌ User not found',
        show_alert: true,
      });
      return;
    }

    const roleEmoji = user.role === 'owner' ? '👑' :
      user.role === 'user' ? '👤' : '⏳';
    const roleName = user.role === 'owner' ? 'Owner' :
      user.role === 'user' ? 'User' : 'Trial';
    const status = user.isActive ? '✅ Active' : '❌ Inactive';
    const phone = user.whatsappPhone || '🚫 Not set';
    const paired = user.whatsappPaired ? '✅ Connected' : '❌ Disconnected';

    let expiryText = '';
    if (user.expiryTime) {
      const expiryDate = new Date(user.expiryTime);
      const now = new Date();
      const isExpired = expiryDate < now;
      const dateStr = expiryDate.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = expiryDate.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
      expiryText = isExpired ?
        `⏰ Expired: ${dateStr} ${timeStr}` :
        `⏳ Expires: ${dateStr} ${timeStr}`;
    } else {
      expiryText = '♾️ Permanent Access';
    }

    const message = `${roleEmoji} *User Information*\n` +
      '━━━━━━━━━━━━━━━━━━\n\n' +
      `🆔 *User ID*\n\`${user.userId}\`\n\n` +
      `🏷️ *Role*\n${roleEmoji} ${roleName}\n\n` +
      `🟢 *Status*\n${status}\n\n` +
      `📱 *Phone Number*\n${phone}\n\n` +
      `💬 *WhatsApp*\n${paired}\n\n` +
      `⏰ *Access Period*\n${expiryText}\n\n` +
      '━━━━━━━━━━━━━━━━━━';

    const backButton = new InlineKeyboard().text(
      '🔙 Back to List',
      'back_to_users',
    );

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: backButton,
    });

    await ctx.answerCallbackQuery();
  } catch (error) {
    log.error({ error }, 'Error in view user detail');
    await ctx.answerCallbackQuery({
      text: '❌ Error loading user details',
      show_alert: true,
    });
  }
};

// -- handleBackToUsersList --
export const handleBackToUsersList = async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    await ctx.deleteMessage();
    await handleAdminUsersList(ctx);
  } catch (error) {
    log.error({ error }, 'Error in back to users list');
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
