import { createLogger } from '../logger.js';
import { getCachedBio, setCachedBio } from './cache.js';
import { getSocketLimiter } from './socket-limiter.js';
import {
  detectBusinessTypeEnhanced,
  extractBusinessInfo,
  detectWebsites,
} from './bio-checker.js';

const log = createLogger('WhatsAppUtils');

// -- formatPhoneNumber --
export const formatPhoneNumber = (phone) => {
  let formatted = phone.replace(/\D/g, '');
  if (formatted.length === 0) {
    return formatted;
  }
  if (!formatted.startsWith('62') &&
      formatted.length > 9 &&
      formatted.startsWith('8')) {
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
    return 'Unknown';
  }
  const date = new Date(timestamp);
  return date.toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
};

// -- fetchStatusUsingUSync --
const fetchStatusUsingUSync = async (socket, jid) => {
  try {
    log.info(`[USYNC-STATUS] Fetching status for ${jid} using USyncQuery`);

    const { USyncQuery, USyncUser } = await import(
      '@whiskeysockets/baileys/lib/WAUSync/index.js'
    );

    const usyncQuery = new USyncQuery()
      .withContext('interactive')
      .withStatusProtocol();

    // Use withId instead of withPhone to ensure JID is passed in user attributes
    // This fixes the issue where withPhone requires ContactProtocol to work
    usyncQuery.withUser(new USyncUser().withId(jid));

    log.info(`[USYNC-STATUS] Executing USyncQuery for ${jid}`);
    const results = await socket.executeUSyncQuery(usyncQuery);

    log.info(`[USYNC-STATUS] Raw results: ${JSON.stringify(results)}`);

    if (results && results.list && results.list.length > 0) {
      const statusData = results.list[0]?.status;

      log.info(`[USYNC-STATUS] Status data: ${JSON.stringify(statusData)}`);

      if (statusData) {
        const bioText = statusData.status;
        const setAt = statusData.setAt;

        log.info(`[USYNC-STATUS] Found bio: "${bioText}" setAt: ${setAt}`);

        return {
          status: bioText || undefined,
          setAt: setAt || new Date(0),
        };
      }
    }

    log.warn(`[USYNC-STATUS] No status found for ${jid}`);
    return { status: undefined, setAt: new Date(0) };
  } catch (error) {
    log.error({ error }, `[USYNC-STATUS] Error fetching status for ${jid}`);
    throw error;
  }
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
    log.info(
      `[DETECT-DEBUG] ${phoneNumber}: Full statusResponse = ${JSON.stringify(statusResponse)}`,
    );
    log.info(`[DETECT-DEBUG] ${phoneNumber}: isRegistered = ${isRegistered}`);
    log.info(`[DETECT-DEBUG] ${phoneNumber}: statusResponse type = ${typeof statusResponse}`);

    if (isRegistered === false) {
      log.info(`[DETECT] ${phoneNumber}: Not registered on WhatsApp`);
      return {
        category: 'unregistered',
        status: 'Unregistered',
        detail: 'Number not registered on WhatsApp',
      };
    }

    if (!statusResponse) {
      log.info(`[DETECT] ${phoneNumber}: statusResponse is null/undefined - No bio`);
      return {
        category: 'noBio',
        status: 'No Bio',
        detail: 'Account registered but has no bio',
      };
    }

    let bioText = null;
    let bioSetAt = null;

    if (typeof statusResponse === 'object' && statusResponse !== null) {
      if (Array.isArray(statusResponse) && statusResponse.length > 0) {
        bioText = statusResponse[0]?.status?.status || statusResponse[0]?.status;
        bioSetAt = statusResponse[0]?.status?.setAt || statusResponse[0]?.setAt;
      } else if (statusResponse.status !== undefined) {
        if (typeof statusResponse.status === 'string') {
          bioText = statusResponse.status;
        } else if (typeof statusResponse.status === 'object') {
          bioText = statusResponse.status.status || statusResponse.status;
        }
        bioSetAt = statusResponse.status?.setAt || statusResponse.setAt;
      } else if (typeof statusResponse === 'string') {
        bioText = statusResponse;
      }
    }

    log.info(`[DETECT-DEBUG] ${phoneNumber}: Extracted bioText = "${bioText}"`);
    log.info(`[DETECT-DEBUG] ${phoneNumber}: Extracted bioSetAt = ${bioSetAt}`);

    if (!bioText || (typeof bioText === 'string' && bioText.trim() === '')) {
      log.info(`[DETECT] ${phoneNumber}: Registered but bio is empty`);
      return {
        category: 'noBio',
        status: 'No Bio',
        detail: 'Account registered but has no bio',
        setAt: formatBioDate(bioSetAt),
      };
    }

    log.info(`[DETECT] ${phoneNumber}: Has bio text: "${bioText}"`);
    return {
      category: 'hasBio',
      status: 'Has Bio',
      detail: 'Account registered and has bio',
      bioText,
      setAt: formatBioDate(bioSetAt),
    };
  } catch (error) {
    log.error({ error }, `Error detecting bio category for ${phoneNumber}`);
    return {
      category: 'error',
      status: 'Error',
      detail: error?.message || 'Failed to detect status',
    };
  }
};

// -- fetchBioForUser --
export const fetchBioForUser = async (
  socket,
  phoneNumber,
  useCache = true,
  userId = null,
) => {
  try {
    if (!socket) {
      throw new Error('Socket disconnected');
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
      [registrationInfo, statusResponse, businessProfile] = await limiter.run(
        async () => {
          return Promise.all([
            checkIfRegisteredParallel(socket, jid),
            fetchStatusUsingUSync(socket, jid).catch((err) => {
              log.warn(`[FETCH-OPT] fetchStatusUsingUSync error: ${err.message}`);
              return socket.fetchStatus(jid).catch((err2) => {
                log.warn(`[FETCH-OPT] fetchStatus fallback error: ${err2.message}`);
                return null;
              });
            }),
            socket.getBusinessProfile(jid).catch(() => null),
          ]);
        },
      );
    } else {
      [registrationInfo, statusResponse, businessProfile] = await Promise.all([
        checkIfRegisteredParallel(socket, jid),
        fetchStatusUsingUSync(socket, jid).catch((err) => {
          log.warn(`[FETCH-OPT] fetchStatusUsingUSync error: ${err.message}`);
          return socket.fetchStatus(jid).catch((err2) => {
            log.warn(`[FETCH-OPT] fetchStatus fallback error: ${err2.message}`);
            return null;
          });
        }),
        socket.getBusinessProfile(jid).catch(() => null),
      ]);
    }

    log.info(`[FETCH-OPT] Parallel fetch completed for ${phoneNumber}`);
    log.info(
      `[FETCH-OPT-DEBUG] ${phoneNumber}: registrationInfo = ${JSON.stringify(registrationInfo)}`,
    );
    log.info(
      `[FETCH-OPT-DEBUG] ${phoneNumber}: statusResponse RAW = ${JSON.stringify(statusResponse)}`,
    );
    log.info(
      `[FETCH-OPT-DEBUG] ${phoneNumber}: businessProfile exists = ${!!businessProfile}`,
    );

    if (registrationInfo && !registrationInfo.exists) {
      log.info(`[FETCH-OPT] ${phoneNumber} is not registered`);
      const result = {
        phone: phoneNumber,
        success: false,
        category: 'unregistered',
        error: 'Number not registered',
      };
      setCachedBio(phoneNumber, result, 300);
      return result;
    }

    const categoryInfo = detectBioCategory(
      statusResponse,
      registrationInfo?.exists !== false,
      phoneNumber,
    );

    const bioText = categoryInfo.bioText || '';

    const businessInfo = await detectBusinessTypeEnhanced(socket, jid, bioText);
    const extractedBusinessInfo = extractBusinessInfo(businessProfile);

    const websites = businessInfo.isBusiness
      ? detectWebsites(bioText, businessProfile)
      : [];
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
        error: 'User has no bio',
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
        error: 'Number not registered',
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
    let errorMsg = error?.message || 'Failed to fetch bio';

    if (error?.message?.includes('rate') || error?.message?.includes('429')) {
      category = 'rateLimit';
      errorMsg = 'Rate limit - try again later';
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

export const fetchBioForUserOptimized = fetchBioForUser;
