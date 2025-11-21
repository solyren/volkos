import { createLogger } from '../logger.js';
import { getUser } from '../db/users.js';

const log = createLogger('AuthMiddleware');

// -- checkUserExists --
export const checkUserExists = async (ctx, next) => {
  try {
    const userId = ctx.from?.id;

    if (!userId) {
      await ctx.reply('❌ Tidak dapat mengidentifikasi user');
      return;
    }

    const user = await getUser(userId);

    if (!user) {
      const ownerId = Number(process.env.TELEGRAM_ADMIN_ID);
      const isOwner = userId === ownerId;
      const role = isOwner ? 'owner' : 'user';
      log.info(`New user detected: ${userId}, creating ${role} account`);
      const { createUser } = await import('../db/users.js');
      await createUser(userId, role);
      ctx.user = { userId, role, isNew: true };
    } else {
      ctx.user = user;
    }

    await next();
  } catch (error) {
    log.error({ error }, 'Error in checkUserExists middleware');
    await ctx.reply('❌ Kesalahan sistem');
  }
};

// -- checkUserActive --
export const checkUserActive = async (ctx, next) => {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ User belum diinisialisasi');
      return;
    }

    if (!ctx.user.isActive) {
      await ctx.reply('❌ Akses lo udah dinonaktifkan. Chat owner untuk info lebih lanjut.');
      return;
    }

    await next();
  } catch (error) {
    log.error({ error }, 'Error in checkUserActive middleware');
    await ctx.reply('❌ Kesalahan sistem');
  }
};

// -- requireRole --
export const requireRole = (allowedRoles) => {
  return async (ctx, next) => {
    try {
      if (!ctx.user) {
        await ctx.reply('❌ User belum diinisialisasi');
        return;
      }

      if (!allowedRoles.includes(ctx.user.role)) {
        const userId = ctx.user.userId;
        const role = ctx.user.role;
        log.warn(`Unauthorized access attempt by user ${userId} with role ${role}`);
        const msg = '❌ Lo ga punya akses buat command ini.';
        await ctx.reply(msg);
        return;
      }

      await next();
    } catch (error) {
      log.error({ error }, 'Error in requireRole middleware');
      await ctx.reply('❌ Kesalahan sistem');
    }
  };
};

// -- requireOwner --
export const requireOwner = async (ctx, next) => {
  try {
    const ownerId = Number(process.env.TELEGRAM_ADMIN_ID);

    if (ctx.from?.id !== ownerId) {
      const userId = ctx.from?.id;
      log.warn(`Unauthorized owner command attempt by user ${userId}`);
      await ctx.reply('❌ Cuma owner yang bisa pake command ini.');
      return;
    }

    await next();
  } catch (error) {
    log.error({ error }, 'Error in requireOwner middleware');
    await ctx.reply('❌ Kesalahan sistem');
  }
};
