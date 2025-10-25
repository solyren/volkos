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
  if (errors.length > 0) {
    throw new Error(`Config validation failed:\n${errors.join('\n')}`);
  }
};
