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
    const reg = await navigator.serviceWorker.register("./sw.js", {
      updateViaCache: "none",
    });
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

    // Proactively check for updates on resume, focus, page show, and online
    const triggerUpdateCheck = () => {
      if (navigator.onLine && document.visibilityState !== "hidden") {
        reg.update().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", triggerUpdateCheck);
    window.addEventListener("focus", triggerUpdateCheck);
    window.addEventListener("pageshow", triggerUpdateCheck);
    window.addEventListener("online", triggerUpdateCheck);

    // Periodically check for updates while the app is active (every 30 minutes)
    const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
    setInterval(triggerUpdateCheck, UPDATE_CHECK_INTERVAL_MS);

    return reg;
  } catch (err) {
    console.warn("[PWA] Service Worker registration failed:", err);
    return null;
  }
}

/**
 * Proactively triggers a service worker update check and returns the result.
 *
 * @returns {Promise<{ status: 'update-available'|'up-to-date'|'offline'|'unsupported'|'error', message: string }>}
 */
export async function checkForUpdates() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return {
      status: "unsupported",
      message: "Service Workers are not supported in this browser.",
    };
  }

  if (!navigator.onLine) {
    return {
      status: "offline",
      message: "You are offline. Connect to the internet to check for updates.",
    };
  }

  try {
    const reg =
      swRegistration || (await navigator.serviceWorker.getRegistration());
    if (!reg) {
      return {
        status: "unsupported",
        message: "No active service worker registered.",
      };
    }

    // Check if an update is already waiting to be applied
    if (reg.waiting) {
      showUpdateBanner(reg.waiting);
      return {
        status: "update-available",
        message: "A new update is available! Click 'Update now' to apply.",
      };
    }

    // Trigger update check against the server
    await reg.update();

    if (reg.waiting) {
      showUpdateBanner(reg.waiting);
      return {
        status: "update-available",
        message: "A new update is available! Click 'Update now' to apply.",
      };
    }

    if (reg.installing) {
      return new Promise((resolve) => {
        const worker = reg.installing;
        const onStateChange = () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            worker.removeEventListener("statechange", onStateChange);
            showUpdateBanner(worker);
            resolve({
              status: "update-available",
              message:
                "A new update is available! Click 'Update now' to apply.",
            });
          } else if (worker.state === "redundant") {
            worker.removeEventListener("statechange", onStateChange);
            resolve({
              status: "up-to-date",
              message: "LivingDex is up to date.",
            });
          }
        };

        worker.addEventListener("statechange", onStateChange);

        // Fallback timer if state change resolves earlier or gets stuck
        setTimeout(() => {
          worker.removeEventListener("statechange", onStateChange);
          if (reg.waiting) {
            showUpdateBanner(reg.waiting);
            resolve({
              status: "update-available",
              message:
                "A new update is available! Click 'Update now' to apply.",
            });
          } else {
            resolve({
              status: "up-to-date",
              message: "LivingDex is up to date.",
            });
          }
        }, 3000);
      });
    }

    return {
      status: "up-to-date",
      message: "LivingDex is up to date.",
    };
  } catch (err) {
    console.warn("[PWA] Update check failed:", err);
    return {
      status: "error",
      message: `Failed to check for updates: ${err.message || "Network error"}`,
    };
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
