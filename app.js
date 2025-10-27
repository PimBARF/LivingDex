// =============================================================================
// CONFIGURATION & CONSTANTS
// =============================================================================

/**
 * Multi-Dex configuration object.
 * Each dex defines: title (display name), order (array of National Dex IDs),
 * slotCount (total slots), and storagePrefix (namespace for localStorage keys).
 */
const DEXES = {
  za: {
    title: 'Pokémon Legends: Z-A',
    order: [152,153,154,498,499,500,158,159,160,661,662,663,659,660,664,665,666,13,14,15,16,17,18,179,180,181,504,505,406,315,407,129,130,688,689,120,121,669,670,671,672,673,677,678,667,668,674,675,568,569,702,172,25,26,173,35,36,167,168,23,24,63,64,65,92,93,94,543,544,545,679,680,681,69,70,71,511,512,513,514,515,516,307,308,309,310,280,281,282,475,228,229,333,334,531,682,683,684,685,133,134,135,136,196,197,470,471,700,427,428,353,354,582,583,584,322,323,449,450,529,530,551,552,553,66,67,68,443,444,445,703,302,303,359,447,448,79,80,199,318,319,602,603,604,147,148,149,1,2,3,4,5,6,7,8,9,618,676,686,687,690,691,692,693,704,705,706,225,361,362,478,459,460,712,713,123,212,127,214,587,701,708,709,559,560,714,715,707,607,608,609,142,696,697,698,699,95,208,304,305,306,694,695,710,711,246,247,248,656,657,658,870,650,651,652,227,653,654,655,371,372,373,115,780,374,375,376,716,717,718],
    slotCount: 230,
    storagePrefix: 'za'
  },

  national: {
    title: 'National Dex',
    order: Array.from({ length: 1025 }, (_, i) => i + 1),
    slotCount: 1025,
    storagePrefix: 'national'
  }
};

/**
 * Determine active dex from URL parameter (?dex=za) or default to 'za'.
 * CONFIG holds the configuration for the currently active dex.
 */
const DEX_KEY = new URLSearchParams(location.search).get('dex') || 'za';
const CONFIG = DEXES[DEX_KEY] || DEXES.za;

// Derived constants from active config
const LIVING_DEX_SPECIES_ORDER = CONFIG.order;
const LIVING_DEX_SLOT_COUNT = CONFIG.slotCount;
const BOX_CAPACITY = 30;

// Storage and cache keys (namespaced per dex to avoid collisions)
const CAUGHT_STORAGE_KEY = `${CONFIG.storagePrefix}-caught-v1`;
const THEME_STORAGE_KEY = 'theme-v1';
const SPECIES_CACHE_KEY = `${CONFIG.storagePrefix}-species-names-v1`;
const SPECIES_CACHE_META_KEY = `${CONFIG.storagePrefix}-species-names-meta-v1`;
const SPECIES_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180 days

// API and UI constants
const NAME_FETCH_CONCURRENCY = 10;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Utility functions for sprite URLs and species name formatting
const spriteUrlForSpecies = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const normaliseSpeciesName = name => name.replace(/-/g, ' ').replace(/\b\w/g, value => value.toUpperCase());


// =============================================================================
// STORAGE & PERSISTENCE LAYER
// =============================================================================

/**
 * Load caught-slot data from localStorage.
 * Defaults to an empty object when nothing is stored yet.
 */
function loadCaughtSlots() {
  try {
    return JSON.parse(localStorage.getItem(CAUGHT_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Persist caught-slot data to localStorage.
 * Ignores quota errors to keep the UI responsive.
 */
function saveCaughtSlots(caught) {
  try {
    localStorage.setItem(CAUGHT_STORAGE_KEY, JSON.stringify(caught));
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Load species name cache from localStorage.
 */
function loadSpeciesCache() {
  try {
    return JSON.parse(localStorage.getItem(SPECIES_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Save species name cache to localStorage with metadata (timestamp, hash, version).
 */
function saveSpeciesCache(map) {
  try {
    localStorage.setItem(SPECIES_CACHE_KEY, JSON.stringify(map));
    localStorage.setItem(SPECIES_CACHE_META_KEY, JSON.stringify({
      ts: Date.now(),
      idsHash: hashIds(),
      version: 1,
    }));
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Read species cache metadata (timestamp, hash, version).
 */
function readSpeciesCacheMeta() {
  try {
    return JSON.parse(localStorage.getItem(SPECIES_CACHE_META_KEY) || '');
  } catch {
    return null;
  }
}

/**
 * Determine if the species cache is stale based on TTL and content hash.
 */
function isSpeciesCacheStale() {
  const meta = readSpeciesCacheMeta();
  if (!meta) return true;
  if ((Date.now() - (meta.ts || 0)) > SPECIES_CACHE_TTL_MS) return true;
  if (meta.idsHash !== hashIds()) return true;
  return false;
}

/**
 * Generate a stable hash of the unique species list.
 * Used to invalidate cache when the dex list changes.
 */
function hashIds() {
  const s = Array.from(new Set(LIVING_DEX_SPECIES_ORDER)).join(',');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return String(h);
}


// =============================================================================
// THEME & UI STATE MANAGEMENT
// =============================================================================

/**
 * Apply theme to the document and persist preference.
 * Updates theme toggle button text and HTML data attribute.
 */
function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  const button = document.getElementById('themeToggle');
  if (button) button.textContent = mode === 'light' ? '🌙' : '☀️';
}

/**
 * Toggle visibility of caught slots based on filter checkbox state.
 */
function applyUncaughtFilter() {
  const toggle = document.getElementById('toggleUncaught');
  const enabled = toggle?.checked;
  document.body.classList.toggle('hide-caught', !!enabled);
}

/**
 * Display a toast notification with automatic dismissal.
 * @param {string} message - The message to display
 * @param {string} type - The toast type: 'success', 'warning', or 'danger'
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}


// =============================================================================
// PROGRESS TRACKING & STATE SYNCHRONIZATION
// =============================================================================

/**
 * Count how many slots in the living dex have been caught.
 */
function countCaughtSlots() {
  const caught = loadCaughtSlots();
  let total = 0;
  for (let slot = 1; slot <= LIVING_DEX_SLOT_COUNT; slot += 1) {
    if (caught[slot]) total += 1;
  }
  return total;
}

/**
 * Update progress bar text, width, and page title to reflect current caught total.
 */
function updateProgressBar() {
  const caught = countCaughtSlots();
  const percentage = Math.round((caught * 100) / LIVING_DEX_SLOT_COUNT);
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('progressText');
  if (fill) fill.style.width = `${percentage}%`;
  if (label) label.textContent = `${caught}/${LIVING_DEX_SLOT_COUNT} caught (${percentage}%)`;
  document.title = `${CONFIG.title} — ${caught}/${LIVING_DEX_SLOT_COUNT}`;
}

/**
 * Sync caught state to storage, UI, and filters.
 * Ensures consistency across all representations.
 */
function syncCaughtState(caught) {
  if (!caught) return;
  saveCaughtSlots(caught);
  document.querySelectorAll('.cell').forEach(cell => {
    const slot = Number(cell.dataset.regional);
    const isCaught = !!caught[slot];
    cell.classList.toggle('caught', isCaught);
    cell.setAttribute('aria-pressed', String(isCaught));
  });
  updateProgressBar();
  applyUncaughtFilter();
}


// =============================================================================
// SHARING & ENCODING
// =============================================================================

/**
 * Encode caught state into a shareable URL hash using bitpacking.
 * Compact binary representation suitable for URL sharing.
 */
function encodeCaughtState(caught) {
  try {
    const bytes = new Uint8Array(Math.ceil(LIVING_DEX_SLOT_COUNT / 8));
    for (let slot = 1; slot <= LIVING_DEX_SLOT_COUNT; slot += 1) {
      if (caught[slot]) bytes[(slot - 1) >> 3] |= 1 << ((slot - 1) & 7);
    }
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return '#s=' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  } catch {
    return '';
  }
}

/**
 * Decode a share hash back into the caught-state map.
 * Reverses the bitpacking used in encodeCaughtState.
 */
function decodeCaughtState(hash) {
  try {
    const match = /#s=([^&]+)/.exec(hash);
    if (!match) return null;
    const base64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(decodeURIComponent(padded));
    const bytes = Uint8Array.from(decoded, value => value.charCodeAt(0));
    const caught = {};
    for (let slot = 1; slot <= LIVING_DEX_SLOT_COUNT; slot += 1) {
      caught[slot] = !!(bytes[(slot - 1) >> 3] & (1 << ((slot - 1) & 7)));
    }
    return caught;
  } catch {
    return null;
  }
}


// =============================================================================
// SPECIES DATA & API INTEGRATION
// =============================================================================

/**
 * Fetch English species name from PokeAPI.
 * Falls back to normalized default name if lookup fails.
 */
async function fetchSpeciesName(id) {
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  if (!response.ok) throw new Error('PokeAPI error');
  const payload = await response.json();
  return payload.names?.find(entry => entry.language?.name === 'en')?.name || normaliseSpeciesName(payload.name || '');
}

/**
 * Concurrency-limited map function for rate-limited API calls.
 * Distributes work across multiple workers to respect rate limits.
 */
async function mapWithConcurrency(list, task, { concurrency = 6 } = {}) {
  const results = new Array(list.length);
  let index = 0;
  async function worker() {
    while (index < list.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await task(list[currentIndex], currentIndex);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, list.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Download missing species names from PokeAPI with smart caching.
 * - Loads cached names immediately to reduce visual flicker
 * - Fetches only missing names with retries and concurrency control
 * - Merges results and updates cache for future sessions
 */
async function hydrateSpeciesNames() {
  const allIds = [...new Set(LIVING_DEX_SPECIES_ORDER)];
  let cache = loadSpeciesCache();

  // Discard stale cache (old TTL or dex list changed)
  if (isSpeciesCacheStale()) {
    cache = {};
  }

  // 1) Apply cached names immediately for fast visual feedback
  window.__livingDexNames = { ...(window.__livingDexNames || {}), ...cache };
  applyNamesToCells();

  // 2) Identify missing species names
  const missing = allIds.filter(id => !window.__livingDexNames[id]);

  if (missing.length === 0) {
    saveSpeciesCache(window.__livingDexNames);
    return;
  }

  // 3) Fetch missing names with retries and concurrency control
  const fresh = {};
  await mapWithConcurrency(missing, async id => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const name = await fetchSpeciesName(id);
        fresh[id] = name;
        return;
      } catch {
        // Exponential backoff before retry
        await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
      }
    }
    // Fallback keeps UI consistent if PokeAPI is unavailable
    fresh[id] = `#${id}`;
  }, { concurrency: NAME_FETCH_CONCURRENCY });

  // 4) Merge, persist, and refresh UI with newly fetched names
  window.__livingDexNames = { ...window.__livingDexNames, ...fresh };
  saveSpeciesCache(window.__livingDexNames);
  applyNamesToCells();
}

/**
 * Update species name display on all cells.
 * Applies names from window.__livingDexNames to cell labels and tooltips.
 */
function applyNamesToCells() {
  document.querySelectorAll('.cell').forEach(cell => {
    const national = Number(cell.dataset.national);
    const regional = Number(cell.dataset.regional);
    const name = window.__livingDexNames?.[national] || cell.dataset.name || `#${national}`;
    cell.dataset.name = String(name).toLowerCase();
    cell.title = `#${regional} — ${name} (${national})`;
    const label = cell.querySelector('.label');
    if (label) label.textContent = name;
  });
}


// =============================================================================
// DOM RENDERING & BOX MANAGEMENT
// =============================================================================

/**
 * Create shell sections that mirror in-game storage boxes.
 * Each box contains up to BOX_CAPACITY slots.
 */
function renderLivingDexBoxes(container) {
  const boxCount = Math.ceil(LIVING_DEX_SLOT_COUNT / BOX_CAPACITY);
  for (let boxIndex = 0; boxIndex < boxCount; boxIndex += 1) {
    const start = boxIndex * BOX_CAPACITY + 1;
    const end = Math.min((boxIndex + 1) * BOX_CAPACITY, LIVING_DEX_SLOT_COUNT);
    const section = document.createElement('section');
    section.className = 'box';
    section.innerHTML = `
      <h2>
        <span>Box ${boxIndex + 1} — #${start}–${end}</span>
        <span class="tools">
          <button class="btn box-catch" data-range="${start}-${end}">Mark all caught</button>
          <button class="btn box-clear" data-range="${start}-${end}">Clear box</button>
        </span>
      </h2>
      <div class="grid"></div>
    `;
    container.appendChild(section);
  }
}

/**
 * Generate an interactive cell representing a single dex slot.
 * Includes sprite, name label, and slot index.
 */
function createDexSlot(slotIndex, speciesId, name) {
  const button = document.createElement('button');
  button.className = 'cell';
  button.setAttribute('aria-pressed', 'false');
  button.dataset.regional = slotIndex;
  button.dataset.national = speciesId;
  button.dataset.name = name.toLowerCase();
  button.title = `#${slotIndex} — ${name} (${speciesId})`;
  button.innerHTML = `
    <div class="index">${slotIndex}</div>
    <img class="sprite" src="${spriteUrlForSpecies(speciesId)}" alt="${name}" loading="lazy" onerror="this.style.opacity=.2"/>
    <div class="label">${name}</div>
  `;
  return button;
}

/**
 * Populate all boxes with cells following the configured living dex order.
 * Applies caught state from storage and sets up click handlers.
 */
function populateDexSlots() {
  const caught = loadCaughtSlots();
  const grids = document.querySelectorAll('.box .grid');
  let slotIndex = 1;
  
  for (const species of LIVING_DEX_SPECIES_ORDER) {
    const speciesName = window.__livingDexNames?.[species] || `#${species}`;
    const cell = createDexSlot(slotIndex, species, speciesName);
    
    // Restore caught state from storage
    if (caught[slotIndex]) {
      cell.classList.add('caught');
      cell.setAttribute('aria-pressed', 'true');
    }
    
    // Add click handler for toggling caught state
    cell.onclick = () => {
      const nextCaught = loadCaughtSlots();
      const regionalSlot = Number(cell.dataset.regional);
      const isCaught = !cell.classList.contains('caught');
      cell.classList.toggle('caught', isCaught);
      cell.setAttribute('aria-pressed', String(isCaught));
      nextCaught[regionalSlot] = isCaught;
      saveCaughtSlots(nextCaught);
      updateProgressBar();
      applyUncaughtFilter();
    };
    
    const boxIndex = Math.floor((slotIndex - 1) / BOX_CAPACITY);
    grids[boxIndex].appendChild(cell);
    slotIndex += 1;
  }
}

/**
 * Register per-box controls (Mark all caught, Clear box).
 * These buttons enable bulk operations on entire boxes.
 */
function registerBoxActions() {
  document.querySelectorAll('.box').forEach(box => {
    const grid = box.querySelector('.grid');
    
    // Mark all caught button
    box.querySelector('.box-catch').onclick = () => {
      const caught = loadCaughtSlots();
      grid.querySelectorAll('.cell').forEach(cell => {
        cell.classList.add('caught');
        cell.setAttribute('aria-pressed', 'true');
        caught[Number(cell.dataset.regional)] = true;
      });
      saveCaughtSlots(caught);
      updateProgressBar();
      applyUncaughtFilter();
    };
    
    // Clear box button
    box.querySelector('.box-clear').onclick = () => {
      const caught = loadCaughtSlots();
      grid.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('caught');
        cell.setAttribute('aria-pressed', 'false');
        caught[Number(cell.dataset.regional)] = false;
      });
      saveCaughtSlots(caught);
      updateProgressBar();
      applyUncaughtFilter();
    };
  });
}


// =============================================================================
// HEADER CONTROLS & USER INTERACTIONS
// =============================================================================

/**
 * Apply search filter to cells based on query.
 * Supports searching by number (#42, 42) or by name.
 * Highlights matches and dims non-matches.
 */
function applySearchFilter(query) {
  const trimmed = query.trim().toLowerCase();
  const cells = [...document.querySelectorAll('.cell')];
  cells.forEach(cell => cell.classList.remove('highlight', 'dimmed'));
  
  if (!trimmed) return;
  
  let matches = [];
  
  // Match by number (regional or national ID)
  if (/^#?\d+$/.test(trimmed)) {
    const number = Number(trimmed.replace('#', ''));
    matches = cells.filter(cell => {
      const regional = Number(cell.dataset.regional) || NaN;
      const national = Number(cell.dataset.national) || NaN;
      const label = (cell.querySelector('.label')?.textContent || '').trim();
      return regional === number || national === number || label === `#${number}` || label === String(number);
    });
  } else {
    // Match by name
    matches = cells.filter(cell => {
      const name = cell.dataset.name || cell.querySelector('.label')?.textContent || '';
      return name.toLowerCase().includes(trimmed);
    });
  }
  
  if (matches.length) {
    const matchedCells = new Set(matches);
    cells.forEach(cell => {
      if (!matchedCells.has(cell)) cell.classList.add('dimmed');
    });
    matches.forEach(cell => cell.classList.add('highlight'));
    matches[0].scrollIntoView({ 
      behavior: prefersReduced ? 'auto' : 'smooth', 
      block: 'center' 
    });
  }
}

/**
 * Register all header control event listeners.
 * Includes: search, filter, theme toggle, and share button.
 */
function registerHeaderControls() {
  const searchInput = document.getElementById('search');
  const clearButton = document.getElementById('clearSearch');
  const uncaughtToggle = document.getElementById('toggleUncaught');
  const themeToggle = document.getElementById('themeToggle');
  const shareButton = document.getElementById('shareLink');

  // Search input
  searchInput?.addEventListener('input', event => applySearchFilter(event.target.value));
  
  // Clear search button
  clearButton?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    searchInput.focus();
    applySearchFilter('');
  });
  
  // Uncaught filter toggle
  uncaughtToggle?.addEventListener('change', applyUncaughtFilter);
  
  // Theme toggle
  themeToggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
  
  // Share button
  shareButton?.addEventListener('click', async () => {
    const url = location.origin + location.pathname + location.search + encodeCaughtState(loadCaughtSlots());
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard!', 'success');
    } catch {
      prompt('Copy this link:', url);
      showToast('Manual copy required.', 'warning');
    }
  });
}


// =============================================================================
// RESET & MODAL DIALOGS
// =============================================================================

/**
 * Clear all caught slots and reset progress to empty state.
 * Also clears any shared hash state from the URL.
 */
function resetProgress() {
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

  updateProgressBar();
  applyUncaughtFilter();
}

/**
 * Register reset confirmation modal with focus trap and keyboard navigation.
 * Supports: click confirm/cancel, Escape key, Tab focus wrapping.
 */
function registerResetControls() {
  const openBtn = document.getElementById('resetDex');
  const modal = document.getElementById('modalReset');
  const confirmBtn = document.getElementById('confirmReset');
  const cancelBtn = document.getElementById('cancelReset');
  const backdrop = modal?.querySelector('[data-close]');
  let lastFocus = null;

  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    confirmBtn?.focus();

    // Focus trap for Tab key
    function onKeydown(e) {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab') {
        const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { 
          last.focus(); 
          e.preventDefault(); 
        } else if (!e.shiftKey && document.activeElement === last) { 
          first.focus(); 
          e.preventDefault(); 
        }
      }
    }
    modal.addEventListener('keydown', onKeydown, { once: false });
    modal._cleanup = () => modal.removeEventListener('keydown', onKeydown);
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal._cleanup?.();
    lastFocus?.focus();
  }

  openBtn?.addEventListener('click', openModal);
  confirmBtn?.addEventListener('click', () => { 
    resetProgress(); 
    closeModal(); 
  });
  cancelBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
}


// =============================================================================
// PAGE INITIALIZATION & BOOTSTRAP
// =============================================================================

/**
 * Set page titles from active dex config.
 */
function setTitles() {
  const h1 = document.getElementById('pageTitle');
  const docTitle = document.getElementById('docTitle');
  if (h1) h1.textContent = CONFIG.title;
  if (docTitle) docTitle.textContent = CONFIG.title;
}

/**
 * Main initialization function.
 * Sets up UI, loads data, registers event listeners, and handles shared state.
 */
async function initializeLivingDex() {
  setTitles();
  applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'light');

  const app = document.getElementById('app');
  if (!app) return;

  // Render storage boxes
  renderLivingDexBoxes(app);
  window.__livingDexNames = {};
  
  // Populate cells and register box controls
  populateDexSlots();
  registerBoxActions();
  
  // Fetch and apply species names from cache or API
  await hydrateSpeciesNames();

  // Final sync of all cell names
  document.querySelectorAll('.cell').forEach(cell => {
    const national = Number(cell.dataset.national);
    const regional = Number(cell.dataset.regional);
    const name = window.__livingDexNames[national] || cell.dataset.name || `#${national}`;
    cell.dataset.name = name.toLowerCase();
    cell.title = `#${regional} — ${name} (${national})`;
    cell.querySelector('.label').textContent = name;
  });

  // Register header and reset controls
  registerHeaderControls();
  registerResetControls();
  
  // Trigger initial search if input has value
  const searchInput = document.getElementById('search');
  if (searchInput?.value) searchInput.dispatchEvent(new Event('input'));

  updateProgressBar();

  // Handle shared state from URL hash
  const sharedState = decodeCaughtState(location.hash);
  if (sharedState && Object.keys(sharedState).length) {
    if (confirm('Load caught data from this link? This replaces your current progress.')) {
      syncCaughtState(sharedState);
    }
  }

  // Watch for hash changes (e.g., user clicking shared link)
  window.addEventListener('hashchange', () => {
    const incomingState = decodeCaughtState(location.hash);
    if (incomingState) syncCaughtState(incomingState);
  });
}

/**
 * Self-check IIFE for regression testing.
 * Validates share encoding/decoding round-trips.
 */
(function runSelfCheck() {
  try {
    const empty = {};
    const full = {};
    for (let slot = 1; slot <= LIVING_DEX_SLOT_COUNT; slot += 1) full[slot] = true;
    const emptyRoundTrip = decodeCaughtState(encodeCaughtState(empty));
    const fullRoundTrip = decodeCaughtState(encodeCaughtState(full));
    console.assert(emptyRoundTrip && Object.values(emptyRoundTrip).every(value => !value), 'Empty state failed');
    console.assert(fullRoundTrip && Object.values(fullRoundTrip).every(value => value), 'Full state failed');
  } catch (error) {
    console.warn('Self-check warning:', error);
  }
})();

/**
 * Bootstrap the application once the DOM is ready.
 */
(async function bootstrapLivingDex() {
  await initializeLivingDex();
})();
