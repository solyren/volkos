import { createLogger } from '../../logger.js';
import { getUser } from '../../db/users.js';
import { isUserSocketConnected } from '../../whatsapp/socket-pool.js';
import { ownerMainMenu, userMainMenu } from '../keyboards.js';
import { config } from '../../config.js';
import {
  checkGroupMembership,
  getGroupVerificationMessage,
  getGroupVerificationMarkup,
} from '../../db/groups.js';

const log = createLogger('TelegramMessages');

// -- handleStatusCommand --
export const handleStatusCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const user = await getUser(userId);

    if (!user) {
      const menu = ownerMainMenu();
      await ctx.reply('❌ Profil user tidak ditemukan', {
        reply_markup: menu,
      });
      return;
    }

    const whatsappConnected = isUserSocketConnected(userId);
    const role = user.role === 'owner' ? 'PEMILIK' : 'PENGGUNA';
    const phoneStatus = user.whatsappPhone ? `✅ ${user.whatsappPhone}` : '❌ Belum pair';
    const connectionStatus = whatsappConnected ? '✅ Connected' : '❌ Disconnected';

    const message = '📊 *Status Lo:*\n\n' +
      `Peran: *${role}*\n` +
      `WhatsApp: ${phoneStatus}\n` +
      `Koneksi: ${connectionStatus}\n` +
      `Aktif: ${user.isActive ? '✅' : '❌'}`;

    const menu = user.role === 'owner' ? ownerMainMenu() : userMainMenu();
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: menu,
    });
    log.debug(`Status command executed for user ${userId}`);
  } catch (error) {
    log.error({ error }, 'Error in status command');
    const menu = ownerMainMenu();
    await ctx.reply('❌ Gagal mengambil status', {
      reply_markup: menu,
    });
  }
};

// -- handleStartCommand --
export const handleStartCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const ownerId = Number(process.env.TELEGRAM_ADMIN_ID);
    const isOwner = userId === ownerId;

    const groupCheck = await checkGroupMembership(ctx, userId);
    if (!groupCheck.isMember) {
      const message = getGroupVerificationMessage(groupCheck.missingGroups);
      const keyboard = getGroupVerificationMarkup(groupCheck.missingGroups);
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
      return;
    }

    const { createUser, updateUser } = await import('../../db/users.js');
    let user = await getUser(userId);

    if (!user) {
      const role = isOwner ? 'owner' : 'user';
      log.info(`New ${role} detected: ${userId}`);
      await createUser(userId, role);
      user = { userId, role, isNew: true };
    } else if (isOwner && user.role !== 'owner') {
      log.info(`Updating user ${userId} role to owner`);
      await updateUser(userId, { role: 'owner' });
      user.role = 'owner';
    }

    let message = '';
    let thumbnail = '';

    if (user.role === 'owner') {
      message = '👑 *Selamat Datang, Owner!*\n\n' +
        '✨ Lo punya *akses unlimited* ke semua fitur.\n\n' +
        '💼 *Panel Kontrol:*\n' +
        '• Kelola semua user\n' +
        '• Setting sistem\n' +
        '• Kirim broadcast\n' +
        '• Akses bot penuh\n\n' +
        '💡 Pilih menu di bawah:';
      thumbnail = config.thumbnails.welcomeOwner;
    } else {
      message = '🎉 *Selamat Datang di VOLKSBOT!*\n\n' +
        '✨ Selamat datang! Semua fitur tersedia untuk lo.\n\n' +
        '🚀 *Fitur:*\n' +
        '• Sambung WhatsApp\n' +
        '• Cek bio (bulk turbo)\n' +
        '• Full akses koneksi\n' +
        '• Support prioritas\n\n' +
        '👇 Pilih menu:';
      thumbnail = config.thumbnails.welcomeUser;
    }

    if (thumbnail && thumbnail.trim() !== '') {
      try {
        await ctx.replyWithPhoto(thumbnail, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: user.role === 'owner' ? ownerMainMenu() : userMainMenu(),
        });
      } catch (photoError) {
        log.warn({ photoError }, 'Failed to send thumbnail, sending text only');
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: user.role === 'owner' ? ownerMainMenu() : userMainMenu(),
        });
      }
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: user.role === 'owner' ? ownerMainMenu() : userMainMenu(),
      });
    }

    log.info(`User ${userId} started bot (role: ${user.role})`);
  } catch (error) {
    log.error({ error }, 'Error in start command');
  }
};

// -- handleHelpCommand --
export const handleHelpCommand = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const user = await getUser(userId);

    let message = '';

    if (user?.role === 'owner') {
      message = '*VOLKOS Bot - Panduan Pemilik*\n\n' +
        '*Fitur Pemilik:*\n' +
        '👥 Lihat User - Daftar semua user dengan status\n' +
        '➕ Tambah User - Buat user baru\n' +
        '📊 Status Sistem - Lihat statistik sistem\n' +
        '📢 Siaran - Kirim pesan ke semua user\n' +
        '📱 Pairing - Sambungkan akun WhatsApp\n' +
        '🔍 Cek Bio - Cek bio WhatsApp (bulk)\n\n' +
        '*Tambah User:*\n' +
        '• Kirim ID user yang ingin ditambahkan\n' +
        '• Pilih peran: 👤 Pengguna atau 👑 Pemilik\n\n' +
        '*Cara Pakai Cek Bio:*\n' +
        '• Kirim 1 nomor → Cek tunggal\n' +
        '• Kirim banyak nomor → Cek bulk (mode turbo)\n' +
        '• Upload file .txt → Cek bulk\n' +
        '• Hasil: ≤10 (pesan), >10 (file)\n\n' +
        '*💡 Tips:* Gunakan tombol 🔙 Batal kapan saja untuk keluar';
    } else {
      message = '*VOLKOS Bot - Panduan Pengguna*\n\n' +
        '*Fitur Tersedia:*\n' +
        '📱 Sambungkan WhatsApp - Hubungkan akun WhatsApp kamu\n' +
        '📊 Status - Cek status koneksi kamu\n' +
        '🔍 Cek Bio - Cek satu atau banyak nomor\n' +
        '❌ Putuskan - Hapus sambungan WhatsApp\n\n' +
        '*Cara Pakai Cek Bio:*\n' +
        '• Kirim 1 nomor → Cek tunggal\n' +
        '• Kirim banyak nomor → Cek bulk (mode turbo)\n' +
        '• Upload file .txt → Cek bulk\n' +
        '• ≤10 nomor (teks) → Hasil dalam pesan\n' +
        '• >10 nomor ATAU file → 2 file .txt\n\n' +
        '*💡 Tips:* Gunakan tombol 🔙 Batal kapan saja untuk keluar';
    }

    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: menu,
    });
  } catch (error) {
    log.error({ error }, 'Error in help command');
    const menu = ownerMainMenu();
    await ctx.reply('❌ Gagal memuat bantuan', {
      reply_markup: menu,
    });
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
