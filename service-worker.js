const CACHE_NAME = 'nexcore-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './hub.html',
  './thanks.html',
  './mobile-preview.html',
  './googleb60d962a5a64f048.html',

  './assets/css/style.css',

  './assets/js/script.js',

  './assets/images/leaderpic.webp',
  './assets/images/audacity.webp',
  './assets/images/cloudflare.webp',
  './assets/images/davinciresolve.webp',
  './assets/images/flaticon.webp',
  './assets/images/fontawesome.webp',
  './assets/images/github.webp',
  './assets/images/googleanalytics.webp',
  './assets/images/googlefont.webp',
  './assets/images/googlesearchconsole.webp',
  './assets/images/inkscape.webp',
  './assets/images/iphone.webp',
  './assets/images/large-screen.webp',
  './assets/images/nexcore-word.webp',
  './assets/images/nexcore-icon.png',
  './assets/images/nexcore-logo.webp',
  './assets/images/openai.webp',
  './assets/images/opengraph.webp',
  './assets/images/pagespeed.webp',
  './assets/images/shots.webp',
  './assets/images/squ-logo.webp',
  './assets/images/squ-word.webp',
  './assets/images/supabase.webp',
  './assets/images/trello.webp',
  './assets/images/uiverse.webp',
  './assets/images/uptimerobot.webp',
  './assets/images/vscode.webp',
  './assets/images/web3forms.webp',
  './assets/images/webutility.webp',
  './assets/images/xai.webp',
  './assets/images/xmlsitemaps.webp',

  './manifest.json',

  './sitemap.xml',

  './robots.txt',

  './README.md',

  './LICENSE'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME && caches.delete(key)))
    )
  );
});

// Fetch
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response =>
      response || fetch(event.request)
    )
  );
});