(function () {
  'use strict';

  var STORAGE_KEY = 'nexcore_cookie_preferences';
  var COMPONENT_PATH = 'components/cookie-modal.html';
  var GA_ID = 'G-PYZB5L2R8W';
  var REQUIRED_KEYS = ['necessary', 'analytics', 'external_media', 'ai_services'];
  var defaultPreferences = {
    necessary: true,
    analytics: false,
    external_media: false,
    ai_services: false
  };

  var root = null;
  var dialog = null;
  var settingsButton = null;
  var lastFocusedElement = null;
  var focusTrapBound = false;
  var serviceLoaders = {
    analytics: [],
    external_media: [],
    ai_services: []
  };

  function clonePreferences(pref) {
    return {
      necessary: true,
      analytics: !!pref.analytics,
      external_media: !!pref.external_media,
      ai_services: !!pref.ai_services
    };
  }

  function nowUnix() {
    return Math.floor(Date.now() / 1000);
  }

  function parsePreferences(raw) {
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      var merged = Object.assign({}, defaultPreferences, parsed);
      REQUIRED_KEYS.forEach(function (key) {
        merged[key] = key === 'necessary' ? true : !!merged[key];
      });
      if (typeof merged.timestamp !== 'number') {
        merged.timestamp = nowUnix();
      }
      return merged;
    } catch (error) {
      return null;
    }
  }

  function getPreferences() {
    return parsePreferences(localStorage.getItem(STORAGE_KEY));
  }

  function storePreferences(prefs) {
    var safePrefs = clonePreferences(prefs);
    safePrefs.timestamp = nowUnix();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safePrefs));
    return safePrefs;
  }

  function clearGACookies() {
    document.cookie.split(';').forEach(function (cookie) {
      var name = cookie.split('=')[0].trim();
      if (/^_ga|^_gid|^_gat|^_gac_/.test(name)) {
        document.cookie = name + '=; Max-Age=0; path=/; domain=' + location.hostname + ';';
        document.cookie = name + '=; Max-Age=0; path=/;';
      }
    });
  }

  function loadGoogleAnalytics() {
    if (window.__nexcore_ga_loaded) return;
    window.__nexcore_ga_loaded = true;

    var script = document.createElement('script');
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    script.async = true;
    script.onload = function () {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', GA_ID, {
        anonymize_ip: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
    };
    document.head.appendChild(script);
  }

  function enableEmbeds() {
    document.querySelectorAll('[data-consent-category="external_media"]').forEach(function (node) {
      var source = node.getAttribute('data-src');
      if (!source) return;
      if (node.tagName === 'IFRAME' || node.tagName === 'VIDEO' || node.tagName === 'IMG') {
        if (!node.getAttribute('src')) {
          node.setAttribute('src', source);
        }
      }
    });
  }

  function disableEmbeds() {
    document.querySelectorAll('[data-consent-category="external_media"]').forEach(function (node) {
      var source = node.getAttribute('src');
      if (source && !node.getAttribute('data-src')) {
        node.setAttribute('data-src', source);
      }
      if (node.tagName === 'IFRAME' || node.tagName === 'VIDEO' || node.tagName === 'IMG') {
        node.removeAttribute('src');
      }
    });
  }

  function applyPreferences(prefs) {
    if (prefs.analytics) {
      loadGoogleAnalytics();
    } else {
      clearGACookies();
    }

    if (prefs.external_media) {
      enableEmbeds();
    } else {
      disableEmbeds();
    }

    document.documentElement.setAttribute('data-ai-consent', prefs.ai_services ? 'granted' : 'denied');

    serviceLoaders.analytics.forEach(function (cb) {
      cb(prefs.analytics, prefs);
    });
    serviceLoaders.external_media.forEach(function (cb) {
      cb(prefs.external_media, prefs);
    });
    serviceLoaders.ai_services.forEach(function (cb) {
      cb(prefs.ai_services, prefs);
    });

    window.dispatchEvent(new CustomEvent('nexcore:cookie-preferences', { detail: prefs }));
  }

  function getFocusableElements() {
    if (!dialog) return [];
    var selectors = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];
    return Array.prototype.slice.call(dialog.querySelectorAll(selectors.join(',')));
  }

  function onTrapFocus(event) {
    if (!root || !root.classList.contains('is-open') || event.key !== 'Tab') return;
    var focusables = getFocusableElements();
    if (!focusables.length) return;

    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeIfAllowed() {
    if (!getPreferences()) return;
    hideModal();
  }

  function onModalKeydown(event) {
    if (event.key === 'Escape') {
      closeIfAllowed();
      return;
    }
    onTrapFocus(event);
  }

  function showModal() {
    if (!root || !dialog) return;
    lastFocusedElement = document.activeElement;
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    dialog.focus();
  }

  function hideModal() {
    if (!root) return;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function syncInputs(prefs) {
    if (!dialog) return;
    REQUIRED_KEYS.forEach(function (key) {
      var input = dialog.querySelector('[data-consent="' + key + '"]');
      if (!input) return;
      input.checked = key === 'necessary' ? true : !!prefs[key];
    });
  }

  function buildPreferencesFromInputs() {
    var next = clonePreferences(defaultPreferences);
    ['analytics', 'external_media', 'ai_services'].forEach(function (key) {
      var input = dialog.querySelector('[data-consent="' + key + '"]');
      next[key] = !!(input && input.checked);
    });
    return next;
  }

  function persistAndApply(nextPrefs) {
    var saved = storePreferences(nextPrefs);
    applyPreferences(saved);
    hideModal();
  }

  function toggleAccordion(button, panel) {
    var isOpen = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    panel.hidden = isOpen;
  }

  function setupAccordions() {
    if (!dialog) return;

    var customizeToggle = dialog.querySelector('#nc-cookie-customize-toggle');
    var categories = dialog.querySelector('#nc-cookie-categories');
    if (customizeToggle && categories) {
      customizeToggle.addEventListener('click', function () {
        var expanded = customizeToggle.getAttribute('aria-expanded') === 'true';
        customizeToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        categories.hidden = expanded;
      });
    }

    dialog.querySelectorAll('.nc-cookie__category-head').forEach(function (button) {
      var panelId = button.getAttribute('aria-controls');
      var panel = panelId ? dialog.querySelector('#' + panelId) : null;
      if (!panel) return;

      var switchInput = button.querySelector('input[type="checkbox"]');

      button.addEventListener('click', function (event) {
        if (event.target === switchInput || event.target.closest('.nc-switch')) return;
        toggleAccordion(button, panel);
      });

      if (switchInput) {
        switchInput.addEventListener('click', function (event) {
          event.stopPropagation();
        });
      }
    });
  }

  function setupActions() {
    if (!dialog) return;
    var acceptAll = dialog.querySelector('#nc-cookie-accept-all');
    var rejectOptional = dialog.querySelector('#nc-cookie-reject-optional');
    var saveBtn = dialog.querySelector('#nc-cookie-save');

    if (acceptAll) {
      acceptAll.addEventListener('click', function () {
        persistAndApply({
          necessary: true,
          analytics: true,
          external_media: true,
          ai_services: true
        });
      });
    }

    if (rejectOptional) {
      rejectOptional.addEventListener('click', function () {
        persistAndApply({
          necessary: true,
          analytics: false,
          external_media: false,
          ai_services: false
        });
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        persistAndApply(buildPreferencesFromInputs());
      });
    }

    var closeSurface = root.querySelector('[data-cookie-close]');
    if (closeSurface) {
      closeSurface.addEventListener('click', closeIfAllowed);
    }

    if (!focusTrapBound) {
      root.addEventListener('keydown', onModalKeydown);
      focusTrapBound = true;
    }
  }

  function registerSettingsButton() {
    settingsButton = document.getElementById('nc-cookie-settings-btn');
    if (!settingsButton) return;
    settingsButton.addEventListener('click', function () {
      var current = getPreferences() || defaultPreferences;
      syncInputs(current);
      showModal();
    });
  }

  function injectComponent(html) {
    var host = document.createElement('div');
    host.innerHTML = html;
    while (host.firstChild) {
      document.body.appendChild(host.firstChild);
    }

    root = document.getElementById('nc-cookie-root');
    dialog = root ? root.querySelector('.nc-cookie__dialog') : null;
  }

  function loadComponent() {
    return fetch(COMPONENT_PATH, { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('Unable to load cookie component');
        return response.text();
      })
      .then(injectComponent);
  }

  function initializeManager() {
    if (!root || !dialog) return;

    setupAccordions();
    setupActions();
    registerSettingsButton();

    var existing = getPreferences();
    if (existing) {
      syncInputs(existing);
      applyPreferences(existing);
    } else {
      syncInputs(defaultPreferences);
      showModal();
    }

    window.addEventListener('storage', function (event) {
      if (event.key !== STORAGE_KEY) return;
      var updated = getPreferences();
      if (!updated) return;
      syncInputs(updated);
      applyPreferences(updated);
    });
  }

  function registerLoader(category, callback) {
    if (!serviceLoaders[category] || typeof callback !== 'function') return;
    serviceLoaders[category].push(callback);
  }

  window.NexCoreConsentManager = {
    key: STORAGE_KEY,
    getPreferences: getPreferences,
    open: function () {
      var current = getPreferences() || defaultPreferences;
      syncInputs(current);
      showModal();
    },
    applyPreferences: function (prefs) {
      persistAndApply(prefs || defaultPreferences);
    },
    registerLoader: registerLoader
  };

  // Backward compatibility for legacy references in existing pages.
  window.nexcoreConsent = {
    get: getPreferences,
    set: function (prefs) {
      persistAndApply(prefs || defaultPreferences);
    },
    accept: function () {
      persistAndApply({
        necessary: true,
        analytics: true,
        external_media: true,
        ai_services: true
      });
    },
    reject: function () {
      persistAndApply({
        necessary: true,
        analytics: false,
        external_media: false,
        ai_services: false
      });
    },
    remove: function () {
      localStorage.removeItem(STORAGE_KEY);
      clearGACookies();
      showModal();
    }
  };

  function init() {
    loadComponent()
      .then(initializeManager)
      .catch(function (error) {
        console.error('Cookie manager failed to initialize:', error);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
