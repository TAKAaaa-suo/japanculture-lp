/**
 * RSS feed fetcher module.
 * Fetches and normalizes items from multiple RSS sources.
 */

const crypto = require('crypto');
const RSSParser = require('rss-parser');

/**
 * Generate a deterministic ID from a URL string.
 * @param {string} str - URL or unique identifier
 * @returns {string} 8-character hex hash
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
 * Extract the first image URL from RSS item fields.
 * Checks enclosure, media:content, and content:encoded in order.
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

  // Try to extract from content:encoded or content
  const content = item['content:encoded'] || item.content || '';
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) {
    return imgMatch[1];
  }

  return null;
}

/**
 * Fetch and parse RSS feeds from the given sources.
 * @param {Array} sources - Array of source config objects
 * @returns {Promise<Array>} Normalized items
 */
async function fetchRSSFeeds(sources) {
  const parser = new RSSParser({
    timeout: 15000,
    headers: {
      'User-Agent': 'JapanCulture-NewsCollector/1.0',
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
      const items = (feed.items || []).map((item) => {
        const link = item.link || item.guid || '';
        const rawSummary = item.contentSnippet || item.content || item.description || '';
        const summary = truncate(stripHtml(rawSummary), 200);
        const title = stripHtml(item.title || '');
        const pubDate = item.isoDate || item.pubDate || null;

        return {
          id: generateId(link),
          title,
          summary,
          link,
          image: extractImage(item),
          source: source.name,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          language: source.language,
          category: source.category || 'news',
          translated: false,
        };
      });

      console.log(`    Found ${items.length} items from ${source.name}`);
      allItems.push(...items);
    } catch (err) {
      console.error(`  [ERROR] Failed to fetch ${source.name}: ${err.message}`);
      // Continue with other sources
    }
  }

  return allItems;
}

module.exports = { fetchRSSFeeds, generateId, stripHtml, truncate };
