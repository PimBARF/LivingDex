/**
 * @file PWA & Service Worker lifecycle manager for LivingDex.
 * Handles service worker registration, update discovery, floating notification
 * banners, and manual offline cache refreshes.
 */

let waitingWorker = null;
let swRegistration = null;

/**
 * Shows the floating update banner alerting the user that new files/data are available.
 *
 * @param {ServiceWorker|null} worker - The waiting service worker instance.
 */
export function showUpdateBanner(worker) {
  waitingWorker = worker;
  const banner = document.getElementById("updateBanner");
  if (!banner) return;
  banner.hidden = false;
  banner.classList.add("show");
}

/**
 * Hides the floating update banner.
 */
export function hideUpdateBanner() {
  const banner = document.getElementById("updateBanner");
  if (!banner) return;
  banner.classList.remove("show");
  banner.hidden = true;
}

/**
 * Sends a SKIP_WAITING signal to the waiting service worker to trigger immediate activation.
 */
export function applyAppUpdate() {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  } else if (navigator.serviceWorker.controller) {
    window.location.reload();
  }
}

/**
 * Initializes Service Worker registration and lifecycle event listeners.
 *
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function initPwa() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  // Bind banner buttons
  const btnUpdate = document.getElementById("btnUpdateApp");
  const btnDismiss = document.getElementById("btnDismissUpdate");

  btnUpdate?.addEventListener("click", () => {
    applyAppUpdate();
  });

  btnDismiss?.addEventListener("click", () => {
    hideUpdateBanner();
  });

  try {
    const reg = await navigator.serviceWorker.register("./sw.js");
    swRegistration = reg;

    // Check if there is already a waiting worker upon page load
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateBanner(reg.waiting);
    }

    // Detect when a new service worker is installed in the background
    reg.addEventListener("updatefound", () => {
      const installingWorker = reg.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (
          installingWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          showUpdateBanner(installingWorker);
        }
      });
    });

    // Auto-reload when the active controller changes after skipWaiting()
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Periodically check for updates when returning to the tab
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        reg.update().catch(() => {});
      }
    });

    return reg;
  } catch (err) {
    console.warn("[PWA] Service Worker registration failed:", err);
    return null;
  }
}

/**
 * Manually requests the service worker to refresh data caches and reload offline datasets.
 *
 * @returns {Promise<{ success: boolean, message: string }>} Result status.
 */
export async function refreshOfflineDataAndCaches() {
  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "REFRESH_DATA" });
    }

    if (swRegistration) {
      await swRegistration.update();
    }

    // Force network fetch of species dataset to confirm connectivity
    const testRes = await fetch("data/species.json", { cache: "reload" });
    if (!testRes.ok) throw new Error(`HTTP ${testRes.status}`);

    return {
      success: true,
      message: "Offline data and cache refreshed successfully.",
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to refresh cache: ${err.message || "Network error"}`,
    };
  }
}
