import { createLogger } from '../../logger.js';
import {
  getAllUsers,
  getUser,
  createUser,
  deleteUser,
  updateUser,
  removeWhatsAppPairing,
} from '../../db/users.js';
import { disconnectUserSocket } from '../../whatsapp/socket-pool.js';
import { formatErrorMessage } from '../utils.js';

const log = createLogger('TelegramAdmin');

// -- handleAdminUsersCommand --
export const handleAdminUsersCommand = async (ctx) => {
  try {
    const users = await getAllUsers();

    if (users.length === 0) {
      await ctx.reply('📋 Belum ada user. Semua user baru mulai sebagai *trial*.');
      return;
    }

    let message = '📋 *Semua User:*\n\n';

    for (const user of users) {
      const role = user.role.toUpperCase();
      const status = user.isActive ? '✅' : '❌';
      const phone = user.whatsappPhone ? `📱 ${user.whatsappPhone}` : '📵 Gak ada nomor';
      const expiryDate = user.expiryTime ?
        new Date(user.expiryTime).toLocaleDateString() : null;
      const expiry = expiryDate ? ` (Exp: ${expiryDate})` : '';

      message += `${status} User ${user.userId}: *${role}*${expiry}\n${phone}\n\n`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in admin users command');
    await ctx.reply(formatErrorMessage(error));
  }
};

// -- handleAdminAddUserCommand --
export const handleAdminAddUserCommand = async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length < 2) {
      await ctx.reply('Cara pake: /admin_add_user <userId> <role>\nRole: trial, user, owner');
      return;
    }

    const userId = Number(args[0]);
    const role = args[1].toLowerCase();

    if (!['trial', 'user', 'owner'].includes(role)) {
      await ctx.reply('❌ Role gak valid. Pake: trial, user, owner');
      return;
    }

    const existingUser = await getUser(userId);

    if (existingUser) {
      await ctx.reply(`❌ User ${userId} udah ada.`);
      return;
    }

    const expiryDays = role === 'trial' ? 1 : null;
    await createUser(userId, role, expiryDays);
    await ctx.reply(`✅ User ${userId} dibuat dengan role *${role}*.`, { parse_mode: 'Markdown' });
    log.info(`Admin created user ${userId} with role ${role}`);
  } catch (error) {
    log.error({ error }, 'Error in admin add user command');
    await ctx.reply(formatErrorMessage(error));
  }
};

// -- handleAdminRemoveUserCommand --
export const handleAdminRemoveUserCommand = async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length < 1) {
      await ctx.reply('Cara pake: /admin_remove_user <userId>');
      return;
    }

    const userId = Number(args[0]);
    const user = await getUser(userId);

    if (!user) {
      await ctx.reply(`❌ User ${userId} gak ketemu.`);
      return;
    }

    if (user.whatsappPaired) {
      await disconnectUserSocket(userId);
    }

    await deleteUser(userId);
    await ctx.reply(`✅ User ${userId} dihapus.`);
    log.info(`Admin removed user ${userId}`);
  } catch (error) {
    log.error({ error }, 'Error in admin remove user command');
    await ctx.reply(formatErrorMessage(error));
  }
};

// -- handleAdminSetRoleCommand --
export const handleAdminSetRoleCommand = async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length < 2) {
      await ctx.reply('Cara pake: /admin_set_role <userId> <role>\nRole: trial, user, owner');
      return;
    }

    const userId = Number(args[0]);
    const role = args[1].toLowerCase();

    if (!['trial', 'user', 'owner'].includes(role)) {
      await ctx.reply('❌ Role gak valid. Pake: trial, user, owner');
      return;
    }

    const user = await getUser(userId);

    if (!user) {
      await ctx.reply(`❌ User ${userId} gak ketemu.`);
      return;
    }

    await updateUser(userId, { role });
    await ctx.reply(`✅ Role user ${userId} diubah jadi *${role}*.`, { parse_mode: 'Markdown' });
    log.info(`Admin changed user ${userId} role to ${role}`);
  } catch (error) {
    log.error({ error }, 'Error in admin set role command');
    await ctx.reply(formatErrorMessage(error));
  }
};

// -- handleAdminSetExpiryCommand --
export const handleAdminSetExpiryCommand = async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length < 2) {
      await ctx.reply('Cara pake: /admin_set_expiry <userId> <days>\nSet days ke 0 untuk permanen');
      return;
    }

    const userId = Number(args[0]);
    const days = Number(args[1]);

    if (isNaN(days) || days < 0) {
      await ctx.reply('❌ Days harus angka positif atau 0 untuk permanen.');
      return;
    }

    const user = await getUser(userId);

    if (!user) {
      await ctx.reply(`❌ User ${userId} gak ketemu.`);
      return;
    }

    const expiryTime = days === 0 ? null : Date.now() + days * 24 * 60 * 60 * 1000;
    await updateUser(userId, { expiryTime });

    const msg = days === 0 ? 'permanen' : `${days} hari`;
    await ctx.reply(`✅ Expiry user ${userId} diset ke *${msg}*.`, { parse_mode: 'Markdown' });
    log.info(`Admin set user ${userId} expiry to ${msg}`);
  } catch (error) {
    log.error({ error }, 'Error in admin set expiry command');
    await ctx.reply(formatErrorMessage(error));
  }
};

// -- handleAdminRemovePairingCommand --
export const handleAdminRemovePairingCommand = async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length < 1) {
      await ctx.reply('Cara pake: /admin_remove_pairing <userId>');
      return;
    }

    const userId = Number(args[0]);
    const user = await getUser(userId);

    if (!user) {
      await ctx.reply(`❌ User ${userId} gak ketemu.`);
      return;
    }

    if (user.whatsappPaired) {
      await disconnectUserSocket(userId);
      await removeWhatsAppPairing(userId);
      await ctx.reply(`✅ Pairing WhatsApp user ${userId} dihapus.`);
      log.info(`Admin removed pairing for user ${userId}`);
    } else {
      await ctx.reply(`❌ User ${userId} gak ada pairing WhatsApp.`);
    }
  } catch (error) {
    log.error({ error }, 'Error in admin remove pairing command');
    await ctx.reply(formatErrorMessage(error));
  }
};

// -- handleAdminStatusCommand --
export const handleAdminStatusCommand = async (ctx) => {
  try {
    const users = await getAllUsers();
    const activeUsers = users.filter((u) => u.isActive).length;
    const pairedUsers = users.filter((u) => u.whatsappPaired).length;
    const trialUsers = users.filter((u) => u.role === 'trial').length;
    const permanentUsers = users.filter((u) => u.role === 'user').length;

    const message = '📊 *Status System:*\n\n' +
      `Total User: *${users.length}*\n` +
      `User Aktif: *${activeUsers}*\n` +
      `User Paired: *${pairedUsers}*\n\n` +
      `User Trial: *${trialUsers}*\n` +
      `User Permanen: *${permanentUsers}*`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    log.error({ error }, 'Error in admin status command');
    await ctx.reply(formatErrorMessage(error));
  }
};
