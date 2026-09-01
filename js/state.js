import { ACTIVE_GAME } from "./config.js";
import {
  loadCaughtSlots,
  saveCaughtSlots,
  loadShinyCaughtSlots,
  saveShinyCaughtSlots,
} from "./storage.js";
import { applyHideCaughtFilter } from "./ui/controls.js";
import {
  renderDexSectionBoxes,
  populateDexSlots,
  registerBoxControls,
} from "./ui/dom-render.js";

/**
 * Global state to track whether the user is viewing a shiny Pokédex or a normal Pokédex.
 * @type {boolean}
 */
export let isShinyMode = false;

/**
 * Update the active shiny mode state.
 *
 * @param {boolean} active - `true` to enable shiny mode, `false` for normal mode.
 * @returns {void}
 */
export function setShinyMode(active) {
  isShinyMode = active;
}

/**
 * Count how many slots in the living dex have been caught.
 * Reads caught data from either normal or shiny storage depending on the active shiny mode.
 *
 * @param {number} slotCount - The total number of living dex slots to evaluate.
 * @returns {number} The total count of caught slots.
 */
export function countCaughtSlots(slotCount) {
  const caught = isShinyMode ? loadShinyCaughtSlots() : loadCaughtSlots();
  let total = 0;
  for (let slot = 1; slot <= slotCount; slot += 1) {
    if (caught[slot]) total += 1;
  }
  return total;
}

/**
 * Update progress bar text, width, and page title to reflect the current caught total.
 * Calculates completion percentage and adjusts UI progress elements and document title.
 *
 * @param {number} slotCount - The total number of living dex slots.
 * @returns {void}
 */
export function updateProgressBar(slotCount) {
  const safeSlotCount =
    Number.isFinite(slotCount) && slotCount > 0 ? slotCount : 0;
  const caught = countCaughtSlots(safeSlotCount);
  const percentage =
    safeSlotCount > 0 ? Math.round((caught * 100) / safeSlotCount) : 0;
  const fill = document.getElementById("progressFill");
  const label = document.getElementById("progressText");
  if (fill) fill.style.width = `${percentage}%`;

  // Differentiate between shiny and normal dex in the progress label
  const modeText = isShinyMode ? "✨ Shiny caught" : "caught";
  if (label)
    label.textContent = `${caught}/${safeSlotCount} ${modeText} (${percentage}%)`;

  // Update the window title with an optional shiny indicator
  const titlePrefix = isShinyMode ? "✨ Shiny " : "";
  document.title = `${titlePrefix}${ACTIVE_GAME.title} — ${caught}/${safeSlotCount}`;
}

/**
 * Sync caught state to storage, UI, and filters.
 * Ensures consistency across all representations (local storage, DOM cell
 * classes/attributes, progress bar, and active visibility filters).
 *
 * @param {Record<number, boolean>} caught - Map of slot indices (1-based) to caught boolean flags.
 * @param {number} slotCount - Total number of living dex slots.
 * @returns {void}
 */
export function syncCaughtState(caught, slotCount) {
  if (!caught) return;

  // Route data to correct storage key based on shiny mode
  if (isShinyMode) {
    saveShinyCaughtSlots(caught);
  } else {
    saveCaughtSlots(caught);
  }

  // Update all cells in the UI to match caught state
  document.querySelectorAll(".cell:not(.is-placeholder)").forEach((cell) => {
    const slot = Number(cell.dataset.regional);
    const isCaught = !!caught[slot];
    cell.classList.toggle("caught", isCaught);
    cell.setAttribute("aria-pressed", String(isCaught));
  });

  updateProgressBar(slotCount);
  applyHideCaughtFilter();
}

/**
 * Clear all caught slots and reset progress to empty state.
 * Resets storage, removes caught styling and ARIA attributes from cells,
 * and clears any shared hash state from the URL.
 *
 * @param {number} slotCount - Total number of living dex slots to reset progress for.
 * @returns {void}
 */
export function resetDexProgress(slotCount) {
  const empty = {};
  saveCaughtSlots(empty);

  document.querySelectorAll(".cell").forEach((cell) => {
    cell.classList.remove("caught");
    cell.setAttribute("aria-pressed", "false");
  });

  // Clear shared hash state from URL
  if (location.hash) {
    history.replaceState(null, "", location.pathname + location.search);
  }

  updateProgressBar(slotCount);
  applyHideCaughtFilter();
}

/**
 * Rebuild the dex grid for the current game/segment selection.
 * Centralizes the app render flow so it can be reused across multiple actions
 * (e.g., initial load, segment toggle, game switch).
 *
 * @param {Object} params - The parameters for rebuilding the dex view.
 * @param {Array<{ key: string, title: string, entries: Array<{ speciesId: number, formId: number }>, startIndex?: number }>} params.sections - Array of Pokédex section definitions to render.
 * @param {number} params.slotCount - Total number of slots across all rendered sections.
 * @returns {void}
 */
export function rebuildDexView({ sections, slotCount, onComplete }) {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = "";
  if (!sections.length) {
    app.innerHTML = `
      <section class="box app-empty-state" role="status" aria-live="polite">
        <h2>Pokédex data unavailable</h2>
        <p>The dex could not be loaded yet. Please check your connection and try again.</p>
      </section>
    `;
    updateProgressBar(0);
    applyHideCaughtFilter();
    if (typeof onComplete === "function") onComplete();
    return;
  }

  let startGlobal = 1;
  for (const sec of sections) {
    renderDexSectionBoxes(
      app,
      sec.key,
      sec.title,
      sec.entries.length,
      startGlobal,
      sec.startIndex || 1,
    );
    startGlobal += sec.entries.length;
  }

  populateDexSlots(sections, slotCount, () => {
    registerBoxControls(slotCount);
    updateProgressBar(slotCount);
    applyHideCaughtFilter();
    if (typeof onComplete === "function") onComplete();
  });
  registerBoxControls(slotCount);
  updateProgressBar(slotCount);
  applyHideCaughtFilter();
}
