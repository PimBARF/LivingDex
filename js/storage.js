import {
  ACTIVE_GAME,
  ACTIVE_GAME_ID,
  CAUGHT_STORAGE_KEY,
  SHINY_CAUGHT_STORAGE_KEY,
  SEGMENTS_STORAGE_KEY,
  BOX_LABELS_STORAGE_KEY,
  COLLAPSED_BOXES_STORAGE_KEY,
  SPECIES_CACHE_KEY,
  SPECIES_CACHE_META_KEY,
  SPECIES_CACHE_TTL_MS,
  SETTINGS_STORAGE_KEY,
  getDefaultEnabledSegments,
} from "./config.js";

/**
 * @typedef {Object} AppSettings
 * @property {'light'|'dark'|'auto'} theme - Theme preference ('light', 'dark', or 'auto').
 * @property {'system'|boolean} reducedMotion - Reduced motion preference ('system', true, or false).
 * @property {boolean} hideCaughtDefault - Whether to hide caught slots by default.
 * @property {boolean} rememberCollapsedBoxes - Whether to persist collapsed box states across sessions.
 * @property {boolean} autoCollapseFullBoxes - Whether to automatically collapse a box when all slots are caught.
 * @property {string} language - UI and Pokemon name language code (e.g., 'en').
 * @property {string} spriteStyle - Selected sprite style key.
 * @property {'last-used'|'specific'} defaultGameMode - Mode for initial game selection.
 * @property {string|null} defaultGameId - Target game ID when defaultGameMode is 'specific'.
 * @property {number} version - Settings schema version.
 */

/**
 * Default global application settings (UI preferences).
 * @type {AppSettings}
 */
const DEFAULT_SETTINGS = {
  theme: "auto", // 'light' | 'dark' | 'auto'
  reducedMotion: "system", // 'system' | true | false
  hideCaughtDefault: false,
  rememberCollapsedBoxes: false,
  autoCollapseFullBoxes: false,
  language: "en",
  spriteStyle: "pokesprites",
  defaultGameMode: "last-used", // 'last-used' | 'specific'
  defaultGameId: null,
  version: 1,
};

/**
 * Load app settings from localStorage, merging with default values.
 * Falls back to default settings if reading or parsing fails.
 *
 * @returns {AppSettings} The stored settings merged with defaults.
 */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persist app settings to localStorage after merging with defaults.
 *
 * @param {Partial<AppSettings>} next - Updated settings or partial changes to save.
 * @returns {AppSettings} The newly merged and saved settings object.
 */
export function saveSettings(next) {
  const merged = { ...DEFAULT_SETTINGS, ...next };
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore quota
  }
  return merged;
}

/**
 * Clear cached species names and associated metadata from localStorage for all games.
 *
 * @returns {void}
 */
export function clearSpeciesCache() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (
        key.endsWith("-species-names-v1") ||
        key.endsWith("-species-names-meta-v1")
      ) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // ignore quota
  }
}

/**
 * Clear all application data stored in localStorage.
 *
 * @returns {void}
 */
export function clearAllSavedData() {
  try {
    localStorage.clear();
  } catch {
    // ignore quota
  }
}

/**
 * Load caught-slot data from localStorage for the active game.
 * Defaults to an empty object when nothing is stored yet or parsing fails.
 *
 * @returns {Record<string|number, boolean>} Map of slot numbers to caught status.
 */
export function loadCaughtSlots() {
  try {
    return JSON.parse(localStorage.getItem(CAUGHT_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * Persist caught-slot data to localStorage for the active game.
 * Ignores quota errors silently to keep the UI responsive.
 *
 * @param {Record<string|number, boolean>} caught - Map of slot numbers to caught status.
 * @returns {void}
 */
export function saveCaughtSlots(caught) {
  try {
    localStorage.setItem(CAUGHT_STORAGE_KEY, JSON.stringify(caught));
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Load shiny caught-slot data from localStorage for the active game.
 * Defaults to an empty object when nothing is stored yet or parsing fails.
 *
 * @returns {Record<string|number, boolean>} Map of slot numbers to shiny caught status.
 */
export function loadShinyCaughtSlots() {
  try {
    return JSON.parse(localStorage.getItem(SHINY_CAUGHT_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * Persist shiny caught-slot data to localStorage for the active game.
 * Ignores quota errors silently to keep the UI responsive.
 *
 * @param {Record<string|number, boolean>} caught - Map of slot numbers to shiny caught status.
 * @returns {void}
 */
export function saveShinyCaughtSlots(caught) {
  try {
    localStorage.setItem(SHINY_CAUGHT_STORAGE_KEY, JSON.stringify(caught));
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Load custom box label mappings from localStorage for the specified or active game.
 *
 * @param {string} [gamePrefix=ACTIVE_GAME.storagePrefix] - Game storage prefix.
 * @returns {Record<string, string>} Map of box IDs to custom box labels.
 */
export function loadBoxLabels(gamePrefix = ACTIVE_GAME.storagePrefix) {
  try {
    const key = `${gamePrefix}-box-labels-v1`;
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

/**
 * Persist custom box label mappings to localStorage for the specified or active game.
 *
 * @param {Record<string, string>} labels - Map of box IDs to custom box labels.
 * @param {string} [gamePrefix=ACTIVE_GAME.storagePrefix] - Game storage prefix.
 * @returns {void}
 */
export function saveBoxLabels(labels, gamePrefix = ACTIVE_GAME.storagePrefix) {
  try {
    const key = `${gamePrefix}-box-labels-v1`;
    if (!labels || Object.keys(labels).length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(labels));
    }
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Clear custom box labels for the specified or active game.
 *
 * @param {string} [gamePrefix=ACTIVE_GAME.storagePrefix] - Game storage prefix.
 * @returns {void}
 */
export function clearBoxLabels(gamePrefix = ACTIVE_GAME.storagePrefix) {
  try {
    localStorage.removeItem(`${gamePrefix}-box-labels-v1`);
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Clear all custom box labels across all games.
 *
 * @returns {void}
 */
export function clearAllBoxLabels() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.endsWith("-box-labels-v1")) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Load persisted collapsed box IDs from localStorage for the specified or active game.
 *
 * @param {string} [gamePrefix=ACTIVE_GAME.storagePrefix] - Game storage prefix.
 * @returns {Set<string>} Set of collapsed box IDs.
 */
export function loadCollapsedBoxes(gamePrefix = ACTIVE_GAME.storagePrefix) {
  try {
    const key = `${gamePrefix}-collapsed-boxes-v1`;
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Persist collapsed box IDs to localStorage for the specified or active game.
 *
 * @param {Set<string>|string[]} collapsedSet - Set or array of collapsed box IDs.
 * @param {string} [gamePrefix=ACTIVE_GAME.storagePrefix] - Game storage prefix.
 * @returns {void}
 */
export function saveCollapsedBoxes(
  collapsedSet,
  gamePrefix = ACTIVE_GAME.storagePrefix,
) {
  try {
    const key = `${gamePrefix}-collapsed-boxes-v1`;
    const list = Array.from(collapsedSet);
    if (list.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Clear persisted collapsed box state for the specified or active game.
 *
 * @param {string} [gamePrefix=ACTIVE_GAME.storagePrefix] - Game storage prefix.
 * @returns {void}
 */
export function clearCollapsedBoxes(gamePrefix = ACTIVE_GAME.storagePrefix) {
  try {
    localStorage.removeItem(`${gamePrefix}-collapsed-boxes-v1`);
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Load species name cache from localStorage for the active game.
 *
 * @returns {Record<string|number, string>} Map of species IDs to translated names.
 */
export function loadSpeciesCache() {
  try {
    return JSON.parse(localStorage.getItem(SPECIES_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * Save species name cache to localStorage with metadata (timestamp, hash, language, version).
 *
 * @param {Record<string|number, string>} map - Map of species IDs to translated names.
 * @param {Array<number|string>} speciesOrder - Array of species IDs to compute the hash for.
 * @param {string} [language="en"] - Language code for the cached names.
 * @returns {void}
 */
export function saveSpeciesCache(map, speciesOrder, language = "en") {
  try {
    localStorage.setItem(SPECIES_CACHE_KEY, JSON.stringify(map));
    localStorage.setItem(
      SPECIES_CACHE_META_KEY,
      JSON.stringify({
        ts: Date.now(),
        idsHash: hashSpeciesIds(speciesOrder),
        language,
        version: 1,
      }),
    );
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * @typedef {Object} SpeciesCacheMeta
 * @property {number} ts - Timestamp when the cache was saved.
 * @property {string} idsHash - Hash of the unique species list.
 * @property {string} language - Language code of the cached species names.
 * @property {number} version - Schema version of the metadata.
 */

/**
 * Read species cache metadata (timestamp, hash, language, version).
 *
 * @returns {SpeciesCacheMeta|null} The parsed metadata object or null if absent/invalid.
 */
export function readSpeciesCacheMeta() {
  try {
    return JSON.parse(localStorage.getItem(SPECIES_CACHE_META_KEY) || "");
  } catch {
    return null;
  }
}

/**
 * Determine if the species cache is stale based on TTL, content hash, and language.
 *
 * @param {Array<number|string>} speciesOrder - Array of species IDs in dex order.
 * @param {string} [language="en"] - Current active language code.
 * @returns {boolean} True if the cache is expired, invalid, mismatched, or missing; false otherwise.
 */
export function isSpeciesCacheStale(speciesOrder, language = "en") {
  const meta = readSpeciesCacheMeta();
  if (!meta) return true;
  if (Date.now() - (meta.ts || 0) > SPECIES_CACHE_TTL_MS) return true;
  if (meta.idsHash !== hashSpeciesIds(speciesOrder)) return true;
  if (meta.language !== language) return true;
  return false;
}

/**
 * Generate a stable 32-bit integer hash of the unique species list.
 * Used to invalidate the species cache when the dex list or order changes.
 *
 * @param {Array<number|string>} speciesOrder - Array of species IDs.
 * @returns {string} Stringified 32-bit hash value.
 */
export function hashSpeciesIds(speciesOrder) {
  const s = Array.from(new Set(speciesOrder)).join(",");
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return String(h);
}

/**
 * @typedef {Object} SegmentConfig
 * @property {Set<string>} enabled - Set of enabled segment identifiers.
 * @property {string[]} order - Ordered list of segment identifiers.
 */

/**
 * Load segment configuration (enabled set and custom order) for the specified or active game.
 *
 * @param {import("./config.js").GameConfig} [game=ACTIVE_GAME] - Game configuration.
 * @returns {SegmentConfig} Segment configuration object.
 */
export function loadSegmentConfig(game = ACTIVE_GAME) {
  const defaultOrder = (game.dexes || []).map((seg) => seg.id);
  const defaultEnabled = getDefaultEnabledSegments(game);

  try {
    const key = `${game.storagePrefix}-segments-v1`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {
        enabled: defaultEnabled,
        order: defaultOrder,
      };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {
        enabled: defaultEnabled,
        order: defaultOrder,
      };
    }

    const enabledList = Array.isArray(parsed.enabled)
      ? parsed.enabled
      : Array.from(defaultEnabled);
    const orderList = Array.isArray(parsed.order) ? parsed.order : defaultOrder;

    return {
      enabled: new Set(enabledList),
      order: orderList,
    };
  } catch {
    return {
      enabled: defaultEnabled,
      order: defaultOrder,
    };
  }
}

/**
 * Persist segment configuration (enabled set and custom order) for the specified or active game.
 *
 * @param {{ enabled: Set<string>|Iterable<string>, order?: string[] }} config - Configuration to save.
 * @param {string} [gamePrefix=ACTIVE_GAME.storagePrefix] - Game storage prefix.
 * @returns {void}
 */
export function saveSegmentConfig(
  config,
  gamePrefix = ACTIVE_GAME.storagePrefix,
) {
  try {
    const key = `${gamePrefix}-segments-v1`;
    const payload = {
      enabled: Array.from(config.enabled || []),
      order: Array.isArray(config.order) ? config.order : [],
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Reset segment configuration to default for the specified or active game.
 *
 * @param {string} [gamePrefix=ACTIVE_GAME.storagePrefix] - Game storage prefix.
 * @returns {void}
 */
export function resetSegmentConfig(gamePrefix = ACTIVE_GAME.storagePrefix) {
  try {
    localStorage.removeItem(`${gamePrefix}-segments-v1`);
  } catch {
    // Ignore quota errors silently
  }
}

/**
 * Read enabled segments setting for the current dex from localStorage.
 *
 * @param {import("./config.js").GameConfig} [game=ACTIVE_GAME] - Game configuration.
 * @returns {Set<string>} Set of enabled segment keys.
 */
export function loadEnabledSegments(game = ACTIVE_GAME) {
  return loadSegmentConfig(game).enabled;
}

/**
 * Persist enabled segments setting for the current dex to localStorage while preserving custom order.
 *
 * @param {Set<string>|Iterable<string>} set - Set or collection of enabled segment keys.
 * @param {string} [gamePrefix=ACTIVE_GAME.storagePrefix] - Game storage prefix.
 * @returns {void}
 */
export function saveEnabledSegments(
  set,
  gamePrefix = ACTIVE_GAME.storagePrefix,
) {
  const current = loadSegmentConfig(ACTIVE_GAME);
  saveSegmentConfig({ enabled: set, order: current.order }, gamePrefix);
}

// =============================================================================
// SHARING & ENCODING
// =============================================================================

/**
 * Version number for the share URL payload format.
 * @type {number}
 */
const SHARE_PAYLOAD_VERSION = 2;

/**
 * Get sorted list of currently enabled segment keys for sharing.
 *
 * @returns {string[]} Sorted array of enabled segment keys.
 */
function getShareSegments() {
  return Array.from(loadEnabledSegments()).sort();
}

/**
 * Convert a Uint8Array of bytes into a URL-safe Base64 string without padding.
 *
 * @param {Uint8Array} bytes - Byte array to encode.
 * @returns {string} URL-safe base64-encoded string.
 */
function bytesToBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Convert a URL-safe Base64 string back into a Uint8Array of bytes.
 *
 * @param {string} encoded - URL-safe base64-encoded string.
 * @returns {Uint8Array} Decoded byte array.
 */
function base64UrlToBytes(encoded) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * @typedef {Object} SharePayload
 * @property {number} version - Share payload schema version.
 * @property {string} gameId - Game identifier.
 * @property {string[]} segments - List of enabled segment keys.
 * @property {number} slotCount - Total slot count for the dex.
 * @property {string} bits - Base64Url-encoded bitfield of caught status.
 */

/**
 * Validate that a decoded share payload matches the current dex configuration context.
 *
 * @param {SharePayload} payload - Parsed share payload.
 * @param {number} slotCount - Expected total slot count.
 * @param {Iterable<string>} segments - Expected enabled segment keys.
 * @returns {boolean} True if payload matches the current dex context, false otherwise.
 */
function shareContextMatches(payload, slotCount, segments) {
  if (!payload || payload.version !== SHARE_PAYLOAD_VERSION) return false;
  if (payload.gameId !== ACTIVE_GAME_ID || payload.slotCount !== slotCount)
    return false;
  const expectedSegments = [...segments].sort();
  const payloadSegments = Array.isArray(payload.segments)
    ? [...payload.segments].sort()
    : [];
  return (
    expectedSegments.length === payloadSegments.length &&
    expectedSegments.every(
      (segment, index) => segment === payloadSegments[index],
    )
  );
}

/**
 * Bit-pack and compress the current caught state into a URL hash string.
 *
 * @async
 * @param {Record<string|number, boolean>} caught - Map of slot numbers to caught status.
 * @param {number} slotCount - Total number of slots in the dex.
 * @returns {Promise<string>} URL hash fragment containing compressed state (e.g. "#s=..."), or empty string on error.
 */
export async function encodeCaughtState(caught, slotCount) {
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
    const stream = new Blob([new TextEncoder().encode(payload)])
      .stream()
      .pipeThrough(new CompressionStream("deflate"));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return "#s=" + bytesToBase64Url(compressed);
  } catch (err) {
    console.error("encodeCaughtState error:", err);
    return "";
  }
}

/**
 * Decompress and decode a caught state from a URL hash fragment.
 *
 * @async
 * @param {string} hash - URL hash containing "#s=...".
 * @param {number} slotCount - Expected number of slots.
 * @param {Iterable<string>} [segments=getShareSegments()] - Enabled segment keys to validate against.
 * @returns {Promise<Record<number, boolean>|null>} Map of slot numbers to caught status, or null if invalid or mismatched.
 */
export async function decodeCaughtState(
  hash,
  slotCount,
  segments = getShareSegments(),
) {
  try {
    const match = /#s=([^&]+)/.exec(hash);
    if (!match) return null;

    const compressed = base64UrlToBytes(match[1]);
    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream("deflate"));
    const decompressedText = await new Response(stream).text();
    const payload = JSON.parse(decompressedText);
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
    console.error("decodeCaughtState error:", err);
    return null;
  }
}
