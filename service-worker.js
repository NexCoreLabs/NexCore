const CACHE_NAME = 'nexcore-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './hub.html',
  './thanks.html',
  './mobile-preview.html',
  './googleb60d962a5a64f048.html',

  './assets/css/style.css',
  './assets/css/style-index.css',
  './assets/css/style-hub.css',
  './assets/css/style-thanks.css',

  './assets/js/script.js',
  './assets/js/script-index.js',
  './assets/js/script-hub.js',
  './assets/js/script-thanks.js',

  './assets/images/alfarismujahid-profile.jpeg',
  './assets/images/audacity.png',
  './assets/images/cloudflare.png',
  './assets/images/flaticon.png',
  './assets/images/fontawesome.png',
  './assets/images/github.png',
  './assets/images/googleanalytics.png',
  './assets/images/googlefont.png',
  './assets/images/googlesearchconsole.png',
  './assets/images/inkscape.png',
  './assets/images/ipad.png',
  './assets/images/iphone.png',
  './assets/images/lap.png',
  './assets/images/large-screen.png',
  './assets/images/nexcore-word.png',
  './assets/images/nexcore-icon.png',
  './assets/images/nexcore-logo.png',
  './assets/images/openai.png',
  './assets/images/opengraph.png',
  './assets/images/pagespeed.png',
  './assets/images/pc.png',
  './assets/images/shots.png',
  './assets/images/squ-logo.png',
  './assets/images/squ-word.png',
  './assets/images/supabase.png',
  './assets/images/trello.png',
  './assets/images/uiverse.png',
  './assets/images/uptimerobot.png',
  './assets/images/vscode.png',
  './assets/images/web3forms.png',
  './assets/images/webutility.png',
  './assets/images/xai.png',
  './assets/images/xmlsitemaps.png',

  './manifest.json',

  './sitemap.xml'
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
