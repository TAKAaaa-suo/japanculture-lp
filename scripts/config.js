/**
 * Configuration for the anime news collector.
 * Defines data sources, keywords, and output settings.
 */

const path = require('path');

// RSS feed sources ordered by priority
const RSS_SOURCES = [
  {
    name: 'Anime News Network',
    url: 'https://www.animenewsnetwork.com/all/rss.xml',
    language: 'en',
    priority: 1,
    category: 'news',
  },
  {
    name: 'Crunchyroll News',
    url: 'https://www.crunchyroll.com/newsrss?lang=en',
    language: 'en',
    priority: 1,
    category: 'news',
  },
  {
    name: 'MyAnimeList News',
    url: 'https://myanimelist.net/rss/news.xml',
    language: 'en',
    priority: 2,
    category: 'news',
  },
  {
    name: 'Natalie Comic',
    url: 'https://natalie.mu/comic/feed',
    language: 'ja',
    priority: 3,
    category: 'news',
  },
  {
    name: 'Animate Times',
    url: 'https://www.animatetimes.com/rss.xml',
    language: 'ja',
    priority: 3,
    category: 'news',
  },
];

// Product pages to scrape
const SCRAPE_SOURCES = [
  {
    name: 'Good Smile Company',
    url: 'https://www.goodsmile.info/en/products/announced',
    language: 'en',
    category: 'products',
  },
  {
    name: 'Kotobukiya',
    url: 'https://www.kotobukiya.co.jp/en/product-category/figure/',
    language: 'en',
    category: 'products',
  },
];

// Keywords used to filter anime goods / merchandise / event content
const GOODS_KEYWORDS = [
  // Product types
  'figure', 'figurine', 'nendoroid', 'figma', 'statue',
  'scale figure', 'plush', 'plushie', 'stuffed',
  'merchandise', 'merch', 'goods', 'collectible',
  'model kit', 'gunpla', 'plastic model',
  'artbook', 'art book',
  'dakimakura', 'tapestry', 'poster',
  'keychain', 'strap', 'badge', 'pin',
  'acrylic stand', 'acrylic block',
  'trading card', 'card game', 'tcg',
  'gashapon', 'gacha', 'capsule toy',
  'prize figure', 'crane game', 'ichiban kuji',
  'cosplay', 'costume',
  'soundtrack', 'ost', 'vinyl',
  't-shirt', 'apparel', 'clothing',
  'mug', 'tumbler', 'cup',
  'towel', 'blanket',
  'tote bag', 'backpack',
  // Events
  'event', 'exhibition', 'expo', 'convention',
  'anime expo', 'comiket', 'comic market',
  'anime japan', 'wonder festival', 'wonfes',
  'jump festa', 'tokyo game show',
  'collaboration', 'collab', 'pop-up shop',
  'cafe', 'store event', 'signing',
  // Commerce
  'pre-order', 'preorder', 'pre order',
  'release date', 'on sale', 'limited edition',
  'exclusive', 'shop', 'store',
  'proxy', 'buying service',
  'import', 'japan exclusive',
  // Japanese keywords (for untranslated content)
  'フィギュア', 'ねんどろいど', 'グッズ',
  '予約', '発売', '限定',
  'イベント', 'コラボ', '展示',
  'プライズ', 'アクリルスタンド',
  'ガシャポン', 'ガチャ', '一番くじ',
];

// Output settings
const OUTPUT = {
  dir: path.join(__dirname, '..', 'files', 'data'),
  file: path.join(__dirname, '..', 'files', 'data', 'news.json'),
};

// Maximum number of items to keep in the output
const MAX_ITEMS = 50;

module.exports = {
  RSS_SOURCES,
  SCRAPE_SOURCES,
  GOODS_KEYWORDS,
  OUTPUT,
  MAX_ITEMS,
};
