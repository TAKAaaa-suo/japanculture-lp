/**
 * Multi-store product/event scraper module.
 * Scrapes product listings and event info from stores on the Friday route.
 *
 * Supported store types:
 *   - animate-news:      Animate news page
 *   - animate-onlyshop:  Animate OnlyShop pop-up listings
 *   - kotobukiya:         Kotobukiya product listings
 *   - kotobukiya-events:  Kotobukiya event listings
 *   - goodsmile:          Good Smile Company announced products
 *   - banpresto:          Banpresto prize figures
 *   - jumpshop:           Jump Shop Shopify JSON endpoint
 *   - pokemon:            Pokemon Center goods page
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { generateId, truncate, stripHtml, normalizeImageUrl, extractPrice } = require('./fetch-rss');

const REQUEST_TIMEOUT = 20000;
const USER_AGENT = 'Mozilla/5.0 (compatible; JapanCulture-Bot/1.0)';

// Short or generic titles that indicate navigation elements, not real products
const JUNK_TITLES = ['top', 'home', 'mobile site', 'menu', 'search', 'cart', 'login', 'sign in', ''];

/**
 * Clean a title string: collapse whitespace, remove stray numbers, trim.
 * @param {string} raw - Raw title text
 * @returns {string} Cleaned title
 */
function cleanTitle(raw) {
  if (!raw) return '';
  return raw
    .replace(/[\t\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\d+\s*$/, '')
    .trim();
}

/**
 * Check whether a scraped item looks like a real product (not a navigation link).
 * @param {string} title - Cleaned title
 * @param {string} link - Product URL
 * @returns {boolean} True if the item appears to be a genuine product
 */
function isValidProduct(title, link) {
  if (!title || title.length < 3) return false;
  if (JUNK_TITLES.includes(title.toLowerCase())) return false;
  if (link.includes('javascript:') || link.endsWith('#')) return false;
  return true;
}

/**
 * Extract the best image URL from an element, checking lazy-load attributes first.
 * @param {Object} $img - Cheerio img element
 * @returns {string|null} Image URL or null
 */
function extractBestImage($img) {
  if (!$img || !$img.length) return null;
  const src = $img.attr('data-original')
    || $img.attr('data-src')
    || $img.attr('data-lazy')
    || $img.attr('srcset')
    || $img.attr('src')
    || null;

  // Reject known placeholders
  if (src && (src.includes('load_s-') || src.includes('spacer.gif') || src.includes('loading.gif'))) {
    return null;
  }
  return src;
}

/**
 * Make a URL absolute given a base domain.
 * @param {string} url - Possibly relative URL
 * @param {string} base - Base URL (e.g. 'https://www.animate.co.jp')
 * @returns {string} Absolute URL
 */
function makeAbsolute(url, base) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return base + url;
  return base + '/' + url;
}

/**
 * Normalize and absolutize an image URL.
 * @param {string|null} rawUrl - Raw image URL
 * @param {string} baseDomain - Base domain for relative URLs
 * @returns {string|null} Normalized absolute URL or null
 */
function normalizeImage(rawUrl, baseDomain) {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (url.startsWith('//')) {
    url = 'https:' + url;
  }
  if (!url.startsWith('http')) {
    url = baseDomain + (url.startsWith('/') ? '' : '/') + url;
  }
  return normalizeImageUrl(url);
}

/**
 * Parse a loosely formatted date string into an ISO string.
 * Handles Japanese date formats like "2024年1月15日" and "2024.01.15".
 * Falls back to the current date on failure.
 * @param {string} dateStr - Date string
 * @returns {string} ISO date string
 */
function parseLooseDate(dateStr) {
  if (!dateStr) return new Date().toISOString();

  try {
    // Japanese date format: 2024年1月15日
    const jaMatch = dateStr.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (jaMatch) {
      const d = new Date(parseInt(jaMatch[1]), parseInt(jaMatch[2]) - 1, parseInt(jaMatch[3]));
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    // Dot-separated: 2024.01.15
    const dotMatch = dateStr.match(/(\d{4})[./](\d{1,2})[./](\d{1,2})/);
    if (dotMatch) {
      const d = new Date(parseInt(dotMatch[1]), parseInt(dotMatch[2]) - 1, parseInt(dotMatch[3]));
      if (!isNaN(d.getTime())) return d.toISOString();
    }

    // Standard parse
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch (_) {
    // Fall through
  }
  return new Date().toISOString();
}

/**
 * Fetch HTML from a URL with standard headers.
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} HTML string
 */
async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    },
    maxContentLength: 2 * 1024 * 1024, // 2MB max
  });
  return response.data;
}

// ============================================================
// Individual Store Scrapers
// ============================================================

/**
 * Scrape Animate news page.
 * @param {Object} source - Source configuration
 * @returns {Promise<Array>} Normalized items
 */
async function scrapeAnimateNews(source) {
  const items = [];
  const baseUrl = 'https://www.animate.co.jp';

  for (const url of source.urls) {
    try {
      console.log(`  Scraping: ${source.name} (${url})`);
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      // Animate uses various card/list structures for news
      // Try multiple selectors to find news items
      const selectors = [
        '.news-list li', '.news-list article',
        '.article-list li', '.article-list article',
        '.list-item', '.news_list li',
        'article.post', '.entry-list li',
        '.contents-list li', '.news-item',
        'ul.list li', '.c-card',
      ];

      let found = false;
      for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          found = true;
          elements.each((i, el) => {
            if (items.length >= 10) return false; // Limit to 10

            const $el = $(el);
            const $link = $el.find('a').first();
            const rawTitle = $el.find('h2, h3, h4, .title, .ttl, .news-title, .c-card__title').text()
              || $link.text() || '';
            const title = cleanTitle(rawTitle);
            const href = $link.attr('href') || '';
            const link = makeAbsolute(href, baseUrl);
            const $img = $el.find('img').first();
            const rawImage = extractBestImage($img);
            const image = normalizeImage(rawImage, baseUrl);
            const dateText = $el.find('time, .date, .news-date, [class*="date"], .c-card__date').first().text().trim();

            if (isValidProduct(title, link)) {
              items.push({
                id: generateId(link),
                title: truncate(title, 200),
                summary: `Animate news: ${truncate(title, 150)}`,
                link,
                image,
                source: source.name,
                storeTag: source.storeTag,
                publishedAt: parseLooseDate(dateText),
                language: source.language,
                category: source.category,
                translated: false,
                price: null,
              });
            }
          });
          break; // Found a working selector
        }
      }

      if (!found) {
        // Fallback: grab any anchor+image combos that look like articles
        $('a').each((i, el) => {
          if (items.length >= 10) return false;
          const $a = $(el);
          const href = $a.attr('href') || '';
          if (!href.includes('/news/') && !href.includes('/article/')) return;
          const title = cleanTitle($a.text());
          const link = makeAbsolute(href, baseUrl);
          const $img = $a.find('img').first();
          const rawImage = extractBestImage($img);
          const image = normalizeImage(rawImage, baseUrl);

          if (isValidProduct(title, link)) {
            items.push({
              id: generateId(link),
              title: truncate(title, 200),
              summary: `Animate news: ${truncate(title, 150)}`,
              link,
              image,
              source: source.name,
              storeTag: source.storeTag,
              publishedAt: new Date().toISOString(),
              language: source.language,
              category: source.category,
              translated: false,
              price: null,
            });
          }
        });
      }

      console.log(`    Found ${items.length} items from ${source.name}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to scrape ${source.name}: ${err.message}`);
    }
  }

  return items;
}

/**
 * Scrape Animate OnlyShop (pop-up shop listings).
 * @param {Object} source - Source configuration
 * @returns {Promise<Array>} Normalized items
 */
async function scrapeAnimateOnlyShop(source) {
  const items = [];
  const baseUrl = 'https://www.animate.co.jp';

  for (const url of source.urls) {
    try {
      console.log(`  Scraping: ${source.name} (${url})`);
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      // Try to find JSON-LD structured data first
      const jsonLdScripts = $('script[type="application/ld+json"]');
      let foundJsonLd = false;

      jsonLdScripts.each((_, el) => {
        try {
          const data = JSON.parse($(el).html());
          if (data['@type'] === 'ItemList' && Array.isArray(data.itemListElement)) {
            foundJsonLd = true;
            data.itemListElement.forEach((listItem) => {
              const item = listItem.item || listItem;
              const title = cleanTitle(item.name || '');
              const link = makeAbsolute(item.url || '', baseUrl);
              const image = normalizeImage(item.image || null, baseUrl);

              if (isValidProduct(title, link)) {
                items.push({
                  id: generateId(link),
                  title: truncate(title, 200),
                  summary: `Animate OnlyShop: ${truncate(title, 150)}`,
                  link,
                  image,
                  source: source.name,
                  storeTag: source.storeTag,
                  publishedAt: parseLooseDate(item.datePublished || ''),
                  language: source.language,
                  category: source.category,
                  translated: false,
                  price: null,
                });
              }
            });
          }
        } catch (_) { /* not valid JSON-LD */ }
      });

      // If no JSON-LD, parse HTML
      if (!foundJsonLd) {
        const selectors = [
          '.onlyshop-list li', '.onlyshop-item',
          '.shop-list li', '.shop-item',
          '.list-item', '.c-card',
          'article', '.entry',
        ];

        for (const selector of selectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            elements.each((i, el) => {
              if (items.length >= 15) return false;
              const $el = $(el);
              const $link = $el.find('a').first();
              const rawTitle = $el.find('h2, h3, h4, .title, .ttl, .shop-name').text()
                || $link.text() || '';
              const title = cleanTitle(rawTitle);
              const href = $link.attr('href') || '';
              const link = makeAbsolute(href, baseUrl);
              const $img = $el.find('img').first();
              const rawImage = extractBestImage($img);
              const image = normalizeImage(rawImage, baseUrl);
              const dateText = $el.find('time, .date, .period, [class*="date"]').first().text().trim();

              if (isValidProduct(title, link)) {
                items.push({
                  id: generateId(link),
                  title: truncate(title, 200),
                  summary: `Animate OnlyShop: ${truncate(title, 150)}`,
                  link,
                  image,
                  source: source.name,
                  storeTag: source.storeTag,
                  publishedAt: parseLooseDate(dateText),
                  language: source.language,
                  category: source.category,
                  translated: false,
                  price: null,
                });
              }
            });
            break;
          }
        }
      }

      console.log(`    Found ${items.length} items from ${source.name}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to scrape ${source.name}: ${err.message}`);
    }
  }

  return items;
}

/**
 * Scrape Kotobukiya product listings.
 * @param {Object} source - Source configuration
 * @returns {Promise<Array>} Normalized items
 */
async function scrapeKotobukiya(source) {
  const items = [];
  const baseUrl = 'https://www.kotobukiya.co.jp';

  for (const url of source.urls) {
    try {
      console.log(`  Scraping: ${source.name} (${url})`);
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      // Primary selectors for Kotobukiya product list
      const productSelectors = [
        'li.productList_item',
        '.product-item', '.product-card',
        'article', '.entry',
      ];

      for (const selector of productSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each((i, el) => {
            if (items.length >= 15) return false;

            const $el = $(el);

            // Product name: try specific Koto classes first
            const titleText = $el.find('.productList_title, .productList_name').text()
              || $el.find('h2 a, h3 a, h4 a, .product-title a, .entry-title a').first().text()
              || $el.find('a').first().text()
              || '';
            const title = cleanTitle(titleText);

            // Series name for richer summary
            const seriesName = cleanTitle($el.find('.productList_name, .series-name, .product-series').text() || '');

            // Link
            const $link = $el.find('a').first();
            const href = $link.attr('href') || '';
            const link = makeAbsolute(href, baseUrl);

            // Image: check data attributes, then src
            const $img = $el.find('.productList_figure img, img').first();
            const rawImage = extractBestImage($img);
            const image = normalizeImage(rawImage, baseUrl);

            // Release date
            const dateText = $el.find('.productList_dates, time, .date, [class*="date"]').first().text().trim();

            if (isValidProduct(title, link) && link !== baseUrl) {
              const summaryParts = ['Kotobukiya'];
              if (seriesName && seriesName !== title) summaryParts.push(seriesName);
              summaryParts.push(truncate(title, 150));

              items.push({
                id: generateId(link),
                title: truncate(title, 200),
                summary: summaryParts.join(': '),
                link,
                image,
                source: source.name,
                storeTag: source.storeTag,
                publishedAt: parseLooseDate(dateText),
                language: source.language,
                category: source.category,
                translated: false,
                price: null,
              });
            }
          });
          break;
        }
      }

      console.log(`    Found ${items.length} products from ${source.name}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to scrape ${source.name}: ${err.message}`);
    }
  }

  return items;
}

/**
 * Scrape Kotobukiya event listings.
 * @param {Object} source - Source configuration
 * @returns {Promise<Array>} Normalized items
 */
async function scrapeKotobukiyaEvents(source) {
  const items = [];
  const baseUrl = 'https://www.kotobukiya.co.jp';

  for (const url of source.urls) {
    try {
      console.log(`  Scraping: ${source.name} (${url})`);
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      const eventSelectors = [
        '.event-item', '.event-list li',
        'article', '.entry', '.list-item',
        '.contents-list li',
      ];

      for (const selector of eventSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each((i, el) => {
            if (items.length >= 10) return false;

            const $el = $(el);
            const $link = $el.find('a').first();
            const rawTitle = $el.find('h2, h3, h4, .title, .event-title, .entry-title').text()
              || $link.text() || '';
            const title = cleanTitle(rawTitle);
            const href = $link.attr('href') || '';
            const link = makeAbsolute(href, baseUrl);
            const $img = $el.find('img').first();
            const rawImage = extractBestImage($img);
            const image = normalizeImage(rawImage, baseUrl);
            const dateText = $el.find('time, .date, .period, [class*="date"]').first().text().trim();

            if (isValidProduct(title, link) && link !== baseUrl) {
              items.push({
                id: generateId(link),
                title: truncate(title, 200),
                summary: `Kotobukiya Event: ${truncate(title, 150)}`,
                link,
                image,
                source: source.name,
                storeTag: source.storeTag,
                publishedAt: parseLooseDate(dateText),
                language: source.language,
                category: source.category,
                translated: false,
                price: null,
              });
            }
          });
          break;
        }
      }

      console.log(`    Found ${items.length} events from ${source.name}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to scrape ${source.name}: ${err.message}`);
    }
  }

  return items;
}

/**
 * Scrape announced products from Good Smile Company.
 * Uses data-original attribute for real image URLs (the site uses lazy-loading
 * with placeholder GIFs in the src attribute).
 * @param {Object} source - Source configuration
 * @returns {Promise<Array>} Normalized product items
 */
async function scrapeGoodSmile(source) {
  const items = [];
  const baseUrl = 'https://www.goodsmile.info';

  for (const url of source.urls) {
    try {
      console.log(`  Scraping: ${source.name} (${url})`);
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      // Good Smile uses .hitItem containers with lazy-loaded images.
      // Real image URL is in data-original attribute; src is a placeholder GIF.
      $('.hitItem').each((_, el) => {
        const $el = $(el);
        const $link = $el.find('a').first();
        const rawTitle = $el.find('.hitTtl').text() || $link.text() || '';
        const title = cleanTitle(rawTitle);
        const href = $link.attr('href') || '';
        const link = makeAbsolute(href, baseUrl);

        // Prefer data-original (real image), then data-src, then data-lazy.
        const $img = $el.find('img').first();
        const rawImage = $img.attr('data-original')
          || $img.attr('data-src')
          || $img.attr('data-lazy')
          || null;
        // Only use src if it does NOT look like a placeholder
        const srcFallback = $img.attr('src') || null;
        const imageRaw = rawImage || (srcFallback && !srcFallback.includes('load_s-') ? srcFallback : null);
        const image = normalizeImage(imageRaw, baseUrl);

        const dateText = $el.find('.hitDate, [class*="date"]').first().text().trim();

        if (isValidProduct(title, link) && link !== baseUrl) {
          items.push({
            id: generateId(link),
            title: truncate(title, 200),
            summary: `New product from Good Smile Company: ${truncate(title, 150)}`,
            link,
            image,
            source: source.name,
            storeTag: source.storeTag,
            publishedAt: parseLooseDate(dateText),
            language: source.language,
            category: source.category,
            translated: false,
            price: null,
          });
        }
      });

      console.log(`    Found ${items.length} products from ${source.name}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to scrape ${source.name}: ${err.message}`);
    }
  }

  return items;
}

/**
 * Scrape Banpresto prize figure listings.
 * @param {Object} source - Source configuration
 * @returns {Promise<Array>} Normalized items
 */
async function scrapeBanpresto(source) {
  const items = [];
  const baseUrl = 'https://bsp-prize.jp';

  for (const url of source.urls) {
    try {
      console.log(`  Scraping: ${source.name} (${url})`);
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      // Banpresto uses various card/item structures for prize figures
      const prizeSelectors = [
        '.prize-item', '.product-item', '.item-card',
        '.prize-list li', '.product-list li',
        'article', '.entry', '.card',
        '.list-item', 'li.item',
        '.c-card', '.p-card',
      ];

      for (const selector of prizeSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each((i, el) => {
            if (items.length >= 15) return false;

            const $el = $(el);
            const $link = $el.find('a').first();
            const rawTitle = $el.find('h2, h3, h4, .title, .prize-name, .item-name, .product-name').text()
              || $link.text() || '';
            const title = cleanTitle(rawTitle);
            const href = $link.attr('href') || '';
            const link = makeAbsolute(href, baseUrl);
            const $img = $el.find('img').first();
            const rawImage = extractBestImage($img);
            const image = normalizeImage(rawImage, baseUrl);

            // Try to find series name
            const seriesName = cleanTitle(
              $el.find('.series, .series-name, .product-series, [class*="series"]').text() || ''
            );

            if (isValidProduct(title, link) && link !== baseUrl) {
              const summary = seriesName
                ? `Banpresto Prize: ${seriesName} - ${truncate(title, 120)}`
                : `Banpresto Prize: ${truncate(title, 150)}`;

              items.push({
                id: generateId(link),
                title: truncate(title, 200),
                summary,
                link,
                image,
                source: source.name,
                storeTag: source.storeTag,
                publishedAt: new Date().toISOString(), // Prize pages often lack dates
                language: source.language,
                category: source.category,
                translated: false,
                price: null,
              });
            }
          });
          break;
        }
      }

      console.log(`    Found ${items.length} items from ${source.name}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to scrape ${source.name}: ${err.message}`);
    }
  }

  return items;
}

/**
 * Fetch products from Jump Shop Shopify JSON endpoint.
 * This returns JSON directly, not HTML.
 * @param {Object} source - Source configuration
 * @returns {Promise<Array>} Normalized items
 */
async function scrapeJumpShop(source) {
  const items = [];

  for (const url of source.urls) {
    try {
      console.log(`  Fetching: ${source.name} (${url})`);
      const response = await axios.get(url, {
        timeout: REQUEST_TIMEOUT,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
        },
      });

      const data = response.data;
      const products = data.products || [];

      // Sort by created_at descending and take the 15 most recent
      const sorted = products
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 15);

      for (const product of sorted) {
        const title = cleanTitle(product.title || '');
        const link = `https://jumpshop-online.com/products/${product.handle}`;
        const image = (product.images && product.images.length > 0)
          ? normalizeImageUrl(product.images[0].src)
          : null;
        const publishedAt = product.created_at
          ? new Date(product.created_at).toISOString()
          : new Date().toISOString();

        // Extract price from variants
        let price = null;
        if (product.variants && product.variants.length > 0 && product.variants[0].price) {
          const priceNum = product.variants[0].price;
          // Shopify prices may be in cents or whole numbers
          const priceVal = parseFloat(priceNum);
          if (priceVal > 0) {
            // Format as yen - if > 10000 it's likely already in yen, otherwise multiply
            const yenPrice = priceVal >= 100 ? Math.round(priceVal) : Math.round(priceVal * 100);
            price = '\u00a5' + yenPrice.toLocaleString('ja-JP');
          }
        }

        // Strip HTML from body for summary
        const summary = truncate(stripHtml(product.body_html || ''), 200)
          || `Jump Shop: ${truncate(title, 150)}`;

        if (isValidProduct(title, link)) {
          items.push({
            id: generateId(link),
            title: truncate(title, 200),
            summary,
            link,
            image,
            source: source.name,
            storeTag: source.storeTag,
            publishedAt,
            language: source.language,
            category: source.category,
            translated: false,
            price,
          });
        }
      }

      console.log(`    Found ${items.length} products from ${source.name}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to fetch ${source.name}: ${err.message}`);
    }
  }

  return items;
}

/**
 * Scrape Pokemon Center goods page.
 * @param {Object} source - Source configuration
 * @returns {Promise<Array>} Normalized items
 */
async function scrapePokemon(source) {
  const items = [];
  const baseUrl = 'https://www.pokemon.co.jp';

  for (const url of source.urls) {
    try {
      console.log(`  Scraping: ${source.name} (${url})`);
      const html = await fetchHtml(url);
      const $ = cheerio.load(html);

      // Pokemon.co.jp goods page uses various card structures
      const goodsSelectors = [
        '.goods-item', '.goods-list li',
        '.product-item', '.product-list li',
        '.list-item', '.entry-item',
        'article', '.card', '.c-card',
        'li.item', '.item-list li',
      ];

      for (const selector of goodsSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          elements.each((i, el) => {
            if (items.length >= 15) return false;

            const $el = $(el);
            const $link = $el.find('a').first();
            const rawTitle = $el.find('h2, h3, h4, .title, .goods-title, .product-name, .item-name').text()
              || $link.text() || '';
            const title = cleanTitle(rawTitle);
            const href = $link.attr('href') || '';
            const link = makeAbsolute(href, baseUrl);
            const $img = $el.find('img').first();
            const rawImage = extractBestImage($img);
            const image = normalizeImage(rawImage, baseUrl);
            const dateText = $el.find('time, .date, [class*="date"]').first().text().trim();

            if (isValidProduct(title, link) && link !== baseUrl) {
              items.push({
                id: generateId(link),
                title: truncate(title, 200),
                summary: `Pokemon Center: ${truncate(title, 150)}`,
                link,
                image,
                source: source.name,
                storeTag: source.storeTag,
                publishedAt: parseLooseDate(dateText),
                language: source.language,
                category: source.category,
                translated: false,
                price: null,
              });
            }
          });
          break;
        }
      }

      console.log(`    Found ${items.length} items from ${source.name}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to scrape ${source.name}: ${err.message}`);
    }
  }

  return items;
}

// ============================================================
// Dispatcher
// ============================================================

/**
 * Dispatcher: routes to the correct scraper based on source.type.
 */
const SCRAPER_MAP = {
  'animate-news': scrapeAnimateNews,
  'animate-onlyshop': scrapeAnimateOnlyShop,
  'kotobukiya': scrapeKotobukiya,
  'kotobukiya-events': scrapeKotobukiyaEvents,
  'goodsmile': scrapeGoodSmile,
  'banpresto': scrapeBanpresto,
  'jumpshop': scrapeJumpShop,
  'pokemon': scrapePokemon,
};

/**
 * Fetch new products/events from all scrape sources.
 * Routes each source to the appropriate scraper based on its type field.
 * @param {Array} sources - Array of scrape source config objects
 * @returns {Promise<Array>} Normalized product/event items
 */
async function fetchNewProducts(sources) {
  const allItems = [];

  for (const source of sources) {
    const scraperFn = SCRAPER_MAP[source.type];
    if (!scraperFn) {
      console.warn(`  [WARN] Unknown scrape type: "${source.type}" for ${source.name}, skipping`);
      continue;
    }

    try {
      const items = await scraperFn(source);
      allItems.push(...items);
    } catch (err) {
      console.error(`  [ERROR] Scraper crashed for ${source.name}: ${err.message}`);
      // Continue with other sources
    }
  }

  return allItems;
}

module.exports = { fetchNewProducts, normalizeImageUrl: normalizeImage };
