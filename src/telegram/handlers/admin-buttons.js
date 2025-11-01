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
      await ctx.reply('📋 Belum ada user', {
        reply_markup: mainAdminMenu(),
      });
      return;
    }

    let message = `📊 Total: *${users.length}* user\n\n`;

    const inlineKeyboard = new InlineKeyboard();
    let buttonCount = 0;

    for (const user of users) {
      const roleEmoji = user.role === 'owner' ? '👑' :
        user.role === 'user' ? '👤' : '⏳';
      const roleName = user.role === 'owner' ? 'Pemilik' :
        user.role === 'user' ? 'Pengguna' : 'Trial';
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
        text: '❌ User tidak ditemukan',
        show_alert: true,
      });
      return;
    }

    const roleEmoji = user.role === 'owner' ? '👑' :
      user.role === 'user' ? '👤' : '⏳';
    const roleName = user.role === 'owner' ? 'Pemilik' :
      user.role === 'user' ? 'Pengguna' : 'Trial';
    const status = user.isActive ? '✅ Aktif' : '❌ Tidak Aktif';
    const phone = user.whatsappPhone || '🚫 Belum diatur';
    const paired = user.whatsappPaired ? '✅ Paired' : '❌ Unpaired';

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
        `⏰ Kedaluwarsa: ${dateStr} ${timeStr}` :
        `⏳ Akan Kedaluwarsa: ${dateStr} ${timeStr}`;
    } else {
      expiryText = '♾️ Akses Permanen';
    }

    const message = `${roleEmoji} *Informasi User*\n` +
      '━━━━━━━━━━━━━━━━━━\n\n' +
      `🆔 *User ID*\n\`${user.userId}\`\n\n` +
      `🏷️ *Peran*\n${roleEmoji} ${roleName}\n\n` +
      `🟢 *Status*\n${status}\n\n` +
      `📱 *Nomor Telepon*\n${phone}\n\n` +
      `💬 *WhatsApp*\n${paired}\n\n` +
      `⏰ *Periode Akses*\n${expiryText}\n\n` +
      '━━━━━━━━━━━━━━━━━━';

    const backButton = new InlineKeyboard().text(
      '🔙 Kembali ke Daftar',
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
      text: '❌ Gagal memuat detail user',
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

    const message = '📊 Status Sistem\n\n' +
      `Total User: ${users.length}\n` +
      `User Aktif: ${activeUsers}\n` +
      `User Tersambung: ${pairedUsers}\n\n` +
      `User Trial: ${trialUsers}\n` +
      `User Permanen: ${permanentUsers}\n\n` +
      `⚙️ Durasi Trial: ${trialDays} hari`;

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
    const message = '🛠️ Panel Admin\n\nPilih aksi:';
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
    const message = '*➕ Tambah User Baru*\n\n' +
      'Kirim format: `<userId> <hari>`\n\n' +
      '*Contoh:*\n' +
      '• `123456789 30` - User dengan akses 30 hari\n' +
      '• `987654321 0` - User permanen\n\n' +
      '*Pilihan Peran:*\n' +
      '👤 Pengguna - User biasa dengan masa berlaku custom\n' +
      '👑 Pemilik - Akses admin penuh (permanen)\n\n' +
      '*💡 Catatan:* Hari hanya berlaku untuk peran Pengguna';

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
    log.info(`[TRIAL] Current trial days: ${currentDays}`);
    const message = '⚙️ *Set Trial Duration*\n\n' +
      `✅ Current: *${currentDays} days*\n\n` +
      'Send new duration (days):\n' +
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
    const message = '*🔄 Perpanjang Akses User*\n\n' +
      'Kirim format: `<userId> <hariTambahan>`\n\n' +
      '*Contoh:*\n' +
      '• `123456789 7` - Tambah 7 hari\n' +
      '• `987654321 30` - Tambah 30 hari\n\n' +
      '*Catatan:*\n' +
      '• Hari akan ditambahkan ke masa berlaku saat ini\n' +
      '• Berlaku untuk peran Pengguna dan Trial\n' +
      '• Peran Pemilik selalu permanen';

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
    const message = '*🗑️ Hapus User*\n\n' +
      'Kirim ID user yang akan dihapus:\n' +
      'Contoh: `123456789`\n\n' +
      '*⚠️ Peringatan:*\n' +
      '• Ini akan menghapus user secara permanen\n' +
      '• Koneksi WhatsApp akan diputuskan\n' +
      '• Data user tidak dapat dipulihkan';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });

    ctx.session.removingUser = true;
  } catch (error) {
    log.error({ error }, 'Error in remove user start');
  }
};
