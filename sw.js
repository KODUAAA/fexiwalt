// FEXIWALT service worker: makes the site installable, faster on slow data, and friendly when offline.
//
// What it does:
//   pages, scripts, styles   network first  -> you always get the newest version when online;
//                                              the saved copy is only used if the network fails
//   images, fonts            cache first, refreshed in the background (they rarely change)
//   anything else            left alone: Firebase, Firestore, login, Cloudinary photos and other websites
//                            are never touched or stored here, so private data is never cached
//   no network + no saved copy of a page -> a small "You're offline" page (offline.html)
//
// When you change files a lot, bump VERSION so people's phones drop the old saved copies.
const VERSION = "v2";
const STATIC = `fexiwalt-static-${VERSION}`;   // css, js, images, icons
const PAGES = `fexiwalt-pages-${VERSION}`;     // html pages

// saved at install time so the site opens quickly and the offline page always exists
const PRECACHE = [
  "/offline.html", "/manifest.webmanifest", "/images/logo.jpg",
  "/images/icons/icon-192.png", "/images/icons/icon-512.png",
  "/css/home.css", "/css/dark.css", "/css/photos.css"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC);
    // one missing file must not stop the install, so add them one by one
    await Promise.allSettled(PRECACHE.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC, PAGES]);
    for (const name of await caches.keys()) if (name.startsWith("fexiwalt-") && !keep.has(name)) await caches.delete(name);
    await self.clients.claim();
  })());
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const saved = await cache.match(request);
    if (saved) return saved;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const saved = await cache.match(request);
  const refresh = fetch(request).then(res => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => null);
  return saved || (await refresh) || Response.error();
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;                       // only ever handle plain page/file requests
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // other websites (Firebase, Cloudinary, fonts, CDNs): hands off
  if (url.pathname === "/sw.js") return;                  // never cache the service worker itself
  if (url.pathname.startsWith("/__/")) return;            // Firebase's own sign-in pages: always straight from the network

  // opening a page
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try { return await networkFirst(req, PAGES); }
      catch { return (await caches.match("/offline.html")) || Response.error(); }
    })());
    return;
  }

  // scripts and styles: newest when online (keeps the pieces of the site consistent), saved copy when offline
  if (/\.(?:js|css|webmanifest|json)$/.test(url.pathname)) {
    event.respondWith(networkFirst(req, STATIC));
    return;
  }

  // images and fonts
  if (/\.(?:jpg|jpeg|png|webp|gif|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
  }
});
