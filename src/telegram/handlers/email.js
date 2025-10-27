import { createLogger } from '../../logger.js';
import nodemailer from 'nodemailer';
import {
  saveUserEmail,
  getUserEmail,
  setEmailTemplate,
  getEmailTemplate,
} from '../../db/email.js';
import { getUser } from '../../db/users.js';
import { ownerMainMenu, userMainMenu, cancelKeyboard } from '../keyboards.js';
import { ownerEmailMenu } from '../keyboards-email.js';
import { getRedis } from '../../db/redis.js';

const log = createLogger('EmailHandler');

// -- handleOwnerEmailMenuStart --
export const handleOwnerEmailMenuStart = async (ctx) => {
  try {
    const message = '📧 *Manajemen Email*\n\n' +
      'Pilih aksi:';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: ownerEmailMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error in owner email menu');
    await ctx.reply('❌ Gagal membuka menu email', {
      reply_markup: ownerMainMenu(),
    });
  }
};

// -- handleOwnerViewTemplate --
export const handleOwnerViewTemplate = async (ctx) => {
  try {
    const template = await getEmailTemplate();

    if (!template) {
      await ctx.reply(
        '❌ *Template Belum Diatur*\n\n' +
        '⚠️ Template email belum dikonfigurasi.\n\n' +
        '📝 Gunakan tombol *Atur Template* untuk membuat.',
        {
          parse_mode: 'Markdown',
          reply_markup: ownerEmailMenu(),
        },
      );
      return;
    }

    const message = '👁️ *Template Email Saat Ini*\n\n' +
      '```\n' +
      template +
      '\n```\n\n' +
      '*Placeholder Tersedia:*\n' +
      '• `{nama}` - Nama user\n' +
      '• `{nomor}` - Nomor telepon\n\n' +
      '💡 Gunakan *Atur Template* untuk mengubah';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: ownerEmailMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error viewing template');
    await ctx.reply('❌ Gagal memuat template', {
      reply_markup: ownerEmailMenu(),
    });
  }
};

// -- handleOwnerDeleteTemplate --
export const handleOwnerDeleteTemplate = async (ctx) => {
  try {
    const template = await getEmailTemplate();

    if (!template) {
      await ctx.reply(
        '❌ *Tidak Ada Template untuk Dihapus*\n\n' +
        'Template email belum diatur.',
        {
          parse_mode: 'Markdown',
          reply_markup: ownerEmailMenu(),
        },
      );
      return;
    }

    const redis = getRedis();
    await redis.del('email:template');

    await ctx.reply(
      '✅ *Template Berhasil Dihapus!*\n\n' +
      '🗑️ Template email telah dihapus.\n\n' +
      '⚠️ User tidak dapat menggunakan Fix Nomor sampai kamu mengatur template baru.',
      {
        parse_mode: 'Markdown',
        reply_markup: ownerEmailMenu(),
      },
    );

    log.info('Email template deleted by owner');
  } catch (error) {
    log.error({ error }, 'Error deleting template');
    await ctx.reply('❌ Gagal menghapus template', {
      reply_markup: ownerEmailMenu(),
    });
  }
};

// -- handleOwnerSetTemplateStart --
export const handleOwnerSetTemplateStart = async (ctx) => {
  try {
    const currentTemplate = await getEmailTemplate();
    const templatePreview = currentTemplate || 'Belum ada template';

    const message = '📧 *Konfigurasi Template Email*\n\n' +
      '*Template Saat Ini:*\n' +
      '```\n' +
      templatePreview +
      '\n```\n\n' +
      '*Placeholder Tersedia:*\n' +
      '• `{nama}` - Nama user\n' +
      '• `{nomor}` - Nomor telepon\n\n' +
      '*Contoh:*\n' +
      '```\n' +
      'Halo, nama saya {nama}.\n' +
      'Saya butuh bantuan dengan nomor: {nomor}\n' +
      '```\n\n' +
      '📝 Kirim teks template kamu sekarang:';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });

    ctx.session.settingEmailTemplate = true;
  } catch (error) {
    log.error({ error }, 'Error in owner email template start');
    await ctx.reply('❌ Gagal memulai pengaturan template email', {
      reply_markup: ownerMainMenu(),
    });
  }
};

// -- handleOwnerEmailTemplateInput --
export const handleOwnerEmailTemplateInput = async (ctx, text) => {
  try {
    if (!text.includes('{nama}') || !text.includes('{nomor}')) {
      await ctx.reply(
        '❌ *Template Tidak Valid*\n\n' +
        'Template harus mengandung keduanya:\n' +
        '• Placeholder `{nama}`\n' +
        '• Placeholder `{nomor}`\n\n' +
        'Silakan kirim lagi:',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    await setEmailTemplate(text);
    ctx.session.settingEmailTemplate = false;

    await ctx.reply(
      '✅ *Template Email Diperbarui!*\n\n' +
      '*Template Baru:*\n' +
      '```\n' +
      text +
      '\n```\n\n' +
      '💡 User sekarang dapat menggunakan fitur Fix Nomor',
      {
        parse_mode: 'Markdown',
        reply_markup: ownerMainMenu(),
      },
    );

    log.info('Email template updated by owner');
  } catch (error) {
    log.error({ error }, 'Error in owner email template input');
    await ctx.reply('❌ Gagal memperbarui template email', {
      reply_markup: ownerMainMenu(),
    });
  }
};

// -- handleUserSetupEmailStart --
export const handleUserSetupEmailStart = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const existingEmail = await getUserEmail(userId);

    let message = '';

    if (existingEmail) {
      message = '📧 *Setup Email*\n\n' +
        '✅ *Konfigurasi Sekarang:*\n' +
        `Email: \`${existingEmail.email}\`\n` +
        `Nama: \`${existingEmail.nama}\`\n\n` +
        '🔄 *Mau update? Mulai dari awal ya.*\n\n' +
        '📧 *Langkah 1/3: Kirim email Gmail kamu*\n\n' +
        '*Contoh:*\n' +
        '`emailku@gmail.com`';
    } else {
      message = '📧 *Setup Email - Langkah 1/3*\n\n' +
        '📧 Kirim *email Gmail kamu*:\n\n' +
        '*Contoh:*\n' +
        '`emailku@gmail.com`\n\n' +
        '*⚠️ Cara dapetin App Password (nanti):*\n' +
        '1. Google Account → Security\n' +
        '2. Aktifkan 2-Step Verification → App passwords\n' +
        '3. Generate new App Password → https://myaccount.google.com/apppasswords"\n' +
        '4. Copy password 16 karakter\n\n' +
        '*🔒 Password kamu bakal dienkripsi aman*';
    }

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });

    ctx.session.setupEmail = {
      step: 'email',
      email: '',
      password: '',
    };
  } catch (error) {
    log.error({ error }, 'Error in user setup email start');
    const user = await getUser(ctx.from?.id);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();
    await ctx.reply('❌ Gagal mulai setup email', {
      reply_markup: menu,
    });
  }
};

// -- handleUserSetupEmailInput --
export const handleUserSetupEmailInput = async (ctx, text) => {
  try {
    const userId = ctx.from?.id;
    const input = text.trim();

    if (!ctx.session.setupEmail) {
      ctx.session.setupEmail = { step: 'email', email: '', password: '' };
    }

    if (ctx.session.setupEmail.step === 'email') {
      if (!input.includes('@gmail.com')) {
        await ctx.reply('❌ Cuma support Gmail aja. Kirim email Gmail yang bener ya.');
        return;
      }

      ctx.session.setupEmail.email = input;
      ctx.session.setupEmail.step = 'password';

      await ctx.reply(
        '✅ Email udah disimpan!\n\n' +
        '📧 *Langkah 2/3: Kirim App Password kamu*\n\n' +
        'Format: 16 karakter (spasi boleh)\n\n' +
        '*Contoh:*\n' +
        '`abcd efgh ijkl mnop`\n\n' +
        '💡 Dapetin dari: Google Account → Security → App passwords',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (ctx.session.setupEmail.step === 'password') {
      const cleanPassword = input.replace(/\s/g, '');

      if (cleanPassword.length < 10) {
        await ctx.reply('❌ App Password terlalu pendek (min 10 karakter). Coba lagi ya.');
        return;
      }

      ctx.session.setupEmail.password = cleanPassword;
      ctx.session.setupEmail.step = 'nama';

      await ctx.reply(
        '✅ Password udah disimpan!\n\n' +
        '👤 *Langkah 3/3: Kirim nama kamu*\n\n' +
        'Ini bakal dipake di template email.\n\n' +
        '*Contoh:*\n' +
        '`Budi Santoso`',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (ctx.session.setupEmail.step === 'nama') {
      if (input.length < 2) {
        await ctx.reply('❌ Nama terlalu pendek (min 2 karakter). Coba lagi ya.');
        return;
      }

      const { email, password } = ctx.session.setupEmail;
      const nama = input;

      await ctx.reply('⏳ Ngecek kredensial Gmail...');

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: email,
          pass: password,
        },
      });

      await transporter.verify();

      await saveUserEmail(userId, email, password, nama);
      delete ctx.session.setupEmail;

      const user = await getUser(userId);

      await ctx.reply(
        '✅ *Setup Email Selesai!*\n\n' +
        `📧 Email: \`${email}\`\n` +
        `👤 Nama: \`${nama}\`\n\n` +
        '🔧 Sekarang bisa pake *Fix Nomor*!\n' +
        '🔒 App Password kamu udah aman terenkripsi.',
        {
          parse_mode: 'Markdown',
          reply_markup: user?.role === 'owner' ? ownerMainMenu() : userMainMenu(),
        },
      );

      log.info(`Email setup completed for user ${userId}`);
    }
  } catch (error) {
    log.error({ error }, 'Error in user setup email input');

    delete ctx.session.setupEmail;

    const user = await getUser(ctx.from?.id);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();

    if (error.code === 'EAUTH') {
      await ctx.reply(
        '❌ *Autentikasi Gagal*\n\n' +
        'Kemungkinan:\n' +
        '• Email salah\n' +
        '• App Password salah\n' +
        '• 2-Step Verification belum aktif\n\n' +
        'Coba lagi pake tombol 📧 *Atur Email*.',
        {
          parse_mode: 'Markdown',
          reply_markup: menu,
        },
      );
    } else {
      await ctx.reply('❌ Gagal setup email. Coba lagi ya.', {
        reply_markup: menu,
      });
    }
  }
};

// -- handleUserFixNomorStart --
export const handleUserFixNomorStart = async (ctx) => {
  try {
    const userId = ctx.from?.id;

    const template = await getEmailTemplate();
    if (!template) {
      await ctx.reply(
        '❌ *Fitur Belum Tersedia*\n\n' +
        '⚠️ Owner belum setting template email.\n\n' +
        '💡 Hubungi owner dulu buat aktifin fitur ini.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const emailData = await getUserEmail(userId);
    if (!emailData) {
      await ctx.reply(
        '❌ *Email Belum Diatur*\n\n' +
        '⚠️ Setup email dulu pake:\n' +
        '📧 Tombol *Atur Email*\n\n' +
        '💡 Butuh Gmail + App Password buat pake fitur ini.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const message = '🔧 *Fix Nomor*\n\n' +
      `📧 Email: \`${emailData.email}\`\n` +
      `👤 Nama: \`${emailData.nama}\`\n\n` +
      '*📱 Kirim nomor yang mau di-fix:*\n\n' +
      '*Format:*\n' +
      '• Pake kode negara: `628123456789`\n' +
      '• Tanpa plus: `628123456789`\n\n' +
      '*Contoh:*\n' +
      '`628123456789`\n\n' +
      '💡 Email bakal otomatis dikirim ke support WhatsApp';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });

    ctx.session.fixingNomor = true;
  } catch (error) {
    log.error({ error }, 'Error in user fix nomor start');
    const user = await getUser(ctx.from?.id);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();
    await ctx.reply('❌ Gagal mulai fix nomor', {
      reply_markup: menu,
    });
  }
};

// -- handleUserFixNomorInput --
export const handleUserFixNomorInput = async (ctx, text) => {
  try {
    const userId = ctx.from?.id;
    const nomor = text.trim();

    if (!/^\d{10,15}$/.test(nomor)) {
      await ctx.reply(
        '❌ *Nomor Ga Valid*\n\n' +
        'Format: `628123456789`\n' +
        '• Cuma angka\n' +
        '• 10-15 karakter\n' +
        '• Tanpa spasi atau simbol',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const emailData = await getUserEmail(userId);
    if (!emailData) {
      await ctx.reply('❌ Konfigurasi email ga ketemu');
      ctx.session.fixingNomor = false;
      return;
    }

    const template = await getEmailTemplate();
    if (!template) {
      await ctx.reply('❌ Template email belum diatur');
      ctx.session.fixingNomor = false;
      return;
    }

    await ctx.reply('⏳ Ngirim email ke support WhatsApp...');

    const emailBody = template
      .replace(/{nama}/g, emailData.nama)
      .replace(/{nomor}/g, nomor);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailData.email,
        pass: emailData.appPassword,
      },
    });

    await transporter.sendMail({
      from: emailData.email,
      to: 'support@support.whatsapp.com',
      subject: `Fix Number Request - ${nomor}`,
      text: emailBody,
    });

    ctx.session.fixingNomor = false;

    const user = await getUser(userId);

    await ctx.reply(
      '✅ *Email Berhasil Dikirim!*\n\n' +
      `📱 Nomor: \`${nomor}\`\n` +
      `📧 Dari: \`${emailData.email}\`\n` +
      '📩 Ke: `support@support.whatsapp.com`\n\n' +
      '⏰ Support WhatsApp bakal proses request kamu.\n' +
      '💡 Cek email buat balasan dari WhatsApp.',
      {
        parse_mode: 'Markdown',
        reply_markup: user?.role === 'owner' ? ownerMainMenu() : userMainMenu(),
      },
    );

    log.info(`Fix nomor email sent for user ${userId}, number: ${nomor}`);
  } catch (error) {
    log.error({ error }, 'Error in user fix nomor input');

    ctx.session.fixingNomor = false;

    const user = await getUser(ctx.from?.id);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();

    if (error.code === 'EAUTH') {
      await ctx.reply(
        '❌ *Autentikasi Email Gagal*\n\n' +
        'Kredensial email kamu mungkin udah expired.\n\n' +
        '💡 Setup ulang email pake:\n' +
        '📧 Tombol *Atur Email*',
        {
          parse_mode: 'Markdown',
          reply_markup: menu,
        },
      );
    } else {
      await ctx.reply('❌ Gagal kirim email. Coba lagi ya.', {
        reply_markup: menu,
      });
    }
  }
};
