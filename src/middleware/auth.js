import { createLogger } from '../logger.js';
import { getUser } from '../db/users.js';

const log = createLogger('AuthMiddleware');

// -- checkUserExists --
export const checkUserExists = async (ctx, next) => {
  try {
    const userId = ctx.from?.id;

    if (!userId) {
      await ctx.reply('❌ Cannot identify user');
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
    await ctx.reply('❌ System error');
  }
};

// -- checkUserActive --
export const checkUserActive = async (ctx, next) => {
  try {
    if (!ctx.user) {
      await ctx.reply('❌ User not initialized');
      return;
    }

    if (!ctx.user.isActive) {
      await ctx.reply('❌ Your access has been deactivated. Chat owner for more info.');
      return;
    }

    await next();
  } catch (error) {
    log.error({ error }, 'Error in checkUserActive middleware');
    await ctx.reply('❌ System error');
  }
};

// -- requireRole --
export const requireRole = (allowedRoles) => {
  return async (ctx, next) => {
    try {
      if (!ctx.user) {
        await ctx.reply('❌ User not initialized');
        return;
      }

      if (!allowedRoles.includes(ctx.user.role)) {
        const userId = ctx.user.userId;
        const role = ctx.user.role;
        log.warn(`Unauthorized access attempt by user ${userId} with role ${role}`);
        const msg = '❌ You don\'t have access to this command.';
        await ctx.reply(msg);
        return;
      }

      await next();
    } catch (error) {
      log.error({ error }, 'Error in requireRole middleware');
      await ctx.reply('❌ System error');
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
      await ctx.reply('❌ Only owner can use this command.');
      return;
    }

    await next();
  } catch (error) {
    log.error({ error }, 'Error in requireOwner middleware');
    await ctx.reply('❌ System error');
  }
};
