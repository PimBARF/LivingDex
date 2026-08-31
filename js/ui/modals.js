import {
  loadSettings,
  saveSettings,
  clearSpeciesCache,
  clearAllSavedData,
} from "../storage.js";

import {
  applyTheme,
  applyReducedMotionPreference,
  syncThemeSettingsRadios,
  resolveReducedMotionPreference,
} from "./theme.js";

import { GAMES, getOrderedGameEntries } from "../config.js";

import { resetDexProgress } from "../state.js";
import { applyPersistedViewSettings } from "../main.js";
import { refreshOfflineDataAndCaches } from "../pwa.js";

/**
 * Attach common modal accessibility and event handlers including opening, closing,
 * backdrop click dismissal, Escape key closing, and Tab key focus trapping.
 *
 * @param {Object} options - Configuration options for modal handling.
 * @param {HTMLElement|null} options.modal - The modal container element.
 * @param {HTMLElement|null} [options.openBtn] - Optional button that opens the modal on click.
 * @param {HTMLElement|null} [options.closeBtn] - Optional button that closes the modal on click.
 * @param {HTMLElement|null} [options.backdrop] - Optional backdrop element that closes the modal on click.
 * @param {((lastFocus: HTMLElement|null) => void)|null} [options.onOpen] - Optional callback triggered when modal opens.
 * @param {(() => void)|null} [options.onClose] - Optional callback triggered when modal closes.
 * @param {((event: KeyboardEvent, closeModal: () => void) => void)|null} [options.onKeydown] - Optional custom keydown handler.
 * @param {string} [options.focusSelector] - Optional CSS selector of the element to focus upon opening.
 * @returns {{ openModal: () => void, closeModal: () => void }} Object containing functions to programmatically open or close the modal.
 */
export function attachModalHandlers({
  modal,
  openBtn,
  closeBtn,
  backdrop,
  onOpen,
  onClose,
  onKeydown,
  focusSelector,
}) {
  if (!modal) return { openModal: () => {}, closeModal: () => {} };

  let lastFocus = null;

  /**
   * Close the modal, clean up listeners, trigger onClose callback, and restore focus.
   */
  function closeModal() {
    modal.hidden = true;
    modal._cleanup?.();
    onClose?.();
    lastFocus?.focus();
  }

  /**
   * Open the modal, track previous active element, set initial focus, and bind key listeners.
   */
  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    onOpen?.(lastFocus);

    const focusTarget = modal.querySelector(
      focusSelector ||
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const fallbackTarget =
      focusTarget ||
      modal.querySelector("button, [href], input, select, textarea");
    fallbackTarget?.focus();

    /**
     * Keydown handler to manage Escape key dismissal and Tab focus trapping.
     * @param {KeyboardEvent} event - The keyboard event.
     */
    function handleKeydown(event) {
      if (event.key === "Escape") {
        closeModal();
        return;
      }

      if (event.key === "Tab") {
        const focusables = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const list = Array.from(focusables).filter(
          (el) => !el.hasAttribute("disabled"),
        );
        if (!list.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          last.focus();
          event.preventDefault();
        } else if (!event.shiftKey && document.activeElement === last) {
          first.focus();
          event.preventDefault();
        }
      }
      onKeydown?.(event, closeModal);
    }

    modal.addEventListener("keydown", handleKeydown, { once: false });
    modal._cleanup = () => modal.removeEventListener("keydown", handleKeydown);
  }

  openBtn?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", closeModal);

  return { openModal, closeModal };
}

/**
 * Show the shared link warning modal when a shared URL hash is detected and run a callback on confirm.
 * On either confirm or cancel, the URL hash is cleared to avoid re-prompting.
 *
 * @param {() => void} [onConfirm] - Callback function executed if the user confirms importing the shared progress.
 */
export function showSharedLinkWarningModal(onConfirm) {
  const modal = document.getElementById("modalSharedLink");
  const confirmBtn = document.getElementById("confirmSharedLink");
  const cancelBtn = document.getElementById("cancelSharedLink");
  const backdrop = modal?.querySelector("[data-close]");

  if (!modal) {
    try {
      onConfirm?.();
    } catch {}
    return;
  }

  /**
   * Clear the URL hash from the browser history without triggering a reload.
   */
  function clearHash() {
    if (location.hash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  let confirmHandler;
  let cancelHandler;
  const { openModal, closeModal } = attachModalHandlers({
    modal,
    openBtn: null,
    closeBtn: null,
    backdrop,
    onOpen: () => confirmBtn?.focus(),
    onClose: () => {
      clearHash();
      confirmBtn?.removeEventListener("click", confirmHandler);
      cancelBtn?.removeEventListener("click", cancelHandler);
    },
    onKeydown: (event) => {
      if (event.key === "Escape") clearHash();
    },
    focusSelector: "#confirmSharedLink",
  });

  confirmHandler = () => {
    try {
      onConfirm?.();
    } catch {}
    closeModal();
  };
  confirmBtn?.addEventListener("click", confirmHandler);

  cancelHandler = () => closeModal();
  cancelBtn?.addEventListener("click", cancelHandler);

  openModal();
}

/**
 * Register reset confirmation modal handlers, focus management, and confirm button action.
 * Supports: click confirm/cancel, Escape key, Tab focus wrapping.
 *
 * @param {number} slotCount - Total number of dex slots to reset in the active game.
 */
export function registerResetControls(slotCount) {
  const openBtn = document.getElementById("resetDex");
  const modal = document.getElementById("modalReset");
  const confirmBtn = document.getElementById("confirmReset");
  const cancelBtn = document.getElementById("cancelReset");
  const backdrop = modal?.querySelector("[data-close]");

  const { closeModal } = attachModalHandlers({
    modal,
    openBtn,
    closeBtn: cancelBtn,
    backdrop,
    onOpen: () => confirmBtn?.focus(),
    onClose: () => {},
    focusSelector: "#confirmReset",
  });

  confirmBtn?.addEventListener("click", () => {
    resetDexProgress(slotCount);
    closeModal();
  });
}

/**
 * Check whether a value is a non-null, non-array object.
 *
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is a plain object, false otherwise.
 */
function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Read and JSON-parse an object from localStorage by key with a fallback.
 *
 * @param {string} key - The localStorage key to read.
 * @param {*} [fallback=null] - Fallback value if key is not found or parsing fails.
 * @returns {Object|*} Parsed plain object or fallback value.
 */
function readStoredObject(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Count the number of own enumerable keys in a plain object.
 *
 * @param {*} value - The object to count keys from.
 * @returns {number} The count of keys, or 0 if value is not a plain object.
 */
function countObjectEntries(value) {
  return isPlainObject(value) ? Object.keys(value).length : 0;
}

/**
 * Build the full application export payload including settings and per-game progress.
 *
 * @returns {{
 *   exportedAt: string,
 *   schemaVersion: number,
 *   settings: Object,
 *   games: Object<string, {
 *     caught: Object,
 *     segments: Object|null,
 *     speciesCache: Object|null,
 *     speciesCacheMeta: Object|null
 *   }>
 * }} Structured export data payload.
 */
function buildExportPayload() {
  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: 2,
    settings: loadSettings(),
    games: Object.fromEntries(
      Object.entries(GAMES).map(([gameKey, config]) => {
        const caughtKey = `${config.storagePrefix}-caught-v1`;
        const segmentsKey = `${config.storagePrefix}-segments-v1`;
        const speciesCacheKey = `${config.storagePrefix}-species-names-v1`;
        const speciesCacheMetaKey = `${config.storagePrefix}-species-names-meta-v1`;

        return [
          gameKey,
          {
            caught: readStoredObject(caughtKey, {}),
            segments: readStoredObject(segmentsKey, null),
            speciesCache: readStoredObject(speciesCacheKey, null),
            speciesCacheMeta: readStoredObject(speciesCacheMetaKey, null),
          },
        ];
      }),
    ),
  };
}

/**
 * Validate and normalize a raw payload from an imported backup file.
 *
 * @param {*} rawPayload - The parsed JSON data from the imported file.
 * @returns {{
 *   exportedAt: string|null,
 *   schemaVersion: number|null,
 *   settings: Object|null,
 *   games: Object<string, Object>
 * }} Validated import payload.
 * @throws {Error} If the payload is not a plain object or contains neither valid settings nor games.
 */
function normalizeImportPayload(rawPayload) {
  if (!isPlainObject(rawPayload)) {
    throw new Error("Invalid payload");
  }

  const settings = isPlainObject(rawPayload.settings)
    ? rawPayload.settings
    : null;
  const games = {};

  if (isPlainObject(rawPayload.games)) {
    for (const [gameKey, gamePayload] of Object.entries(rawPayload.games)) {
      if (!GAMES[gameKey] || !isPlainObject(gamePayload)) continue;

      const nextGame = {};
      if (isPlainObject(gamePayload.caught))
        nextGame.caught = gamePayload.caught;
      if (isPlainObject(gamePayload.segments))
        nextGame.segments = gamePayload.segments;
      if (isPlainObject(gamePayload.speciesCache))
        nextGame.speciesCache = gamePayload.speciesCache;
      if (isPlainObject(gamePayload.speciesCacheMeta))
        nextGame.speciesCacheMeta = gamePayload.speciesCacheMeta;

      if (Object.keys(nextGame).length) {
        games[gameKey] = nextGame;
      }
    }
  }

  if (!settings && !Object.keys(games).length) {
    throw new Error("Invalid payload");
  }

  return {
    exportedAt:
      typeof rawPayload.exportedAt === "string" ? rawPayload.exportedAt : null,
    schemaVersion: Number.isFinite(rawPayload.schemaVersion)
      ? rawPayload.schemaVersion
      : null,
    settings,
    games,
  };
}

/**
 * Register all settings modal controls, submodals (About, Import Review), and data actions.
 * Handles theme, reduced motion, hide-caught default, language, sprite style, default game,
 * data export/import, and cache resets.
 *
 * @returns {{ closeModal: () => void }} Object containing function to close the settings modal.
 */
export function registerSettingsControls() {
  const openBtn = document.getElementById("settingsBtn");
  const modal = document.getElementById("modalSettings");
  const backdrop = modal?.querySelector("[data-close]");
  const closeBtn = document.getElementById("closeSettings");
  const exportBtn = document.getElementById("settingsExportData");
  const importBtn = document.getElementById("settingsImportData");
  const importInput = document.getElementById("settingsImportFile");
  const refreshCacheBtn = document.getElementById("settingsRefreshCache");
  const clearCacheBtn = document.getElementById("settingsClearSpeciesCache");
  const clearAllBtn = document.getElementById("settingsClearAllData");
  const defaultGameModeSelect = document.getElementById(
    "settingsDefaultGameMode",
  );
  const defaultGameSelect = document.getElementById("settingsDefaultGame");
  const defaultGameWrapper = document.getElementById(
    "settingsDefaultGameWrapper",
  );
  const importModal = document.getElementById("modalImportData");
  const importBackdrop = importModal?.querySelector("[data-close]");
  const importSummary = document.getElementById("importDataSummary");
  const importOptions = document.getElementById("importDataOptions");
  const confirmImportBtn = document.getElementById("confirmImportData");
  const cancelImportBtn = document.getElementById("cancelImportData");
  const aboutBtn = document.getElementById("settingsAbout");
  const aboutModal = document.getElementById("modalAbout");
  const aboutBackdrop = aboutModal?.querySelector("[data-close]");
  const closeAboutBtn = document.getElementById("closeAbout");
  let pendingImportPayload = null;
  let pendingImportFileName = "";

  /**
   * Synchronize modal form input controls with current persisted settings.
   */
  function syncSettingsControls() {
    const settings = loadSettings();
    const reducedMotion = document.getElementById("settingsReducedMotion");
    const hideCaught = document.getElementById("settingsHideCaught");
    const language = document.getElementById("settingsLanguage");
    const spriteStyle = document.getElementById("settingsSpriteStyle");

    /**
     * Build HTML optgroup and option markup for the default game select dropdown.
     * @returns {string} Option markup HTML string.
     */
    const buildGameSelectMarkup = () => {
      const groups = new Map();
      for (const [key, config] of getOrderedGameEntries()) {
        const label = config.group
          ? config.group
              .replace("gen", "Generation ")
              .replace("special", "Special / Other")
              .replace(/^(Generation )([0-9])$/, "$1$2")
          : "Other";
        const normalized = label.startsWith("Generation") ? label : label;
        if (!groups.has(normalized)) groups.set(normalized, []);
        groups
          .get(normalized)
          .push(`<option value="${key}">${config.title}</option>`);
      }

      const orderedGroups = Array.from(groups.entries())
        .map(([groupName, options]) => {
          return `<optgroup label="${groupName}">${options.join("")}</optgroup>`;
        })
        .join("");
      return '<option value="">Select a game…</option>' + orderedGroups;
    };

    syncThemeSettingsRadios(settings.theme);
    if (reducedMotion)
      reducedMotion.checked = resolveReducedMotionPreference(
        settings.reducedMotion,
      );
    if (hideCaught) hideCaught.checked = !!settings.hideCaughtDefault;
    if (language) language.value = settings.language || "en";
    if (spriteStyle) spriteStyle.value = settings.spriteStyle || "pokesprites";
    if (defaultGameModeSelect)
      defaultGameModeSelect.value = settings.defaultGameMode || "last-used";
    if (defaultGameSelect) {
      defaultGameSelect.innerHTML = buildGameSelectMarkup();
      defaultGameSelect.value = settings.defaultGameId || "";
    }

    if (defaultGameWrapper) {
      defaultGameWrapper.hidden =
        (defaultGameModeSelect?.value || "last-used") !== "specific";
    }
  }

  /**
   * Read settings from DOM inputs, save them to storage, apply UI updates, and refresh view settings.
   * @returns {Promise<void>}
   */
  async function persistSettingsFromControls() {
    const settings = loadSettings();
    const previousLanguage = settings.language;
    const selectedTheme =
      document.querySelector('input[name="settingsTheme"]:checked')?.value ||
      settings.theme ||
      "auto";
    const nextSettings = {
      ...settings,
      theme: selectedTheme,
      reducedMotion: document.getElementById("settingsReducedMotion")?.checked
        ? true
        : false,
      hideCaughtDefault:
        !!document.getElementById("settingsHideCaught")?.checked,
      language: document.getElementById("settingsLanguage")?.value || "en",
      spriteStyle:
        document.getElementById("settingsSpriteStyle")?.value || "pokesprites",
      defaultGameMode:
        document.getElementById("settingsDefaultGameMode")?.value ||
        "last-used",
      defaultGameId:
        document.getElementById("settingsDefaultGame")?.value || null,
    };

    saveSettings(nextSettings);
    applyTheme(nextSettings.theme);
    applyReducedMotionPreference(nextSettings.reducedMotion);

    const speciesOrder = Array.from(
      document.querySelectorAll(".cell:not(.is-placeholder)"),
    )
      .map((cell) => Number(cell.dataset.national))
      .filter(Number.isFinite);
    await applyPersistedViewSettings({ speciesOrder, previousLanguage });
  }

  /**
   * Export all user data and settings as a downloadable JSON file.
   */
  function exportAllData() {
    const payload = buildExportPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "livingdex-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Data exported.", "success");
  }

  /**
   * Render the review checklist modal for selecting which items to import.
   * @param {Object} payload - The normalized import payload.
   */
  function renderImportReview(payload) {
    if (!importSummary || !importOptions) return;

    const gameEntries = Object.entries(payload.games || {});
    const hasSettings = !!payload.settings;
    const fileLabel = pendingImportFileName
      ? ` from ${pendingImportFileName}`
      : "";
    const settingsCount = hasSettings ? 1 : 0;

    importSummary.textContent = `This file${fileLabel} contains ${settingsCount ? "settings and " : ""}${gameEntries.length} game entr${gameEntries.length === 1 ? "y" : "ies"}. Select what you want to import.`;
    importOptions.innerHTML = "";

    if (hasSettings) {
      const row = document.createElement("label");
      row.className = "import-option";
      row.innerHTML = `
        <span class="switch">
          <input type="checkbox" id="importSettingsCheckbox" checked>
          <span>Import settings</span>
        </span>
        <p class="import-option-meta">Theme, display preferences, default game, and other app settings will be merged into the current device settings.</p>
      `;
      importOptions.appendChild(row);
    }

    for (const [gameKey, gamePayload] of gameEntries) {
      const config = GAMES[gameKey];
      if (!config) continue;

      const caughtCount = countObjectEntries(gamePayload.caught);
      const segmentCount = countObjectEntries(gamePayload.segments);
      const cacheCount = countObjectEntries(gamePayload.speciesCache);
      const hasMeta = isPlainObject(gamePayload.speciesCacheMeta);

      const row = document.createElement("label");
      row.className = "import-option";
      row.innerHTML = `
        <span class="switch">
          <input type="checkbox" data-game-key="${gameKey}" checked>
          <span>${config.title}</span>
        </span>
        <p class="import-option-meta">
          Caught: ${caughtCount} · Segments: ${segmentCount} · Cache names: ${cacheCount}${hasMeta ? " · Cache metadata included" : ""}
        </p>
      `;
      importOptions.appendChild(row);
    }
  }

  /**
   * Reset pending import state and clear import review modal elements.
   */
  function resetImportReviewState() {
    pendingImportPayload = null;
    pendingImportFileName = "";
    if (importSummary) importSummary.textContent = "";
    if (importOptions) importOptions.innerHTML = "";
    if (importInput) importInput.value = "";
  }

  /**
   * Open the import review modal with the given payload and filename.
   * @param {Object} payload - The normalized import payload.
   * @param {string} [fileName] - The name of the imported file.
   */
  function openImportReviewModal(payload, fileName) {
    pendingImportPayload = payload;
    pendingImportFileName = fileName || "";
    renderImportReview(payload);
    openImportReviewDialog();
  }

  /**
   * Apply selected settings and game data from the pending import payload to localStorage.
   */
  function applySelectedImport() {
    if (!pendingImportPayload) return;
    const importSettingsChecked = document.getElementById(
      "importSettingsCheckbox",
    )?.checked;
    const selectedGameKeys = Array.from(
      importOptions?.querySelectorAll("input[data-game-key]") || [],
    )
      .filter((input) => input.checked)
      .map((input) => input.dataset.gameKey)
      .filter(Boolean);

    if (!importSettingsChecked && !selectedGameKeys.length) {
      showToast("Select at least one item to import.", "warning");
      return;
    }

    if (importSettingsChecked && pendingImportPayload.settings) {
      saveSettings({ ...loadSettings(), ...pendingImportPayload.settings });
    }

    for (const gameKey of selectedGameKeys) {
      const gamePayload = pendingImportPayload.games?.[gameKey];
      const config = GAMES[gameKey];
      if (!config || !gamePayload) continue;

      if (isPlainObject(gamePayload.caught)) {
        localStorage.setItem(
          `${config.storagePrefix}-caught-v1`,
          JSON.stringify(gamePayload.caught),
        );
      }
      if (isPlainObject(gamePayload.segments)) {
        localStorage.setItem(
          `${config.storagePrefix}-segments-v1`,
          JSON.stringify(gamePayload.segments),
        );
      }
      if (isPlainObject(gamePayload.speciesCache)) {
        localStorage.setItem(
          `${config.storagePrefix}-species-names-v1`,
          JSON.stringify(gamePayload.speciesCache),
        );
      }
      if (isPlainObject(gamePayload.speciesCacheMeta)) {
        localStorage.setItem(
          `${config.storagePrefix}-species-names-meta-v1`,
          JSON.stringify(gamePayload.speciesCacheMeta),
        );
      }
    }

    closeImportReviewDialog();
    showToast("Selected data imported.", "success");
    window.location.reload();
  }

  /**
   * Read and parse an uploaded JSON file, validating its payload and opening the import review dialog.
   * @param {File} [file] - The uploaded file object.
   */
  function importAllData(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = normalizeImportPayload(
          JSON.parse(String(reader.result)),
        );
        openImportReviewModal(payload, file.name);
      } catch {
        showToast("Import failed: invalid JSON.", "danger");
        resetImportReviewState();
      }
    };
    reader.readAsText(file);
  }

  /**
   * Refresh the offline data and caches from the network.
   */
  async function refreshCacheAction() {
    showToast("Refreshing offline data...", "warning");
    const res = await refreshOfflineDataAndCaches();
    showToast(res.message, res.success ? "success" : "danger");
    if (res.success) {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  /**
   * Clear the cached Pokémon species names from localStorage.
   */
  function clearSpeciesCacheAction() {
    clearSpeciesCache();
    showToast("Species cache cleared.", "success");
  }

  /**
   * Prompt user for confirmation before wiping all stored progress and settings.
   */
  function clearAllDataAction() {
    if (
      !window.confirm(
        "This will clear all saved progress and settings for this site. Continue?",
      )
    )
      return;
    clearAllSavedData();
    window.location.reload();
  }

  /**
   * Attach change listeners to theme radio inputs to immediately persist and apply selections.
   */
  function attachThemeSettingsHandlers() {
    const radios = modal?.querySelectorAll('input[name="settingsTheme"]');
    if (!radios || !radios.length) return;

    radios.forEach((radio) => {
      radio.onchange = (e) => {
        if (e.target.checked) {
          persistSettingsFromControls();
        }
      };
    });
  }

  const { closeModal } = attachModalHandlers({
    modal,
    openBtn,
    closeBtn,
    backdrop,
    onOpen: () => {
      syncSettingsControls();
      attachThemeSettingsHandlers();
      closeBtn?.focus();
    },
    onClose: () => {},
    focusSelector: "#closeSettings",
  });

  const { openModal: openAboutModal } = attachModalHandlers({
    modal: aboutModal,
    openBtn: null,
    closeBtn: closeAboutBtn,
    backdrop: aboutBackdrop,
    onOpen: () => closeAboutBtn?.focus(),
    onClose: () => {},
    focusSelector: "#closeAbout",
  });

  const {
    openModal: openImportReviewDialog,
    closeModal: closeImportReviewDialog,
  } = attachModalHandlers({
    modal: importModal,
    openBtn: null,
    closeBtn: cancelImportBtn,
    backdrop: importBackdrop,
    onOpen: () => confirmImportBtn?.focus(),
    onClose: () => {
      resetImportReviewState();
    },
    focusSelector: '#importDataOptions input[type="checkbox"]',
  });

  document
    .getElementById("settingsReducedMotion")
    ?.addEventListener("change", persistSettingsFromControls);
  document
    .getElementById("settingsHideCaught")
    ?.addEventListener("change", persistSettingsFromControls);
  document
    .getElementById("settingsLanguage")
    ?.addEventListener("change", persistSettingsFromControls);
  document
    .getElementById("settingsSpriteStyle")
    ?.addEventListener("change", persistSettingsFromControls);

  defaultGameModeSelect?.addEventListener("change", () => {
    if (defaultGameWrapper) {
      defaultGameWrapper.hidden = defaultGameModeSelect.value !== "specific";
    }
    persistSettingsFromControls();
  });

  defaultGameSelect?.addEventListener("change", persistSettingsFromControls);
  exportBtn?.addEventListener("click", exportAllData);
  importBtn?.addEventListener("click", () => {
    if (importInput) importInput.value = "";
    importInput?.click();
  });
  importInput?.addEventListener("change", (event) =>
    importAllData(event.target.files?.[0]),
  );
  confirmImportBtn?.addEventListener("click", applySelectedImport);
  refreshCacheBtn?.addEventListener("click", refreshCacheAction);
  clearCacheBtn?.addEventListener("click", clearSpeciesCacheAction);
  clearAllBtn?.addEventListener("click", clearAllDataAction);
  aboutBtn?.addEventListener("click", openAboutModal);

  return { closeModal };
}

/**
 * Display a toast notification with automatic dismissal.
 *
 * @param {string} message - The message to display.
 * @param {'success'|'warning'|'danger'} [type="success"] - The toast type for styling.
 */
export function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}
