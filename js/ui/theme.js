import { loadSettings, saveSettings } from "../storage.js";

// Track system preference fallbacks for theme and motion
const SYSTEM_THEME_MQL = window.matchMedia
  ? window.matchMedia("(prefers-color-scheme: dark)")
  : null;
const REDUCED_MOTION_MQL = window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;

function resolveTheme(mode) {
  if (mode === "auto") {
    return SYSTEM_THEME_MQL && SYSTEM_THEME_MQL.matches ? "dark" : "light";
  }
  // Fallback to light/dark if anything unexpected is stored
  return mode === "dark" ? "dark" : "light";
}

export function resolveReducedMotionPreference(
  value = loadSettings().reducedMotion,
) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return !!(REDUCED_MOTION_MQL && REDUCED_MOTION_MQL.matches);
}

export function isMotionReduced() {
  return resolveReducedMotionPreference(loadSettings().reducedMotion);
}

export function applyReducedMotionPreference(value) {
  const settings = loadSettings();
  const selected = value ?? settings.reducedMotion ?? "system";
  const reduced = resolveReducedMotionPreference(selected);
  document.documentElement.dataset.motion = reduced ? "reduced" : "full";
  document.body.classList.toggle("reduced-motion", reduced);
}

/**
 * Apply theme to the document and persist preference.
 * Supports 'light', 'dark', and 'auto' (system preference).
 * - 'mode' is the user choice (stored as-is, including 'auto')
 * - resolved theme ('light' or 'dark') is applied to the DOM
 */
export function applyTheme(mode) {
  const settings = loadSettings();
  const storedMode = mode || settings.theme || "light";
  const resolved = resolveTheme(storedMode);

  // Store the *selected* mode (can be 'auto')
  saveSettings({ ...settings, theme: storedMode });

  // Apply the effective theme to the document
  document.documentElement.dataset.theme = resolved;

  // Update small header toggle icon
  const button = document.getElementById("themeToggle");
  if (button) {
    // Icon reflects the *current* visible theme:
    // - show moon when light (click to go dark)
    // - show sun when dark (click to go light)
    button.textContent = resolved === "light" ? "🌙" : "☀️";
  }

  // Keep settings modal radios in sync if it's open
  syncThemeSettingsRadios(storedMode);
}

/**
 * Keep the theme radios in the Settings modal in sync with the stored theme.
 * @param {string} mode - 'light' | 'dark' | 'auto'
 */
export function syncThemeSettingsRadios(mode) {
  const settings = loadSettings();
  const value = mode || settings.theme || "light";
  const radios = document.querySelectorAll('input[name="settingsTheme"]');
  if (!radios.length) return;

  radios.forEach((radio) => {
    radio.checked = radio.value === value;
  });
}

// When the OS theme changes, re-resolve if we're in 'auto'
if (SYSTEM_THEME_MQL) {
  SYSTEM_THEME_MQL.addEventListener("change", () => {
    const settings = loadSettings();
    if (settings.theme === "auto") {
      applyTheme("auto");
    }
  });
}

if (REDUCED_MOTION_MQL) {
  REDUCED_MOTION_MQL.addEventListener("change", () => {
    const settings = loadSettings();
    if (
      settings.reducedMotion === "system" ||
      settings.reducedMotion === undefined ||
      settings.reducedMotion === null
    ) {
      applyReducedMotionPreference("system");
    }
  });
}
