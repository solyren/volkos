import { InlineKeyboard } from 'grammy';
import { createLogger } from '../logger.js';
import { config } from '../config.js';

const log = createLogger('GroupVerification');

// -- checkGroupMembership --
export const checkGroupMembership = async (ctx, userId) => {
  const groupId1 = config.groups.requiredGroupId1;
  const groupId2 = config.groups.requiredGroupId2;

  if (!groupId1 && !groupId2) {
    return { isMember: true, missingGroups: [] };
  }

  if (userId === config.telegram.adminId) {
    return { isMember: true, missingGroups: [] };
  }

  const missingGroups = [];

  if (groupId1) {
    try {
      const member = await ctx.api.getChatMember(groupId1, userId);
      const validStatus = ['member', 'administrator', 'creator'];
      if (!validStatus.includes(member.status)) {
        missingGroups.push({
          id: groupId1,
          name: 'urGank',
          link: 'https://t.me/urGank',
        });
      }
    } catch (error) {
      log.error(
        { error: error.message, userId, groupId: groupId1, status: error.status },
        'Error checking group 1 membership',
      );
      missingGroups.push({
        id: groupId1,
        name: 'urGank',
        link: 'https://t.me/urGank',
      });
    }
  }

  if (groupId2) {
    try {
      const member = await ctx.api.getChatMember(groupId2, userId);
      const validStatus = ['member', 'administrator', 'creator'];
      if (!validStatus.includes(member.status)) {
        missingGroups.push({
          id: groupId2,
          name: 'urGank Chat',
          link: 'https://t.me/urGankChat',
        });
      }
    } catch (error) {
      log.error(
        { error: error.message, userId, groupId: groupId2, status: error.status },
        'Error checking group 2 membership',
      );
      missingGroups.push({
        id: groupId2,
        name: 'urGank Chat',
        link: 'https://t.me/urGankChat',
      });
    }
  }

  return {
    isMember: missingGroups.length === 0,
    missingGroups,
  };
};

// -- getGroupVerificationMarkup --
export const getGroupVerificationMarkup = (missingGroups) => {
  const keyboard = new InlineKeyboard();

  missingGroups.forEach((group) => {
    keyboard.url(`🔗 ${group.name}`, group.link);
    keyboard.row();
  });

  keyboard.text('✅ Sudah Join', 'verify_group');

  return keyboard;
};

// -- getGroupVerificationMessage --
export const getGroupVerificationMessage = (missingGroups) => {
  if (missingGroups.length === 0) {
    return null;
  }

  return 'Harus Join Grub Terlebih Dahulu';
};
