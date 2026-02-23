/**
 * Content filtering module.
 * Filters items to only include anime goods, merchandise, and event related content.
 */

const { GOODS_KEYWORDS } = require('./config');

// Product sources that should always pass through the filter
const PRODUCT_SOURCES = ['Good Smile Company', 'Kotobukiya'];

/**
 * Check if a text string matches any of the goods-related keywords.
 * Matching is case-insensitive.
 * @param {string} text - Text to check
 * @returns {boolean} True if any keyword matches
 */
function matchesKeywords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return GOODS_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

/**
 * Filter items to only include anime goods, merchandise, and event content.
 *
 * Rules:
 * - Items from product sources (Good Smile, Kotobukiya) always pass.
 * - Items from general news sources must match at least one keyword in title or summary.
 * - Items that don't match any keyword from general news sources are excluded.
 *
 * @param {Array} items - Array of news/product items
 * @returns {Array} Filtered items
 */
function filterAnimeGoods(items) {
  const before = items.length;

  const filtered = items.filter((item) => {
    // Product sources always pass
    if (PRODUCT_SOURCES.includes(item.source)) {
      return true;
    }

    // Items with category 'products' always pass
    if (item.category === 'products') {
      return true;
    }

    // For general news sources, check keyword match in title + summary
    const combinedText = `${item.title || ''} ${item.summary || ''}`;
    return matchesKeywords(combinedText);
  });

  const after = filtered.length;
  console.log(`  Filtered: ${before} items -> ${after} items (removed ${before - after} non-matching)`);

  return filtered;
}

module.exports = { filterAnimeGoods };
