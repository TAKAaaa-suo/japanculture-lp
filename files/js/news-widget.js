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

  // Source badge color map
  var SOURCE_COLORS = {
    'Anime News Network': '#1a73e8',
    'Crunchyroll':        '#f47521',
    'MyAnimeList':        '#2e51a2',
    'ANN':                '#1a73e8',
    'Natalie':            '#e4007f',
    'Comic Natalie':      '#e4007f',
    'Oricon':             '#00a1e9',
    'PR Times':           '#0072bc',
    'MFC':                '#5c6bc0',
    'Tokyo Otaku Mode':   '#e91e63',
    'Good Smile Company': '#ff6600',
    'Kotobukiya':         '#c62828',
    'Animate Times':      '#ff4081',
    'Official':           '#ef4444',
    'default':            '#6b7280'
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
      '.section-light .nw-retry { border-color: rgba(0,0,0,0.12); }'
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

    var linkUrl = item.url ? escapeHtml(item.url) : '#';
    var target = item.url ? ' target="_blank" rel="noopener noreferrer"' : '';

    return (
      '<article class="nw-card">' +
        '<div class="nw-card-image">' +
          imgHtml +
          badgeHtml +
        '</div>' +
        '<div class="nw-card-body">' +
          '<h3 class="nw-card-title"><a href="' + linkUrl + '"' + target + '>' + escapeHtml(item.title || 'Untitled') + '</a></h3>' +
          '<p class="nw-card-summary">' + escapeHtml(item.summary || '') + '</p>' +
          '<p class="nw-card-date">' + formatDate(item.date || item.published_date) + '</p>' +
        '</div>' +
      '</article>'
    );
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
          '<div class="nw-error-msg">Check back soon for the latest anime merchandise updates.</div>' +
        '</div>';
      return;
    }

    var html = '<div class="nw-grid">';
    for (var i = 0; i < this.visibleCount; i++) {
      html += renderCard(this.items[i]);
    }
    html += '</div>';

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
