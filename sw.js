const CACHE_NAME = "stundenapp-v4"; // <-- bei jedem Update hochzählen

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/script.js",
  "./manifest.webmanifest"
];

// Install: nur Core cachen (keine Bilder -> keine 404-Probleme)
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
});

// Activate: alte Caches löschen + sofort übernehmen
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
      await self.clients.claim();
    })()
  );
});

// Fetch: HTML immer aus dem Netz versuchen (damit Updates kommen),
// falls offline -> Cache.
// Statische Dateien: Cache-first.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // nur gleicher Origin
  if (url.origin !== self.location.origin) return;

  // Für HTML: Network-first (wichtig für Updates)
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Für Assets: Cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);
    })
  );
});


