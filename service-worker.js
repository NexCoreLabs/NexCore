/* Improved Service Worker — robust caching, offline fallback, and runtime strategies */
const CACHE_VERSION = 'v2.7.0';
const CACHE_PREFIX = 'nexcore-cache-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const IMAGE_CACHE_PREFIX = 'nexcore-images-';
const IMAGE_CACHE = `${IMAGE_CACHE_PREFIX}${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/hub.html',
  '/project.html',
  '/ai-chat.html',
  '/roadmap.html',
  '/releases.html',
  '/thanks.html',
  '/googleb60d962a5a64f048.html',
  '/account.html',
  '/auth.html',
  '/dashboard.html',
  '/faq.html',
  '/how-to-use.html',
  '/privacy-policy.html',
  '/terms.html',
  '/offline.html',

  '/assets/css/style.css',
  '/assets/css/ai-chat.css',
  '/assets/css/unminified-css.css',
  '/assets/css/cookies.css',
  '/assets/css/project-categories.css',
  '/assets/js/script.js',
  '/assets/js/ai-chat.js',
  '/assets/js/auth-ui.js',
  '/assets/js/unminified-js.js',
  '/assets/js/cookie-consent.js',
  '/assets/js/cookies.js',
  '/assets/js/project-categories.js',
  '/assets/js/supabase-client.js',
  '/assets/data/releases.json',
  '/version.js',

  '/assets/images/nexcore-logo.webp',
  '/assets/images/nexcore-icon.png',
  '/assets/images/ceopic.webp',
  '/assets/images/oman.webp',

  '/manifest.json',
  '/sitemap.xml',
  '/robots.txt'
];

// Maximum entries for runtime caches
const MAX_IMAGE_ENTRIES = 60;

// Utility: trim cache to size
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Try to addAll, but fall back to individually adding to avoid failing install on single 404
    try {
      await cache.addAll(PRECACHE_URLS);
    } catch (err) {
      console.warn('Precaching failed, attempting individual cache adds', err);
      for (const url of PRECACHE_URLS) {
        try { await cache.add(url); } catch (e) { /* ignore individual failures */ }
      }
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Enable navigation preload if supported
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) { /* ignore */ }
    }

    // Cleanup old caches for both app and image caches.
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => {
          const isAppCache = k.startsWith(CACHE_PREFIX);
          const isImageCache = k.startsWith(IMAGE_CACHE_PREFIX);
          if (!isAppCache && !isImageCache) return false;
          return k !== CACHE_NAME && k !== IMAGE_CACHE;
        })
        .map((k) => caches.delete(k))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests
  if (request.method !== 'GET') return;

  // Navigation requests (HTML): network-first with fallback to cache => good for SPAs and content updates
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith((async () => {
      try {
        const preloadResp = await event.preloadResponse;
        if (preloadResp) {
          if (url.origin === self.location.origin && preloadResp.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, preloadResp.clone());
          }
          return preloadResp;
        }

        const networkResp = await fetch(request);
        if (url.origin === self.location.origin && networkResp.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResp.clone());
        }
        return networkResp;
      } catch (err) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request)
          || await cache.match(url.pathname)
          || await cache.match('/index.html')
          || await cache.match('/offline.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  // Images: cache-first, with runtime limit
  if (request.destination === 'image') {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const resp = await fetch(request);
        if (resp && resp.ok) {
          cache.put(request, resp.clone());
          trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
        }
        return resp;
      } catch (err) {
        // Return a tiny transparent placeholder image (1x1) to prevent broken UI
        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>',
          { headers: { 'Content-Type': 'image/svg+xml' } }
        );
      }
    })());
    return;
  }

  // For CSS/JS: stale-while-revalidate
  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'worker') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const networkPromise = fetch(request).then((resp) => {
        if (resp && resp.ok) cache.put(request, resp.clone());
        return resp;
      }).catch(() => null);
      return cached || (await networkPromise) || caches.match('/offline.html');
    })());
    return;
  }

  // Default: try cache, then network
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const resp = await fetch(request);
      if (resp && resp.ok && (request.url.startsWith(self.location.origin))) {
        cache.put(request, resp.clone());
      }
      return resp;
    } catch (err) {
      return caches.match('/offline.html');
    }
  })());
});

// Allow the page to notify the SW to skip waiting on update
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
