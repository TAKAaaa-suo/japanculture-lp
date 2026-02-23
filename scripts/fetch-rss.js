/**
 * RSS feed fetcher module.
 * Fetches and normalizes items from Japanese merchandise RSS sources.
 * Optimized for WordPress feeds (Hobby Dengeki, Figsoku) which use
 * content:encoded with full HTML containing images and product details.
 *
 * Includes OG image fallback for items without images in their feed content.
 */

const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');
const RSSParser = require('rss-parser');

/** Max number of article pages to fetch for OG image extraction per source */
const OG_IMAGE_FETCH_LIMIT = 10;
/** Timeout for individual article page fetches (ms) */
const OG_IMAGE_FETCH_TIMEOUT = 5000;

/**
 * Generate a deterministic ID from a URL string.
 * @param {string} str - URL or unique identifier
 * @returns {string} 16-character hex hash
 */
function generateId(str) {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

/**
 * Strip HTML tags from a string and collapse whitespace.
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 * @param {string} str - Input string
 * @param {number} maxLen - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen - 3).trim() + '...';
}

/**
 * Extract the FIRST image URL from content:encoded HTML.
 * Japanese WordPress feeds (Hobby Dengeki, Figsoku) embed full HTML
 * with multiple images in content:encoded.
 * @param {string} contentEncoded - The content:encoded HTML string
 * @returns {string|null} First image URL or null
 */
function extractImageFromContent(contentEncoded) {
  if (!contentEncoded) return null;

  // Try to parse with cheerio for robust extraction
  try {
    const $ = cheerio.load(contentEncoded);
    const $img = $('img').first();
    if ($img.length) {
      // Check data attributes first (lazy loading), then src
      const src = $img.attr('data-original')
        || $img.attr('data-src')
        || $img.attr('data-lazy')
        || $img.attr('src')
        || null;
      return src;
    }
  } catch (_) {
    // Fall through to regex
  }

  // Fallback: regex extraction
  const imgMatch = contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    return imgMatch[1];
  }

  return null;
}

/**
 * Extract the first image URL from RSS item fields.
 * Checks enclosure, media:content, content:encoded, and content in order.
 * @param {Object} item - Parsed RSS item
 * @returns {string|null} Image URL or null
 */
function extractImage(item) {
  // Check enclosure
  if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image')) {
    return item.enclosure.url;
  }

  // Check media:content or media:thumbnail
  if (item['media:content'] && item['media:content']['$'] && item['media:content']['$'].url) {
    return item['media:content']['$'].url;
  }
  if (item['media:thumbnail'] && item['media:thumbnail']['$'] && item['media:thumbnail']['$'].url) {
    return item['media:thumbnail']['$'].url;
  }

  // Check itunes:image
  if (item.itunes && item.itunes.image) {
    return item.itunes.image;
  }

  // Extract FIRST image from content:encoded (primary for Japanese WP feeds)
  const contentEncoded = item['content:encoded'] || '';
  const imgFromContent = extractImageFromContent(contentEncoded);
  if (imgFromContent) {
    return imgFromContent;
  }

  // Fallback: try content field
  const content = item.content || '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    return imgMatch[1];
  }

  return null;
}

/**
 * Extract price from content if mentioned.
 * Looks for Japanese price patterns like "価格：3,500円", "税込3,500円",
 * "¥3,500", etc.
 * @param {string} text - Text content to search
 * @returns {string|null} Formatted price string or null
 */
function extractPrice(text) {
  if (!text) return null;

  // Pattern: number followed by 円
  const yenMatch = text.match(/([\d,]+)\s*円/);
  if (yenMatch) {
    return '\u00a5' + yenMatch[1]; // ¥ prefix
  }

  // Pattern: ¥ or ￥ followed by number
  const symbolMatch = text.match(/[¥￥]\s*([\d,]+)/);
  if (symbolMatch) {
    return '\u00a5' + symbolMatch[1];
  }

  return null;
}

/**
 * Normalize an image URL:
 * - Prepend https: if URL starts with //
 * - Fix double // in path (not in protocol)
 * @param {string|null} url - Raw image URL
 * @returns {string|null} Normalized URL or null
 */
function normalizeImageUrl(url) {
  if (!url) return null;
  let normalized = url.trim();
  if (normalized.startsWith('//')) {
    normalized = 'https:' + normalized;
  }
  // Fix double // in path (but not in protocol like https://)
  const protoMatch = normalized.match(/^(https?:\/\/)/);
  if (protoMatch) {
    const proto = protoMatch[1];
    const rest = normalized.slice(proto.length);
    normalized = proto + rest.replace(/\/\//g, '/');
  }
  return normalized;
}

/**
 * Fetch the og:image meta tag from an article page.
 * @param {string} url - Article URL
 * @returns {Promise<string|null>} OG image URL or null
 */
async function fetchOgImage(url) {
  try {
    const response = await axios.get(url, {
      timeout: OG_IMAGE_FETCH_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JapanCulture-Bot/1.0)',
        'Accept': 'text/html',
      },
      // Only download the first 100KB to avoid fetching huge pages
      maxContentLength: 100 * 1024,
    });
    const $ = cheerio.load(response.data);
    const ogImage = $('meta[property="og:image"]').attr('content')
      || $('meta[name="twitter:image"]').attr('content')
      || null;
    return normalizeImageUrl(ogImage);
  } catch (_) {
    return null;
  }
}

/**
 * For items that have no image, try to fetch the og:image from their article page.
 * Limited to the first OG_IMAGE_FETCH_LIMIT items to avoid excessive requests.
 * @param {Array} items - Array of normalized items
 * @returns {Promise<Array>} Items with images filled in where possible
 */
async function fillMissingImages(items) {
  let fetched = 0;
  for (const item of items) {
    if (item.image) continue; // Already has an image
    if (fetched >= OG_IMAGE_FETCH_LIMIT) break;
    if (!item.link) continue;

    fetched++;
    const ogImage = await fetchOgImage(item.link);
    if (ogImage) {
      item.image = ogImage;
    }
  }
  if (fetched > 0) {
    const filled = items.filter((i) => i.image).length;
    console.log(`    Fetched OG images for ${fetched} articles (${filled} now have images)`);
  }
  return items;
}

/**
 * Fetch and parse RSS feeds from the given sources.
 * Optimized for Japanese WordPress feeds with content:encoded.
 * @param {Array} sources - Array of source config objects
 * @returns {Promise<Array>} Normalized items
 */
async function fetchRSSFeeds(sources) {
  const parser = new RSSParser({
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JapanCulture-Bot/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
    customFields: {
      item: [
        ['media:content', 'media:content'],
        ['media:thumbnail', 'media:thumbnail'],
        ['content:encoded', 'content:encoded'],
      ],
    },
  });

  const allItems = [];

  for (const source of sources) {
    try {
      console.log(`  Fetching RSS: ${source.name} (${source.url})`);
      const feed = await parser.parseURL(source.url);
      let items = (feed.items || []).map((item) => {
        const link = item.link || item.guid || '';

        // For Japanese WP feeds, content:encoded has the full article HTML
        const contentEncoded = item['content:encoded'] || '';
        const rawContent = item.contentSnippet || item.content || item.description || '';

        // Strip HTML for summary from content:encoded first, then fallback
        const summarySource = contentEncoded || rawContent;
        const summary = truncate(stripHtml(summarySource), 200);

        const title = stripHtml(item.title || '');
        const pubDate = item.isoDate || item.pubDate || null;

        // Extract and normalize image URL (content:encoded first)
        const rawImage = extractImage(item);
        const image = normalizeImageUrl(rawImage);

        // Extract price from content
        const priceText = stripHtml(contentEncoded || rawContent);
        const price = extractPrice(priceText);

        return {
          id: generateId(link),
          title,
          summary,
          link,
          image,
          source: source.name,
          storeTag: source.storeTag || null,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          language: source.language,
          category: source.category || 'products',
          translated: false,
          price,
        };
      });

      console.log(`    Found ${items.length} items from ${source.name}`);

      // If many items lack images, try fetching OG images from article pages
      const missingCount = items.filter((i) => !i.image).length;
      if (missingCount > 0) {
        console.log(`    ${missingCount} items lack images, fetching OG images (up to ${OG_IMAGE_FETCH_LIMIT})...`);
        items = await fillMissingImages(items);
      }

      allItems.push(...items);
    } catch (err) {
      console.error(`  [ERROR] Failed to fetch ${source.name}: ${err.message}`);
      // Continue with other sources
    }
  }

  return allItems;
}

module.exports = { fetchRSSFeeds, generateId, stripHtml, truncate, normalizeImageUrl, extractPrice };
