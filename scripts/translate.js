/**
 * Translation module using DeepL API Free.
 * Translates Japanese text fields (title, summary) to English.
 */

const axios = require('axios');

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate';
const BATCH_DELAY_MS = 1000;

/**
 * Delay execution for a given number of milliseconds.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Translate an array of text strings from Japanese to English using DeepL.
 * @param {string[]} texts - Array of strings to translate
 * @param {string} apiKey - DeepL API key
 * @returns {Promise<string[]>} Array of translated strings (same order)
 */
async function translateBatch(texts, apiKey) {
  if (!texts.length) return [];

  try {
    const response = await axios.post(
      DEEPL_API_URL,
      new URLSearchParams({
        auth_key: apiKey,
        source_lang: 'JA',
        target_lang: 'EN',
        ...texts.reduce((acc, text, i) => {
          acc[`text`] = text; // DeepL accepts multiple text params
          return acc;
        }, {}),
      }),
      {
        // DeepL accepts multiple 'text' parameters, so we use a different approach
        params: {},
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      }
    );

    if (response.data && response.data.translations) {
      return response.data.translations.map((t) => t.text);
    }

    return texts; // Return originals on unexpected response
  } catch (err) {
    console.error(`  [ERROR] DeepL translation failed: ${err.message}`);
    return texts; // Return originals on error
  }
}

/**
 * Translate an array of texts using DeepL, sending proper multi-text requests.
 * @param {string[]} texts - Array of strings to translate
 * @param {string} apiKey - DeepL API key
 * @returns {Promise<string[]>} Translated strings
 */
async function translateTextsWithDeepL(texts, apiKey) {
  if (!texts.length) return [];

  // Build form data with multiple 'text' entries
  const params = new URLSearchParams();
  params.append('auth_key', apiKey);
  params.append('source_lang', 'JA');
  params.append('target_lang', 'EN');
  for (const text of texts) {
    params.append('text', text);
  }

  try {
    const response = await axios.post(DEEPL_API_URL, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000,
    });

    if (response.data && response.data.translations) {
      return response.data.translations.map((t) => t.text);
    }
    return texts;
  } catch (err) {
    console.error(`  [ERROR] DeepL translation failed: ${err.message}`);
    return texts;
  }
}

/**
 * Translate Japanese items' title and summary fields to English.
 * Items with language !== 'ja' are returned unchanged.
 * If no DEEPL_API_KEY is set, returns items as-is with a warning.
 *
 * @param {Array} items - Array of news items
 * @returns {Promise<Array>} Items with translated fields where applicable
 */
async function translateTexts(items) {
  const apiKey = process.env.DEEPL_API_KEY;

  if (!apiKey) {
    console.warn('  [WARN] DEEPL_API_KEY not set. Japanese items will not be translated.');
    return items;
  }

  // Separate Japanese items that need translation
  const jaItems = items.filter((item) => item.language === 'ja' && !item.translated);
  const otherItems = items.filter((item) => item.language !== 'ja' || item.translated);

  if (jaItems.length === 0) {
    console.log('  No Japanese items to translate.');
    return items;
  }

  console.log(`  Translating ${jaItems.length} Japanese items...`);

  // Process in batches of 10 (DeepL recommends reasonable batch sizes)
  const BATCH_SIZE = 10;
  const translatedItems = [];

  for (let i = 0; i < jaItems.length; i += BATCH_SIZE) {
    const batch = jaItems.slice(i, i + BATCH_SIZE);

    // Prepare texts: title and summary interleaved
    const textsToTranslate = [];
    for (const item of batch) {
      textsToTranslate.push(item.title);
      textsToTranslate.push(item.summary);
    }

    const translated = await translateTextsWithDeepL(textsToTranslate, apiKey);

    // Map translations back to items
    for (let j = 0; j < batch.length; j++) {
      const item = { ...batch[j] };
      const titleIdx = j * 2;
      const summaryIdx = j * 2 + 1;

      item.originalTitle = item.title;
      item.title = translated[titleIdx] || item.title;
      item.summary = translated[summaryIdx] || item.summary;
      item.translated = true;

      translatedItems.push(item);
    }

    // Rate limiting between batches
    if (i + BATCH_SIZE < jaItems.length) {
      console.log(`    Translated batch ${Math.floor(i / BATCH_SIZE) + 1}, waiting...`);
      await delay(BATCH_DELAY_MS);
    }
  }

  console.log(`  Translation complete: ${translatedItems.length} items translated.`);

  return [...otherItems, ...translatedItems];
}

module.exports = { translateTexts };
