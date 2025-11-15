import {
    buildActiveDexSections,
    loadSpeciesNames,
} from './api.js';

import {
    loadSettings,
} from './storage.js';

import {
    applyTheme,
    updateProgressBar,
    syncCaughtState,
    registerBoxControls,
    renderDexSectionBoxes,
    populateDexSlots,
    registerHeaderControls,
    registerScrollToTopButton,
    registerResetControls,
    registerSettingsControls,
    renderGameSelector,
    renderGameInfo,
    setGameTitles,
    decodeCaughtState,
} from './ui.js';

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

  const app = document.getElementById('app');
  if (!app) return;
  
  // Compute active sections and combined order
  const sections = await buildActiveDexSections();
  const combinedSpeciesIds = sections.flatMap(s => s.entries.map(e => e.speciesId));
  LIVING_DEX_SPECIES_ORDER = combinedSpeciesIds;
  LIVING_DEX_SLOT_COUNT = combinedSpeciesIds.length;

  // Clear and render boxes per section
  app.innerHTML = '';
  window.__livingDexNames = {};
  let startGlobal = 1;
  for (const sec of sections) {
    renderDexSectionBoxes(app, sec.key, sec.title, sec.entries.length, startGlobal);
    startGlobal += sec.entries.length;
  }
  
  // Populate cells and register box controls
  populateDexSlots(sections, LIVING_DEX_SLOT_COUNT);
  registerBoxControls(LIVING_DEX_SLOT_COUNT);
  
  // Fetch and apply species names from cache or API
  await loadSpeciesNames(LIVING_DEX_SPECIES_ORDER);

  // Names are applied by loadSpeciesNames() as cache arrives and fetch completes

  // Register header and reset controls
  registerHeaderControls(LIVING_DEX_SLOT_COUNT);
  registerScrollToTopButton();
  registerResetControls(LIVING_DEX_SLOT_COUNT);
  registerSettingsControls();
  
  // Trigger initial search if input has value
  const searchInput = document.getElementById('search');
  if (searchInput?.value) searchInput.dispatchEvent(new Event('input'));

  updateProgressBar(LIVING_DEX_SLOT_COUNT);

  // Handle shared state from URL hash
  const sharedState = decodeCaughtState(location.hash, LIVING_DEX_SLOT_COUNT);
  if (sharedState && Object.keys(sharedState).length) {
    // Show shared link warning modal
    import('./ui.js').then(ui => {
      ui.showSharedLinkWarningModal(() => {
        syncCaughtState(sharedState, LIVING_DEX_SLOT_COUNT);
      });
    });
  }

  // Watch for hash changes (e.g., user clicking shared link)
  window.addEventListener('hashchange', () => {
    const incomingState = decodeCaughtState(location.hash, LIVING_DEX_SLOT_COUNT);
    if (incomingState) syncCaughtState(incomingState, LIVING_DEX_SLOT_COUNT);
  });
}

/**
 * Bootstrap the application once the DOM is ready.
 */
(async function bootstrapLivingDex() {
  await initializeLivingDexApp();
})();