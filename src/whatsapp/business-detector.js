import { createLogger } from '../logger.js';

const log = createLogger('WhatsAppBusinessDetector');

// -- detectBusinessTypeEnhanced --
export const detectBusinessTypeEnhanced = async (socket, jid, bioText = '') => {
  try {
    let accountType = 'Akun Pribadi';
    let isBusiness = false;
    const isVerified = null;
    let businessProfile = null;

    const profile = await socket.getBusinessProfile(jid).catch(() => null);
    businessProfile = profile;

    if (profile?.businessName || profile?.wid) {
      accountType = 'WhatsApp Business';
      isBusiness = true;
      log.info(`[BUSINESS] ${jid}: WhatsApp Business`);
      return {
        accountType,
        isBusiness,
        isVerified,
        businessProfile,
      };
    }

    const businessBioPatterns = [
      'Hello. I\'m using WhatsApp Business.',
      'Hello. I?m using WhatsApp Business.',
      'Hola. Estoy usando WhatsApp Business.',
      'WhatsApp Business',
    ];

    if (businessBioPatterns.some(p => bioText.includes(p))) {
      accountType = 'WhatsApp Business';
      isBusiness = true;
      log.info(`[BUSINESS] ${jid}: WhatsApp Business (detected from bio)`);
      return {
        accountType,
        isBusiness,
        isVerified,
        businessProfile,
      };
    }

    log.info(`[BUSINESS] ${jid}: Personal account`);
    return {
      accountType,
      isBusiness,
      isVerified,
      businessProfile,
    };
  } catch (error) {
    log.error({ error }, `Error detecting business type for ${jid}`);
    return {
      accountType: 'Akun Pribadi',
      isBusiness: false,
      isVerified: null,
      businessProfile: null,
    };
  }
};

// -- extractBusinessInfo --
export const extractBusinessInfo = (businessProfile) => {
  if (!businessProfile) {
    return {
      email: null,
      address: null,
      description: null,
      websites: [],
      category: null,
    };
  }

  return {
    email: businessProfile.email || null,
    address: businessProfile.address || null,
    description: businessProfile.description || null,
    websites: businessProfile.website || businessProfile.websites || [],
    category: businessProfile.category || businessProfile.vertical || null,
  };
};
