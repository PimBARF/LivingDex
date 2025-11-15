import {
  ACTIVE_GAME,
  REGIONAL_FORM_MAPPINGS,
  NAME_FETCH_CONCURRENCY,
  normalizeSpeciesName,
} from './config.js';

import {
    loadSpeciesCache,
    saveSpeciesCache,
    isSpeciesCacheStale,
    loadEnabledSegments,
} from './storage.js';

import { applyNamesToCells } from './ui.js'; // CHANGE THIS LATER!

// Local cache for resolving pokemon (form) IDs -> species IDs
const POKEMON_TO_SPECIES_CACHE_KEY = `${ACTIVE_GAME.storagePrefix}-pokemon-to-species-v1`;

function loadPokemonToSpeciesMapCache() {
  try { return JSON.parse(localStorage.getItem(POKEMON_TO_SPECIES_CACHE_KEY) || '{}') || {}; }
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
async function geSpeciesIdForPokemon(pokemonId) {
  const cache = loadPokemonToSpeciesMapCache();
  const key = String(pokemonId);
  if (cache[key]) return cache[key];

  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
  if (!res.ok) throw new Error('Failed to resolve species for pokemon');
  const data = await res.json();
  const m = /\/pokemon-species\/(\d+)\//.exec(data.species?.url || '');
  const speciesId = m ? Number(m[1]) : null;
  if (!speciesId) throw new Error('Malformed pokemon species URL');
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
  const cacheKey = `${ACTIVE_GAME.storagePrefix}-pokedex-${pokedexId}-v2`;
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
 * Compute active sections for current dex based on configuration and user settings.
 * Returns array of { key, title, kind, entries } in render order.
 * entries is array of { speciesId, formId }
 */
export async function buildActiveDexSections() {
  const enabled = loadEnabledSegments() || new Set(ACTIVE_GAME.dexes.filter(s => !s.optional).map(s => s.id));

  const sections = [];
  for (const seg of ACTIVE_GAME.dexes) {
    const include = !seg.optional || enabled.has(seg.id);
    if (!include) continue;
    if (seg.manualIds) {
      // For manual lists:
      // - forms segments provide pokemon (form) IDs; resolve their base species IDs for naming
      // - any other manual segment is treated as species IDs directly
      let entries = [];
      if (seg.type === 'forms') {
        const ids = seg.manualIds.slice();
        const resolved = await mapWithConcurrency(ids, async (pokemonId) => {
          try {
            const speciesId = await geSpeciesIdForPokemon(pokemonId);
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
  }
  return sections;
}

/**
 * Fetch English species name from PokeAPI.
 * Falls back to normalized default name if lookup fails.
 */
export async function fetchSpeciesName(id) {
  // First try assuming the id is a species id
  let response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  if (response.ok) {
    const payload = await response.json();
    return payload.names?.find(entry => entry.language?.name === 'en')?.name || normalizeSpeciesName(payload.name || '');
  }
  // If that failed, it may be a pokemon (form) id; resolve to species id and retry
  try {
    const speciesId = await geSpeciesIdForPokemon(id);
    response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`);
    if (!response.ok) throw new Error('PokeAPI error');
    const payload = await response.json();
    return payload.names?.find(entry => entry.language?.name === 'en')?.name || normalizeSpeciesName(payload.name || '');
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
  const allIds = [...new Set(speciesOrder)];
  let cache = loadSpeciesCache();

  // Discard stale cache (old TTL or dex list changed)
  if (isSpeciesCacheStale(speciesOrder)) {
    cache = {};
  }

  // 1) Apply cached names immediately for fast visual feedback
  window.__livingDexNames = { ...(window.__livingDexNames || {}), ...cache };
  applyNamesToCells();

  // 2) Identify missing species names
  const missing = allIds.filter(id => !window.__livingDexNames[id]);

  if (missing.length === 0) {
    saveSpeciesCache(window.__livingDexNames, speciesOrder);
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
  saveSpeciesCache(window.__livingDexNames, speciesOrder);
  applyNamesToCells();
}