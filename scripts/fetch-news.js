#!/usr/bin/env node

/**
 * Main orchestrator script for the anime news collector.
 *
 * Flow:
 *   1. Fetch RSS feeds from configured sources
 *   2. Scrape product pages from configured sources
 *   3. Combine all items
 *   4. Filter to anime goods / merchandise / event content
 *   5. Translate Japanese items (if DeepL key is available)
 *   6. Deduplicate by ID
 *   7. Sort by publishedAt (newest first)
 *   8. Limit to MAX_ITEMS
 *   9. Write JSON to files/data/news.json
 *
 * Usage:
 *   node scripts/fetch-news.js           # Normal run
 *   node scripts/fetch-news.js --dry-run # Log items without writing file
 */

const fs = require('fs');
const path = require('path');

const { RSS_SOURCES, SCRAPE_SOURCES, OUTPUT, MAX_ITEMS } = require('./config');
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
  console.log('=== Anime News Collector ===');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Step 1: Fetch RSS feeds
  console.log('[1/6] Fetching RSS feeds...');
  let rssItems = [];
  try {
    rssItems = await fetchRSSFeeds(RSS_SOURCES);
  } catch (err) {
    console.error(`[ERROR] RSS fetch failed entirely: ${err.message}`);
  }
  console.log(`  Total RSS items: ${rssItems.length}`);
  console.log('');

  // Step 2: Scrape product pages
  console.log('[2/6] Scraping product pages...');
  let productItems = [];
  try {
    productItems = await fetchNewProducts(SCRAPE_SOURCES);
  } catch (err) {
    console.error(`[ERROR] Product scraping failed entirely: ${err.message}`);
  }
  console.log(`  Total product items: ${productItems.length}`);
  console.log('');

  // Step 3: Combine all items
  console.log('[3/6] Combining items...');
  let allItems = [...rssItems, ...productItems];
  console.log(`  Combined total: ${allItems.length}`);
  console.log('');

  // Step 4: Filter to anime goods content
  console.log('[4/6] Filtering for anime goods/merchandise/events...');
  allItems = filterAnimeGoods(allItems);
  console.log('');

  // Step 5: Translate Japanese items
  console.log('[5/6] Translating Japanese items...');
  allItems = await translateTexts(allItems);
  console.log('');

  // Step 6: Deduplicate, sort, and limit
  console.log('[6/6] Finalizing...');
  allItems = deduplicateById(allItems);
  console.log(`  After deduplication: ${allItems.length}`);

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

  // Build output object
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
      publishedAt: item.publishedAt,
      category: item.category,
      translated: item.translated || false,
      ...(item.originalTitle ? { originalTitle: item.originalTitle } : {}),
    })),
  };

  console.log('');

  if (isDryRun) {
    console.log('=== DRY RUN: Output Preview ===');
    console.log(`Items: ${output.count}`);
    console.log('');
    output.items.slice(0, 10).forEach((item, i) => {
      console.log(`  ${i + 1}. [${item.source}] ${item.title}`);
      console.log(`     ${item.link}`);
      console.log(`     ${item.publishedAt} | ${item.category}`);
      console.log('');
    });
    if (output.count > 10) {
      console.log(`  ... and ${output.count - 10} more items`);
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
