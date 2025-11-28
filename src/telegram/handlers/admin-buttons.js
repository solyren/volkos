import { createLogger } from '../../logger.js';
import { InlineKeyboard } from 'grammy';
import { getAllUsers, getUser } from '../../db/users.js';
import { mainAdminMenu, cancelKeyboard } from '../keyboards.js';

const log = createLogger('TelegramAdminButtons');

// -- handleAdminUsersList --
export const handleAdminUsersList = async (ctx) => {
  try {
    const users = await getAllUsers();

    if (users.length === 0) {
      await ctx.reply('No users found', {
        reply_markup: mainAdminMenu(),
      });
      return;
    }

    let message = `*Total: ${users.length} users*\n\n`;

    const inlineKeyboard = new InlineKeyboard();
    let buttonCount = 0;

    for (const user of users) {
      const roleName = user.role === 'owner' ? 'Owner' : 'User';
      const statusIcon = user.isActive ? 'Active' : 'Inactive';

      message += `${roleName} ${statusIcon}\n`;
      message += `ID: \`${user.userId}\`\n\n`;

      inlineKeyboard.text(
        `${user.userId}`,
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
        text: '⚠️ User not found',
        show_alert: true,
      });
      return;
    }

    const roleName = user.role === 'owner' ? 'Owner' : 'User';
    const status = user.isActive ? 'Active' : 'Inactive';
    const phone = user.whatsappPhone || 'Not set';
    const paired = user.whatsappPaired ? 'Paired' : 'Not paired';

    const message = '*User Information*\n' +
      '━━━━━━━━━━━━━━━━━━\n\n' +
      `*User ID*\n\`${user.userId}\`\n\n` +
      `*Role*\n${roleName}\n\n` +
      `*Status*\n${status}\n\n` +
      `*Phone Number*\n${phone}\n\n` +
      `*WhatsApp*\n${paired}\n\n` +
      '━━━━━━━━━━━━━━━━━━';

    const backButton = new InlineKeyboard().text(
      'Back to List',
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
      text: 'Failed to load user details',
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
    const ownerUsers = users.filter((u) => u.role === 'owner').length;
    const regularUsers = users.filter((u) => u.role === 'user').length;

    const message = '*System Status*\n\n' +
      `Total Users: ${users.length}\n` +
      `Active Users: ${activeUsers}\n` +
      `Connected Users: ${pairedUsers}\n\n` +
      `Owners: ${ownerUsers}\n` +
      `Regular Users: ${regularUsers}`;

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: mainAdminMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error in admin status');
  }
};

// -- handleAdminMainMenu --
export const handleAdminMainMenu = async (ctx) => {
  try {
    const message = '🛠️ Admin Panel\n\nSelect action:';
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
    const message = '*Add New User*\n\n' +
      'Send ID user:\n' +
      'Example: `123456789`\n\n' +
      '*Role Options:*\n' +
      'User - Regular user access\n' +
      'Owner - Full admin access';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });
    ctx.session.adminAddUserId = null;
  } catch (error) {
    log.error({ error }, 'Error in add user start');
  }
};



// -- handleRemoveUserStart --
export const handleRemoveUserStart = async (ctx) => {
  try {
    const message = '*Remove User*\n\n' +
      'Send the user ID to remove:\n' +
      'Example: `123456789`\n\n' +
      '*Warning:*\n' +
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
