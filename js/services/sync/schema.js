/**
 * LivingDex - Sync Schema & Data Transformer (Schema v3)
 * Handles creating structured backup payloads and normalizing imported data from older schemas.
 */

import {
  getAllCaughtSlots,
  getAllShinyCaughtSlots,
  getAllBoxLabels,
  getAllSegmentSettings,
  getItemInventory,
  getSpecimenInventory,
} from "../../storage.js";

export const CURRENT_SCHEMA_VERSION = 3;

/**
 * Builds the canonical Schema v3 backup payload from current localStorage state.
 * @returns {object} Canonical payload ready for cloud storage or file export
 */
export function buildExportPayload() {
  const caught = getAllCaughtSlots();
  const shiny = getAllShinyCaughtSlots();
  const boxLabels = getAllBoxLabels();
  const segments = getAllSegmentSettings();
  const items = getItemInventory();
  const specimenInventory = getSpecimenInventory();

  // Aggregate list of active games present in storage
  const gameSet = new Set([
    ...Object.keys(caught),
    ...Object.keys(shiny),
    ...Object.keys(boxLabels),
    ...Object.keys(segments),
  ]);

  const gamesData = {};
  for (const gameId of gameSet) {
    gamesData[gameId] = {
      caught: caught[gameId] || [],
      shiny: shiny[gameId] || [],
      boxLabels: boxLabels[gameId] || {},
      segmentSettings: segments[gameId] || null,
    };
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    source: "LivingDex PWA",
    data: {
      games: gamesData,
      inventory: {
        items: items || {},
        specimens: specimenInventory || {},
      },
    },
  };
}

/**
 * Normalizes an imported payload (v1 legacy, v2, or v3) into a standardized structure.
 * @param {any} rawData Parsed JSON object from file or cloud
 * @returns {{ valid: boolean, schemaVersion: number, data: object, error?: string }}
 */
export function normalizeImportPayload(rawData) {
  if (!rawData || typeof rawData !== "object") {
    return {
      valid: false,
      schemaVersion: 0,
      data: {},
      error: "Invalid JSON payload: expected an object",
    };
  }

  // Detect Schema Version
  let detectedVersion = 1;
  if (typeof rawData.schemaVersion === "number") {
    detectedVersion = rawData.schemaVersion;
  } else if (rawData.version && typeof rawData.version === "number") {
    detectedVersion = rawData.version;
  }

  const normalized = {
    games: {},
    inventory: {
      items: {},
      specimens: {},
    },
  };

  try {
    if (detectedVersion >= 3 && rawData.data) {
      // Schema v3: { schemaVersion: 3, data: { games: { ... }, inventory: { ... } } }
      if (rawData.data.games && typeof rawData.data.games === "object") {
        for (const [gameId, gData] of Object.entries(rawData.data.games)) {
          if (!gData || typeof gData !== "object") continue;
          normalized.games[gameId] = {
            caught: Array.isArray(gData.caught)
              ? gData.caught
              : typeof gData.caught === "object"
                ? gData.caught
                : {},
            shiny: Array.isArray(gData.shiny)
              ? gData.shiny
              : typeof gData.shiny === "object"
                ? gData.shiny
                : {},
            boxLabels:
              gData.boxLabels && typeof gData.boxLabels === "object" ? gData.boxLabels : {},
            segmentSettings:
              gData.segmentSettings && typeof gData.segmentSettings === "object"
                ? gData.segmentSettings
                : null,
          };
        }
      }
      if (rawData.data.inventory && typeof rawData.data.inventory === "object") {
        normalized.inventory.items = rawData.data.inventory.items || {};
        normalized.inventory.specimens = rawData.data.inventory.specimens || {};
      }
    } else if (detectedVersion === 2 || (rawData.games && typeof rawData.games === "object")) {
      // Schema v2: { schemaVersion: 2, games: { ... }, inventory: { ... } }
      const gamesSource = rawData.games || {};
      for (const [gameId, gData] of Object.entries(gamesSource)) {
        if (!gData || typeof gData !== "object") continue;
        normalized.games[gameId] = {
          caught: Array.isArray(gData.caught)
            ? gData.caught
            : typeof gData.caught === "object"
              ? gData.caught
              : {},
          shiny: Array.isArray(gData.shiny)
            ? gData.shiny
            : typeof gData.shiny === "object"
              ? gData.shiny
              : {},
          boxLabels: gData.boxLabels && typeof gData.boxLabels === "object" ? gData.boxLabels : {},
          segmentSettings:
            gData.segmentSettings && typeof gData.segmentSettings === "object"
              ? gData.segmentSettings
              : null,
        };
      }
      if (rawData.inventory && typeof rawData.inventory === "object") {
        normalized.inventory.items = rawData.inventory.items || {};
        normalized.inventory.specimens = rawData.inventory.specimens || {};
      }
    } else {
      // Schema v1 (legacy): Raw object mapping localStorage keys or game keys
      for (const [key, value] of Object.entries(rawData)) {
        if (key === "schemaVersion" || key === "timestamp" || key === "source") continue;

        if (key.startsWith("livingdex_caught_") || key.endsWith("-caught-v1")) {
          const gameId = key.replace("livingdex_caught_", "").replace("-caught-v1", "");
          if (!normalized.games[gameId])
            normalized.games[gameId] = {
              caught: {},
              shiny: {},
              boxLabels: {},
              segmentSettings: null,
            };
          normalized.games[gameId].caught = value || {};
        } else if (
          key.startsWith("livingdex_shiny_caught_") ||
          key.startsWith("livingdex_shiny_") ||
          key.endsWith("-shiny-caught-v1")
        ) {
          const gameId = key
            .replace(/livingdex_shiny(?:_caught)?_/, "")
            .replace("-shiny-caught-v1", "");
          if (!normalized.games[gameId])
            normalized.games[gameId] = {
              caught: {},
              shiny: {},
              boxLabels: {},
              segmentSettings: null,
            };
          normalized.games[gameId].shiny = value || {};
        } else if (key.startsWith("livingdex_box_labels_") || key.endsWith("-box-labels-v1")) {
          const gameId = key.replace("livingdex_box_labels_", "").replace("-box-labels-v1", "");
          if (!normalized.games[gameId])
            normalized.games[gameId] = {
              caught: {},
              shiny: {},
              boxLabels: {},
              segmentSettings: null,
            };
          if (value && typeof value === "object") normalized.games[gameId].boxLabels = value;
        } else if (key === "livingdex_item_inventory" || key === "inventory") {
          if (value && typeof value === "object") normalized.inventory.items = value;
        } else if (key === "livingdex_specimen_inventory") {
          if (value && typeof value === "object") normalized.inventory.specimens = value;
        } else if (value && typeof value === "object") {
          // Direct game caught dictionary
          if (!normalized.games[key])
            normalized.games[key] = { caught: {}, shiny: {}, boxLabels: {}, segmentSettings: null };
          normalized.games[key].caught = value;
        }
      }
    }

    return {
      valid: true,
      schemaVersion: detectedVersion,
      data: normalized,
    };
  } catch (err) {
    return {
      valid: false,
      schemaVersion: detectedVersion,
      data: {},
      error: `Failed to normalize payload: ${err.message}`,
    };
  }
}
