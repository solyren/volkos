import { createLogger } from '../logger.js';
import { getUser, isUserExpired } from '../db/users.js';

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
      const role = isOwner ? 'owner' : 'trial';
      const ownerMsg = `Owner detected: ${userId}`;
      const trialMsg = `New user detected: ${userId}, creating trial account`;
      const msg = isOwner ? ownerMsg : trialMsg;
      log.info(msg);
      const { createUser } = await import('../db/users.js');
      await createUser(userId, role, isOwner ? null : 1);
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

    const expired = await isUserExpired(ctx.user.userId);

    if (expired || !ctx.user.isActive) {
      await ctx.reply('❌ Akses lo udah expired. Chat owner buat perpanjang.');
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
