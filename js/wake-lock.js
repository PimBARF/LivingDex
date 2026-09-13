/**
 * @file Screen Wake Lock manager for LivingDex.
 * Prevents mobile devices and tablets from dimming or timing out while the app is actively viewed.
 */

/**
 * Active wake lock sentinel instance.
 * @type {WakeLockSentinel|null}
 */
let wakeLockSentinel = null;

/**
 * Current user preference flag.
 * @type {boolean}
 */
let isWakeLockEnabled = false;

/**
 * Determine whether the Screen Wake Lock API is supported in the current environment.
 * @returns {boolean} True if navigator.wakeLock is supported.
 */
export function isWakeLockSupported() {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

/**
 * Request a screen wake lock from the browser.
 * Safe to call even if the wake lock is already acquired or unsupported.
 * @returns {Promise<boolean>} True if the wake lock is active, false otherwise.
 */
export async function requestWakeLock() {
  if (!isWakeLockSupported() || !isWakeLockEnabled) {
    return false;
  }

  if (
    typeof document !== "undefined" &&
    document.visibilityState !== "visible"
  ) {
    return false;
  }

  try {
    if (wakeLockSentinel && !wakeLockSentinel.released) {
      return true;
    }
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch {
    wakeLockSentinel = null;
    return false;
  }
}

/**
 * Release any currently active screen wake lock.
 * @returns {Promise<void>}
 */
export async function releaseWakeLock() {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {
      // Ignore release errors
    }
    wakeLockSentinel = null;
  }
}

/**
 * Apply the user's wake lock preference.
 * Acquires or releases the screen lock based on the enabled state and current document visibility.
 *
 * @param {boolean} enabled - Whether screen wake lock should be kept active.
 * @returns {Promise<void>}
 */
export async function applyWakeLockPreference(enabled) {
  isWakeLockEnabled = !!enabled;

  if (isWakeLockEnabled) {
    await requestWakeLock();
  } else {
    await releaseWakeLock();
  }
}

// Automatically re-acquire the wake lock when the app returns to the foreground
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", async () => {
    if (isWakeLockEnabled && document.visibilityState === "visible") {
      await requestWakeLock();
    }
  });
}
