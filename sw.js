/**
 * @file Service Worker for LivingDex PWA.
 * Provides service worker lifecycle event handlers to support PWA installability.
 */

/**
 * Handles the Service Worker install event.
 *
 * @param {ExtendableEvent} event - The service worker install event.
 * @returns {void}
 */
self.addEventListener("install", (event) => {
  console.log("Service Worker installed.");
});

/**
 * Handles fetch events intercepted by the Service Worker.
 * Currently serves as a pass-through for network requests.
 *
 * @param {FetchEvent} event - The fetch event triggered by network requests.
 * @returns {void}
 */
self.addEventListener("fetch", (event) => {});
