/**
 * Product page scraper module.
 * Scrapes product listings from Good Smile Company and Kotobukiya.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { generateId, truncate } = require('./fetch-rss');

const REQUEST_TIMEOUT = 20000;
const USER_AGENT = 'JapanCulture-NewsCollector/1.0';

// Short or generic titles that indicate navigation elements, not real products
const JUNK_TITLES = ['top', 'home', 'mobile site', 'menu', 'search', 'cart', 'login', 'sign in'];

/**
 * Clean a title string: collapse whitespace, remove stray numbers, trim.
 * @param {string} raw - Raw title text
 * @returns {string} Cleaned title
 */
function cleanTitle(raw) {
  if (!raw) return '';
  return raw
    .replace(/[\t\n\r]+/g, ' ')  // replace tabs/newlines with spaces
    .replace(/\s+/g, ' ')         // collapse multiple spaces
    .replace(/^\d+\s*$/, '')       // remove titles that are just numbers
    .trim();
}

/**
 * Check whether a scraped item looks like a real product (not a navigation link).
 * @param {string} title - Cleaned title
 * @param {string} link - Product URL
 * @returns {boolean} True if the item appears to be a genuine product
 */
function isValidProduct(title, link) {
  if (!title || title.length < 3) return false;
  if (JUNK_TITLES.includes(title.toLowerCase())) return false;
  // Reject links that are javascript: or anchor-only
  if (link.includes('javascript:') || link.endsWith('#')) return false;
  // Must contain /product/ in the URL for Good Smile, or a real path for Kotobukiya
  return true;
}

/**
 * Scrape announced products from Good Smile Company.
 * @param {Object} source - Source configuration object
 * @returns {Promise<Array>} Normalized product items
 */
async function scrapeGoodSmile(source) {
  const items = [];

  try {
    console.log(`  Scraping: ${source.name} (${source.url})`);
    const response = await axios.get(source.url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const $ = cheerio.load(response.data);

    // Good Smile product listing items
    // They use .hitItem containers for product cards
    $('.hitItem, .productItem, [class*="product"]').each((_, el) => {
      const $el = $(el);
      const titleEl = $el.find('a[title], .hitTtl a, .productName a, h3 a, h4 a').first();
      const rawTitle = titleEl.text() || $el.find('a').first().text() || '';
      const title = cleanTitle(rawTitle);
      const relativeLink = titleEl.attr('href') || $el.find('a').first().attr('href') || '';
      const link = relativeLink.startsWith('http')
        ? relativeLink
        : `https://www.goodsmile.info${relativeLink}`;
      const image = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || null;
      const imageUrl = image && !image.startsWith('http') ? `https://www.goodsmile.info${image}` : image;
      const dateText = $el.find('.hitDate, .productDate, [class*="date"]').first().text().trim();

      if (isValidProduct(title, link) && link !== 'https://www.goodsmile.info') {
        items.push({
          id: generateId(link),
          title: truncate(title, 200),
          summary: `New product announcement from Good Smile Company: ${truncate(title, 150)}`,
          link,
          image: imageUrl,
          source: source.name,
          publishedAt: dateText ? parseLooseDate(dateText) : new Date().toISOString(),
          language: source.language,
          category: 'products',
          translated: false,
        });
      }
    });

    console.log(`    Found ${items.length} products from ${source.name}`);
  } catch (err) {
    console.error(`  [ERROR] Failed to scrape ${source.name}: ${err.message}`);
  }

  return items;
}

/**
 * Scrape figure products from Kotobukiya.
 * @param {Object} source - Source configuration object
 * @returns {Promise<Array>} Normalized product items
 */
async function scrapeKotobukiya(source) {
  const items = [];

  try {
    console.log(`  Scraping: ${source.name} (${source.url})`);
    const response = await axios.get(source.url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const $ = cheerio.load(response.data);

    // Kotobukiya uses various product card layouts
    $('article, .product-item, .product-card, [class*="product"], .entry, li.item').each((_, el) => {
      const $el = $(el);
      const titleEl = $el.find('h2 a, h3 a, h4 a, .product-title a, .entry-title a, a.title').first();
      const rawTitle = titleEl.text() || $el.find('a').first().text() || '';
      const title = cleanTitle(rawTitle);
      const relativeLink = titleEl.attr('href') || $el.find('a').first().attr('href') || '';
      const link = relativeLink.startsWith('http')
        ? relativeLink
        : `https://www.kotobukiya.co.jp${relativeLink}`;
      const image = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src') || null;
      const imageUrl = image && !image.startsWith('http') ? `https://www.kotobukiya.co.jp${image}` : image;
      const dateText = $el.find('time, .date, [class*="date"]').first().text().trim();

      if (isValidProduct(title, link) && link !== 'https://www.kotobukiya.co.jp') {
        items.push({
          id: generateId(link),
          title: truncate(title, 200),
          summary: `New figure from Kotobukiya: ${truncate(title, 150)}`,
          link,
          image: imageUrl,
          source: source.name,
          publishedAt: dateText ? parseLooseDate(dateText) : new Date().toISOString(),
          language: source.language,
          category: 'products',
          translated: false,
        });
      }
    });

    console.log(`    Found ${items.length} products from ${source.name}`);
  } catch (err) {
    console.error(`  [ERROR] Failed to scrape ${source.name}: ${err.message}`);
  }

  return items;
}

/**
 * Parse a loosely formatted date string into an ISO string.
 * Falls back to the current date on failure.
 * @param {string} dateStr - Date string
 * @returns {string} ISO date string
 */
function parseLooseDate(dateStr) {
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch (_) {
    // Fall through
  }
  return new Date().toISOString();
}

/**
 * Fetch new products from all scrape sources.
 * @param {Array} sources - Array of scrape source config objects
 * @returns {Promise<Array>} Normalized product items
 */
async function fetchNewProducts(sources) {
  const allItems = [];

  for (const source of sources) {
    let items = [];
    if (source.name === 'Good Smile Company') {
      items = await scrapeGoodSmile(source);
    } else if (source.name === 'Kotobukiya') {
      items = await scrapeKotobukiya(source);
    } else {
      console.warn(`  [WARN] Unknown scrape source: ${source.name}, skipping`);
    }
    allItems.push(...items);
  }

  return allItems;
}

module.exports = { fetchNewProducts };
