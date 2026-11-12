// All settings come from environment variables (Secrets in production). Nothing secret lives in frontend code.
module.exports = {
  PORT: Number(process.env.PORT || 3000),
  APP_NAME: process.env.APP_NAME || 'Better Plate', // working title, owner to confirm
  BRAND_NAME: process.env.BRAND_NAME || 'Root Cause NP',
  OWNER_EMAIL: (process.env.OWNER_EMAIL || 'owner@example.test').toLowerCase(),
  BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  SHOW_OWNER_FLAGS: process.env.SHOW_OWNER_FLAGS !== '0',
  COOKIE_SECURE: process.env.NODE_ENV === 'production',
  OFF_CONTACT: process.env.OFF_CONTACT || '', // optional contact for the Open Food Facts User-Agent (owner sets)
  TERMS_VERSION: '2026-11-draft',
  POLICY_VERSION: '2026-11-draft',
  BANNER_VERSION: 'banner-v1',
};
