 =========================================================
   Stunden-App – Service Worker (FINAL)
   - Cache-Version bei Updates erhöhen!
   ========================================================= */

const CACHE_NAME = "stundenapp-v7"; // <<< bei jedem Update +1 erhöhen

const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/script.js",
  "./manifest.webmanifest",
  "./img/logo-mader.png",
  "./img/icon-192.png",
  "./img/icon-512.png"
];

// Install: Assets vorab cachen
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: alte Caches löschen
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch: Cache first für App-Dateien, sonst Network + Cache
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // nur GET Requests cachen
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // nur erfolgreiche, gleiche-origin Antworten cachen
          const url = new URL(req.url);
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // Offline-Fallback
          return caches.match("./index.html");
        });
    })
  );
});


