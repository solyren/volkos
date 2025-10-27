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
    const message = '📧 *Email Management*\n\n' +
      'Select an action:';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: ownerEmailMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error in owner email menu');
    await ctx.reply('❌ Error opening email menu');
  }
};

// -- handleOwnerViewTemplate --
export const handleOwnerViewTemplate = async (ctx) => {
  try {
    const template = await getEmailTemplate();

    if (!template) {
      await ctx.reply(
        '❌ *No Template Set*\n\n' +
        '⚠️ Email template has not been configured yet.\n\n' +
        '📝 Use *Set Template* button to create one.',
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
      '💡 Use *Set Template* to modify';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: ownerEmailMenu(),
    });
  } catch (error) {
    log.error({ error }, 'Error viewing template');
    await ctx.reply('❌ Error loading template');
  }
};

// -- handleOwnerDeleteTemplate --
export const handleOwnerDeleteTemplate = async (ctx) => {
  try {
    const template = await getEmailTemplate();

    if (!template) {
      await ctx.reply(
        '❌ *No Template to Delete*\n\n' +
        'Email template is not set.',
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
      '✅ *Template Deleted Successfully!*\n\n' +
      '🗑️ Email template has been removed.\n\n' +
      '⚠️ Users cannot use Fix Nomor until you set a new template.',
      {
        parse_mode: 'Markdown',
        reply_markup: ownerEmailMenu(),
      },
    );

    log.info('Email template deleted by owner');
  } catch (error) {
    log.error({ error }, 'Error deleting template');
    await ctx.reply('❌ Failed to delete template');
  }
};

// -- handleOwnerSetTemplateStart --
export const handleOwnerSetTemplateStart = async (ctx) => {
  try {
    const currentTemplate = await getEmailTemplate();
    const templatePreview = currentTemplate || 'No template set yet';

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
    await ctx.reply('❌ Error starting email template setup');
  }
};

// -- handleOwnerEmailTemplateInput --
export const handleOwnerEmailTemplateInput = async (ctx, text) => {
  try {
    if (!text.includes('{nama}') || !text.includes('{nomor}')) {
      await ctx.reply(
        '❌ *Invalid Template*\n\n' +
        'Template must contain both:\n' +
        '• `{nama}` placeholder\n' +
        '• `{nomor}` placeholder\n\n' +
        'Please send again:',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    await setEmailTemplate(text);
    ctx.session.settingEmailTemplate = false;

    await ctx.reply(
      '✅ *Email Template Updated!*\n\n' +
      '*New Template:*\n' +
      '```\n' +
      text +
      '\n```\n\n' +
      '💡 Users can now use Fix Nomor feature',
      {
        parse_mode: 'Markdown',
        reply_markup: ownerMainMenu(),
      },
    );

    log.info('Email template updated by owner');
  } catch (error) {
    log.error({ error }, 'Error in owner email template input');
    await ctx.reply('❌ Failed to update email template');
  }
};

// -- handleUserSetupEmailStart --
export const handleUserSetupEmailStart = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    const existingEmail = await getUserEmail(userId);

    let message = '';

    if (existingEmail) {
      message = '📧 *Email Setup*\n\n' +
        '✅ *Current Configuration:*\n' +
        `Email: \`${existingEmail.email}\`\n` +
        `Name: \`${existingEmail.nama}\`\n\n` +
        '🔄 *To update, let\'s start over.*\n\n' +
        '📧 *Step 1/3: Send your Gmail address*\n\n' +
        '*Example:*\n' +
        '`myemail@gmail.com`';
    } else {
      message = '📧 *Email Setup - Step 1/3*\n\n' +
        '📧 Send your *Gmail address*:\n\n' +
        '*Example:*\n' +
        '`myemail@gmail.com`\n\n' +
        '*⚠️ How to get App Password (for later):*\n' +
        '1. Google Account → Security\n' +
        '2. 2-Step Verification → App passwords\n' +
        '3. Generate new → Select "Mail"\n' +
        '4. Copy 16-char password\n\n' +
        '*🔒 Your password will be encrypted*';
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
    await ctx.reply('❌ Error starting email setup');
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
        await ctx.reply('❌ Only Gmail addresses are supported. Please send a valid Gmail address.');
        return;
      }

      ctx.session.setupEmail.email = input;
      ctx.session.setupEmail.step = 'password';

      await ctx.reply(
        '✅ Email saved!\n\n' +
        '📧 *Step 2/3: Send your App Password*\n\n' +
        'Format: 16 characters (spaces optional)\n\n' +
        '*Example:*\n' +
        '`abcd efgh ijkl mnop`\n\n' +
        '💡 Get it from: Google Account → Security → App passwords',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    if (ctx.session.setupEmail.step === 'password') {
      const cleanPassword = input.replace(/\s/g, '');

      if (cleanPassword.length < 10) {
        await ctx.reply('❌ App Password too short (minimum 10 characters). Please try again.');
        return;
      }

      ctx.session.setupEmail.password = cleanPassword;
      ctx.session.setupEmail.step = 'nama';

      await ctx.reply(
        '✅ App Password saved!\n\n' +
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
        await ctx.reply('❌ Name too short (minimum 2 characters). Please try again.');
        return;
      }

      const { email, password } = ctx.session.setupEmail;
      const nama = input;

      await ctx.reply('⏳ Verifying Gmail credentials...');

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
        '✅ *Email Setup Complete!*\n\n' +
        `📧 Email: \`${email}\`\n` +
        `👤 Name: \`${nama}\`\n\n` +
        '🔧 You can now use *Fix Nomor* feature!\n' +
        '🔒 Your App Password is encrypted and secure.',
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

    if (error.code === 'EAUTH') {
      await ctx.reply(
        '❌ *Authentication Failed*\n\n' +
        'Possible reasons:\n' +
        '• Invalid email address\n' +
        '• Wrong App Password\n' +
        '• 2-Step Verification not enabled\n\n' +
        'Please start over using 📧 *Setup Email* button.',
        { parse_mode: 'Markdown' },
      );
    } else {
      await ctx.reply('❌ Failed to setup email. Please try again.');
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
        '❌ *Feature Not Available*\n\n' +
        '⚠️ Owner has not configured email template yet.\n\n' +
        '💡 Please contact owner to enable this feature.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const emailData = await getUserEmail(userId);
    if (!emailData) {
      await ctx.reply(
        '❌ *Email Not Configured*\n\n' +
        '⚠️ Please setup your email first using:\n' +
        '📧 *Setup Email* button\n\n' +
        '💡 You need Gmail + App Password to use this feature.',
        { parse_mode: 'Markdown' },
      );
      return;
    }

    const message = '🔧 *Fix Nomor*\n\n' +
      `📧 Email: \`${emailData.email}\`\n` +
      `👤 Name: \`${emailData.nama}\`\n\n` +
      '*📱 Send phone number to fix:*\n\n' +
      '*Format:*\n' +
      '• With country code: `628123456789`\n' +
      '• Without plus: `628123456789`\n\n' +
      '*Example:*\n' +
      '`628123456789`\n\n' +
      '💡 Email will be sent to WhatsApp support automatically';

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: cancelKeyboard(),
    });

    ctx.session.fixingNomor = true;
  } catch (error) {
    log.error({ error }, 'Error in user fix nomor start');
    await ctx.reply('❌ Error starting fix nomor');
  }
};

// -- handleUserFixNomorInput --
export const handleUserFixNomorInput = async (ctx, text) => {
  try {
    const userId = ctx.from?.id;
    const nomor = text.trim();

    if (!/^\d{10,15}$/.test(nomor)) {
      await ctx.reply(
        '❌ *Invalid Phone Number*\n\n' +
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
      await ctx.reply('❌ Email template not configured');
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

    ctx.session.fixingNomor = false;

    const user = await getUser(userId);

    await ctx.reply(
      '✅ *Email Sent Successfully!*\n\n' +
      `📱 Number: \`${nomor}\`\n` +
      `📧 From: \`${emailData.email}\`\n` +
      '📩 To: `support@support.whatsapp.com`\n\n' +
      '⏰ WhatsApp support will process your request.\n' +
      '💡 Check your email for reply from WhatsApp.',
      {
        parse_mode: 'Markdown',
        reply_markup: user?.role === 'owner' ? ownerMainMenu() : userMainMenu(),
      },
    );

    log.info(`Fix nomor email sent for user ${userId}, number: ${nomor}`);
  } catch (error) {
    log.error({ error }, 'Error in user fix nomor input');

    ctx.session.fixingNomor = false;

    if (error.code === 'EAUTH') {
      await ctx.reply(
        '❌ *Email Authentication Failed*\n\n' +
        'Your email credentials may have expired.\n\n' +
        '💡 Please re-setup your email using:\n' +
        '📧 *Setup Email* button',
        { parse_mode: 'Markdown' },
      );
    } else {
      await ctx.reply('❌ Failed to send email. Please try again.');
    }
  }
};
