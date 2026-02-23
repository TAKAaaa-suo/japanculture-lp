#!/usr/bin/env node

/**
 * Main orchestrator script for the store-exclusive event news collector.
 *
 * Flow:
 *   1. Fetch JSON APIs (collabo-cafe, Animate OnlyShop, Gratte, Animate Cafe)
 *   2. Fetch RSS feeds (nijimen, filtered by event/store tags)
 *   3. Combine all items
 *   4. Filter (remove invalid items and exact duplicates)
 *   5. Translate Japanese items to English (via Google Translate)
 *   6. Deduplicate by ID
 *   7. Sort by publishedAt (newest first)
 *   8. Limit to MAX_ITEMS (50)
 *   9. Write JSON to files/data/news.json
 *
 * Usage:
 *   node scripts/fetch-news.js           # Normal run
 *   node scripts/fetch-news.js --dry-run # Log items without writing file
 */

const fs = require('fs');
const path = require('path');

const { API_SOURCES, RSS_SOURCES, OUTPUT, MAX_ITEMS } = require('./config');
const { fetchRSSFeeds } = require('./fetch-rss');
const { fetchNewProducts } = require('./fetch-products');
const { translateTexts } = require('./translate');
const { filterAnimeGoods } = require('./filter');

const isDryRun = process.argv.includes('--dry-run');

/**
 * Deduplicate items by their ID field.
 * First occurrence wins.
 * @param {Array} items
 * @returns {Array} Deduplicated items
 */
function deduplicateById(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  }
  return unique;
}

/**
 * Main execution function.
 */
async function main() {
  const startTime = Date.now();
  console.log('=== Store-Exclusive Event News Collector ===');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Step 1: Fetch JSON API sources
  console.log('[1/6] Fetching JSON API sources (collabo-cafe, Animate OnlyShop, Gratte, Animate Cafe)...');
  let apiItems = [];
  try {
    apiItems = await fetchNewProducts(API_SOURCES);
  } catch (err) {
    console.error(`[ERROR] API fetch failed entirely: ${err.message}`);
  }
  console.log(`  Total API items: ${apiItems.length}`);
  console.log('');

  // Step 2: Fetch RSS feeds (nijimen)
  console.log('[2/6] Fetching RSS feeds (nijimen)...');
  let rssItems = [];
  try {
    rssItems = await fetchRSSFeeds(RSS_SOURCES);
  } catch (err) {
    console.error(`[ERROR] RSS fetch failed entirely: ${err.message}`);
  }
  console.log(`  Total RSS items: ${rssItems.length}`);
  console.log('');

  // Step 3: Combine all items
  console.log('[3/6] Combining items...');
  let allItems = [...apiItems, ...rssItems];
  console.log(`  Combined total: ${allItems.length}`);
  console.log('');

  // Step 4: Filter (remove invalid + title duplicates)
  console.log('[4/6] Filtering and deduplicating...');
  allItems = filterAnimeGoods(allItems);
  console.log('');

  // Step 5: Translate Japanese items to English (Google Translate, no API key needed)
  console.log('[5/6] Translating Japanese items to English...');
  allItems = await translateTexts(allItems);
  console.log('');

  // Step 6: Deduplicate by ID, sort, and limit
  console.log('[6/6] Finalizing...');
  allItems = deduplicateById(allItems);
  console.log(`  After ID deduplication: ${allItems.length}`);

  // Sort by publishedAt descending (newest first)
  allItems.sort((a, b) => {
    const dateA = new Date(a.publishedAt).getTime();
    const dateB = new Date(b.publishedAt).getTime();
    return dateB - dateA;
  });

  // Limit to MAX_ITEMS
  if (allItems.length > MAX_ITEMS) {
    allItems = allItems.slice(0, MAX_ITEMS);
    console.log(`  Trimmed to ${MAX_ITEMS} items`);
  }

  // Build output object with eventStart/eventEnd fields
  const output = {
    lastUpdated: new Date().toISOString(),
    count: allItems.length,
    items: allItems.map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      link: item.link,
      image: item.image || null,
      source: item.source,
      storeTag: item.storeTag || null,
      publishedAt: item.publishedAt,
      category: item.category,
      language: item.language || 'ja',
      translated: item.translated || false,
      eventStart: item.eventStart || null,
      eventEnd: item.eventEnd || null,
      ...(item.originalTitle ? { originalTitle: item.originalTitle } : {}),
    })),
  };

  console.log('');

  if (isDryRun) {
    console.log('=== DRY RUN: Output Preview ===');
    console.log(`Items: ${output.count}`);
    console.log('');
    output.items.slice(0, 15).forEach((item, i) => {
      console.log(`  ${i + 1}. [${item.source}] ${item.title}`);
      console.log(`     Store: ${item.storeTag || 'N/A'} | Category: ${item.category}`);
      console.log(`     ${item.link}`);
      console.log(`     ${item.publishedAt}${item.eventStart ? ' | Event: ' + item.eventStart + ' to ' + (item.eventEnd || '?') : ''}`);
      console.log(`     Image: ${item.image ? 'YES' : 'NO'}`);
      console.log('');
    });
    if (output.count > 15) {
      console.log(`  ... and ${output.count - 15} more items`);
    }
  } else {
    // Ensure output directory exists
    fs.mkdirSync(OUTPUT.dir, { recursive: true });

    // Write JSON file
    const jsonStr = JSON.stringify(output, null, 2);
    fs.writeFileSync(OUTPUT.file, jsonStr, 'utf-8');
    console.log(`Written ${output.count} items to ${OUTPUT.file}`);
    console.log(`File size: ${(Buffer.byteLength(jsonStr) / 1024).toFixed(1)} KB`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log(`=== Done in ${elapsed}s ===`);
}

// Run
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
