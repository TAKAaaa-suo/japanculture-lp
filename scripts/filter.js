/**
 * Content filtering module (simplified for event-specific sources).
 *
 * Since ALL sources are now event/store-exclusive specific, no keyword
 * filtering is needed. This module only:
 *   - Removes items with no title or no link
 *   - Removes duplicate items (same title, case-insensitive)
 */

/**
 * Filter and deduplicate items.
 *
 * Rules:
 * - Remove items with no title or no link
 * - Remove exact title duplicates (first occurrence wins, case-insensitive)
 *
 * @param {Array} items - Array of event/product items
 * @returns {Array} Filtered items
 */
function filterAnimeGoods(items) {
  const before = items.length;
  let removedInvalid = 0;
  let removedDuplicates = 0;

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

    filtered.push(item);
  }

  const after = filtered.length;
  console.log(`  Filtered: ${before} items -> ${after} items (removed ${removedInvalid} invalid, ${removedDuplicates} duplicates)`);

  return filtered;
}

module.exports = { filterAnimeGoods };
