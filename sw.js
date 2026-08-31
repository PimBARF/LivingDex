/**
 * @file Service Worker for LivingDex PWA.
 * Provides multi-tier caching (App Shell, Datasets, and Sprites),
 * offline execution, background revalidation, and update lifecycle control.
 */

const CACHE_VERSION = "v1.0.0";
const SHELL_CACHE = `livingdex-shell-${CACHE_VERSION}`;
const DATA_CACHE = `livingdex-data-${CACHE_VERSION}`;
const SPRITE_CACHE = "livingdex-sprites-v1";

const EXPECTED_CACHES = [SHELL_CACHE, DATA_CACHE, SPRITE_CACHE];

/**
 * Core Application Shell assets pre-cached upon installation.
 */
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./js/main.js",
  "./js/config.js",
  "./js/db.js",
  "./js/pwa.js",
  "./js/state.js",
  "./js/storage.js",
  "./js/pako.esm.mjs",
  "./js/ui/theme.js",
  "./js/ui/controls.js",
  "./js/ui/dom-render.js",
  "./js/ui/modals.js",
  "./js/ui/pokemon-info.js",
  "./assets/favicon.ico",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/fonts/Inter-VariableFont_opsz,wght.ttf",
  "./assets/fonts/Inter-Italic-VariableFont_opsz,wght.ttf",
];

/**
 * Static JSON data files pre-cached for instant offline Pokédex and search operations.
 */
const DATA_ASSETS = [
  "./data/species.json",
  "./data/evolutions.json",
  "./data/games/home.json",
  "./data/games/sv.json",
  "./data/games/swsh.json",
  "./data/games/rby.json",
  "./data/games/gsc.json",
  "./data/games/rse.json",
  "./data/games/frlg.json",
  "./data/games/dppt.json",
  "./data/games/hgss.json",
  "./data/games/bw.json",
  "./data/games/b2w2.json",
  "./data/games/xy.json",
  "./data/games/oras.json",
  "./data/games/sm.json",
  "./data/games/usum.json",
  "./data/games/lgpe.json",
  "./data/games/bdsp.json",
  "./data/games/pla.json",
  "./data/games/za.json",
];

/**
 * Install Event: Pre-cache App Shell and Core Datasets.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const [shellCache, dataCache] = await Promise.all([
        caches.open(SHELL_CACHE),
        caches.open(DATA_CACHE),
      ]);

      // Cache shell assets (fail-safe individually)
      await Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          shellCache.add(url).catch((err) => {
            console.warn(`[SW] Shell precache failed for ${url}:`, err);
          }),
        ),
      );

      // Cache data assets
      await Promise.allSettled(
        DATA_ASSETS.map((url) =>
          dataCache.add(url).catch((err) => {
            console.warn(`[SW] Data precache failed for ${url}:`, err);
          }),
        ),
      );
    })(),
  );
});

/**
 * Activate Event: Clean up outdated cache versions and claim clients.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (!EXPECTED_CACHES.includes(key)) {
            console.log(`[SW] Purging outdated cache bucket: ${key}`);
            return caches.delete(key);
          }
          return null;
        }),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Fetch Event: Intelligent routing and caching strategies.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests
  if (request.method !== "GET") return;

  // Ignore browser extensions or other schemes
  if (!url.protocol.startsWith("http")) return;

  // Strategy 1: Sprites & Artwork (Cache-First)
  // Matches both local assets/sprites and remote PokeAPI GitHub raw sprites
  const isSprite =
    url.pathname.includes("/sprites/") ||
    url.hostname === "raw.githubusercontent.com";

  if (isSprite) {
    event.respondWith(cacheFirstWithNetworkFallback(request, SPRITE_CACHE));
    return;
  }

  // Strategy 2: Data JSON Files (Stale-While-Revalidate)
  const isDataFile = url.pathname.includes("/data/");
  if (isDataFile) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // Strategy 3: App Shell Assets & Navigation (Stale-While-Revalidate with Navigation Fallback)
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          return networkResponse;
        } catch {
          const cachedIndex =
            (await caches.match("./index.html")) ||
            (await caches.match("/index.html")) ||
            (await caches.match("./"));
          if (cachedIndex) return cachedIndex;
          throw new Error("Offline and no index.html cached");
        }
      })(),
    );
    return;
  }

  // Default Strategy for App Shell assets (CSS, JS, Fonts)
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});

/**
 * Cache-First with network fallback strategy.
 * Used for static sprite images and media assets.
 *
 * @param {Request} request
 * @param {string} cacheName
 * @returns {Promise<Response>}
 */
async function cacheFirstWithNetworkFallback(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // If both cache and network fail, return synthetic 404
    return new Response("Asset not found or offline", {
      status: 404,
      statusText: "Not Found",
      headers: { "Content-Type": "text/plain" },
    });
  }
}

/**
 * Stale-While-Revalidate strategy.
 * Immediately returns cached response if available, while simultaneously fetching
 * and updating the cache in the background.
 *
 * @param {Request} request
 * @param {string} cacheName
 * @returns {Promise<Response>}
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((err) => {
      if (!cachedResponse) {
        throw err;
      }
    });

  return cachedResponse || fetchPromise;
}

/**
 * Message Event: Handles client commands (SKIP_WAITING, REFRESH_DATA, CLEAR_ALL).
 */
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "REFRESH_DATA") {
    event.waitUntil(
      (async () => {
        const dataCache = await caches.open(DATA_CACHE);
        await Promise.allSettled(
          DATA_ASSETS.map(async (url) => {
            try {
              const res = await fetch(url, { cache: "reload" });
              if (res.ok) await dataCache.put(url, res);
            } catch (err) {
              console.warn(`[SW] Failed to refresh ${url}:`, err);
            }
          }),
        );
      })(),
    );
  }

  if (event.data.type === "PURGE_ALL_CACHES") {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      })(),
    );
  }
});
