import { createLogger } from '../logger.js';

const log = createLogger('WhatsAppBioChecker');

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
      return { accountType, isBusiness, isVerified, businessProfile };
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
      return { accountType, isBusiness, isVerified, businessProfile };
    }

    log.info(`[BUSINESS] ${jid}: Personal account`);
    return { accountType, isBusiness, isVerified, businessProfile };
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

// -- extractWebsites --
export const extractWebsites = (text) => {
  if (!text) {
    return [];
  }

  const urlPattern = /(?:https?:\/\/)(?:www\.)?[\w-]+\.[\w.-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?/gi; // eslint-disable-line max-len
  const matches = text.match(urlPattern) || [];

  const websites = matches.filter((url) => {
    const normalized = url.toLowerCase();
    return (
      !normalized.includes('whatsapp.net') &&
      !normalized.includes('whatsapp.com') &&
      !normalized.includes('wa.me') &&
      !normalized.includes('t.me') &&
      !normalized.includes('telegram.me')
    );
  });

  return [...new Set(websites)];
};

// -- detectWebsites --
export const detectWebsites = (bioText, businessProfile = null) => {
  const websites = [];

  if (businessProfile?.website && Array.isArray(businessProfile.website)) {
    websites.push(...businessProfile.website);
  }

  if (businessProfile?.websites && Array.isArray(businessProfile.websites)) {
    websites.push(...businessProfile.websites);
  }

  if (bioText) {
    const bioWebsites = extractWebsites(bioText);
    websites.push(...bioWebsites);
  }

  if (businessProfile) {
    const safeFields = [
      businessProfile.description,
      businessProfile.address,
    ].filter(f => f && typeof f === 'string');

    const allProfileText = safeFields.join(' ');
    if (allProfileText.trim()) {
      const profileWebsites = extractWebsites(allProfileText);
      websites.push(...profileWebsites);
    }
  }

  const uniqueWebsites = [...new Set(websites)];

  if (uniqueWebsites.length > 0) {
    log.info('[WEBSITE] Found websites:', { count: uniqueWebsites.length });
  }

  return uniqueWebsites;
};
