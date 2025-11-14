import {
    CAUGHT_STORAGE_KEY,
    SEGMENTS_STORAGE_KEY,
    SPECIES_CACHE_KEY,
    SPECIES_CACHE_META_KEY,
    SPECIES_CACHE_TTL_MS,
} from './config.js';

/**
 * Load caught-slot data from localStorage.
 * Defaults to an empty object when nothing is stored yet.
 */
export function loadCaughtSlots() {
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
export function saveCaughtSlots(caught) {
  try {
    localStorage.setItem(CAUGHT_STORAGE_KEY, JSON.stringify(caught));
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Load species name cache from localStorage.
 */
export function loadSpeciesCache() {
  try {
    return JSON.parse(localStorage.getItem(SPECIES_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Save species name cache to localStorage with metadata (timestamp, hash, version).
 */
export function saveSpeciesCache(map, speciesOrder) {
  try {
    localStorage.setItem(SPECIES_CACHE_KEY, JSON.stringify(map));
    localStorage.setItem(SPECIES_CACHE_META_KEY, JSON.stringify({
      ts: Date.now(),
      idsHash: hashIds(speciesOrder),
      version: 1,
    }));
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Read species cache metadata (timestamp, hash, version).
 */
export function readSpeciesCacheMeta() {
  try {
    return JSON.parse(localStorage.getItem(SPECIES_CACHE_META_KEY) || '');
  } catch {
    return null;
  }
}

/**
 * Determine if the species cache is stale based on TTL and content hash.
 */
export function isSpeciesCacheStale(speciesOrder) {
  const meta = readSpeciesCacheMeta();
  if (!meta) return true;
  if ((Date.now() - (meta.ts || 0)) > SPECIES_CACHE_TTL_MS) return true;
  if (meta.idsHash !== hashIds(speciesOrder)) return true;
  return false;
}

/**
 * Generate a stable hash of the unique species list.
 * Used to invalidate cache when the dex list changes.
 */
export function hashIds(speciesOrder) {
  const s = Array.from(new Set(speciesOrder)).join(',');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return String(h);
}

/**
 * Read enabled segments setting for the current dex.
 * Returns a Set of enabled segment keys.
 */
export function loadEnabledSegments() {
  try {
    const raw = localStorage.getItem(SEGMENTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return new Set(parsed.enabled || []);
  } catch { return null; }
}

export function saveEnabledSegments(set) {
  try {
    localStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify({ enabled: Array.from(set) }));
  } catch { /* ignore */ }
}