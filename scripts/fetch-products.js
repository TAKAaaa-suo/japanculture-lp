/**
 * JSON API fetcher module for store-exclusive events and goods.
 *
 * Fetches from structured JSON APIs (no HTML scraping):
 *   - collabo-cafe.com WordPress REST API (collaboration cafes & events)
 *   - Animate OnlyShop WordPress REST API (pop-up shops)
 *   - Animate Gratte WordPress REST API (exclusive collab drinks + bonus items)
 *   - Animate Cafe JSON API (cafe events with exclusive goods)
 *
 * All sources return JSON directly. Cheerio is only used to extract
 * the first image from HTML content fields within the JSON responses.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { generateId, stripHtml, truncate } = require('./fetch-rss');

const TIMEOUT = 15000;
const UA = 'Mozilla/5.0 (compatible; JapanCulture-Bot/1.0)';

// Known banner/ad images that should be filtered out
const BANNER_PATTERNS = ['ver3-1.jpg', 'ver3-1.png', 'banner', 'logo'];

/**
 * Check if an image URL is a known site banner or ad image.
 * @param {string} url - Image URL to check
 * @returns {boolean} True if image is a known banner
 */
function isBannerImage(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return BANNER_PATTERNS.some(pattern => lower.includes(pattern));
}

// ============================================================
// Route Store Detection
// ============================================================

const ROUTE_STORES = [
  { tag: 'Animate Akihabara', keywords: ['アニメイト秋葉原', 'animate akihabara', '秋葉原'] },
  { tag: 'Animate Ikebukuro', keywords: ['アニメイト池袋', 'animate ikebukuro', '池袋'] },
  { tag: 'Kotobukiya Akihabara', keywords: ['コトブキヤ', 'kotobukiya', '秋葉原'] },
  { tag: 'Pokemon Center', keywords: ['ポケモンセンター', 'pokemon center', 'ポケセン'] },
  { tag: 'Jump Shop', keywords: ['ジャンプショップ', 'jump shop'] },
  { tag: 'Mandarake', keywords: ['まんだらけ', 'mandarake', '中野'] },
  { tag: 'Akihabara Area', keywords: ['秋葉原', 'akihabara'] },
  { tag: 'Ikebukuro Area', keywords: ['池袋', 'ikebukuro'] },
  { tag: 'Shibuya Area', keywords: ['渋谷', 'shibuya', '原宿', 'harajuku'] },
  { tag: 'Nakano Area', keywords: ['中野', 'nakano'] },
];

/**
 * Detect a route store tag based on keywords in the event text.
 * @param {string} title - Event title
 * @param {string} summary - Event summary
 * @param {string} content - Raw content HTML (optional)
 * @returns {string} Store tag or 'Tokyo Events' as default
 */
function detectStoreTag(title, summary, content) {
  const text = `${title} ${summary} ${content || ''}`.toLowerCase();
  for (const store of ROUTE_STORES) {
    for (const keyword of store.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return store.tag;
      }
    }
  }
  return 'Tokyo Events'; // Default for events that can't be mapped
}

/**
 * Decode common HTML entities found in WordPress REST API title.rendered fields.
 * Also strips any residual HTML tags.
 * @param {string} str - HTML-encoded string
 * @returns {string} Decoded plain text
 */
function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#8211;/g, '\u2013')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8220;/g, '\u201c')
    .replace(/&#8221;/g, '\u201d')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/<[^>]*>/g, '');
}

/**
 * Extract the first image URL from an HTML content string.
 * Checks data attributes for lazy-loaded images before falling back to src.
 * @param {string} html - HTML content string
 * @returns {string|null} Image URL or null
 */
function extractImageFromHtml(html) {
  if (!html) return null;
  try {
    const $ = cheerio.load(html);
    const img = $('img').first();
    if (!img.length) return null;
    const src = img.attr('data-src') || img.attr('data-original') || img.attr('src');
    if (src && src.startsWith('//')) return 'https:' + src;
    return src || null;
  } catch (_) {
    return null;
  }
}

/**
 * Format event start/end dates into a readable period string.
 * @param {string|null} start - ISO 8601 start date
 * @param {string|null} end - ISO 8601 end date
 * @returns {string} Formatted period (e.g., "Mar 5 - Apr 1") or empty string
 */
function formatEventPeriod(start, end) {
  if (!start) return '';
  try {
    const s = new Date(start);
    if (isNaN(s.getTime())) return '';
    const options = { month: 'short', day: 'numeric' };
    let text = s.toLocaleDateString('en-US', options);
    if (end) {
      const e = new Date(end);
      if (!isNaN(e.getTime())) {
        text += ' \u2013 ' + e.toLocaleDateString('en-US', options);
      }
    }
    return text;
  } catch (_) {
    return '';
  }
}

// ============================================================
// API Fetchers
// ============================================================

/**
 * Fetch events from collabo-cafe.com WordPress REST API.
 * Supports multi-page fetching.
 * @param {Object} source - Source configuration from config.js
 * @returns {Promise<Array>} Normalized event items
 */
async function fetchCollaboCafe(source) {
  const items = [];
  const pages = source.pages || 1;

  for (let page = 1; page <= pages; page++) {
    try {
      const params = { ...source.params, page, _embed: true };
      const res = await axios.get(source.url, {
        params,
        timeout: TIMEOUT,
        headers: { 'User-Agent': UA },
      });

      for (const event of res.data) {
        const title = decodeEntities(event.title?.rendered || '');
        const link = event.link || '';

        // Get featured image from _embedded (much more reliable than content HTML)
        const featuredMedia = event._embedded?.['wp:featuredmedia']?.[0];
        let image = featuredMedia?.source_url
          || featuredMedia?.media_details?.sizes?.medium?.source_url
          || extractImageFromHtml(event.content?.rendered)
          || null;

        // Filter out known banner/ad images
        if (image && isBannerImage(image)) {
          image = null;
        }

        const summary = truncate(
          stripHtml(event.excerpt?.rendered || event.content?.rendered || ''),
          200
        );
        const period = formatEventPeriod(event.start, event.end);

        // Detect store tag from event content
        const storeTag = detectStoreTag(title, summary, event.content?.rendered || '');

        items.push({
          id: generateId(link),
          title,
          summary: period ? `${period} | ${summary}` : summary,
          link,
          image,
          source: source.name,
          storeTag,
          publishedAt: event.modified || event.start || new Date().toISOString(),
          category: source.category,
          language: source.language,
          translated: false,
          eventStart: event.start || null,
          eventEnd: event.end || null,
        });
      }
      console.log(`    Page ${page}: ${res.data.length} events`);
    } catch (err) {
      console.error(`  [ERROR] ${source.name} page ${page}: ${err.message}`);
    }
  }

  return items;
}

/**
 * Fetch posts from Animate WordPress REST API (onlyshop, gratte).
 * These endpoints return standard WP post objects in JSON.
 * @param {Object} source - Source configuration from config.js
 * @returns {Promise<Array>} Normalized post items
 */
async function fetchAnimateWP(source) {
  const items = [];

  try {
    const params = { ...source.params, _embed: true };
    const res = await axios.get(source.url, {
      params,
      timeout: TIMEOUT,
      headers: { 'User-Agent': UA },
    });

    for (const post of res.data) {
      const title = decodeEntities(post.title?.rendered || '');
      const link = post.link || '';

      // Get featured image from _embedded first, fall back to content HTML
      const featuredMedia = post._embedded?.['wp:featuredmedia']?.[0];
      let image = featuredMedia?.source_url
        || featuredMedia?.media_details?.sizes?.medium?.source_url
        || extractImageFromHtml(post.content?.rendered)
        || null;

      // Filter out known banner/ad images
      if (image && isBannerImage(image)) {
        image = null;
      }

      const summary = truncate(
        stripHtml(post.excerpt?.rendered || post.content?.rendered || ''),
        200
      );

      items.push({
        id: generateId(link),
        title,
        summary,
        link,
        image,
        source: source.name,
        storeTag: source.storeTag,
        publishedAt: post.date || post.modified || new Date().toISOString(),
        category: source.category,
        language: source.language,
        translated: false,
      });
    }
    console.log(`    Found ${items.length} items from ${source.name}`);
  } catch (err) {
    console.error(`  [ERROR] ${source.name}: ${err.message}`);
  }

  return items;
}

/**
 * Fetch events from Animate Cafe JSON API.
 * Response may be a plain array or wrapped in a data object.
 * Only includes events with status === "PUBLISHED".
 * @param {Object} source - Source configuration from config.js
 * @returns {Promise<Array>} Normalized cafe event items
 */
async function fetchAnimateCafe(source) {
  const items = [];

  try {
    const res = await axios.get(source.url, {
      timeout: TIMEOUT,
      headers: { 'User-Agent': UA },
    });

    // Handle both array and wrapped responses
    const events = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.events || []);

    for (const event of events) {
      // Only include published events
      if (event.status && event.status !== 'PUBLISHED') continue;

      const title = event.name || '';
      const slug = event.slug || '';
      const link = slug ? `https://animatecafe.jp/events/${slug}` : '';
      const image = event.image?.url || null;
      const period = formatEventPeriod(event.eventStartsAt, event.eventEndsAt);
      const descText = stripHtml(event.description || '');
      const summary = period
        ? `${period} | ${descText.slice(0, 150)}`
        : truncate(descText, 200);

      if (title && link) {
        items.push({
          id: generateId(link),
          title,
          summary,
          link,
          image,
          source: source.name,
          storeTag: source.storeTag,
          publishedAt: event.eventStartsAt || event.displayStartsAt || new Date().toISOString(),
          category: source.category,
          language: source.language,
          translated: false,
          eventStart: event.eventStartsAt || null,
          eventEnd: event.eventEndsAt || null,
        });
      }
    }
    console.log(`    Found ${items.length} cafe events`);
  } catch (err) {
    console.error(`  [ERROR] ${source.name}: ${err.message}`);
  }

  return items;
}

// ============================================================
// Dispatcher
// ============================================================

/**
 * Fetch new events/products from all JSON API sources.
 * Routes each source to the appropriate fetcher based on its type field.
 * @param {Array} _sources - Ignored; uses API_SOURCES from config.js
 * @returns {Promise<Array>} Normalized event/product items
 */
async function fetchNewProducts(_sources) {
  const { API_SOURCES } = require('./config');
  const allItems = [];

  for (const source of API_SOURCES) {
    console.log(`  Fetching: ${source.name}`);
    let items = [];

    switch (source.type) {
      case 'collabo-cafe':
        items = await fetchCollaboCafe(source);
        break;
      case 'animate-wp':
        items = await fetchAnimateWP(source);
        break;
      case 'animate-cafe':
        items = await fetchAnimateCafe(source);
        break;
      default:
        console.warn(`  Unknown source type: ${source.type}`);
    }

    allItems.push(...items);
  }

  return allItems;
}

module.exports = { fetchNewProducts };
