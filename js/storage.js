import {
    ACTIVE_GAME,
    ACTIVE_GAME_ID,
    CAUGHT_STORAGE_KEY,
    SEGMENTS_STORAGE_KEY,
    SPECIES_CACHE_KEY,
    SPECIES_CACHE_META_KEY,
    SPECIES_CACHE_TTL_MS,
    SETTINGS_STORAGE_KEY,
    getDefaultEnabledSegments,
} from './config.js';

// Global app settings (UI prefs)
const DEFAULT_SETTINGS = {
  theme: 'auto',               // 'light' | 'dark' | 'auto'
  reducedMotion: 'system',     // 'system' | true | false
  hideCaughtDefault: false,
  language: 'en',
  spriteStyle: 'pokesprites',
  defaultGameMode: 'last-used', // 'last-used' | 'specific'
  defaultGameId: null,
  version: 1,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(next) {
  const merged = { ...DEFAULT_SETTINGS, ...next };
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore quota
  }
  return merged;
}

export function clearSpeciesCache() {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.endsWith('-species-names-v1') || key.endsWith('-species-names-meta-v1')) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // ignore quota
  }
}

export function clearAllSavedData() {
  try {
    localStorage.clear();
  } catch {
    // ignore quota
  }
}

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
export function saveSpeciesCache(map, speciesOrder, language = 'en') {
  try {
    localStorage.setItem(SPECIES_CACHE_KEY, JSON.stringify(map));
    localStorage.setItem(SPECIES_CACHE_META_KEY, JSON.stringify({
      ts: Date.now(),
      idsHash: hashSpeciesIds(speciesOrder),
      language,
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
export function isSpeciesCacheStale(speciesOrder, language = 'en') {
  const meta = readSpeciesCacheMeta();
  if (!meta) return true;
  if ((Date.now() - (meta.ts || 0)) > SPECIES_CACHE_TTL_MS) return true;
  if (meta.idsHash !== hashSpeciesIds(speciesOrder)) return true;
  if (meta.language !== language) return true;
  return false;
}

/**
 * Generate a stable hash of the unique species list.
 * Used to invalidate cache when the dex list changes.
 */
export function hashSpeciesIds(speciesOrder) {
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
    if (!raw) return getDefaultEnabledSegments(ACTIVE_GAME);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return getDefaultEnabledSegments(ACTIVE_GAME);
    return new Set(parsed.enabled || getDefaultEnabledSegments(ACTIVE_GAME));
  } catch { return getDefaultEnabledSegments(ACTIVE_GAME); }
}

export function saveEnabledSegments(set) {
  try {
    localStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify({ enabled: Array.from(set) }));
  } catch { /* ignore */ }
}

// =============================================================================
// SHARING & ENCODING
// =============================================================================

const SHARE_PAYLOAD_VERSION = 2;

function getShareSegments() {
  return Array.from(loadEnabledSegments()).sort();
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(encoded) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function shareContextMatches(payload, slotCount, segments) {
  if (!payload || payload.version !== SHARE_PAYLOAD_VERSION) return false;
  if (payload.gameId !== ACTIVE_GAME_ID || payload.slotCount !== slotCount) return false;
  const expectedSegments = [...segments].sort();
  const payloadSegments = Array.isArray(payload.segments) ? [...payload.segments].sort() : [];
  return expectedSegments.length === payloadSegments.length
    && expectedSegments.every((segment, index) => segment === payloadSegments[index]);
}

export function encodeCaughtState(caught, slotCount) {
  try {
    // 1) Bit-pack caught slots into bytes
    const bytes = new Uint8Array(Math.ceil(slotCount / 8));
    for (let slot = 1; slot <= slotCount; slot += 1) {
      if (caught[slot]) {
        const i = slot - 1;
        bytes[i >> 3] |= 1 << (i & 7);
      }
    }

    const payload = JSON.stringify({
      version: SHARE_PAYLOAD_VERSION,
      gameId: ACTIVE_GAME_ID,
      segments: getShareSegments(),
      slotCount,
      bits: bytesToBase64Url(bytes),
    });
    const compressed = window.pako.deflate(new TextEncoder().encode(payload));
    return '#s=' + bytesToBase64Url(compressed);
  } catch (err) {
    console.error('encodeCaughtState error:', err);
    return '';
  }
}


export function decodeCaughtState(hash, slotCount, segments = getShareSegments()) {
  try {
    const match = /#s=([^&]+)/.exec(hash);
    if (!match) return null;

    const compressed = base64UrlToBytes(match[1]);
    const payload = JSON.parse(new TextDecoder().decode(window.pako.inflate(compressed)));
    if (!shareContextMatches(payload, slotCount, segments)) return null;

    const bytes = base64UrlToBytes(payload.bits);
    if (bytes.length !== Math.ceil(slotCount / 8)) return null;

    const caught = {};
    for (let slot = 1; slot <= slotCount; slot += 1) {
      const i = slot - 1;
      caught[slot] = !!(bytes[i >> 3] & (1 << (i & 7)));
    }
    return caught;
  } catch (err) {
    console.error('decodeCaughtState error:', err);
    return null;
  }
}