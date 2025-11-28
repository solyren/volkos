import { createLogger } from '../../logger.js';
import nodemailer from 'nodemailer';
import {
  saveUserEmail,
  getUserEmail,
  setEmailTemplate,
  getEmailTemplate,
} from '../../db/email.js';
import { getUser } from '../../db/users.js';
import { checkCooldown, getCooldownRemainingTime } from '../../db/cooldown.js';
import { ownerMainMenu, userMainMenu, cancelKeyboard } from '../keyboards.js';
import { ownerEmailMenu } from '../keyboards-email.js';
import { getRedis } from '../../db/redis.js';

const log = createLogger('EmailHandler');

// -- handleOwnerEmailMenuStart --
export const handleOwnerEmailMenuStart = async (ctx) => {
  try {
    const message = '📧 *Email Management*\n\n' +
      'Choose an action:';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: ownerEmailMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error in owner email menu');
    await ctx.reply('❌ Failed to open menu email', {
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
        '*Template Not Set Yet*\n\n' +
        '⚠️ Template email not configured yet.\n\n' +
        '📝 Use *Set Template* button to create.',
        {
          parse_mode: 'Markdown',
          reply_markup: ownerEmailMenu(),
        },
      );
      return;
    }

    const message = '👁️ *Current Email Template*\n\n' +
      '```\n' +
      template +
      '\n```\n\n' +
      '*Available Placeholders:*\n' +
      '• `{nama}` - User name\n' +
      '• `{nomor}` - Phone number\n\n' +
      '💡 Use *Set Template* to change';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: ownerEmailMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error viewing template');
    await ctx.reply('❌ Failed to load template', {
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
        '❌ *No Template to Delete*\n\n' +
        'Template email not set yet.',
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
      '*Template Successfully Deleted!*\n\n' +
      '🗑️ Template email has been deleted.\n\n' +
      '⚠️ User cannot use Fix Number until you set new template.',
      {
        parse_mode: 'Markdown',
        reply_markup: ownerEmailMenu(),
      },
    );

    log.info('Email template deleted by owner');
  } catch (error) {
    log.error({ error }, 'Error deleting template');
    await ctx.reply('❌ Failed to delete template', {
      reply_markup: ownerEmailMenu(),
    });
  }
};

// -- handleOwnerSetTemplateStart --
export const handleOwnerSetTemplateStart = async (ctx) => {
  try {
    const currentTemplate = await getEmailTemplate();
    const templatePreview = currentTemplate || 'No template set';

    const message = '📧 *Email Template Configuration*\n\n' +
      '*Current Template:*\n' +
      '```\n' +
      templatePreview +
      '\n```\n\n' +
      '*Available Placeholders:*\n' +
      '• `{nama}` - User name\n' +
      '• `{nomor}` - Phone number\n\n' +
      '*Example:*\n' +
      '```\n' +
      'Hello, my name is {nama}.\n' +
      'I need help with number: {nomor}\n' +
      '```\n\n' +
      '📝 Send your template text now:';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });

    ctx.session.settingEmailTemplate = true;
  } catch (error) {
    log.error({ error }, 'Error in owner email template start');
    await ctx.reply('❌ Failed to start setting email template', {
      reply_markup: ownerMainMenu(),
    });
  }
};

// -- handleOwnerEmailTemplateInput --
export const handleOwnerEmailTemplateInput = async (ctx, text) => {
  try {
    if (!text.includes('{nama}') || !text.includes('{nomor}')) {
      await ctx.reply(
        '❌ *Invalid Template*\n\n' +
        'Template must contain both:\n' +
        '• Placeholder `{nama}`\n' +
        '• Placeholder `{nomor}`\n\n' +
        'Please resend:',
        { parse_mode: 'Markdown' },
      );
      ctx.session.settingEmailTemplate = false;
      return;
    }

    await setEmailTemplate(text);
    ctx.session.settingEmailTemplate = false;

    await ctx.reply(
      '*Email Template Updated!*\n\n' +
      '*New Template:*\n' +
      '```\n' +
      text +
      '\n```\n\n' +
      '💡 User can now use Fix Number feature',
      {
        parse_mode: 'Markdown',
        reply_markup: ownerMainMenu(),
      },
    );

    log.info('Email template updated by owner');
  } catch (error) {
    log.error({ error }, 'Error in owner email template input');
    await ctx.reply('❌ Failed to update email template', {
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
        '*Current Configuration:*\n' +
        `Email: \`${existingEmail.email}\`\n` +
        `Name: \`${existingEmail.nama}\`\n\n` +
        '🔄 *Want to update? Start from the beginning.*\n\n' +
        '📧 *Step 1/3: Send your Gmail address*\n\n' +
        '*Contoh:*\n' +
        '`yourname@gmail.com`';
    } else {
      message = '📧 *Setup Email - Step 1/3*\n\n' +
        '📧 Send *your Gmail address*:\n\n' +
        '*Contoh:*\n' +
        '`yourname@gmail.com`\n\n' +
        '*⚠️ How to get App Password (later):*\n' +
        '1. Google Account → Security\n' +
        '2. Enable 2-Step Verification → App passwords\n' +
        '3. Generate new App Password → https://myaccount.google.com/apppasswords"\n' +
        '4. Copy 16-character password\n\n' +
        '*🔒 Your password will be securely encrypted*';
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
    await ctx.reply('❌ Failed to start email setup', {
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
        await ctx.reply('❌ Only Gmail is supported. Please send a valid Gmail address.');
        return;
      }

      ctx.session.setupEmail.email = input;
      ctx.session.setupEmail.step = 'password';

      await ctx.reply(
        'Email saved!\n\n' +
        '📧 *Step 2/3: Send your App Password*\n\n' +
        'Format: 16 characters (spaces allowed)\n\n' +
        '*Example:*\n' +
        '`abcd efgh ijkl mnop`\n\n' +
        '💡 Get from: Google Account → Security → https://myaccount.google.com/apppasswords',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (ctx.session.setupEmail.step === 'password') {
      const cleanPassword = input.replace(/\s/g, '');

      if (cleanPassword.length < 10) {
        await ctx.reply('❌ App Password too short (min 10 characters). Try again.');
        return;
      }

      ctx.session.setupEmail.password = cleanPassword;
      ctx.session.setupEmail.step = 'nama';

      await ctx.reply(
        'Password saved!\n\n' +
        '👤 *Step 3/3: Send your name*\n\n' +
        'This will be used in email template.\n\n' +
        '*Example:*\n' +
        '`John Doe`',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (ctx.session.setupEmail.step === 'nama') {
      if (input.length < 2) {
        await ctx.reply('❌ Name too short (min 2 characters). Try again.');
        return;
      }

      const { email, password } = ctx.session.setupEmail;
      const nama = input;

      await ctx.reply('⏳ Checking Gmail credentials...');

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
        '*Email Setup Complete!*\n\n' +
        `📧 Email: \`${email}\`\n` +
        `👤 Name: \`${nama}\`\n\n` +
        '🔧 Now you can use *Fix Number*!\n' +
        '🔒 App Password is securely encrypted.',
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
        '❌ *Authentication Failed*\n\n' +
        'Possible reasons:\n' +
        '• Incorrect Email\n' +
        '• Incorrect App Password\n' +
        '• 2-Step Verification not active yet\n\n' +
        'Try again using 📧 *Email Settings* button.',
        {
          parse_mode: 'Markdown',
          reply_markup: menu,
        },
      );
    } else {
      await ctx.reply('❌ Failed to setup email. Try again.', {
        reply_markup: menu,
      });
    }
  }
};

// -- handleUserFixNomorStart --
export const handleUserFixNomorStart = async (ctx) => {
  try {
    const userId = ctx.from?.id;

    const cooldownRemaining = await getCooldownRemainingTime(userId, 'fixnomor');
    if (cooldownRemaining > 0) {
      await ctx.reply(
        '⏳ *Cooldown Active*\n\n' +
        `Wait ${cooldownRemaining} seconds before fix number again.`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const template = await getEmailTemplate();
    if (!template) {
      await ctx.reply(
        '❌ *Feature Not Available*\n\n' +
        '⚠️ Owner has not set email template.\n\n' +
        '💡 Contact owner to activate this feature.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const emailData = await getUserEmail(userId);
    if (!emailData) {
      await ctx.reply(
        '❌ *Email Not Configured*\n\n' +
        '⚠️ Setup email first using:\n' +
        '📧 *Email Settings* button\n\n' +
        '💡 Requires Gmail + App Password to use this feature.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const message = '🔧 *Fix Number*\n\n' +
      `📧 Email: \`${emailData.email}\`\n` +
      `👤 Name: \`${emailData.nama}\`\n\n` +
      '*📱 Send number to fix:*\n\n' +
      '*Format:*\n' +
      '• Use country code: `628123456789`\n' +
      '• Without plus: `628123456789`\n\n' +
      '*Example:*\n' +
      '`628123456789`\n\n' +
      '💡 Email will be automatically sent to WhatsApp support';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });

    ctx.session.fixingNomor = true;
  } catch (error) {
    log.error({ error }, 'Error in user fix number start');
    const user = await getUser(ctx.from?.id);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();
    await ctx.reply('❌ Failed to start fix number', {
      reply_markup: menu,
    });
  }
};

// -- handleUserFixNomorInput --
export const handleUserFixNomorInput = async (ctx, text) => {
  try {
    const userId = ctx.from?.id;
    const nomor = text.trim();

    const cooldownRemaining = await getCooldownRemainingTime(userId, 'fixnomor');
    if (cooldownRemaining > 0) {
      ctx.session.fixingNomor = false;
      await ctx.reply(
        '⏳ *Cooldown Active*\n\n' +
        `Wait ${cooldownRemaining} seconds before fix number again.`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (!/^\d{10,15}$/.test(nomor)) {
      await ctx.reply(
        '❌ *Invalid Number*\n\n' +
        'Format: `628123456789`\n' +
        '• Only digits\n' +
        '• 10-15 characters\n' +
        '• No spaces or symbols',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const emailData = await getUserEmail(userId);
    if (!emailData) {
      await ctx.reply('❌ Email configuration not found');
      ctx.session.fixingNomor = false;
      return;
    }

    const template = await getEmailTemplate();
    if (!template) {
      await ctx.reply('❌ Email template not set yet');
      ctx.session.fixingNomor = false;
      return;
    }

    await ctx.reply('⏳ Sending email to WhatsApp support...');

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

    await checkCooldown(userId, 'fixnomor', 120);

    ctx.session.fixingNomor = false;

    const user = await getUser(userId);

    await ctx.reply(
      '*Email Successfully Sent!*\n\n' +
      `📱 Nomor: \`${nomor}\`\n` +
      `📧 From: \`${emailData.email}\`\n` +
      '📩 To: `support@support.whatsapp.com`\n\n' +
      '⏰ WhatsApp Support will process your request.\n' +
      '💡 Check email for reply from WhatsApp.',
      {
        parse_mode: 'Markdown',
        reply_markup: user?.role === 'owner' ? ownerMainMenu() : userMainMenu(),
      },
    );

    log.info(`Fix nomor email sent for user ${userId}, number: ${nomor}`);
  } catch (error) {
    log.error({ error }, 'Error in user fix number input');

    ctx.session.fixingNomor = false;

    const user = await getUser(ctx.from?.id);
    const menu = user?.role === 'owner' ? ownerMainMenu() : userMainMenu();

    if (error.code === 'EAUTH') {
      await ctx.reply(
        '❌ *Email Authentication Failed*\n\n' +
        'Your email credentials may have expired.\n\n' +
        '💡 Re-setup email using:\n' +
        '📧 *Email Settings* button',
        {
          parse_mode: 'Markdown',
          reply_markup: menu,
        },
      );
    } else {
      await ctx.reply('❌ Failed to send email. Try again.', {
        reply_markup: menu,
      });
    }
  }
};
