// ========================================
// Anime News Widget - Self-contained
// Fetches /data/news.json and renders cards
// Supports "compact" (3 items) and "full" (6 + load more) modes
// ========================================

(function () {
  'use strict';

  // ------------------------------------
  // Configuration
  // ------------------------------------
  var CONF = {
    dataUrl: '/data/news.json',
    compactCount: 3,
    fullInitialCount: 6,
    fullLoadMoreCount: 6
  };

  // Preferred order for store groups in full mode
  var STORE_GROUP_ORDER = [
    'Animate Ikebukuro',
    'Animate Akihabara',
    'Animate Cafe',
    'Animate',
    'Kotobukiya Akihabara',
    'Pokemon Center',
    'Jump Shop',
    'Mandarake',
    'Akihabara Area',
    'Ikebukuro Area',
    'Shibuya Area',
    'Nakano Area',
    'Various',
    'Tokyo Events'
  ];

  // Source badge color map - store-exclusive event sources
  var SOURCE_COLORS = {
    'Collab Cafes & Events': '#e91e63',
    'Animate OnlyShop':      '#ff4081',
    'Animate Gratte':        '#ff6090',
    'Animate Cafe':          '#f50057',
    'nijimen':               '#7c4dff',
    'default':               '#6b7280'
  };

  // ------------------------------------
  // Inject CSS (once)
  // ------------------------------------
  function injectStyles() {
    if (document.getElementById('news-widget-styles')) return;

    var css = [
      /* Container */
      '.nw-container { font-family: "Inter", "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif; }',

      /* Grid */
      '.nw-grid {',
      '  display: grid;',
      '  grid-template-columns: 1fr;',
      '  gap: 1.5rem;',
      '}',
      '@media (min-width: 640px) {',
      '  .nw-grid { grid-template-columns: repeat(2, 1fr); }',
      '}',
      '@media (min-width: 1024px) {',
      '  .nw-grid { grid-template-columns: repeat(3, 1fr); }',
      '}',

      /* Card */
      '.nw-card {',
      '  background: rgba(255,255,255,0.05);',
      '  border: 1px solid rgba(255,255,255,0.1);',
      '  border-radius: 12px;',
      '  overflow: hidden;',
      '  transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), border-color 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s cubic-bezier(0.4,0,0.2,1);',
      '  display: flex;',
      '  flex-direction: column;',
      '}',
      '.nw-card:hover {',
      '  transform: translateY(-4px);',
      '  border-color: rgba(239,68,68,0.5);',
      '  box-shadow: 0 8px 24px rgba(0,0,0,0.3);',
      '}',

      /* Light section overrides */
      '.section-light .nw-card {',
      '  background: rgba(0,0,0,0.03);',
      '  border-color: rgba(0,0,0,0.08);',
      '}',
      '.section-light .nw-card:hover {',
      '  border-color: rgba(239,68,68,0.4);',
      '  box-shadow: 0 8px 24px rgba(0,0,0,0.1);',
      '}',
      '.section-light .nw-card-title a { color: #0a0a0a; }',
      '.section-light .nw-card-title a:hover { color: #ef4444; }',
      '.section-light .nw-card-summary { color: #6b7280; }',
      '.section-light .nw-card-date { color: #9ca3af; }',
      '.section-light .nw-updated { color: #9ca3af; }',
      '.section-light .nw-load-more { color: #0a0a0a; border-color: rgba(0,0,0,0.15); }',
      '.section-light .nw-load-more:hover { background: #ef4444; color: #fff; border-color: #ef4444; }',

      /* Card image */
      '.nw-card-image {',
      '  position: relative;',
      '  width: 100%;',
      '  padding-top: 56.25%;', /* 16:9 */
      '  overflow: hidden;',
      '  background: rgba(255,255,255,0.03);',
      '}',
      '.nw-card-image img {',
      '  position: absolute;',
      '  top: 0; left: 0;',
      '  width: 100%; height: 100%;',
      '  object-fit: cover;',
      '  transition: transform 0.4s ease;',
      '}',
      '.nw-card:hover .nw-card-image img {',
      '  transform: scale(1.05);',
      '}',
      '.nw-card-image .nw-placeholder {',
      '  position: absolute;',
      '  top: 0; left: 0;',
      '  width: 100%; height: 100%;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 100%);',
      '}',
      '.nw-placeholder svg { opacity: 0.25; }',

      /* Source badge */
      '.nw-badge {',
      '  position: absolute;',
      '  bottom: 0.5rem;',
      '  left: 0.5rem;',
      '  padding: 0.2rem 0.6rem;',
      '  border-radius: 50px;',
      '  font-size: 0.6875rem;',
      '  font-weight: 700;',
      '  color: #fff;',
      '  letter-spacing: 0.02em;',
      '  text-transform: uppercase;',
      '  backdrop-filter: blur(4px);',
      '  -webkit-backdrop-filter: blur(4px);',
      '}',

      /* Store tag badge */
      '.nw-store-tag {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 0.25rem;',
      '  padding: 0.15rem 0.5rem;',
      '  border-radius: 50px;',
      '  font-size: 0.625rem;',
      '  font-weight: 600;',
      '  color: #9ca3af;',
      '  border: 1px solid rgba(255,255,255,0.15);',
      '  background: rgba(255,255,255,0.05);',
      '  margin-bottom: 0.5rem;',
      '  white-space: nowrap;',
      '}',
      '.section-light .nw-store-tag {',
      '  color: #6b7280;',
      '  border-color: rgba(0,0,0,0.12);',
      '  background: rgba(0,0,0,0.03);',
      '}',

      /* Event period badge */
      '.nw-event-period {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 0.25rem;',
      '  padding: 0.15rem 0.5rem;',
      '  border-radius: 50px;',
      '  font-size: 0.625rem;',
      '  font-weight: 600;',
      '  color: #f59e0b;',
      '  border: 1px solid rgba(245,158,11,0.3);',
      '  background: rgba(245,158,11,0.1);',
      '  margin-left: 0.5rem;',
      '  white-space: nowrap;',
      '}',
      '.section-light .nw-event-period {',
      '  color: #d97706;',
      '  border-color: rgba(217,119,6,0.25);',
      '  background: rgba(245,158,11,0.08);',
      '}',

      /* Price badge */
      '.nw-price {',
      '  display: inline-block;',
      '  padding: 0.1rem 0.4rem;',
      '  border-radius: 4px;',
      '  font-size: 0.75rem;',
      '  font-weight: 700;',
      '  color: #ef4444;',
      '  background: rgba(239,68,68,0.1);',
      '  margin-left: 0.5rem;',
      '}',
      '.section-light .nw-price {',
      '  color: #dc2626;',
      '  background: rgba(239,68,68,0.08);',
      '}',

      /* Card body */
      '.nw-card-body {',
      '  padding: 1rem 1.25rem 1.25rem;',
      '  display: flex;',
      '  flex-direction: column;',
      '  flex: 1;',
      '}',

      /* Title */
      '.nw-card-title {',
      '  font-family: "Plus Jakarta Sans", "Inter", -apple-system, sans-serif;',
      '  font-size: 1rem;',
      '  font-weight: 700;',
      '  line-height: 1.35;',
      '  margin: 0 0 0.5rem;',
      '}',
      '.nw-card-title a {',
      '  color: #fff;',
      '  text-decoration: none;',
      '  transition: color 0.2s ease;',
      '}',
      '.nw-card-title a:hover {',
      '  color: #ef4444;',
      '}',

      /* Summary */
      '.nw-card-summary {',
      '  font-size: 0.875rem;',
      '  line-height: 1.55;',
      '  color: #9ca3af;',
      '  margin: 0 0 auto;',
      '  display: -webkit-box;',
      '  -webkit-line-clamp: 3;',
      '  -webkit-box-orient: vertical;',
      '  overflow: hidden;',
      '  padding-bottom: 0.75rem;',
      '}',

      /* Date */
      '.nw-card-date {',
      '  font-size: 0.75rem;',
      '  color: #6b7280;',
      '  margin: 0;',
      '}',

      /* Load more */
      '.nw-load-more-wrap {',
      '  text-align: center;',
      '  margin-top: 2rem;',
      '}',
      '.nw-load-more {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 0.5rem;',
      '  padding: 0.75rem 2rem;',
      '  border: 2px solid rgba(255,255,255,0.15);',
      '  border-radius: 0.5rem;',
      '  background: transparent;',
      '  color: #fff;',
      '  font-size: 0.9375rem;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  transition: all 0.3s cubic-bezier(0.4,0,0.2,1);',
      '}',
      '.nw-load-more:hover {',
      '  background: #ef4444;',
      '  border-color: #ef4444;',
      '  transform: translateY(-2px);',
      '  box-shadow: 0 6px 16px rgba(239,68,68,0.3);',
      '}',

      /* Updated text */
      '.nw-updated {',
      '  text-align: center;',
      '  font-size: 0.8125rem;',
      '  color: #6b7280;',
      '  margin-top: 1.5rem;',
      '}',

      /* Loading spinner */
      '.nw-loading {',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  justify-content: center;',
      '  padding: 3rem 1rem;',
      '  gap: 1rem;',
      '}',
      '.nw-spinner {',
      '  width: 36px; height: 36px;',
      '  border: 3px solid rgba(255,255,255,0.1);',
      '  border-top-color: #ef4444;',
      '  border-radius: 50%;',
      '  animation: nw-spin 0.8s linear infinite;',
      '}',
      '.section-light .nw-spinner {',
      '  border-color: rgba(0,0,0,0.08);',
      '  border-top-color: #ef4444;',
      '}',
      '@keyframes nw-spin { to { transform: rotate(360deg); } }',
      '.nw-loading-text {',
      '  font-size: 0.875rem;',
      '  color: #9ca3af;',
      '}',

      /* Error state */
      '.nw-error {',
      '  text-align: center;',
      '  padding: 3rem 1rem;',
      '}',
      '.nw-error-icon {',
      '  font-size: 2.5rem;',
      '  margin-bottom: 0.75rem;',
      '  opacity: 0.5;',
      '}',
      '.nw-error-title {',
      '  font-size: 1.125rem;',
      '  font-weight: 700;',
      '  color: #fff;',
      '  margin-bottom: 0.5rem;',
      '}',
      '.section-light .nw-error-title { color: #0a0a0a; }',
      '.nw-error-msg {',
      '  font-size: 0.875rem;',
      '  color: #9ca3af;',
      '  margin-bottom: 1rem;',
      '}',
      '.nw-retry {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 0.4rem;',
      '  padding: 0.5rem 1.25rem;',
      '  border: 1px solid rgba(255,255,255,0.15);',
      '  border-radius: 0.5rem;',
      '  background: transparent;',
      '  color: #ef4444;',
      '  font-size: 0.875rem;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  transition: all 0.2s ease;',
      '}',
      '.nw-retry:hover { background: rgba(239,68,68,0.1); }',
      '.section-light .nw-retry { border-color: rgba(0,0,0,0.12); }',

      /* Store section grouping (full mode) */
      '.nw-store-section { margin-bottom: 2rem; }',
      '.nw-store-heading {',
      '  font-size: 1.25rem;',
      '  font-weight: 700;',
      '  color: #fff;',
      '  margin: 2rem 0 1rem;',
      '  padding-bottom: 0.5rem;',
      '  border-bottom: 2px solid rgba(255,255,255,0.15);',
      '}',
      '.nw-store-section:first-child .nw-store-heading { margin-top: 0; }',
      '.section-light .nw-store-heading {',
      '  color: #111;',
      '  border-bottom-color: rgba(0,0,0,0.1);',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'news-widget-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ------------------------------------
  // Placeholder SVG (newspaper icon)
  // ------------------------------------
  var PLACEHOLDER_SVG =
    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/>' +
      '<path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>' +
    '</svg>';

  // ------------------------------------
  // Helpers
  // ------------------------------------
  function getSourceColor(source) {
    if (!source) return SOURCE_COLORS['default'];
    for (var key in SOURCE_COLORS) {
      if (source.toLowerCase().indexOf(key.toLowerCase()) !== -1) {
        return SOURCE_COLORS[key];
      }
    }
    return SOURCE_COLORS['default'];
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatEventPeriod(startStr, endStr) {
    if (!startStr) return '';
    try {
      var s = new Date(startStr);
      if (isNaN(s.getTime())) return '';
      var opts = { month: 'short', day: 'numeric' };
      var text = s.toLocaleDateString('en-US', opts);
      if (endStr) {
        var e = new Date(endStr);
        if (!isNaN(e.getTime())) {
          text += ' \u2013 ' + e.toLocaleDateString('en-US', opts);
        }
      }
      return text;
    } catch (ex) {
      return '';
    }
  }

  // ------------------------------------
  // Render helpers
  // ------------------------------------
  function renderLoading() {
    return (
      '<div class="nw-loading">' +
        '<div class="nw-spinner"></div>' +
        '<div class="nw-loading-text">Loading latest news...</div>' +
      '</div>'
    );
  }

  function renderError(message) {
    return (
      '<div class="nw-error">' +
        '<div class="nw-error-icon">&#128240;</div>' +
        '<div class="nw-error-title">Unable to load news</div>' +
        '<div class="nw-error-msg">' + escapeHtml(message || 'Please try again later.') + '</div>' +
        '<button class="nw-retry" onclick="window.__newsWidget.retry(this)">&#8635; Retry</button>' +
      '</div>'
    );
  }

  function renderCard(item) {
    var imgHtml;
    if (item.image) {
      imgHtml =
        '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.title || '') + '" loading="lazy" ' +
        'onerror="this.parentNode.innerHTML=\'' + PLACEHOLDER_SVG.replace(/'/g, "\\'") + '\';this.parentNode.classList.add(\'nw-placeholder\')">';
    } else {
      imgHtml = '<div class="nw-placeholder">' + PLACEHOLDER_SVG + '</div>';
    }

    var badgeColor = getSourceColor(item.source);
    var badgeHtml = item.source
      ? '<span class="nw-badge" style="background:' + badgeColor + ';">' + escapeHtml(item.source) + '</span>'
      : '';

    // Use link field (new format) with url fallback (old format)
    var linkUrl = item.link || item.url || '#';
    var target = linkUrl !== '#' ? ' target="_blank" rel="noopener noreferrer"' : '';

    // Store tag badge
    var storeTagHtml = '';
    if (item.storeTag) {
      storeTagHtml = '<span class="nw-store-tag">\ud83d\udccd ' + escapeHtml(item.storeTag) + '</span>';
    }

    // Event period badge
    var eventPeriodHtml = '';
    var periodText = formatEventPeriod(item.eventStart, item.eventEnd);
    if (periodText) {
      eventPeriodHtml = '<span class="nw-event-period">\ud83d\udcc5 ' + escapeHtml(periodText) + '</span>';
    }

    // Date: support publishedAt (new), date, published_date (legacy)
    var dateStr = item.publishedAt || item.date || item.published_date || '';

    return (
      '<article class="nw-card">' +
        '<div class="nw-card-image">' +
          imgHtml +
          badgeHtml +
        '</div>' +
        '<div class="nw-card-body">' +
          storeTagHtml +
          '<h3 class="nw-card-title"><a href="' + escapeHtml(linkUrl) + '"' + target + '>' + escapeHtml(item.title || 'Untitled') + '</a>' + eventPeriodHtml + '</h3>' +
          '<p class="nw-card-summary">' + escapeHtml(item.summary || '') + '</p>' +
          '<p class="nw-card-date">' + formatDate(dateStr) + '</p>' +
        '</div>' +
      '</article>'
    );
  }

  // ------------------------------------
  // Group items by store tag
  // ------------------------------------
  function groupByStore(items) {
    var groups = {};
    for (var i = 0; i < items.length; i++) {
      var tag = items[i].storeTag || 'Tokyo Events';
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(items[i]);
    }

    // Sort groups by STORE_GROUP_ORDER
    var orderedKeys = [];
    for (var j = 0; j < STORE_GROUP_ORDER.length; j++) {
      if (groups[STORE_GROUP_ORDER[j]]) {
        orderedKeys.push(STORE_GROUP_ORDER[j]);
      }
    }
    // Add any remaining groups not in the predefined order
    for (var key in groups) {
      if (orderedKeys.indexOf(key) === -1) {
        orderedKeys.push(key);
      }
    }

    // Sort items within each group by date (newest first)
    for (var k = 0; k < orderedKeys.length; k++) {
      groups[orderedKeys[k]].sort(function (a, b) {
        var da = new Date(a.publishedAt || 0).getTime();
        var db = new Date(b.publishedAt || 0).getTime();
        return db - da;
      });
    }

    return { keys: orderedKeys, groups: groups };
  }

  // ------------------------------------
  // Widget class
  // ------------------------------------
  function NewsWidget(container) {
    this.container = container;
    this.mode = container.getAttribute('data-news-mode') || 'full';
    this.items = [];
    this.visibleCount = 0;
    this.lastUpdated = null;

    this.initialCount = this.mode === 'compact' ? CONF.compactCount : CONF.fullInitialCount;
    this.loadMoreCount = CONF.fullLoadMoreCount;
  }

  NewsWidget.prototype.init = function () {
    this.container.classList.add('nw-container');
    this.container.innerHTML = renderLoading();
    this.fetchData();
  };

  NewsWidget.prototype.fetchData = function () {
    var self = this;
    fetch(CONF.dataUrl)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        // Support {items:[...]}, {articles:[...]}, {news:[...]}, or plain array
        if (Array.isArray(data)) {
          self.items = data;
        } else if (data && Array.isArray(data.items)) {
          self.items = data.items;
          self.lastUpdated = data.last_updated || data.lastUpdated || null;
        } else if (data && Array.isArray(data.articles)) {
          self.items = data.articles;
          self.lastUpdated = data.last_updated || data.lastUpdated || null;
        } else if (data && Array.isArray(data.news)) {
          self.items = data.news;
          self.lastUpdated = data.last_updated || data.lastUpdated || null;
        } else {
          self.items = [];
        }
        self.visibleCount = Math.min(self.initialCount, self.items.length);
        self.render();
      })
      .catch(function (err) {
        self.container.innerHTML = renderError(err.message);
      });
  };

  NewsWidget.prototype.render = function () {
    if (!this.items.length) {
      this.container.innerHTML =
        '<div class="nw-error">' +
          '<div class="nw-error-icon">&#128240;</div>' +
          '<div class="nw-error-title">No news yet</div>' +
          '<div class="nw-error-msg">Check back soon for the latest store-exclusive events and collaboration cafes.</div>' +
        '</div>';
      return;
    }

    var html = '';
    var visibleItems = this.items.slice(0, this.visibleCount);

    if (this.mode === 'full') {
      // Full mode: group events by storeTag with section headings
      var result = groupByStore(visibleItems);
      for (var g = 0; g < result.keys.length; g++) {
        var storeKey = result.keys[g];
        var storeItems = result.groups[storeKey];
        html += '<div class="nw-store-section">';
        html += '<h3 class="nw-store-heading">\ud83d\udccd ' + escapeHtml(storeKey) + '</h3>';
        html += '<div class="nw-grid">';
        for (var s = 0; s < storeItems.length; s++) {
          html += renderCard(storeItems[s]);
        }
        html += '</div>';
        html += '</div>';
      }
    } else {
      // Compact mode: flat grid (no grouping, just show the most recent items)
      html += '<div class="nw-grid">';
      for (var i = 0; i < visibleItems.length; i++) {
        html += renderCard(visibleItems[i]);
      }
      html += '</div>';
    }

    // Load More button (only in full mode and if more items exist)
    if (this.mode === 'full' && this.visibleCount < this.items.length) {
      var remaining = this.items.length - this.visibleCount;
      html +=
        '<div class="nw-load-more-wrap">' +
          '<button class="nw-load-more" onclick="window.__newsWidget.loadMore(this)">' +
            'Load More (' + remaining + ' remaining)' +
          '</button>' +
        '</div>';
    }

    // Last updated
    if (this.lastUpdated) {
      html += '<p class="nw-updated">Last updated: ' + formatDate(this.lastUpdated) + '</p>';
    }

    this.container.innerHTML = html;
  };

  NewsWidget.prototype.loadMore = function () {
    this.visibleCount = Math.min(
      this.visibleCount + this.loadMoreCount,
      this.items.length
    );
    this.render();
  };

  // ------------------------------------
  // Global accessor for onclick handlers
  // ------------------------------------
  window.__newsWidget = {
    instances: [],

    loadMore: function (btn) {
      // Find the widget instance that contains this button
      var container = btn.closest('.nw-container');
      for (var i = 0; i < this.instances.length; i++) {
        if (this.instances[i].container === container) {
          this.instances[i].loadMore();
          return;
        }
      }
    },

    retry: function (btn) {
      var container = btn.closest('.nw-container');
      for (var i = 0; i < this.instances.length; i++) {
        if (this.instances[i].container === container) {
          this.instances[i].container.innerHTML = renderLoading();
          this.instances[i].fetchData();
          return;
        }
      }
    }
  };

  // ------------------------------------
  // Auto-initialize on DOMContentLoaded
  // ------------------------------------
  function initAll() {
    injectStyles();

    var targets = document.querySelectorAll('[data-news-mode]');
    for (var i = 0; i < targets.length; i++) {
      var widget = new NewsWidget(targets[i]);
      window.__newsWidget.instances.push(widget);
      widget.init();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
