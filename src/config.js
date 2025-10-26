import dotenv from 'dotenv';

dotenv.config();

export const config = {
  telegram: {
    token: process.env.TELEGRAM_TOKEN,
    adminId: Number(process.env.TELEGRAM_ADMIN_ID),
  },
  whatsapp: {
    authPath: './auth_info',
    usePairingCode: true,
    customPairingCode: 'VOLKSBOT',
    getAuthPath: (userId) => `./auth_info/${userId}/session`,
  },
  upstash: {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
  system: {
    defaultTrialDays: Number(process.env.DEFAULT_TRIAL_DAYS) || 1,
  },
  thumbnails: {
    welcomeOwner:
      process.env.THUMBNAIL_WELCOME_OWNER ||
      'https://cdn.discordapp.com/attachments/1036528456751656993/1432013081365446676/Picsart_25-10-26_21-28-17-096.jpg?ex=68ff819c&is=68fe301c&hm=2ca4e28eb6f9681403898aa3fca7c99274ccbb8f27c774f380d6e7ead9eff400&',
    welcomeUser:
      process.env.THUMBNAIL_WELCOME_USER ||
      'https://cdn.discordapp.com/attachments/1036528456751656993/1432013081365446676/Picsart_25-10-26_21-28-17-096.jpg?ex=68ff819c&is=68fe301c&hm=2ca4e28eb6f9681403898aa3fca7c99274ccbb8f27c774f380d6e7ead9eff400&',
    welcomeTrial:
      process.env.THUMBNAIL_WELCOME_TRIAL ||
      'https://cdn.discordapp.com/attachments/1036528456751656993/1432013081365446676/Picsart_25-10-26_21-28-17-096.jpg?ex=68ff819c&is=68fe301c&hm=2ca4e28eb6f9681403898aa3fca7c99274ccbb8f27c774f380d6e7ead9eff400&',
  },
  debug: process.env.DEBUG === 'true',
};

export const validateConfig = () => {
  const errors = [];
  if (!config.telegram.token) {
    errors.push('TELEGRAM_TOKEN is required');
  }
  if (!config.telegram.adminId) {
    errors.push('TELEGRAM_ADMIN_ID is required');
  }
  if (!config.upstash.url) {
    errors.push('UPSTASH_REDIS_REST_URL is required');
  }
  if (!config.upstash.token) {
    errors.push('UPSTASH_REDIS_REST_TOKEN is required');
  }
  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n${errors.join('\n')}`);
  }
};
