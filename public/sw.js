/**
 * Olgax POS — Service Worker
 * Strategy: network-first for API routes, cache-first for static assets.
 */

const CACHE_NAME = "olgax-pos-v2";

const STATIC_PRECACHE = [
  "/",
  "/pos",
  "/manifest.json",
];

// ── Install: pre-cache the app shell ────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_PRECACHE))
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ──────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // API routes: network-only (let the app queue offline writes itself)
  if (url.pathname.startsWith("/api/")) {
    return; // fall through to browser default
  }

  // _next/static: network-first so code changes are always picked up.
  // In production chunks are content-hashed (immutable), so network hits are
  // cache misses only for genuinely new files — existing cached hashes are
  // returned from cache as a fast fallback if the network is unavailable.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? Response.error()))
    );
    return;
  }

  // Pages: network-first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? Response.error()))
  );
});
