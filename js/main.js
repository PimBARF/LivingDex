import { buildActiveDexSections, loadSpeciesNames } from "./api.js";

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

// Derived (set later after we load the Pokédex from API/localStorage)
let LIVING_DEX_SPECIES_ORDER = [];
let LIVING_DEX_SLOT_COUNT = 0;

/**
 * Main initialization function.
 * Sets up UI, loads data, registers event listeners, and handles shared state.
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
 * Apply persisted view preferences that affect the rendered dex grid.
 * Keeps the hide-caught toggle and sprite style in sync with storage, and
 * refreshes localized names when the selected language changes.
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
 * Populate the game info section with title and segment toggles.
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
 * Populate the dex selector dropdown with available games.
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
 * Set page titles from active dex config.
 */
export function setGameTitles() {
  const docTitle = document.getElementById("docTitle");
  if (docTitle) docTitle.textContent = ACTIVE_GAME.title;
}

/**
 * Bootstrap the application once the DOM is ready.
 */
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

// Register Service Worker for PWA installability
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log(
          "ServiceWorker registration successful with scope: ",
          registration.scope,
        );
      })
      .catch((err) => {
        console.log("ServiceWorker registration failed: ", err);
      });
  });
}
