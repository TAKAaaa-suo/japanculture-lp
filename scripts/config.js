/**
 * Configuration for the store-exclusive event/goods news collector.
 *
 * BUSINESS CONTEXT: This is a proxy purchasing service for items that can
 * ONLY be bought by physically being at a store in Japan.
 *
 * Sources focus exclusively on:
 *   - Collaboration cafes with exclusive goods
 *   - Pop-up shops / OnlyShops
 *   - Store purchase bonuses
 *   - Exhibition exclusive merchandise
 *   - In-store-only events
 */

const path = require('path');

// JSON API sources - all return structured JSON, no HTML scraping needed
const API_SOURCES = [
  {
    name: 'Collab Cafes & Events',
    type: 'collabo-cafe',
    url: 'https://collabo-cafe.com/wp-json/wp/v2/events',
    params: { per_page: 20, orderby: 'modified', order: 'desc' },
    pages: 2,
    language: 'ja',
    category: 'events',
    storeTag: 'Tokyo Events',
  },
  {
    name: 'Animate OnlyShop',
    type: 'animate-wp',
    url: 'https://www.animate.co.jp/wp-json/wp/v2/onlyshop',
    params: { per_page: 15, orderby: 'date', order: 'desc' },
    pages: 1,
    language: 'ja',
    category: 'popup-shop',
    storeTag: 'Animate',
  },
  {
    name: 'Animate Gratte',
    type: 'animate-wp',
    url: 'https://www.animate.co.jp/wp-json/wp/v2/gratte',
    params: { per_page: 10, orderby: 'date', order: 'desc' },
    pages: 1,
    language: 'ja',
    category: 'store-exclusive',
    storeTag: 'Animate',
  },
  {
    name: 'Animate Cafe',
    type: 'animate-cafe',
    url: 'https://api.cafeweb.animatecafe.jp/api/v1/events',
    language: 'ja',
    category: 'cafe',
    storeTag: 'Animate Cafe',
  },
];

// RSS feed sources - filtered by event/store-relevant tags
const RSS_SOURCES = [
  {
    name: 'nijimen',
    url: 'https://nijimen.kusuguru.co.jp/feed',
    language: 'ja',
    category: 'events',
    storeTag: 'Various',
    filterTags: [
      'イベント',
      'カフェ',
      'グッズ',
      'フェア_キャンペーン',
      'コラボカフェ',
      'コラボ',
      'ポップアップ',
      '限定',
    ],
  },
];

// No HTML scraping needed - all sources are JSON APIs or RSS
const SCRAPE_SOURCES = [];

// Not needed - all sources are event-specific
const GOODS_KEYWORDS = [];

const OUTPUT = {
  dir: path.join(__dirname, '..', 'files', 'data'),
  file: path.join(__dirname, '..', 'files', 'data', 'news.json'),
};

const MAX_ITEMS = 50;

module.exports = { API_SOURCES, RSS_SOURCES, SCRAPE_SOURCES, GOODS_KEYWORDS, OUTPUT, MAX_ITEMS };
