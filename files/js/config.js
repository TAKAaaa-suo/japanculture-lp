/**
 * JapanCulture LP Configuration
 * Request buttons open: request.html?service_type=...&item_name=...&item_url=...
 */
window.CONFIG = {
  /** Path to the request form page (relative to index.html) */
  REQUEST_FORM_PATH: 'request.html',

  /** URL parameter names passed to request.html */
  FORM_PARAMS: {
    service_type: 'service_type',
    item_name: 'item_name',
    item_url: 'item_url'
  },

  /** Contact email displayed on the site */
  CONTACT_EMAIL: 'hello@japanculture-proxy.com',

  /** Social links (update when accounts are created) */
  SOCIAL: {
    INSTAGRAM: 'https://instagram.com/japanculture.proxy',
    TIKTOK: 'https://tiktok.com/@japanculture.proxy',
    DISCORD: 'https://discord.gg/YOUR_INVITE_CODE'
  }
};
