/**
 * RSS feed fetcher module.
 * Fetches and normalizes items from Japanese event/store RSS sources.
 *
 * Optimized for nijimen RSS feed with category-based filtering.
 * Only includes items whose categories match the configured filterTags
 * (e.g., events, cafes, collaborations, limited goods).
 */

const crypto = require('crypto');
const cheerio = require('cheerio');
const RSSParser = require('rss-parser');

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
  const protoMatch = normalized.match(/^(https?:\/\/)/);
  if (protoMatch) {
    const proto = protoMatch[1];
    const rest = normalized.slice(proto.length);
    normalized = proto + rest.replace(/\/\//g, '/');
  }
  return normalized;
}

/**
 * Extract image URL from an RSS item.
 * Checks media:content, enclosure, content:encoded, and content in order.
 * Optimized for nijimen which uses media:content with url attribute.
 * @param {Object} item - Parsed RSS item
 * @returns {string|null} Image URL or null
 */
function extractImage(item) {
  // Check media:content (nijimen uses this)
  if (item['media:content'] && item['media:content']['$'] && item['media:content']['$'].url) {
    return item['media:content']['$'].url;
  }
  if (item['media:thumbnail'] && item['media:thumbnail']['$'] && item['media:thumbnail']['$'].url) {
    return item['media:thumbnail']['$'].url;
  }

  // Check enclosure
  if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image')) {
    return item.enclosure.url;
  }

  // Extract first image from content:encoded
  const contentEncoded = item['content:encoded'] || '';
  if (contentEncoded) {
    try {
      const $ = cheerio.load(contentEncoded);
      const $img = $('img').first();
      if ($img.length) {
        const src = $img.attr('data-original')
          || $img.attr('data-src')
          || $img.attr('src')
          || null;
        if (src) return src;
      }
    } catch (_) {
      // Fall through
    }
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
 * Check if an RSS item's categories match any of the configured filter tags.
 * @param {Object} item - Parsed RSS item
 * @param {string[]} filterTags - Array of allowed category strings
 * @returns {boolean} True if at least one category matches
 */
function matchesFilterTags(item, filterTags) {
  if (!filterTags || filterTags.length === 0) return true;

  // rss-parser stores categories as an array of strings
  const categories = item.categories || [];
  if (categories.length === 0) return false;

  for (const cat of categories) {
    const catLower = (cat || '').toLowerCase();
    for (const tag of filterTags) {
      if (catLower.includes(tag.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Fetch and parse RSS feeds from the given sources.
 * Supports category-based filtering via source.filterTags.
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
      let feedItems = feed.items || [];

      // Apply category filter if filterTags are configured
      if (source.filterTags && source.filterTags.length > 0) {
        const before = feedItems.length;
        feedItems = feedItems.filter((item) => matchesFilterTags(item, source.filterTags));
        console.log(`    Tag filter: ${before} -> ${feedItems.length} items (tags: ${source.filterTags.join(', ')})`);
      }

      const items = feedItems.map((item) => {
        const link = item.link || item.guid || '';
        const contentEncoded = item['content:encoded'] || '';
        const rawContent = item.contentSnippet || item.content || item.description || '';
        const summarySource = contentEncoded || rawContent;
        const summary = truncate(stripHtml(summarySource), 200);
        const title = stripHtml(item.title || '');
        const pubDate = item.isoDate || item.pubDate || null;

        const rawImage = extractImage(item);
        const image = normalizeImageUrl(rawImage);

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
          category: source.category || 'events',
          translated: false,
        };
      });

      console.log(`    Found ${items.length} items from ${source.name}`);
      allItems.push(...items);
    } catch (err) {
      console.error(`  [ERROR] Failed to fetch ${source.name}: ${err.message}`);
    }
  }

  return allItems;
}

module.exports = { fetchRSSFeeds, generateId, stripHtml, truncate, normalizeImageUrl };
