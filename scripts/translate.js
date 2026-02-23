/**
 * Translation module using Google Translate (unofficial endpoint).
 * Translates Japanese text fields (title, summary) to English.
 * No API key required.
 */

const axios = require('axios');

const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';

/**
 * Translate a single text from Japanese to English using Google Translate.
 * This uses the same endpoint as the Google Translate website.
 * @param {string} text - Japanese text
 * @returns {Promise<string>} English translation
 */
async function translateText(text) {
  if (!text || text.trim().length === 0) return text;

  try {
    const res = await axios.get(GOOGLE_TRANSLATE_URL, {
      params: {
        client: 'gtx',
        sl: 'ja',
        tl: 'en',
        dt: 't',
        q: text,
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    // Response format: [[["translated text","original text",null,null,10]],null,"ja",...]
    if (res.data && Array.isArray(res.data[0])) {
      return res.data[0].map(segment => segment[0]).join('');
    }
    return text;
  } catch (err) {
    console.error(`  Translation failed: ${err.message}`);
    return text;
  }
}

/**
 * Translate an array of news items (title + summary) from Japanese to English.
 * Only translates items where language === 'ja'.
 * Rate-limited to avoid blocking.
 * @param {Array} items - Array of news items
 * @returns {Promise<Array>} Items with translated title/summary
 */
async function translateTexts(items) {
  const results = [];
  let translated = 0;

  for (const item of items) {
    if (item.language !== 'ja') {
      results.push(item);
      continue;
    }

    try {
      const translatedTitle = await translateText(item.title);
      // Small delay between requests
      await new Promise(r => setTimeout(r, 300));

      // Only translate first 100 chars of summary to keep it brief
      const shortSummary = (item.summary || '').slice(0, 100);
      const translatedSummary = shortSummary ? await translateText(shortSummary) : '';
      await new Promise(r => setTimeout(r, 300));

      results.push({
        ...item,
        title: translatedTitle,
        summary: translatedSummary,
        originalTitle: item.title,
        language: 'en',
        translated: true,
      });
      translated++;
    } catch (err) {
      // On error, keep original
      results.push(item);
    }
  }

  console.log(`  Translated ${translated} items`);
  return results;
}

module.exports = { translateTexts };
