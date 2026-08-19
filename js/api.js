import {
  ACTIVE_GAME,
  NAME_FETCH_CONCURRENCY,
  SPECIES_CACHE_TTL_MS,
  REGIONAL_FORM_MAPPINGS,
  normalizeSpeciesName,
} from './config.js';

import {
    loadSpeciesCache,
    saveSpeciesCache,
    readSpeciesCacheMeta,
    hashSpeciesIds,
    loadEnabledSegments,
    loadSettings,
} from './storage.js';

import { applyNamesToCells } from './ui.js'; // CHANGE THIS LATER!

// Local cache for resolving pokemon (form) IDs -> species IDs
const POKEMON_TO_SPECIES_CACHE_KEY = `${ACTIVE_GAME.storagePrefix}-pokemon-to-species-v1`;
const NAME_FALLBACK_PREFIX = 'Name unavailable';

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function normalizeSpeciesOrder(speciesOrder) {
  return Array.from(new Set((Array.isArray(speciesOrder) ? speciesOrder : [])
    .map(Number)
    .filter(isPositiveInteger)));
}

function normalizeSpeciesNameCache(rawCache) {
  if (!rawCache || typeof rawCache !== 'object') return {};
  return Object.fromEntries(
    Object.entries(rawCache)
      .map(([key, value]) => [Number(key), value])
      .filter(([id, value]) => isPositiveInteger(id) && typeof value === 'string' && value.trim().length > 0),
  );
}

function normalizePokedexEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map(entry => ({
      speciesId: Number(entry?.speciesId),
      formId: Number(entry?.formId ?? entry?.speciesId),
    }))
    .filter(entry => isPositiveInteger(entry.speciesId) && isPositiveInteger(entry.formId));
}

function getSpeciesCacheState(speciesOrder, language = 'en') {
  const meta = readSpeciesCacheMeta();
  if (!meta) return 'missing';
  if (meta.language !== language) return 'language';
  if (meta.idsHash !== hashSpeciesIds(speciesOrder)) return 'mismatch';
  if ((Date.now() - (meta.ts || 0)) > SPECIES_CACHE_TTL_MS) return 'stale';
  return 'fresh';
}

function buildNameFallback(id) {
  return `${NAME_FALLBACK_PREFIX} #${id}`;
}

function loadPokemonToSpeciesMapCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(POKEMON_TO_SPECIES_CACHE_KEY) || '{}') || {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [Number(key), Number(value)])
        .filter(([key, value]) => isPositiveInteger(key) && isPositiveInteger(value)),
    );
  }
  catch { return {}; }
}

function savePokemonToSpeciesMapCache(map) {
  try { localStorage.setItem(POKEMON_TO_SPECIES_CACHE_KEY, JSON.stringify(map)); }
  catch { /* ignore quota */ }
}

/**
 * Resolve a pokemon resource id (which may represent a regional form) to its base species id.
 * Uses localStorage-backed cache to minimize API traffic.
 */
async function getSpeciesIdForPokemon(pokemonId) {
  const cache = loadPokemonToSpeciesMapCache();
  const key = String(pokemonId);
  if (isPositiveInteger(cache[key])) return cache[key];

  let speciesId = null;
  const endpoints = [
    `https://pokeapi.co/api/v2/pokemon/${pokemonId}`,
    `https://pokeapi.co/api/v2/pokemon-form/${pokemonId}`,
  ];

  for (const url of endpoints) {
    const res = await fetch(url);
    if (!res.ok) continue;

    const data = await res.json();
    const match = /\/pokemon-species\/(\d+)\//.exec(data.species?.url || '');
    if (match) {
      speciesId = Number(match[1]);
      break;
    }

    const nestedBase = data.pokemon?.url || '';
    const nestedMatch = /\/pokemon\/(\d+)\/$/.exec(nestedBase);
    if (!nestedMatch) continue;

    const nestedRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${nestedMatch[1]}`);
    if (!nestedRes.ok) continue;

    const nestedData = await nestedRes.json();
    const nestedSpeciesMatch = /\/pokemon-species\/(\d+)\//.exec(nestedData.species?.url || '');
    if (nestedSpeciesMatch) {
      speciesId = Number(nestedSpeciesMatch[1]);
      break;
    }
  }

  if (!speciesId) throw new Error('Failed to resolve species for pokemon');
  cache[key] = speciesId;
  savePokemonToSpeciesMapCache(cache);
  return speciesId;
}

/**
 * Fetch and cache a specific PokeAPI Pokédex by numeric id.
 * Uses a per-segment cache key to avoid collisions between games/segments.
 * Returns array of objects with { speciesId, formId } where formId is the 
 * regional variant if applicable, otherwise same as speciesId.
 */
export async function loadPokedexEntries(pokedexId) {
  const cacheKey = `${ACTIVE_GAME.storagePrefix}-pokedex-${pokedexId}-v3`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '');
    const cachedEntries = normalizePokedexEntries(cached?.entries);
    if (cachedEntries.length) {
      return cachedEntries;
    }
  } catch { /* ignore */ }

  const res = await fetch(`https://pokeapi.co/api/v2/pokedex/${pokedexId}/`);
  if (!res.ok) throw new Error('Failed to load Pokédex from PokeAPI');
  const data = await res.json();
  const pokemonEntries = (data.pokemon_entries || []).slice().sort((a, b) => (a.entry_number || 0) - (b.entry_number || 0));

  const regionalMappings = REGIONAL_FORM_MAPPINGS[pokedexId] || {};
  const entries = pokemonEntries.map(e => {
    const m = /\/pokemon-species\/(\d+)\//.exec(e.pokemon_species?.url || '');
    if (!m) return null;
    const speciesId = Number(m[1]);
    const formId = regionalMappings[speciesId] || speciesId;
    return { speciesId, formId };
  }).filter(Boolean);

  try { localStorage.setItem(cacheKey, JSON.stringify({ entries })); } catch { /* ignore */ }
  return entries;
}

/**
 * Compute active sections for current dex based on configuration and user settings.
 * Returns { sections, warnings } where sections is an array of
 * { key, title, kind, entries } in render order.
 */
export async function buildActiveDexSections() {
  const enabled = loadEnabledSegments();

  const sections = [];
  const warnings = [];
  for (const seg of ACTIVE_GAME.dexes) {
    const include = !seg.optional || enabled.has(seg.id);
    if (!include) continue;
    try {
      if (seg.manualIds) {
        // For manual lists:
        // - forms segments provide pokemon (form) IDs; resolve their base species IDs for naming
        // - any other manual segment is treated as species IDs directly
        let entries = [];
        if (seg.type === 'forms') {
          const ids = seg.manualIds.slice();
          const resolved = await mapWithConcurrency(ids, async (pokemonId) => {
            try {
              const speciesId = await getSpeciesIdForPokemon(pokemonId);
              return { speciesId, formId: pokemonId };
            } catch {
              // Fallback: treat as species if resolution fails
              return { speciesId: pokemonId, formId: pokemonId };
            }
          }, { concurrency: NAME_FETCH_CONCURRENCY });
          entries = resolved.filter(Boolean);
        } else {
          entries = seg.manualIds.map(id => ({ speciesId: id, formId: id }));
        }
        if (entries.length) sections.push({ key: seg.id, title: seg.title, kind: seg.type, entries });
      } else if (seg.pokedexId) {
        const entries = await loadPokedexEntries(seg.pokedexId);
        if (entries.length) sections.push({ key: seg.id, title: seg.title, kind: seg.type, entries });
      }
    } catch (err) {
      warnings.push({
        segmentId: seg.id,
        title: seg.title,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { sections, warnings };
}

function pickLocalizedSpeciesName(payload, language) {
  return payload.names?.find(entry => entry.language?.name === language)?.name
    || payload.names?.find(entry => entry.language?.name === 'en')?.name
    || normalizeSpeciesName(payload.name || '');
}

/**
 * Fetch a localized species name from PokeAPI.
 * Falls back to English/default name if the requested locale is unavailable.
 */
export async function fetchSpeciesName(id, language = 'en') {
  // First try assuming the id is a species id
  let response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  if (response.ok) {
    const payload = await response.json();
    return pickLocalizedSpeciesName(payload, language);
  }
  // If that failed, it may be a pokemon (form) id; resolve to species id and retry
  try {
    const speciesId = await getSpeciesIdForPokemon(id);
    response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`);
    if (!response.ok) throw new Error('PokeAPI error');
    const payload = await response.json();
    return pickLocalizedSpeciesName(payload, language);
  } catch {
    throw new Error('PokeAPI error');
  }
}

/**
 * Concurrency-limited map function for rate-limited API calls.
 * Distributes work across multiple workers to respect rate limits.
 */
export async function mapWithConcurrency(list, task, { concurrency = 6 } = {}) {
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
export async function loadSpeciesNames(speciesOrder) {
  const allIds = normalizeSpeciesOrder(speciesOrder);
  const language = loadSettings().language || 'en';
  const cacheState = getSpeciesCacheState(allIds, language);
  const rawCache = normalizeSpeciesNameCache(loadSpeciesCache());
  const canTrustCache = cacheState !== 'language';
  const cache = canTrustCache ? rawCache : {};
  const shouldRefreshAll = cacheState !== 'fresh';

  // 1) Apply cached names immediately for fast visual feedback
  window.__livingDexNames = { ...cache };
  applyNamesToCells();

  // 2) Identify missing species names
  const missing = shouldRefreshAll
    ? allIds
    : allIds.filter(id => !window.__livingDexNames[id]);

  if (missing.length === 0) {
    saveSpeciesCache(window.__livingDexNames, allIds, language);
    return { cacheState, failedIds: [] };
  }

  // 3) Fetch missing names with retries and concurrency control
  const fresh = {};
  const failedIds = [];

  // Debounced applyNamesToCells to avoid thrashing the DOM per individual fetch
  let applyNamesTimer = null;
  const scheduleApplyNames = () => {
    if (applyNamesTimer !== null) return;
    applyNamesTimer = setTimeout(() => {
      applyNamesTimer = null;
      applyNamesToCells();
    }, 50);
  };

  await mapWithConcurrency(missing, async id => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const name = await fetchSpeciesName(id, language);
        fresh[id] = name;
        window.__livingDexNames[id] = name;
        scheduleApplyNames();
        return;
      } catch (err) {
        // Exponential backoff before retry
        await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
      }
    }
    failedIds.push(id);
  }, { concurrency: NAME_FETCH_CONCURRENCY });

  // Flush any pending debounced update
  if (applyNamesTimer !== null) {
    clearTimeout(applyNamesTimer);
    applyNamesTimer = null;
  }

  // 4) Persist and apply any remaining fallback names for failed fetches
  window.__livingDexNames = { ...window.__livingDexNames, ...fresh };
  for (const id of failedIds) {
    if (!window.__livingDexNames[id]) {
      window.__livingDexNames[id] = buildNameFallback(id);
    }
  }
  const persistedNames = canTrustCache
    ? { ...cache, ...fresh }
    : { ...fresh };
  saveSpeciesCache(persistedNames, allIds, language);
  applyNamesToCells();
  return { cacheState, failedIds };
}