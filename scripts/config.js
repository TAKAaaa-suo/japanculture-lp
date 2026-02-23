/**
 * Configuration for the store-focused product/event news collector.
 * Sources are specific to stores on the Friday proxy purchasing route in Tokyo.
 *
 * Route: Akihabara -> Ikebukuro -> Shibuya/Harajuku -> Nakano Broadway
 */

const path = require('path');

// RSS feed sources - merchandise/figure specific
const RSS_SOURCES = [
  {
    name: 'Hobby Dengeki',
    url: 'https://hobby.dengeki.com/feed/',
    language: 'ja',
    priority: 1,
    category: 'products',
    storeTag: 'All Stores',
  },
  {
    name: 'Figsoku',
    url: 'https://figsoku.net/feed/',
    language: 'ja',
    priority: 1,
    category: 'products',
    storeTag: 'All Stores',
  },
];

// Store pages to scrape
const SCRAPE_SOURCES = [
  {
    name: 'Animate',
    type: 'animate-news',
    urls: [
      'https://www.animate.co.jp/news/',
    ],
    language: 'ja',
    category: 'store-news',
    storeTag: 'Animate Akihabara / Ikebukuro',
  },
  {
    name: 'Animate OnlyShop',
    type: 'animate-onlyshop',
    urls: [
      'https://www.animate.co.jp/onlyshop/',
    ],
    language: 'ja',
    category: 'events',
    storeTag: 'Animate',
  },
  {
    name: 'Kotobukiya',
    type: 'kotobukiya',
    urls: [
      'https://www.kotobukiya.co.jp/product/',
    ],
    language: 'ja',
    category: 'products',
    storeTag: 'Kotobukiya Akihabara',
  },
  {
    name: 'Kotobukiya Events',
    type: 'kotobukiya-events',
    urls: [
      'https://www.kotobukiya.co.jp/event/',
    ],
    language: 'ja',
    category: 'events',
    storeTag: 'Kotobukiya Akihabara',
  },
  {
    name: 'Good Smile Company',
    type: 'goodsmile',
    urls: [
      'https://www.goodsmile.info/en/products/announced',
    ],
    language: 'en',
    category: 'products',
    storeTag: 'Akihabara / Online',
  },
  {
    name: 'Banpresto Prize',
    type: 'banpresto',
    urls: [
      'https://bsp-prize.jp/',
    ],
    language: 'ja',
    category: 'products',
    storeTag: 'Game Centers / Stores',
  },
  {
    name: 'Jump Shop',
    type: 'jumpshop',
    urls: [
      'https://jumpshop-online.com/products.json',
    ],
    language: 'ja',
    category: 'products',
    storeTag: 'Jump Shop Shibuya',
  },
  {
    name: 'Pokemon Goods',
    type: 'pokemon',
    urls: [
      'https://www.pokemon.co.jp/goods/',
    ],
    language: 'ja',
    category: 'products',
    storeTag: 'Pokemon Center Shibuya',
  },
];

// No keyword filtering needed - all sources are already merchandise-specific
const GOODS_KEYWORDS = []; // kept for backwards compat

const OUTPUT = {
  dir: path.join(__dirname, '..', 'files', 'data'),
  file: path.join(__dirname, '..', 'files', 'data', 'news.json'),
};

const MAX_ITEMS = 50;

module.exports = { RSS_SOURCES, SCRAPE_SOURCES, GOODS_KEYWORDS, OUTPUT, MAX_ITEMS };
