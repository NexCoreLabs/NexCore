// Cookie Consent module (vanilla JS)
(function () {
  'use strict';
  const CONSENT_KEY = 'nexcore_cookie_consent_v1';
  const BANNER_ID = 'cookie-consent-banner';
  const GA_ID = 'G-PYZB5L2R8W'; // GA4 Measurement ID

  function getConsent() {
    try {
      const raw = localStorage.getItem(CONSENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setConsent(consent) {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    // Dispatch event so other modules can react
    window.dispatchEvent(new CustomEvent('nexcore:consent', { detail: consent }));
  }

  function clearGACookies() {
    // Attempt to clear common GA cookies (client-side best-effort)
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      if (/^_ga|^_gid|^_gat|^_gac_/.test(name)) {
        document.cookie = name + '=; Max-Age=0; path=/; domain=' + location.hostname + ';';
        document.cookie = name + '=; Max-Age=0; path=/;';
      }
    });
  }

  function loadGoogleAnalytics() {
    if (!getConsent() || !getConsent().analytics) return;
    if (window.__nexcore_ga_loaded) return;
    window.__nexcore_ga_loaded = true;

    // Dynamically insert GA script
    const s = document.createElement('script');
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    s.async = true;
    s.onload = () => {
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);} window.gtag = window.gtag || gtag;
      gtag('js', new Date());
      // Privacy-focused configuration
      gtag('config', GA_ID, {
        anonymize_ip: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
    };
    document.head.appendChild(s);
  }

  function showBanner() {
    const banner = document.getElementById(BANNER_ID);
    if (!banner) return;
    banner.setAttribute('aria-hidden', 'false');
    banner.classList.add('visible');
  }

  function hideBanner() {
    const banner = document.getElementById(BANNER_ID);
    if (!banner) return;
    banner.setAttribute('aria-hidden', 'true');
    banner.classList.remove('visible');
  }

  function acceptAnalytics() {
    setConsent({ analytics: true });
    hideBanner();
    loadGoogleAnalytics();
  }

  function rejectNonEssential() {
    setConsent({ analytics: false });
    hideBanner();
    clearGACookies();
  }

  function init() {
    const consent = getConsent();

    // If consent already given and analytics accepted, load GA
    if (consent && consent.analytics) {
      loadGoogleAnalytics();
      return; // no banner
    }

    // If no consent, show banner
    if (!consent) showBanner();

    // Bind buttons
    const btnAccept = document.getElementById('cc-accept');
    const btnReject = document.getElementById('cc-reject');

    if (btnAccept) btnAccept.addEventListener('click', acceptAnalytics);
    if (btnReject) btnReject.addEventListener('click', rejectNonEssential);

    // Allow external revocation via window.nexcoreConsent object
    window.nexcoreConsent = {
      get: getConsent,
      set: setConsent,
      accept: acceptAnalytics,
      reject: rejectNonEssential,
      remove: () => { localStorage.removeItem(CONSENT_KEY); clearGACookies(); window.location.reload(); }
    };

    // React to consent changes (if user changes on another tab)
    window.addEventListener('storage', (e) => {
      if (e.key === CONSENT_KEY) {
        const c = getConsent();
        if (c && c.analytics) loadGoogleAnalytics();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();