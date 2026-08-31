import { buildActiveDexSections, loadSpeciesNames } from "./db.js";

import {
  loadSettings,
  loadEnabledSegments,
  decodeCaughtState,
  saveEnabledSegments,
} from "./storage.js";

import {
  ACTIVE_GAME,
  ACTIVE_GAME_ID,
  getOrderedGameEntries,
} from "./config.js";

import { rebuildDexView, updateProgressBar, syncCaughtState } from "./state.js";

import { applyTheme, applyReducedMotionPreference } from "./ui/theme.js";

import {
  registerResetControls,
  registerSettingsControls,
  showToast,
} from "./ui/modals.js";

import {
  registerHeaderControls,
  registerScrollToTopButton,
  applyHideCaughtFilter,
} from "./ui/controls.js";

import {
  registerBoxControls,
  applySpriteStyleToCells,
} from "./ui/dom-render.js";

import { initPwa } from "./pwa.js";

/**
 * Array of Pokémon species IDs in display order for the active game and enabled segments.
 * Derived dynamically after loading Pokédex sections from API or cache.
 * @type {number[]}
 */
let LIVING_DEX_SPECIES_ORDER = [];

/**
 * Total count of living dex slots across all active dex sections.
 * Derived dynamically after loading Pokédex sections.
 * @type {number}
 */
let LIVING_DEX_SLOT_COUNT = 0;

/**
 * Main initialization function for the LivingDex application.
 *
 * Orchestrates the full startup flow:
 * 1. Sets header and document titles and renders the game selector and info toggle controls.
 * 2. Loads persisted UI preferences (theme, reduced motion) and applies them.
 * 3. Registers UI control event handlers and modal listeners.
 * 4. Fetches active dex sections and species data, then builds the visual Pokédex box layout.
 * 5. Asynchronously fetches localized Pokémon species names.
 * 6. Applies saved filter and sprite preferences to the rendered cells.
 * 7. Updates the progress bar with current caught counts.
 * 8. Evaluates URL hash state for shared caught checklists and registers hashchange listeners.
 *
 * @async
 * @returns {Promise<void>} Resolves when application initialization completes.
 */
async function initializeLivingDexApp() {
  setGameTitles();
  renderGameSelector();
  renderGameInfo();

  const settings = loadSettings();
  applyTheme(settings.theme);
  applyReducedMotionPreference(settings.reducedMotion);

  // Register controls immediately so the UI is interactive during data loading.
  // slotCount 0 is safe — both functions use live DOM queries as primary source.
  registerHeaderControls(0);
  registerScrollToTopButton();
  registerResetControls(0);
  registerSettingsControls();

  const app = document.getElementById("app");
  if (!app) return;

  // Compute active sections and combined order
  const { sections, warnings } = await buildActiveDexSections();
  const combinedSpeciesIds = sections.flatMap((s) =>
    s.entries.map((e) => e.speciesId),
  );
  LIVING_DEX_SPECIES_ORDER = combinedSpeciesIds;
  LIVING_DEX_SLOT_COUNT = combinedSpeciesIds.length;

  window.__livingDexNames = {};
  rebuildDexView({ sections, slotCount: LIVING_DEX_SLOT_COUNT });
  if (warnings.length) {
    console.warn("Pokédex sections loaded with warnings:", warnings);
    showToast("Some Pokédex data could not be loaded.", "warning");
  }

  // Fetch and apply species names from cache or API
  const nameResult = await loadSpeciesNames(LIVING_DEX_SPECIES_ORDER);
  if (nameResult.failedIds.length) {
    showToast("Some Pokémon names could not be loaded.", "warning");
  }

  // Names are applied by loadSpeciesNames() as they arrive (incrementally)

  // Apply persisted view settings now that cells exist in the DOM
  await applyPersistedViewSettings();

  // Trigger initial search if input has value
  const searchInput = document.getElementById("search");
  if (searchInput?.value) searchInput.dispatchEvent(new Event("input"));

  updateProgressBar(LIVING_DEX_SLOT_COUNT);

  // Handle shared state from URL hash
  /**
   * Helper function to retrieve the currently enabled dex segment IDs as an array.
   * @returns {string[]} List of enabled segment identifiers.
   */
  const getShareSegments = () => Array.from(loadEnabledSegments());
  const sharedState = decodeCaughtState(
    location.hash,
    LIVING_DEX_SLOT_COUNT,
    getShareSegments(),
  );
  if (sharedState && Object.keys(sharedState).length) {
    // Show shared link warning modal
    import("./ui.js").then((ui) => {
      ui.showSharedLinkWarningModal(() => {
        syncCaughtState(sharedState, LIVING_DEX_SLOT_COUNT);
      });
    });
  } else if (/#s=/.test(location.hash)) {
    showToast(
      "This shared link is for a different game or segment selection.",
      "warning",
    );
  }

  // Watch for hash changes (e.g., user clicking shared link)
  window.addEventListener("hashchange", () => {
    const activeSlotCount =
      document.querySelectorAll(".cell:not(.is-placeholder)").length ||
      LIVING_DEX_SLOT_COUNT;
    const incomingState = decodeCaughtState(
      location.hash,
      activeSlotCount,
      getShareSegments(),
    );
    if (incomingState) {
      import("./ui.js").then((ui) => {
        ui.showSharedLinkWarningModal(() => {
          syncCaughtState(incomingState, activeSlotCount);
        });
      });
    } else if (/#s=/.test(location.hash)) {
      showToast(
        "This shared link is for a different game or segment selection.",
        "warning",
      );
    }
  });
}

/**
 * Applies persisted view preferences that affect the rendered dex grid.
 *
 * Keeps the hide-caught toggle and sprite style in sync with storage, and
 * refreshes localized species names when the selected language changes.
 *
 * @async
 * @param {Object} [options={}] - Options object for updating view settings.
 * @param {number[]} [options.speciesOrder=[]] - Ordered array of species IDs to re-fetch names for if language changed.
 * @param {string} [options.previousLanguage] - The previously configured language code to compare against the current setting.
 * @returns {Promise<void>} Resolves when view settings and potential name refreshes have been applied.
 */
export async function applyPersistedViewSettings({
  speciesOrder = [],
  previousLanguage,
} = {}) {
  const settings = loadSettings();
  const hideToggle = document.getElementById("toggleUncaught");

  if (hideToggle) {
    hideToggle.checked = !!settings.hideCaughtDefault;
    hideToggle.dispatchEvent(new Event("change"));
  } else {
    applyHideCaughtFilter();
  }

  applySpriteStyleToCells();

  if (
    speciesOrder.length &&
    previousLanguage !== undefined &&
    previousLanguage !== settings.language
  ) {
    await loadSpeciesNames(speciesOrder);
  }
}

/**
 * Populates the game info section with the active game title and segment toggle checkboxes.
 *
 * Creates interactive checkboxes for optional Pokédex segments. When a user toggles
 * a segment, this updates persistent storage, recalculates active Pokédex sections,
 * rebuilds the box grid view, and fetches species names for the updated slot list.
 *
 * @returns {void}
 */
export function renderGameInfo() {
  const titleEl = document.getElementById("gameTitle");
  const togglesEl = document.getElementById("segmentToggles");

  if (titleEl) {
    titleEl.textContent = ACTIVE_GAME.title;
  }

  if (!togglesEl) return;

  togglesEl.innerHTML = "";

  const enabled = loadEnabledSegments();

  // Create checkboxes for optional segments
  ACTIVE_GAME.dexes
    .filter((s) => s.optional)
    .forEach((seg) => {
      const id = `gameinfo-seg-${seg.id}`;
      const wrapper = document.createElement("label");
      wrapper.className = "segment-toggle";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = id;
      input.name = id;
      input.checked = enabled.has(seg.id);

      const text = document.createElement("span");
      // Always show the configured title for the segment, including forms
      text.textContent = seg.title;

      wrapper.appendChild(input);
      wrapper.appendChild(text);
      togglesEl.appendChild(wrapper);

      // Add event listener for live updates
      input.addEventListener("change", async () => {
        const currentEnabled = loadEnabledSegments();

        if (input.checked) {
          currentEnabled.add(seg.id);
        } else {
          currentEnabled.delete(seg.id);
        }

        saveEnabledSegments(currentEnabled);

        const { sections, warnings } = await buildActiveDexSections();
        const combinedSpeciesIds = sections.flatMap((s) =>
          s.entries.map((e) => e.speciesId),
        );
        const newSlotCount = combinedSpeciesIds.length;

        rebuildDexView({ sections, slotCount: newSlotCount });
        if (warnings.length) {
          console.warn("Pokédex sections loaded with warnings:", warnings);
          showToast("Some Pokédex data could not be loaded.", "warning");
        }

        const nameResult = await loadSpeciesNames(combinedSpeciesIds);
        if (nameResult.failedIds.length) {
          showToast("Some Pokémon names could not be loaded.", "warning");
        }
      });
    });
}

/**
 * Populates the dex selector dropdown with all available games grouped by category/generation.
 *
 * Generates `<optgroup>` elements for generations and special games, selects the currently
 * active game option, and attaches a change listener to switch games by updating the URL parameter.
 *
 * @returns {void}
 */
export function renderGameSelector() {
  const selector = document.getElementById("dexSelector");
  if (!selector) return;

  const groupedEntries = new Map();
  for (const [key, config] of getOrderedGameEntries()) {
    const groupLabel =
      config.group === "special"
        ? "Special / Other"
        : config.group?.startsWith("gen")
          ? `Generation ${config.group.replace("gen", "")}`
          : "Other";
    if (!groupedEntries.has(groupLabel)) groupedEntries.set(groupLabel, []);
    groupedEntries.get(groupLabel).push({ key, title: config.title });
  }

  selector.innerHTML = "";
  for (const [groupLabel, entries] of groupedEntries) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = groupLabel;
    entries.forEach(({ key, title }) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = title;
      if (key === ACTIVE_GAME_ID) option.selected = true;
      optgroup.appendChild(option);
    });
    selector.appendChild(optgroup);
  }

  // Handle dex switching
  selector.addEventListener("change", (e) => {
    const newGame = e.target.value;
    if (newGame && newGame !== ACTIVE_GAME_ID) {
      const url = new URL(location.href);
      url.searchParams.set("game", newGame);
      url.hash = "";
      location.href = url.toString();
    }
  });
}

/**
 * Sets document and page header titles from the active Pokédex configuration.
 *
 * @returns {void}
 */
export function setGameTitles() {
  const docTitle = document.getElementById("docTitle");
  if (docTitle) docTitle.textContent = ACTIVE_GAME.title;
}

/**
 * Top-level application bootstrap IIFE.
 *
 * Automatically executes upon script load to initialize the application and
 * gracefully handles/displays top-level startup errors in the UI if initialization fails.
 */
if (typeof window !== "undefined" && typeof document !== "undefined") {
  (async function bootstrapLivingDex() {
    try {
      await initializeLivingDexApp();
    } catch (err) {
      console.error("LivingDex startup failed:", err);
      const app = document.getElementById("app");
      if (app) {
        app.innerHTML = `
          <section class="box app-empty-state" role="status" aria-live="polite">
            <h2>LivingDex could not finish loading</h2>
            <p>Please refresh the page or check your connection, then try again.</p>
          </section>
        `;
      }
      showToast("LivingDex startup encountered a loading problem.", "warning");
    }
  })();

  // Initialize PWA Service Worker & update lifecycle handlers
  window.addEventListener("load", () => {
    initPwa();
  });
}
