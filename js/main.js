import {
    buildActiveDexSections,
    loadSpeciesNames,
} from './api.js';

import {
    loadSettings,
  loadEnabledSegments,
} from './storage.js';

import {
    applyTheme,
    applyReducedMotionPreference,
    updateProgressBar,
    syncCaughtState,
    registerBoxControls,
    rebuildDexView,
    registerHeaderControls,
    registerScrollToTopButton,
    registerResetControls,
    registerSettingsControls,
    renderGameSelector,
    renderGameInfo,
    setGameTitles,
    decodeCaughtState,
    showToast,
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
  applyReducedMotionPreference(settings.reducedMotion);

  const app = document.getElementById('app');
  if (!app) return;
  
  // Compute active sections and combined order
  const sections = await buildActiveDexSections();
  const combinedSpeciesIds = sections.flatMap(s => s.entries.map(e => e.speciesId));
  LIVING_DEX_SPECIES_ORDER = combinedSpeciesIds;
  LIVING_DEX_SLOT_COUNT = combinedSpeciesIds.length;

  window.__livingDexNames = {};
  rebuildDexView({ sections, slotCount: LIVING_DEX_SLOT_COUNT });
  
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
  const getShareSegments = () => Array.from(loadEnabledSegments());
  const sharedState = decodeCaughtState(location.hash, LIVING_DEX_SLOT_COUNT, getShareSegments());
  if (sharedState && Object.keys(sharedState).length) {
    // Show shared link warning modal
    import('./ui.js').then(ui => {
      ui.showSharedLinkWarningModal(() => {
        syncCaughtState(sharedState, LIVING_DEX_SLOT_COUNT);
      });
    });
  } else if (/#s=/.test(location.hash)) {
    showToast('This shared link is for a different game or segment selection.', 'warning');
  }

  // Watch for hash changes (e.g., user clicking shared link)
  window.addEventListener('hashchange', () => {
    const activeSlotCount = document.querySelectorAll('.cell:not(.is-placeholder)').length || LIVING_DEX_SLOT_COUNT;
    const incomingState = decodeCaughtState(
      location.hash,
      activeSlotCount,
      getShareSegments(),
    );
    if (incomingState) {
      import('./ui.js').then(ui => {
        ui.showSharedLinkWarningModal(() => {
          syncCaughtState(incomingState, activeSlotCount);
        });
      });
    } else if (/#s=/.test(location.hash)) {
      showToast('This shared link is for a different game or segment selection.', 'warning');
    }
  });
}

/**
 * Bootstrap the application once the DOM is ready.
 */
(async function bootstrapLivingDex() {
  await initializeLivingDexApp();
})();