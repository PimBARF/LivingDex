// =============================================================================
// CONFIGURATION & CONSTANTS
// =============================================================================

/**
 * Multi-Dex configuration object.
 * Each dex defines: title (display name), order (array of National Dex IDs),
 * slotCount (total slots), and storagePrefix (namespace for localStorage keys).
 */
const DEXES = {


  home: {
    title: 'Pokémon Home',
    storagePrefix: 'home',
    composite: true,
    segments: [
      { key: 'base', title: 'National Pokédex', pokedex: 1, kind: 'base', optional: false }
    ]
  },

  /**
   * Example composite dex for Pokémon Sword & Shield including DLC segments.
   * Each composite dex supplies a base segment (always enabled) plus optional segments.
   * segment.pokedex: PokeAPI pokedex id to pull ordering from.
   * segment.optional: If true can be toggled in settings (DLC / extras).
   * segment.kind: 'base' | 'dlc' | 'forms' – used for headings.
   * regionalForms: placeholder manual list for regional/variant forms not represented by separate Pokédex entries (kept empty initially).
   */
  swsh: {
    title: 'Sword / Shield',
    storagePrefix: 'swsh',
    composite: true,
    segments: [
      { key: 'base', title: 'Galar Pokédex', pokedex: 27, kind: 'base', optional: false }, // galar
      { key: 'armor', title: 'Isle of Armor', pokedex: 28, kind: 'dlc', optional: true }, // isle-of-armor
      { key: 'tundra', title: 'Crown Tundra', pokedex: 29, kind: 'dlc', optional: true }, // crown-tundra
      { key: 'forms', title: 'Other Regional Forms', kind: 'forms', optional: true, manualIds: [52, 77, 78, 79, 80, 83, 110, 122, 144, 145, 146, 199, 222, 263, 264, 554, 555, 562, 618] }
    ]
  },

  pla: {
    title: 'Legends: Arceus',
    storagePrefix: 'pla',
    composite: true,
    segments: [
      { key: 'base', title: 'Hisui Pokédex', pokedex: 30, kind: 'base', optional: false },
      { key: 'forms', title: 'Regional Forms', kind: 'forms', optional: true, manualIds: [] }
    ]
  },

  sv: {
    title: 'Scarlet / Violet',
    storagePrefix: 'sv',
    composite: true,
    segments: [
      { key: 'base', title: 'Paldea Pokédex', pokedex: 31, kind: 'base', optional: false },
      { key: 'forms', title: 'Regional Forms', kind: 'forms', optional: true, manualIds: [] }
    ]
  },

  za: {
    title: 'Pokémon Legends: Z-A',
    storagePrefix: 'za',
    composite: true,
    segments: [
      { key: 'base', title: 'Lumiose Pokédex', pokedex: 34, kind: 'base', optional: false }
    ]
  }
};

/**
 * Determine active dex from URL parameter (?dex=za) or default to 'home'.
 * CONFIG holds the configuration for the currently active dex.
 */
const DEX_KEY = new URLSearchParams(location.search).get('dex') || 'home';
const CONFIG = DEXES[DEX_KEY] || DEXES.home;

// Derived (set later after we load the Pokédex from API/localStorage)
let LIVING_DEX_SPECIES_ORDER = [];
let LIVING_DEX_SLOT_COUNT = 0;
const BOX_CAPACITY = 30;

// Storage and cache keys (namespaced per dex to avoid collisions)
const CAUGHT_STORAGE_KEY = `${CONFIG.storagePrefix}-caught-v1`;
const POKEDEX_CACHE_KEY = `${CONFIG.storagePrefix}-pokedex-v1`;
const SEGMENTS_STORAGE_KEY = `${CONFIG.storagePrefix}-segments-v1`;

const THEME_STORAGE_KEY = 'theme-v1';

const SPECIES_CACHE_KEY = `${CONFIG.storagePrefix}-species-names-v1`;
const SPECIES_CACHE_META_KEY = `${CONFIG.storagePrefix}-species-names-meta-v1`;
const SPECIES_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180 days

// API and UI constants
const NAME_FETCH_CONCURRENCY = 10;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Regional form mappings: species ID -> form ID for specific dexes
// Maps species to their regional form variants that should appear in regional dexes
const REGIONAL_FORM_MAPPINGS = {
  // Galar Pokédex (27) - Galarian forms
  27: {
    52: 10161,    // Meowth -> Galarian Meowth
    77: 10162,    // Ponyta -> Galarian Ponyta
    78: 10163,    // Rapidash -> Galarian Rapidash
    79: 10164,   // Slowpoke -> Galarian Slowpoke
    80: 10165,   // Slowbro -> Galarian Slowbro
    83: 10166,    // Farfetch'd -> Galarian Farfetch'd
    110: 10167,   // Weezing -> Galarian Weezing
    122: 10168,   // Mr. Mime -> Galarian Mr. Mime
    144: 10169,   // Articuno -> Galarian Articuno
    145: 10170,   // Zapdos -> Galarian Zapdos
    146: 10171,   // Moltres -> Galarian Moltres
    199: 10172,   // Slowking -> Galarian Slowking
    222: 10173,   // Corsola -> Galarian Corsola
    263: 10174,   // Zigzagoon -> Galarian Zigzagoon
    264: 10175,   // Linoone -> Galarian Linoone
    554: 10176,   // Darumaka -> Galarian Darumaka
    555: 10177,   // Darmanitan -> Galarian Darmanitan
    562: 10179,   // Yamask -> Galarian Yamask
    618: 10180    // Stunfisk -> Galarian Stunfisk
  },
  
  // Isle of Armor (28) - Galarian forms that appear in DLC
  28: {
    52: 10161,    // Meowth -> Galarian Meowth
    77: 10162,    // Ponyta -> Galarian Ponyta
    78: 10163,    // Rapidash -> Galarian Rapidash
    79: 10164,   // Slowpoke -> Galarian Slowpoke
    80: 10165,   // Slowbro -> Galarian Slowbro
    83: 10166,    // Farfetch'd -> Galarian Farfetch'd
    110: 10167,   // Weezing -> Galarian Weezing
    122: 10168,   // Mr. Mime -> Galarian Mr. Mime
    144: 10169,   // Articuno -> Galarian Articuno
    145: 10170,   // Zapdos -> Galarian Zapdos
    146: 10171,   // Moltres -> Galarian Moltres
    199: 10172,   // Slowking -> Galarian Slowking
    222: 10173,   // Corsola -> Galarian Corsola
    263: 10174,   // Zigzagoon -> Galarian Zigzagoon
    264: 10175,   // Linoone -> Galarian Linoone
    554: 10176,   // Darumaka -> Galarian Darumaka
    555: 10177,   // Darmanitan -> Galarian Darmanitan
    562: 10179,   // Yamask -> Galarian Yamask
    618: 10180    // Stunfisk -> Galarian Stunfisk
  },
  
  // Crown Tundra (29) - More Galarian forms
  29: {
    52: 10161,    // Meowth -> Galarian Meowth
    77: 10162,    // Ponyta -> Galarian Ponyta
    78: 10163,    // Rapidash -> Galarian Rapidash
    79: 10164,   // Slowpoke -> Galarian Slowpoke
    80: 10165,   // Slowbro -> Galarian Slowbro
    83: 10166,    // Farfetch'd -> Galarian Farfetch'd
    110: 10167,   // Weezing -> Galarian Weezing
    122: 10168,   // Mr. Mime -> Galarian Mr. Mime
    144: 10169,   // Articuno -> Galarian Articuno
    145: 10170,   // Zapdos -> Galarian Zapdos
    146: 10171,   // Moltres -> Galarian Moltres
    199: 10172,   // Slowking -> Galarian Slowking
    222: 10173,   // Corsola -> Galarian Corsola
    263: 10174,   // Zigzagoon -> Galarian Zigzagoon
    264: 10175,   // Linoone -> Galarian Linoone
    554: 10176,   // Darumaka -> Galarian Darumaka
    555: 10177,   // Darmanitan -> Galarian Darmanitan
    562: 10179,   // Yamask -> Galarian Yamask
    618: 10180    // Stunfisk -> Galarian Stunfisk
  },
  
  // Alola Pokédex (16/original-alola) - Alolan forms
  16: {
    19: 10091,    // Rattata -> Alolan Rattata
    20: 10092,    // Raticate -> Alolan Raticate
    26: 10100,    // Raichu -> Alolan Raichu
    27: 10101,    // Sandshrew -> Alolan Sandshrew
    28: 10102,    // Sandslash -> Alolan Sandslash
    37: 10103,    // Vulpix -> Alolan Vulpix
    38: 10104,    // Ninetales -> Alolan Ninetales
    50: 10105,    // Diglett -> Alolan Diglett
    51: 10106,    // Dugtrio -> Alolan Dugtrio
    52: 10107,    // Meowth -> Alolan Meowth
    53: 10108,    // Persian -> Alolan Persian
    74: 10109,    // Geodude -> Alolan Geodude
    75: 10110,    // Graveler -> Alolan Graveler
    76: 10111,    // Golem -> Alolan Golem
    88: 10112,    // Grimer -> Alolan Grimer
    89: 10113,    // Muk -> Alolan Muk
    103: 10114,   // Exeggutor -> Alolan Exeggutor
    105: 10115    // Marowak -> Alolan Marowak
  },
  
  // Hisui Pokédex (30/Legends Arceus) - Hisuian forms
  30: {
    58: 10229,    // Growlithe -> Hisuian Growlithe
    59: 10230,    // Arcanine -> Hisuian Arcanine
    100: 10231,   // Voltorb -> Hisuian Voltorb
    101: 10232,   // Electrode -> Hisuian Electrode
    157: 10233,   // Typhlosion -> Hisuian Typhlosion
    211: 10234,   // Qwilfish -> Hisuian Qwilfish
    215: 10235,   // Sneasel -> Hisuian Sneasel
    503: 10236,   // Samurott -> Hisuian Samurott
    549: 10237,   // Lilligant -> Hisuian Lilligant
    550: 10247,   // Basculin -> Hisuian Basculin (White-Striped)
    570: 10238,   // Zorua -> Hisuian Zorua
    571: 10239,   // Zoroark -> Hisuian Zoroark
    628: 10240,   // Braviary -> Hisuian Braviary
    705: 10241,   // Sliggoo -> Hisuian Sliggoo
    706: 10242,   // Goodra -> Hisuian Goodra
    713: 10243,   // Avalugg -> Hisuian Avalugg
    724: 10244    // Decidueye -> Hisuian Decidueye
  },
  
  // Paldea Pokédex (31/Scarlet & Violet) - Paldean forms
  31: {
    128: 10250,   // Tauros -> Paldean Tauros (Combat Breed)
    194: 10253    // Wooper -> Paldean Wooper
  }
};

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
  document.querySelectorAll('.cell:not(.is-placeholder)').forEach(cell => {
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
 * Load the Pokédex entry list (order) for the active dex.
 * - Uses localStorage cache to avoid hammering PokeAPI
 * - Falls back to live fetch when no cache is present
 * Returns: { entries: [{speciesId, formId}], slotCount: number }
 */
async function getOrFetchPokedex() {
  // 1) Try cache
  try {
    const cached = JSON.parse(localStorage.getItem(POKEDEX_CACHE_KEY) || '');
    if (cached && Array.isArray(cached.entries) && cached.entries.length) {
      return { entries: cached.entries, slotCount: cached.entries.length };
    }
  } catch { /* ignore */ }

  // 2) Fetch from PokeAPI
  const res = await fetch(`https://pokeapi.co/api/v2/pokedex/${CONFIG.pokedex}/`);
  if (!res.ok) throw new Error('Failed to load Pokédex from PokeAPI');
  const data = await res.json();

  // 3) Extract species ids and apply regional form mappings
  const pokemonEntries = (data.pokemon_entries || []).slice().sort((a, b) =>
    (a.entry_number || 0) - (b.entry_number || 0)
  );
  
  const regionalMappings = REGIONAL_FORM_MAPPINGS[CONFIG.pokedex] || {};
  
  const entries = pokemonEntries.map(e => {
    // species URL looks like .../pokemon-species/133/
    const m = /\/pokemon-species\/(\d+)\//.exec(e.pokemon_species?.url || '');
    if (!m) return null;
    const speciesId = Number(m[1]);
    const formId = regionalMappings[speciesId] || speciesId;
    return { speciesId, formId };
  }).filter(Boolean);

  // 4) Cache minimally
  try {
    localStorage.setItem(POKEDEX_CACHE_KEY, JSON.stringify({ entries }));
  } catch { /* ignore quota */ }

  return { entries, slotCount: entries.length };
}

/**
 * Fetch and cache a specific PokeAPI Pokédex by numeric id.
 * Uses a per-segment cache key to avoid collisions between games/segments.
 * Returns array of objects with { speciesId, formId } where formId is the 
 * regional variant if applicable, otherwise same as speciesId.
 */
async function getOrFetchPokedexById(pokedexId) {
  const cacheKey = `${CONFIG.storagePrefix}-pokedex-${pokedexId}-v2`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '');
    if (cached && Array.isArray(cached.entries) && cached.entries.length) {
      return cached.entries;
    }
  } catch { /* ignore */ }

  const res = await fetch(`https://pokeapi.co/api/v2/pokedex/${pokedexId}/`);
  if (!res.ok) throw new Error('Failed to load Pokédex from PokeAPI');
  const data = await res.json();
  const pokemonEntries = (data.pokemon_entries || []).slice().sort((a, b) => (a.entry_number || 0) - (b.entry_number || 0));
  
  // Apply regional form mappings if available for this dex
  const regionalMappings = REGIONAL_FORM_MAPPINGS[pokedexId] || {};
  
  const entries = pokemonEntries.map(e => {
    const m = /\/pokemon-species\/(\d+)\//.exec(e.pokemon_species?.url || '');
    if (!m) return null;
    const speciesId = Number(m[1]);
    // Check if this species has a regional form for this dex
    const formId = regionalMappings[speciesId] || speciesId;
    return { speciesId, formId };
  }).filter(Boolean);

  try { localStorage.setItem(cacheKey, JSON.stringify({ entries })); } catch { /* ignore */ }
  return entries;
}

/**
 * Read enabled segments setting for the current dex.
 * Returns a Set of enabled segment keys for composite dexes.
 */
function loadEnabledSegments() {
  try {
    const raw = localStorage.getItem(SEGMENTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return new Set(parsed.enabled || []);
  } catch { return null; }
}

function saveEnabledSegments(set) {
  try {
    localStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify({ enabled: Array.from(set) }));
  } catch { /* ignore */ }
}

/**
 * Compute active sections for current dex based on configuration and user settings.
 * Returns array of { key, title, kind, entries } in render order.
 * entries is array of { speciesId, formId }
 */
async function computeActiveSections() {
  if (!CONFIG.composite) {
    // Simple single-section dex
    const entries = await getOrFetchPokedexById(CONFIG.pokedex);
    return [{ key: 'base', title: CONFIG.title, kind: 'base', entries }];
  }
  const enabled = loadEnabledSegments() || new Set(CONFIG.segments.filter(s => !s.optional).map(s => s.key));

  const sections = [];
  for (const seg of CONFIG.segments) {
    const include = !seg.optional || enabled.has(seg.key);
    if (!include) continue;
    if (seg.manualIds) {
      // Convert manual species IDs to entry format
      const entries = seg.manualIds.map(speciesId => ({ speciesId, formId: speciesId }));
      if (entries.length) sections.push({ key: seg.key, title: seg.title, kind: seg.kind, entries });
    } else if (seg.pokedex) {
      const entries = await getOrFetchPokedexById(seg.pokedex);
      if (entries.length) sections.push({ key: seg.key, title: seg.title, kind: seg.kind, entries });
    }
  }
  return sections;
}

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
  document.querySelectorAll('.cell:not(.is-placeholder)').forEach(cell => {
    const national = Number(cell.dataset.national);
    const regional = Number(cell.dataset.regional);
    const name = window.__livingDexNames?.[national] || cell.dataset.name || `#${national}`;
    cell.dataset.name = String(name).toLowerCase();
    // Keep existing title format using the number shown in the badge
    const indexText = cell.querySelector('.index')?.textContent || String(regional);
    cell.title = `#${indexText} — ${name} (${national})`;
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
function renderLivingDexBoxesForSection(container, sectionKey, sectionTitle, slotsInSection, startGlobalSlot) {
  // Heading for section
  const heading = document.createElement('h2');
  heading.className = 'section-title';
  heading.textContent = sectionTitle;
  container.appendChild(heading);

  const boxCount = Math.ceil(slotsInSection / BOX_CAPACITY);
  for (let boxIndex = 0; boxIndex < boxCount; boxIndex += 1) {
    const localStart = boxIndex * BOX_CAPACITY + 1;
    const localEnd = Math.min((boxIndex + 1) * BOX_CAPACITY, slotsInSection);
    const globalStart = startGlobalSlot + boxIndex * BOX_CAPACITY;
    const globalEnd = Math.min(startGlobalSlot + localEnd - 1, startGlobalSlot + slotsInSection - 1);
    const section = document.createElement('section');
    section.className = 'box';
    section.dataset.section = sectionKey;
    section.innerHTML = `
      <h2>
        <span>${sectionTitle} — #${String(localStart).padStart(3, '0')}–${String(localEnd).padStart(3, '0')}</span>
        <span class="tools">
          <button class="btn box-toggle" data-range="${globalStart}-${globalEnd}"></button>
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
 * @param {number} slotIndex - Global slot index for storage
 * @param {number} speciesId - Species ID for name lookup
 * @param {number} formId - Form ID for sprite (may differ from speciesId for regional forms)
 * @param {string} name - Display name
 * @param {string} displayIndex - Formatted index to show in cell
 */
function createDexSlot(slotIndex, speciesId, formId, name, displayIndex) {
  const button = document.createElement('button');
  button.className = 'cell';
  button.setAttribute('aria-pressed', 'false');
  button.dataset.regional = slotIndex;
  button.dataset.national = speciesId;
  button.dataset.form = formId;
  button.dataset.name = name.toLowerCase();
  button.title = `#${displayIndex} — ${name} (${speciesId})`;
  button.innerHTML = `
    <div class="index">${displayIndex}</div>
    <img class="sprite" src="${spriteUrlForSpecies(formId)}" alt="${name}" loading="lazy" onerror="this.style.opacity=.2"/>
    <div class="label">${name}</div>
  `;
  return button;
}

/**
 * Populate all boxes with cells following the configured living dex order.
 * Applies caught state from storage and sets up click handlers.
 */
function populateDexSlots(sections) {
  const caught = loadCaughtSlots();
  let globalSlotIndex = 1; // continuous global slot numbering for storage

  sections.forEach(section => {
    const { key, entries } = section;
    // Select all grids for this section (in order)
    const sectionBoxes = Array.from(document.querySelectorAll(`.box[data-section='${key}'] .grid`));
    let localIndex = 0;
    let boxCursor = 0;
    let slotsPlacedInCurrentBox = 0;

    entries.forEach(entry => {
      const { speciesId, formId } = entry;
      const speciesName = window.__livingDexNames?.[speciesId] || `#${speciesId}`;
      const displayIndex = String(localIndex + 1).padStart(3, '0');
      const cell = createDexSlot(globalSlotIndex, speciesId, formId, speciesName, displayIndex);

      if (caught[globalSlotIndex]) {
        cell.classList.add('caught');
        cell.setAttribute('aria-pressed', 'true');
      }

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

      // Append to current box
      sectionBoxes[boxCursor]?.appendChild(cell);
      globalSlotIndex += 1;
      localIndex += 1;
      slotsPlacedInCurrentBox += 1;

      // Move to next box if capacity reached
      if (slotsPlacedInCurrentBox >= BOX_CAPACITY) {
        boxCursor += 1;
        slotsPlacedInCurrentBox = 0;
      }
    });

    // Fill remaining empty slots in the last partially filled box with placeholders
    while (slotsPlacedInCurrentBox > 0 && slotsPlacedInCurrentBox < BOX_CAPACITY) {
      const placeholder = document.createElement('div');
      placeholder.className = 'cell is-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.style.cursor = 'default';
      placeholder.innerHTML = `
        <div class="index">—</div>
        <div class="label">Empty</div>
      `;
      sectionBoxes[boxCursor]?.appendChild(placeholder);
      slotsPlacedInCurrentBox += 1;
    }
  });
}

/**
 * Register per-box controls (Mark all caught, Clear box).
 * These buttons enable bulk operations on entire boxes.
 */
function registerBoxActions() {
  document.querySelectorAll('.box').forEach(box => {
    const grid = box.querySelector('.grid');
    const toggleBtn = box.querySelector('.box-toggle');
    if (!toggleBtn) return;

    function interactiveCells() {
      return Array.from(grid.querySelectorAll('.cell:not(.is-placeholder)'));
    }

    function updateToggleBtnLabel() {
      const caught = loadCaughtSlots();
      const cells = interactiveCells();
      const allCaught = cells.every(cell => caught[Number(cell.dataset.regional)]);
      toggleBtn.textContent = allCaught ? 'Uncatch all' : 'Catch all';
      toggleBtn.setAttribute('aria-label', `${allCaught ? 'Mark all uncaught' : 'Mark all caught'} in this box`);
    }

    updateToggleBtnLabel();

    toggleBtn.onclick = () => {
      const caught = loadCaughtSlots();
      const cells = interactiveCells();
      const allCaught = cells.every(cell => caught[Number(cell.dataset.regional)]);
      cells.forEach(cell => {
        cell.classList.toggle('caught', !allCaught);
        cell.setAttribute('aria-pressed', String(!allCaught));
        caught[Number(cell.dataset.regional)] = !allCaught;
      });
      saveCaughtSlots(caught);
      updateProgressBar();
      applyUncaughtFilter();
      updateToggleBtnLabel();
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
  const cells = [...document.querySelectorAll('.cell:not(.is-placeholder)')];
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
  const shareButton = document.getElementById('shareDex');

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
 * Populate the game info section with title and segment toggles.
 */
function populateGameInfo() {
  const titleEl = document.getElementById('gameTitle');
  const togglesEl = document.getElementById('segmentToggles');
  
  if (titleEl) {
    titleEl.textContent = CONFIG.title;
  }
  
  if (!togglesEl) return;
  
  togglesEl.innerHTML = '';
  
  if (!CONFIG.composite) {
    // No segments to toggle for simple dexes
    return;
  }
  
  const enabled = loadEnabledSegments() || new Set(CONFIG.segments.filter(s => !s.optional).map(s => s.key));
  
  // Create checkboxes for optional segments
  CONFIG.segments.filter(s => s.optional).forEach(seg => {
    const id = `gameinfo-seg-${seg.key}`;
    const wrapper = document.createElement('label');
    wrapper.className = 'segment-toggle';
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.name = id;
    input.checked = enabled.has(seg.key);
    
    const text = document.createElement('span');
    text.textContent = (seg.kind === 'forms') ? 'Regional Forms & Variants' : seg.title;
    
    wrapper.appendChild(input);
    wrapper.appendChild(text);
    togglesEl.appendChild(wrapper);
    
    // Add event listener for live updates
    input.addEventListener('change', async () => {
      const currentEnabled = loadEnabledSegments() || new Set(CONFIG.segments.filter(s => !s.optional).map(s => s.key));
      
      if (input.checked) {
        currentEnabled.add(seg.key);
      } else {
        currentEnabled.delete(seg.key);
      }
      
      saveEnabledSegments(currentEnabled);
      
      // Rebuild UI with new sections
      const app = document.getElementById('app');
      if (app) {
        const sections = await computeActiveSections();
        const combinedSpeciesIds = sections.flatMap(s => s.entries.map(e => e.speciesId));
        LIVING_DEX_SPECIES_ORDER = combinedSpeciesIds;
        LIVING_DEX_SLOT_COUNT = combinedSpeciesIds.length;
        app.innerHTML = '';
        let startGlobal = 1;
        for (const sec of sections) {
          renderLivingDexBoxesForSection(app, sec.key, sec.title, sec.entries.length, startGlobal);
          startGlobal += sec.entries.length;
        }
        populateDexSlots(sections);
        registerBoxActions();
        await hydrateSpeciesNames();
        updateProgressBar();
        applyUncaughtFilter();
      }
    });
  });
}

/**
 * Settings modal for enabling/disabling optional segments (DLC, forms) per game.
 */
function registerSettingsControls() {
  const openBtn = document.getElementById('settingsBtn');
  const modal = document.getElementById('modalSettings');
  const backdrop = modal?.querySelector('[data-close]');
  const closeBtn = document.getElementById('closeSettings');
  let lastFocus = null;

  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    closeBtn?.focus();

    function onKeydown(e) {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab') {
        const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
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
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
}

/**
 * Populate the dex selector dropdown with available dexes.
 */
function populateDexSelector() {
  const selector = document.getElementById('dexSelector');
  if (!selector) return;
  
  selector.innerHTML = '';
  Object.entries(DEXES).forEach(([key, config]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = config.title;
    if (key === DEX_KEY) option.selected = true;
    selector.appendChild(option);
  });
  
  // Handle dex switching
  selector.addEventListener('change', (e) => {
    const newDex = e.target.value;
    if (newDex && newDex !== DEX_KEY) {
      // Redirect to new dex with URL parameter
      const url = new URL(location.href);
      url.searchParams.set('dex', newDex);
      url.hash = ''; // Clear any shared state
      location.href = url.toString();
    }
  });
}

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
  populateDexSelector();
  populateGameInfo();
  applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'light');

  const app = document.getElementById('app');
  if (!app) return;
  
  // Compute active sections and combined order
  const sections = await computeActiveSections();
  const combinedSpeciesIds = sections.flatMap(s => s.entries.map(e => e.speciesId));
  LIVING_DEX_SPECIES_ORDER = combinedSpeciesIds;
  LIVING_DEX_SLOT_COUNT = combinedSpeciesIds.length;

  // Clear and render boxes per section
  app.innerHTML = '';
  window.__livingDexNames = {};
  let startGlobal = 1;
  for (const sec of sections) {
    renderLivingDexBoxesForSection(app, sec.key, sec.title, sec.entries.length, startGlobal);
    startGlobal += sec.entries.length;
  }
  
  // Populate cells and register box controls
  populateDexSlots(sections);
  registerBoxActions();
  
  // Fetch and apply species names from cache or API
  await hydrateSpeciesNames();

  // Final sync of all cell names
  document.querySelectorAll('.cell:not(.is-placeholder)').forEach(cell => {
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
  registerSettingsControls();
  
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
 * Bootstrap the application once the DOM is ready.
 */
(async function bootstrapLivingDex() {
  await initializeLivingDex();
})();
