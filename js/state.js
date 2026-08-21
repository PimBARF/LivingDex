import { ACTIVE_GAME } from './config.js';
import { loadCaughtSlots, saveCaughtSlots } from './storage.js';
import { applyHideCaughtFilter } from './ui/controls.js';
import { renderDexSectionBoxes, populateDexSlots, registerBoxControls } from './ui/dom-render.js';

/**
 * Count how many slots in the living dex have been caught.
 */
export function countCaughtSlots(slotCount) {
  const caught = loadCaughtSlots();
  let total = 0;
  for (let slot = 1; slot <= slotCount; slot += 1) {
    if (caught[slot]) total += 1;
  }
  return total;
}

/**
 * Update progress bar text, width, and page title to reflect current caught total.
 */
export function updateProgressBar(slotCount) {
  const safeSlotCount = Number.isFinite(slotCount) && slotCount > 0 ? slotCount : 0;
  const caught = countCaughtSlots(safeSlotCount);
  const percentage = safeSlotCount > 0 ? Math.round((caught * 100) / safeSlotCount) : 0;
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('progressText');
  if (fill) fill.style.width = `${percentage}%`;
  if (label) label.textContent = `${caught}/${safeSlotCount} caught (${percentage}%)`;
  document.title = `${ACTIVE_GAME.title} — ${caught}/${safeSlotCount}`;
}

/**
 * Sync caught state to storage, UI, and filters.
 * Ensures consistency across all representations.
 */
export function syncCaughtState(caught, slotCount) {
  if (!caught) return;
  saveCaughtSlots(caught);
  document.querySelectorAll('.cell:not(.is-placeholder)').forEach(cell => {
    const slot = Number(cell.dataset.regional);
    const isCaught = !!caught[slot];
    cell.classList.toggle('caught', isCaught);
    cell.setAttribute('aria-pressed', String(isCaught));
  });
  updateProgressBar(slotCount);
  applyHideCaughtFilter();
}

/**
 * Clear all caught slots and reset progress to empty state.
 * Also clears any shared hash state from the URL.
 */
export function resetDexProgress(slotCount) {
  const empty = {};
  saveCaughtSlots(empty);

  document.querySelectorAll('.cell').forEach(cell => {
    cell.classList.remove('caught');
    cell.setAttribute('aria-pressed', 'false');
  });

  // Clear shared hash state from URL
  if (location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
  }

  updateProgressBar(slotCount);
  applyHideCaughtFilter();
}

/**
 * Rebuild the dex grid for the current game/segment selection.
 * Centralizes the app render flow so it can be reused in multiple actions.
 */
export function rebuildDexView({ sections, slotCount }) {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = '';
  if (!sections.length) {
    app.innerHTML = `
      <section class="box app-empty-state" role="status" aria-live="polite">
        <h2>Pokédex data unavailable</h2>
        <p>The dex could not be loaded yet. Please check your connection and try again.</p>
      </section>
    `;
    updateProgressBar(0);
    applyHideCaughtFilter();
    return;
  }

  let startGlobal = 1;
  for (const sec of sections) {
    renderDexSectionBoxes(app, sec.key, sec.title, sec.entries.length, startGlobal);
    startGlobal += sec.entries.length;
  }

  populateDexSlots(sections, slotCount);
  registerBoxControls(slotCount);
  updateProgressBar(slotCount);
  applyHideCaughtFilter();
}