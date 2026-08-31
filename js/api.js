import {
  ACTIVE_GAME,
  NAME_FETCH_CONCURRENCY,
  SPECIES_CACHE_TTL_MS,
  REGIONAL_FORM_MAPPINGS,
  normalizeSpeciesName,
} from "./config.js";

import {
  loadSpeciesCache,
  saveSpeciesCache,
  readSpeciesCacheMeta,
  hashSpeciesIds,
  loadEnabledSegments,
  loadSettings,
} from "./storage.js";

import { applyNamesToCells } from "./ui/dom-render.js";

/**
 * @typedef {Object} PokedexEntry
 * @property {number} speciesId - The National Pokédex species ID.
 * @property {number} formId - The specific Pokémon form ID or variant ID (defaults to speciesId).
 */

/**
 * @typedef {Object} DexSection
 * @property {string} key - Unique identifier for the dex segment.
 * @property {string} title - Human-readable display title for the section.
 * @property {string} kind - Segment type (e.g. 'base', 'dlc', 'forms').
 * @property {PokedexEntry[]} entries - List of Pokédex entries in this section.
 * @property {number} startIndex - Starting box entry / index number for numbering offset.
 */

/**
 * @typedef {Object} SectionWarning
 * @property {string} segmentId - ID of the segment that failed to load.
 * @property {string} title - Title of the segment.
 * @property {string} error - Error message string describing the failure.
 */

/**
 * @typedef {Object} ActiveDexResult
 * @property {DexSection[]} sections - Array of resolved sections in display order.
 * @property {SectionWarning[]} warnings - Array of warning objects for sections that failed to load.
 */

/**
 * @typedef {Object} SpeciesNameLoadResult
 * @property {"missing" | "language" | "mismatch" | "stale" | "fresh"} cacheState - Cache validation status indicator.
 * @property {number[]} failedIds - Array of species/form IDs that could not be fetched.
 */

/**
 * @typedef {Object} PokeApiNameEntry
 * @property {string} name - The localized name.
 * @property {{ name: string, url: string }} language - Language metadata object.
 */

/**
 * @typedef {Object} PokeApiSpeciesPayload
 * @property {string} [name] - Fallback identifier name.
 * @property {PokeApiNameEntry[]} [names] - List of localized name entries.
 */

// Local cache for resolving pokemon (form) IDs -> species IDs
const POKEMON_TO_SPECIES_CACHE_KEY = `${ACTIVE_GAME.storagePrefix}-pokemon-to-species-v1`;
const NAME_FALLBACK_PREFIX = "Name unavailable";

/**
 * Validates whether a value is a positive integer (> 0).
 *
 * @param {*} value - The value to test.
 * @returns {boolean} `true` if the value is a positive integer, `false` otherwise.
 */
function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Sanitizes and deduplicates an array of species IDs, discarding any non-positive integers.
 *
 * @param {Array<number|string>|unknown} speciesOrder - Array of species IDs to normalize.
 * @returns {number[]} Deduplicated array of positive integer species IDs.
 */
function normalizeSpeciesOrder(speciesOrder) {
  return Array.from(
    new Set(
      (Array.isArray(speciesOrder) ? speciesOrder : [])
        .map(Number)
        .filter(isPositiveInteger),
    ),
  );
}

/**
 * Normalizes a raw species name cache object by ensuring keys are numeric
 * and values are non-empty trimmed strings.
 *
 * @param {Record<string|number, unknown>|null|undefined} rawCache - Raw cache object from storage.
 * @returns {Record<number, string>} Sanitized dictionary mapping positive species IDs to names.
 */
function normalizeSpeciesNameCache(rawCache) {
  if (!rawCache || typeof rawCache !== "object") return {};
  return Object.fromEntries(
    Object.entries(rawCache)
      .map(([key, value]) => [Number(key), value])
      .filter(
        ([id, value]) =>
          isPositiveInteger(id) &&
          typeof value === "string" &&
          value.trim().length > 0,
      ),
  );
}

/**
 * Normalizes a list of raw Pokédex entry objects, validating and casting IDs to positive integers.
 *
 * @param {Array<{ speciesId?: unknown, formId?: unknown }>|unknown} entries - Raw array of entry objects.
 * @returns {PokedexEntry[]} Validated Pokédex entry objects with positive integer IDs.
 */
function normalizePokedexEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => ({
      speciesId: Number(entry?.speciesId),
      formId: Number(entry?.formId ?? entry?.speciesId),
    }))
    .filter(
      (entry) =>
        isPositiveInteger(entry.speciesId) && isPositiveInteger(entry.formId),
    );
}

/**
 * Evaluates the current freshness and validity state of the persisted species name cache metadata.
 *
 * @param {number[]} speciesOrder - Ordered array of species IDs to validate against the cached hash.
 * @param {string} [language="en"] - Target language code to compare with the cached language.
 * @returns {"missing" | "language" | "mismatch" | "stale" | "fresh"} Cache state descriptor:
 *   - `"missing"`: No metadata found in storage.
 *   - `"language"`: Cached language differs from requested language.
 *   - `"mismatch"`: Cached ID hash does not match current species list hash.
 *   - `"stale"`: Cache exceeds time-to-live threshold.
 *   - `"fresh"`: Cache is valid, current, and matches the requested configuration.
 */
function getSpeciesCacheState(speciesOrder, language = "en") {
  const meta = readSpeciesCacheMeta();
  if (!meta) return "missing";
  if (meta.language !== language) return "language";
  if (meta.idsHash !== hashSpeciesIds(speciesOrder)) return "mismatch";
  if (Date.now() - (meta.ts || 0) > SPECIES_CACHE_TTL_MS) return "stale";
  return "fresh";
}

/**
 * Generates a fallback display string when a localized species name cannot be retrieved.
 *
 * @param {number|string} id - The species or form ID.
 * @returns {string} Fallback label formatted as "Name unavailable #<id>".
 */
function buildNameFallback(id) {
  return `${NAME_FALLBACK_PREFIX} #${id}`;
}

/**
 * Retrieves the local cache mapping Pokémon form resource IDs to base species IDs from localStorage.
 *
 * @returns {Record<number, number>} Map of Pokémon/form IDs to base species IDs.
 */
function loadPokemonToSpeciesMapCache() {
  try {
    const parsed =
      JSON.parse(localStorage.getItem(POKEMON_TO_SPECIES_CACHE_KEY) || "{}") ||
      {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [Number(key), Number(value)])
        .filter(
          ([key, value]) => isPositiveInteger(key) && isPositiveInteger(value),
        ),
    );
  } catch {
    return {};
  }
}

/**
 * Persists the Pokémon form ID to base species ID mapping dictionary into localStorage.
 *
 * @param {Record<number, number>} map - Map of Pokémon/form IDs to base species IDs.
 * @returns {void}
 */
function savePokemonToSpeciesMapCache(map) {
  try {
    localStorage.setItem(POKEMON_TO_SPECIES_CACHE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

/**
 * Resolves a Pokémon resource ID (which may represent a regional or special form) to its base species ID.
 * Queries PokeAPI `/pokemon/` or `/pokemon-form/` endpoints and utilizes a localStorage-backed cache to minimize API traffic.
 *
 * @param {number|string} pokemonId - Pokémon resource or form ID to resolve.
 * @returns {Promise<number>} Resolves to the base species ID.
 * @throws {Error} If species resolution fails across all lookup endpoints.
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
    const match = /\/pokemon-species\/(\d+)\//.exec(data.species?.url || "");
    if (match) {
      speciesId = Number(match[1]);
      break;
    }

    const nestedBase = data.pokemon?.url || "";
    const nestedMatch = /\/pokemon\/(\d+)\/$/.exec(nestedBase);
    if (!nestedMatch) continue;

    const nestedRes = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${nestedMatch[1]}`,
    );
    if (!nestedRes.ok) continue;

    const nestedData = await nestedRes.json();
    const nestedSpeciesMatch = /\/pokemon-species\/(\d+)\//.exec(
      nestedData.species?.url || "",
    );
    if (nestedSpeciesMatch) {
      speciesId = Number(nestedSpeciesMatch[1]);
      break;
    }
  }

  if (!speciesId) throw new Error("Failed to resolve species for pokemon");
  cache[key] = speciesId;
  savePokemonToSpeciesMapCache(cache);
  return speciesId;
}

/**
 * Fetches and caches Pokédex entries for a specific PokeAPI Pokédex by numeric ID.
 * Uses a per-segment cache key to avoid collisions between games and segments.
 * Applies regional form mappings configured for the Pokédex and returns an array of entry objects.
 *
 * @param {number|string} pokedexId - PokeAPI Pokédex ID.
 * @returns {Promise<PokedexEntry[]>} Array of Pokédex entry objects containing `speciesId` and `formId`.
 * @throws {Error} If the Pokédex cannot be fetched from PokeAPI.
 */
export async function loadPokedexEntries(pokedexId) {
  const cacheKey = `${ACTIVE_GAME.storagePrefix}-pokedex-${pokedexId}-v3`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "");
    const cachedEntries = normalizePokedexEntries(cached?.entries);
    if (cachedEntries.length) {
      return cachedEntries;
    }
  } catch {
    /* ignore */
  }

  const res = await fetch(`https://pokeapi.co/api/v2/pokedex/${pokedexId}/`);
  if (!res.ok) throw new Error("Failed to load Pokédex from PokeAPI");
  const data = await res.json();
  const pokemonEntries = (data.pokemon_entries || [])
    .slice()
    .sort((a, b) => (a.entry_number || 0) - (b.entry_number || 0));

  const regionalMappings = REGIONAL_FORM_MAPPINGS[pokedexId] || {};
  const entries = pokemonEntries
    .map((e) => {
      const m = /\/pokemon-species\/(\d+)\//.exec(e.pokemon_species?.url || "");
      if (!m) return null;
      const speciesId = Number(m[1]);
      const formId = regionalMappings[speciesId] || speciesId;
      return { speciesId, formId };
    })
    .filter(Boolean);

  try {
    localStorage.setItem(cacheKey, JSON.stringify({ entries }));
  } catch {
    /* ignore */
  }
  return entries;
}

/**
 * Computes active Pokédex sections for the currently selected game based on game configuration
 * and user-enabled segment settings.
 *
 * Handles both API-driven Pokédexes and manual ID lists (such as regional form and Gigantamax segments),
 * resolving form IDs to base species IDs where necessary.
 *
 * @returns {Promise<ActiveDexResult>} Object containing an array of active sections and any warnings encountered.
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
        if (seg.type === "forms") {
          const ids = seg.manualIds.slice();
          const resolved = await mapWithConcurrency(
            ids,
            async (pokemonId) => {
              try {
                const speciesId = await getSpeciesIdForPokemon(pokemonId);
                return { speciesId, formId: pokemonId };
              } catch {
                // Fallback: treat as species if resolution fails
                return { speciesId: pokemonId, formId: pokemonId };
              }
            },
            { concurrency: NAME_FETCH_CONCURRENCY },
          );
          entries = resolved.filter(Boolean);
        } else {
          entries = seg.manualIds.map((id) => ({ speciesId: id, formId: id }));
        }
        if (entries.length)
          sections.push({
            key: seg.id,
            title: seg.title,
            kind: seg.type,
            entries,
            startIndex: seg.startEntry || 1,
          });
      } else if (seg.pokedexId) {
        let entries = await loadPokedexEntries(seg.pokedexId);
        if (seg.startEntry && seg.endEntry) {
          entries = entries.slice(seg.startEntry - 1, seg.endEntry);
        }
        if (entries.length)
          sections.push({
            key: seg.id,
            title: seg.title,
            kind: seg.type,
            entries,
            startIndex: seg.startEntry || 1,
          });
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

/**
 * Extracts a localized species name from a PokeAPI species payload.
 * Attempts to match the requested language, falls back to English, and finally to normalized default name.
 *
 * @param {PokeApiSpeciesPayload} payload - PokeAPI pokemon-species response payload.
 * @param {string} language - Target language code (e.g., "en", "ja", "fr", "de").
 * @returns {string} The localized or fallback species name.
 */
function pickLocalizedSpeciesName(payload, language) {
  return (
    payload.names?.find((entry) => entry.language?.name === language)?.name ||
    payload.names?.find((entry) => entry.language?.name === "en")?.name ||
    normalizeSpeciesName(payload.name || "")
  );
}

/**
 * Fetches the localized species name for a given species or form ID from PokeAPI.
 * If direct species lookup fails, attempts resolving the ID as a Pokémon/form ID before fetching.
 * Falls back to English or normalized default name if the requested locale is unavailable.
 *
 * @param {number|string} id - Species or Pokémon form ID.
 * @param {string} [language="en"] - Target language code.
 * @returns {Promise<string>} Resolves with the localized species name.
 * @throws {Error} If the name cannot be resolved from PokeAPI.
 */
export async function fetchSpeciesName(id, language = "en") {
  // First try assuming the id is a species id
  let response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  if (response.ok) {
    const payload = await response.json();
    return pickLocalizedSpeciesName(payload, language);
  }
  // If that failed, it may be a pokemon (form) id; resolve to species id and retry
  try {
    const speciesId = await getSpeciesIdForPokemon(id);
    response = await fetch(
      `https://pokeapi.co/api/v2/pokemon-species/${speciesId}`,
    );
    if (!response.ok) throw new Error("PokeAPI error");
    const payload = await response.json();
    return pickLocalizedSpeciesName(payload, language);
  } catch {
    throw new Error("PokeAPI error");
  }
}

/**
 * Executes an asynchronous mapping task over an array with bounded concurrency.
 * Distributes work across multiple workers to respect API rate limits.
 *
 * @template T, R
 * @param {T[]} list - Items to process.
 * @param {function(T, number): Promise<R>} task - Async callback executed for each item with (item, index).
 * @param {Object} [options={}] - Configuration options.
 * @param {number} [options.concurrency=6] - Maximum number of concurrent tasks running simultaneously.
 * @returns {Promise<R[]>} Array of results maintaining the original order of `list`.
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
  const workers = Array.from(
    { length: Math.min(concurrency, list.length) },
    worker,
  );
  await Promise.all(workers);
  return results;
}

/**
 * Downloads missing species names from PokeAPI with multi-layer caching and progressive DOM updates.
 *
 * Workflow:
 * 1. Applies cached names immediately to the DOM to eliminate visual delay.
 * 2. Identifies missing species names based on cache validity and current configuration.
 * 3. Fetches missing names with exponential backoff retries and concurrency limiting.
 * 4. Persists the updated dictionary into localStorage and applies fallback labels for failed requests.
 *
 * @param {Array<number|string>} speciesOrder - Ordered array of species IDs to load names for.
 * @returns {Promise<SpeciesNameLoadResult>} Object containing cache validation state and list of failed IDs.
 */
export async function loadSpeciesNames(speciesOrder) {
  const allIds = normalizeSpeciesOrder(speciesOrder);
  const language = loadSettings().language || "en";
  const cacheState = getSpeciesCacheState(allIds, language);
  const rawCache = normalizeSpeciesNameCache(loadSpeciesCache());
  const canTrustCache = cacheState !== "language";
  const cache = canTrustCache ? rawCache : {};
  const shouldRefreshAll = cacheState !== "fresh";

  // 1) Apply cached names immediately for fast visual feedback
  window.__livingDexNames = { ...cache };
  applyNamesToCells();

  // 2) Identify missing species names
  const missing = shouldRefreshAll
    ? allIds
    : allIds.filter((id) => !window.__livingDexNames[id]);

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

  await mapWithConcurrency(
    missing,
    async (id) => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const name = await fetchSpeciesName(id, language);
          fresh[id] = name;
          window.__livingDexNames[id] = name;
          scheduleApplyNames();
          return;
        } catch (err) {
          // Exponential backoff before retry
          await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
        }
      }
      failedIds.push(id);
    },
    { concurrency: NAME_FETCH_CONCURRENCY },
  );

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
  const persistedNames = canTrustCache ? { ...cache, ...fresh } : { ...fresh };
  saveSpeciesCache(persistedNames, allIds, language);
  applyNamesToCells();
  return { cacheState, failedIds };
}

