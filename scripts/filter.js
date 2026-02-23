/**
 * Content filtering module for event-specific sources.
 *
 * Filters:
 *   - Removes items with no title or no link
 *   - Removes duplicate items (same title, case-insensitive)
 *   - Excludes mass-chain store collaborations (convenience stores, fast food,
 *     discount retailers, etc.) where anyone can buy without proxy
 *   - Keeps specialty/exclusive items (ichiban kuji, cafe collabs, popup shops,
 *     Animate, Pokemon Center, etc.)
 */

/**
 * Mass-chain stores/brands whose collaborations should be EXCLUDED.
 * These are nationwide chains where anyone can buy -- no proxy value.
 *
 * Each entry is { pattern, isJapanese }.
 * - Japanese patterns: matched with simple includes() (no false-positive risk in JP text)
 * - English patterns: matched with word-boundary regex to avoid false positives
 *   (e.g. "avail" should not match "available", "seven" should not match "seventh")
 */
const EXCLUDE_CHAINS_RAW = [
  // Convenience stores
  { pattern: 'セブン-イレブン', isJapanese: true },
  { pattern: 'セブンイレブン', isJapanese: true },
  { pattern: '7-eleven', isJapanese: false },
  { pattern: 'seven-eleven', isJapanese: false },
  { pattern: 'seven eleven', isJapanese: false },
  { pattern: 'ファミマ', isJapanese: true },
  { pattern: 'ファミリーマート', isJapanese: true },
  { pattern: 'familymart', isJapanese: false },
  { pattern: 'family mart', isJapanese: false },
  { pattern: 'ローソン', isJapanese: true },
  { pattern: 'lawson', isJapanese: false },
  { pattern: 'ミニストップ', isJapanese: true },
  { pattern: 'ministop', isJapanese: false },
  // Fast food
  { pattern: 'マクドナルド', isJapanese: true },
  { pattern: 'マック', isJapanese: true },
  { pattern: 'mcdonald', isJapanese: false },
  { pattern: 'ケンタッキー', isJapanese: true },
  { pattern: 'kfc', isJapanese: false },
  { pattern: 'モスバーガー', isJapanese: true },
  { pattern: 'mos burger', isJapanese: false },
  { pattern: 'すき家', isJapanese: true },
  { pattern: 'sukiya', isJapanese: false },
  { pattern: 'くら寿司', isJapanese: true },
  { pattern: 'kura sushi', isJapanese: false },
  // Discount/variety stores
  { pattern: 'ダイソー', isJapanese: true },
  { pattern: 'daiso', isJapanese: false },
  { pattern: 'セリア', isJapanese: true },
  { pattern: 'seria', isJapanese: false },
  { pattern: 'キャンドゥ', isJapanese: true },
  { pattern: 'can do', isJapanese: false },
  // Mass retail clothing
  { pattern: 'アベイル', isJapanese: true },
  { pattern: 'avail', isJapanese: false },
  { pattern: 'しまむら', isJapanese: true },
  { pattern: 'shimamura', isJapanese: false },
  { pattern: 'ユニクロ', isJapanese: true },
  { pattern: 'uniqlo', isJapanese: false },
  { pattern: 'gu', isJapanese: false },
  // Supermarkets/drugstores
  { pattern: 'イオン', isJapanese: true },
  { pattern: 'aeon', isJapanese: false },
  { pattern: 'ドンキホーテ', isJapanese: true },
  { pattern: 'ドン・キホーテ', isJapanese: true },
  { pattern: 'don quijote', isJapanese: false },
  // National restaurant chains
  { pattern: 'コメダ珈琲', isJapanese: true },
  { pattern: 'komeda', isJapanese: false },
  { pattern: 'スターバックス', isJapanese: true },
  { pattern: 'starbucks', isJapanese: false },
  { pattern: 'ガスト', isJapanese: true },
  { pattern: 'gusto', isJapanese: false },
  { pattern: 'ハッピーセット', isJapanese: true },
  { pattern: 'happy set', isJapanese: false },
  { pattern: 'happy meal', isJapanese: false },
];

/**
 * Pre-compiled matchers for each chain pattern.
 * Japanese patterns use includes(); English patterns use word-boundary regex.
 */
const CHAIN_MATCHERS = EXCLUDE_CHAINS_RAW.map(({ pattern, isJapanese }) => {
  if (isJapanese) {
    // Japanese: simple substring match (no word boundary issues)
    return (text) => text.includes(pattern);
  } else {
    // English: word-boundary regex to avoid "avail" matching "available" etc.
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    return (text) => re.test(text);
  }
});

/**
 * Flat list of chain names for export (backward compat / inspection).
 */
const EXCLUDE_CHAINS = EXCLUDE_CHAINS_RAW.map(e => e.pattern);

/**
 * Keywords that indicate a specialty/exclusive item that should be KEPT
 * even if a chain store name appears in the text.
 */
const KEEP_KEYWORDS = [
  '一番くじ', 'ichiban kuji',
];

/**
 * Check if an item is a mass-chain store collaboration.
 *
 * @param {string} title - English/translated title
 * @param {string} summary - English/translated summary
 * @param {string} [originalTitle] - Original Japanese title (if translated)
 * @returns {boolean} True if this is a chain collab that should be excluded
 */
function isChainCollab(title, summary, originalTitle) {
  const text = `${title || ''} ${summary || ''} ${originalTitle || ''}`;

  const matchesChain = CHAIN_MATCHERS.some(matcher => matcher(text));
  if (!matchesChain) return false;

  // Even if it matches a chain, keep if it contains a specialty keyword
  const textLower = text.toLowerCase();
  const isSpecialty = KEEP_KEYWORDS.some(kw => textLower.includes(kw.toLowerCase()));
  if (isSpecialty) return false;

  return true;
}

/**
 * Filter and deduplicate items.
 *
 * Rules:
 * - Remove items with no title or no link
 * - Remove exact title duplicates (first occurrence wins, case-insensitive)
 * - Exclude mass-chain store collaborations (but keep ichiban kuji, etc.)
 *
 * @param {Array} items - Array of event/product items
 * @returns {Array} Filtered items
 */
function filterAnimeGoods(items) {
  const before = items.length;
  let removedInvalid = 0;
  let removedDuplicates = 0;
  let removedChains = 0;

  const seenTitles = new Set();
  const filtered = [];

  for (const item of items) {
    // Remove items with no title or no link
    if (!item.title || !item.title.trim() || !item.link || !item.link.trim()) {
      removedInvalid++;
      continue;
    }

    // Remove exact title duplicates (case-insensitive)
    const normalizedTitle = item.title.trim().toLowerCase();
    if (seenTitles.has(normalizedTitle)) {
      removedDuplicates++;
      continue;
    }
    seenTitles.add(normalizedTitle);

    // Exclude mass-chain store collaborations
    if (isChainCollab(item.title, item.summary, item.originalTitle)) {
      removedChains++;
      console.log(`    [CHAIN EXCLUDED] ${item.title}`);
      continue;
    }

    filtered.push(item);
  }

  const after = filtered.length;
  console.log(`  Filtered: ${before} items -> ${after} items`);
  console.log(`    Removed: ${removedInvalid} invalid, ${removedDuplicates} duplicates, ${removedChains} chain-store collabs`);

  return filtered;
}

module.exports = { filterAnimeGoods, isChainCollab, EXCLUDE_CHAINS };
