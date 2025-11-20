import { createLogger } from '../logger.js';
import { getCachedBio, setCachedBio } from './cache.js';
import { getSocketLimiter } from './socket-limiter.js';
import { detectBusinessTypeEnhanced, extractBusinessInfo } from './business-detector.js';
import { detectWebsites } from './website-detector.js';

const log = createLogger('WhatsAppUtilsOptimized');

// -- formatPhoneNumber --
export const formatPhoneNumber = (phone) => {
  let formatted = phone.replace(/\D/g, '');
  if (formatted.length === 0) {
    return formatted;
  }
  if (!formatted.startsWith('62') && formatted.length > 9 && formatted.startsWith('8')) {
    formatted = '62' + formatted.substring(1);
  }
  return formatted;
};

// -- isValidPhoneNumber --
export const isValidPhoneNumber = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 10 || cleaned.length > 15) {
    return false;
  }
  const countryCodeRegex = /^\d{1,3}\d{6,14}$/;
  return countryCodeRegex.test(cleaned);
};

// -- handleConnectionError --
export const handleConnectionError = (error, lastDisconnect) => {
  const reason = lastDisconnect?.error?.output?.statusCode;
  log.error({ reason, error }, 'Connection error');
  return reason;
};

// -- formatBioDate --
export const formatBioDate = (timestamp) => {
  if (!timestamp || timestamp === '1970-01-01T00:00:00.000Z') {
    return 'Gak diketahui';
  }
  const date = new Date(timestamp);
  return date.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
};

// -- checkIfRegisteredParallel --
export const checkIfRegisteredParallel = async (socket, jid) => {
  try {
    const [registrationResult] = await socket.onWhatsApp(jid);

    if (registrationResult && registrationResult.exists) {
      return { exists: true };
    }

    return { exists: false };
  } catch (error) {
    log.error({ error }, `Error checking registration for ${jid}`);
    return null;
  }
};

// -- detectBioCategory --
export const detectBioCategory = (statusResponse, isRegistered, phoneNumber) => {
  try {
    if (isRegistered === false) {
      log.info(`[DETECT] ${phoneNumber}: Not registered on WhatsApp`);
      return {
        category: 'unregistered',
        status: 'Tidak Terdaftar',
        detail: 'Nomor tidak terdaftar di WhatsApp',
      };
    }

    if (!statusResponse || statusResponse.length === 0) {
      log.info(`[DETECT] ${phoneNumber}: Registered but no bio data`);
      return {
        category: 'noBio',
        status: 'Tidak Ada Bio',
        detail: 'Akun terdaftar tapi tidak ada bio',
      };
    }

    const bioData = statusResponse[0];
    const bioText = bioData?.status?.status;
    const bioSetAt = bioData?.status?.setAt;

    if (!bioText || bioText.trim() === '') {
      log.info(`[DETECT] ${phoneNumber}: Registered but bio is empty`);
      return {
        category: 'noBio',
        status: 'Tidak Ada Bio',
        detail: 'Akun terdaftar tapi tidak ada bio',
        setAt: formatBioDate(bioSetAt),
      };
    }

    log.info(`[DETECT] ${phoneNumber}: Has bio text`);
    return {
      category: 'hasBio',
      status: 'Ada Bio',
      detail: 'Akun terdaftar dan punya bio',
      bioText,
      setAt: formatBioDate(bioSetAt),
    };
  } catch (error) {
    log.error({ error }, `Error detecting bio category for ${phoneNumber}`);
    return {
      category: 'error',
      status: 'Error',
      detail: error?.message || 'Gagal deteksi status',
    };
  }
};

// -- fetchBioForUserOptimized --
export const fetchBioForUserOptimized = async (
  socket,
  phoneNumber,
  useCache = true,
  userId = null,
) => {
  try {
    if (!socket) {
      throw new Error('Socket gak connect');
    }

    if (useCache) {
      const cached = getCachedBio(phoneNumber);
      if (cached) {
        return cached;
      }
    }

    let jid = phoneNumber;
    if (!jid.includes('@')) {
      const cleaned = jid.replace(/\D/g, '');
      jid = `${cleaned}@s.whatsapp.net`;
    }

    log.info(`[FETCH-OPT] Starting parallel fetch for ${phoneNumber}`);

    let registrationInfo;
    let statusResponse;
    let businessProfile;

    if (userId) {
      const limiter = getSocketLimiter(userId);
      [registrationInfo, statusResponse, businessProfile] = await limiter.run(async () => {
        return Promise.all([
          checkIfRegisteredParallel(socket, jid),
          socket.fetchStatus(jid).catch(() => null),
          socket.getBusinessProfile(jid).catch(() => null),
        ]);
      });
    } else {
      [registrationInfo, statusResponse, businessProfile] = await Promise.all([
        checkIfRegisteredParallel(socket, jid),
        socket.fetchStatus(jid).catch(() => null),
        socket.getBusinessProfile(jid).catch(() => null),
      ]);
    }

    log.info(`[FETCH-OPT] Parallel fetch completed for ${phoneNumber}`);

    if (registrationInfo && !registrationInfo.exists) {
      log.info(`[FETCH-OPT] ${phoneNumber} is not registered`);
      const result = {
        phone: phoneNumber,
        success: false,
        category: 'unregistered',
        error: 'Nomor tidak terdaftar',
      };
      setCachedBio(phoneNumber, result, 300);
      return result;
    }

    const bioText = statusResponse?.[0]?.status?.status || '';
    const categoryInfo = detectBioCategory(
      statusResponse,
      registrationInfo?.exists !== false,
      phoneNumber,
    );

    const businessInfo = await detectBusinessTypeEnhanced(socket, jid, bioText);
    const extractedBusinessInfo = extractBusinessInfo(businessProfile);

    const websites = businessInfo.isBusiness ?
      detectWebsites(bioText, businessProfile) : [];
    const email = businessInfo.isBusiness ? extractedBusinessInfo.email : null;

    if (categoryInfo.category === 'hasBio') {
      const result = {
        phone: phoneNumber,
        bio: categoryInfo.bioText,
        setAt: categoryInfo.setAt,
        success: true,
        category: 'hasBio',
        accountType: businessInfo.accountType,
        isBusiness: businessInfo.isBusiness,
        websites,
        email,
      };
      setCachedBio(phoneNumber, result, 3600);
      return result;
    }

    if (categoryInfo.category === 'noBio') {
      const result = {
        phone: phoneNumber,
        success: false,
        category: 'noBio',
        error: 'User gak punya bio',
        accountType: businessInfo.accountType,
        isBusiness: businessInfo.isBusiness,
        websites,
        email,
      };
      setCachedBio(phoneNumber, result, 600);
      return result;
    }

    if (categoryInfo.category === 'unregistered') {
      const result = {
        phone: phoneNumber,
        success: false,
        category: 'unregistered',
        error: 'Nomor tidak terdaftar',
      };
      setCachedBio(phoneNumber, result, 300);
      return result;
    }

    const errorResult = {
      phone: phoneNumber,
      success: false,
      category: 'error',
      error: categoryInfo.detail,
    };
    return errorResult;
  } catch (error) {
    log.error({ error }, `Failed to fetch bio for ${phoneNumber}`);

    let category = 'error';
    let errorMsg = error?.message || 'Gagal ambil bio';

    if (error?.message?.includes('rate') || error?.message?.includes('429')) {
      category = 'rateLimit';
      errorMsg = 'Rate limit - coba lagi nanti';
    }

    const errorResult = {
      phone: phoneNumber,
      success: false,
      category,
      error: errorMsg,
    };

    if (category === 'rateLimit') {
      setCachedBio(phoneNumber, errorResult, 60);
    }

    return errorResult;
  }
};
