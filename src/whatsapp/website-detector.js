import { createLogger } from '../logger.js';

const log = createLogger('WhatsAppWebsiteDetector');

// -- extractWebsites --
export const extractWebsites = (text) => {
  if (!text) {
    return [];
  }

  const urlPattern = /(?:https?:\/\/)(?:www\.)?[\w-]+\.[\w.-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?/gi;
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
