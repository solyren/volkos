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
