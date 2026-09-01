/**
 * @file Service Worker for LivingDex PWA.
 * Provides multi-tier caching (App Shell, Datasets, and Sprites),
 * offline execution, background revalidation, and update lifecycle control.
 */

const CACHE_VERSION = "v1.5.4";
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
  "./llms.txt",
  "./js/main.js",
  "./js/config.js",
  "./js/db.js",
  "./js/pwa.js",
  "./js/state.js",
  "./js/storage.js",
  "./js/ui/theme.js",
  "./js/ui/controls.js",
  "./js/ui/dom-render.js",
  "./js/ui/modals.js",
  "./js/ui/pokemon-info.js",
  "./assets/favicon.ico",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/fonts/InterVariable.woff2",
  "./assets/fonts/InterVariable-Italic.woff2",
];

/**
 * Static JSON data files pre-cached for instant offline Pokédex and search operations.
 */
const DATA_ASSETS = [
  "./data/species.json",
  "./data/forms.json",
  "./data/evolutions.json",
  "./data/flavor/en.json",
  "./data/games/dex/home.json",
  "./data/games/dex/sv.json",
  "./data/games/dex/swsh.json",
  "./data/games/dex/rby.json",
  "./data/games/dex/gsc.json",
  "./data/games/dex/rse.json",
  "./data/games/dex/frlg.json",
  "./data/games/dex/dppt.json",
  "./data/games/dex/hgss.json",
  "./data/games/dex/bw.json",
  "./data/games/dex/b2w2.json",
  "./data/games/dex/xy.json",
  "./data/games/dex/oras.json",
  "./data/games/dex/sm.json",
  "./data/games/dex/usum.json",
  "./data/games/dex/lgpe.json",
  "./data/games/dex/bdsp.json",
  "./data/games/dex/pla.json",
  "./data/games/dex/za.json",
  "./data/games/evolutions/home.json",
  "./data/games/evolutions/sv.json",
  "./data/games/evolutions/swsh.json",
  "./data/games/evolutions/rby.json",
  "./data/games/evolutions/gsc.json",
  "./data/games/evolutions/rse.json",
  "./data/games/evolutions/frlg.json",
  "./data/games/evolutions/dppt.json",
  "./data/games/evolutions/hgss.json",
  "./data/games/evolutions/bw.json",
  "./data/games/evolutions/b2w2.json",
  "./data/games/evolutions/xy.json",
  "./data/games/evolutions/oras.json",
  "./data/games/evolutions/sm.json",
  "./data/games/evolutions/usum.json",
  "./data/games/evolutions/lgpe.json",
  "./data/games/evolutions/bdsp.json",
  "./data/games/evolutions/pla.json",
  "./data/games/evolutions/za.json",
];

/**
 * Maps a remote PokeAPI sprite URL to a local assets/sprites/... path.
 *
 * @param {string} pathname
 * @returns {string|null}
 */
function mapRemoteSpriteToLocalPath(pathname) {
  let match = pathname.match(
    /\/sprites\/pokemon\/other\/official-artwork\/(shiny\/)?(female\/)?(\d+)\.png$/,
  );
  if (match) {
    return `./assets/sprites/official-artwork/${match[1] || ""}${match[2] || ""}${match[3]}.png`;
  }

  match = pathname.match(
    /\/sprites\/pokemon\/other\/home\/(shiny\/)?(female\/)?(\d+)\.png$/,
  );
  if (match) {
    return `./assets/sprites/home/${match[1] || ""}${match[2] || ""}${match[3]}.png`;
  }

  match = pathname.match(
    /\/sprites\/pokemon\/other\/showdown\/(shiny\/)?(female\/)?(\d+)\.gif$/,
  );
  if (match) {
    return `./assets/sprites/showdown/${match[1] || ""}${match[2] || ""}${match[3]}.gif`;
  }

  match = pathname.match(
    /\/sprites\/pokemon\/(shiny\/)?(female\/)?(\d+)\.png$/,
  );
  if (match) {
    return `./assets/sprites/pokesprites/${match[1] || ""}${match[2] || ""}${match[3]}.png`;
  }

  return null;
}

/**
 * Maps a local assets/sprites/... path to a remote PokeAPI sprite URL.
 *
 * @param {string} pathname
 * @returns {string|null}
 */
function mapLocalSpriteToRemoteUrl(pathname) {
  const GITHUB_BASE =
    "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

  let match = pathname.match(
    /\/assets\/sprites\/official-artwork\/(shiny\/)?(female\/)?(\d+)\.png$/,
  );
  if (match) {
    return `${GITHUB_BASE}/other/official-artwork/${match[1] || ""}${match[2] || ""}${match[3]}.png`;
  }

  match = pathname.match(
    /\/assets\/sprites\/home\/(shiny\/)?(female\/)?(\d+)\.png$/,
  );
  if (match) {
    return `${GITHUB_BASE}/other/home/${match[1] || ""}${match[2] || ""}${match[3]}.png`;
  }

  match = pathname.match(
    /\/assets\/sprites\/showdown\/(shiny\/)?(female\/)?(\d+)\.gif$/,
  );
  if (match) {
    return `${GITHUB_BASE}/other/showdown/${match[1] || ""}${match[2] || ""}${match[3]}.gif`;
  }

  match = pathname.match(
    /\/assets\/sprites\/pokesprites\/(shiny\/)?(female\/)?(\d+)\.png$/,
  );
  if (match) {
    return `${GITHUB_BASE}/${match[1] || ""}${match[2] || ""}${match[3]}.png`;
  }

  return null;
}

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

  // Strategy 1: Sprites & Artwork (Smart Cache-First with Local + Remote fallback)
  const isSprite =
    url.pathname.includes("/sprites/") ||
    url.hostname === "raw.githubusercontent.com";

  if (isSprite) {
    event.respondWith(handleSpriteFetch(request));
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
 * Smart sprite fetch handler:
 * 1. Check SPRITE_CACHE.
 * 2. If miss and remote request: check if a local assets/sprites/... file exists.
 * 3. If local exists, store in SPRITE_CACHE and serve.
 * 4. If local missing, fetch from remote PokeAPI CDN, store in SPRITE_CACHE and serve.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleSpriteFetch(request) {
  const cache = await caches.open(SPRITE_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  const url = new URL(request.url);

  // Case A: Remote PokeAPI sprite requested
  if (url.hostname === "raw.githubusercontent.com") {
    const localPath = mapRemoteSpriteToLocalPath(url.pathname);
    if (localPath) {
      try {
        const localRes = await fetch(localPath);
        const contentType = localRes.headers.get("content-type") || "";
        // Ensure local server returned an actual image and not an HTML 404 page
        if (
          localRes.ok &&
          (contentType.startsWith("image/") || localRes.status === 200)
        ) {
          cache.put(request, localRes.clone());
          return localRes;
        }
      } catch {
        /* proceed to remote network fetch */
      }
    }

    try {
      // Fetch with CORS so the response is transparent with status 200 (OK)
      const remoteRes = await fetch(request.url, { mode: "cors" });
      if (remoteRes && remoteRes.ok) {
        cache.put(request, remoteRes.clone());
        return remoteRes;
      }
    } catch {
      /* fallback to standard fetch */
    }

    try {
      const fallbackRes = await fetch(request);
      if (
        fallbackRes &&
        (fallbackRes.ok ||
          fallbackRes.status === 200 ||
          fallbackRes.type === "opaque")
      ) {
        cache.put(request, fallbackRes.clone());
      }
      return fallbackRes;
    } catch {
      return new Response("Sprite unavailable offline", {
        status: 404,
        statusText: "Not Found",
        headers: { "Content-Type": "text/plain" },
      });
    }
  }

  // Case B: Local assets/sprites/... requested directly
  try {
    const localRes = await fetch(request);
    const contentType = localRes.headers.get("content-type") || "";
    if (localRes.ok && contentType.startsWith("image/")) {
      cache.put(request, localRes.clone());
      return localRes;
    }
  } catch {
    /* fallback to remote if local is missing */
  }

  const remoteUrl = mapLocalSpriteToRemoteUrl(url.pathname);
  if (remoteUrl) {
    try {
      const remoteRes = await fetch(remoteUrl, { mode: "cors" });
      if (
        remoteRes &&
        (remoteRes.ok ||
          remoteRes.status === 200 ||
          remoteRes.type === "opaque")
      ) {
        cache.put(request, remoteRes.clone());
      }
      return remoteRes;
    } catch {
      /* ignore */
    }
  }

  return new Response("Sprite unavailable offline", {
    status: 404,
    statusText: "Not Found",
    headers: { "Content-Type": "text/plain" },
  });
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
 * Message Event: Handles client commands (SKIP_WAITING, REFRESH_DATA, PURGE_ALL_CACHES).
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
