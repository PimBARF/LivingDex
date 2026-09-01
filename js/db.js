import { ACTIVE_GAME_ID } from "./config.js";
import {
  loadSegmentConfig,
  loadEnabledSegments,
  loadSettings,
} from "./storage.js";
import { applyNamesToCells } from "./ui/dom-render.js";

/**
 * In-memory cache for the loaded species dataset.
 * @type {Record<number, Object>|null}
 */
let speciesDataCache = null;

/**
 * In-memory cache for the loaded evolution chains dataset.
 * @type {Record<number, Object>|null}
 */
let evolutionDataCache = null;

/**
 * In-memory cache for the loaded game evolution datasets.
 * @type {Record<string, Object>}
 */
const gameEvolutionsCache = {};

/**
 * In-memory cache for the loaded game dex datasets.
 * @type {Record<string, Object>}
 */
const gameDexDataCache = {};

/**
 * In-memory cache for the loaded game encounters datasets.
 * @type {Record<string, Object>}
 */
const gameEncountersCache = {};

/**
 * In-memory cache for loaded flavor text dictionaries by language.
 * @type {Record<string, Record<string|number, string>>}
 */
const flavorDataCache = {};

/**
 * In-memory cache for loaded localized species name dictionaries by language.
 * @type {Record<string, Record<string|number, string>>}
 */
const namesDataCache = {};

/**
 * Fetches the master species dataset if not already loaded.
 *
 * @returns {Promise<Record<number, Object>>} The master species dictionary.
 */
export async function getAllSpeciesData() {
  if (!speciesDataCache) {
    const res = await fetch("data/species.json");
    if (!res.ok) throw new Error("Failed to fetch species.json");
    speciesDataCache = await res.json();
  }
  return speciesDataCache;
}

/**
 * Retrieves species information by its ID.
 *
 * @param {number|string} speciesId - The National Pokédex species ID.
 * @returns {Promise<Object|null>} The species data object or null if not found.
 */
export async function getSpeciesData(speciesId) {
  const allSpecies = await getAllSpeciesData();
  return allSpecies[Number(speciesId)] || null;
}

/**
 * Retrieves the master evolution dataset if not already loaded.
 *
 * @returns {Promise<Record<number, Object>>} The master evolution dictionary.
 */
export async function getAllEvolutionData() {
  if (!evolutionDataCache) {
    const res = await fetch("data/evolutions.json");
    if (!res.ok) throw new Error("Failed to fetch evolutions.json");
    evolutionDataCache = await res.json();
  }
  return evolutionDataCache;
}

/**
 * Dynamically loads and caches game-specific evolution data on demand with graceful fallback to master evolutions.
 *
 * @param {string} [gameId="home"] - The game identifier (e.g. 'rby', 'gsc', 'pla', 'sv', 'home').
 * @returns {Promise<Record<number, Object>>} The evolution dictionary for the specified game or master dataset.
 */
export async function loadEvolutions(gameId = "home") {
  if (!gameId || gameId === "home") {
    return getAllEvolutionData();
  }
  if (!gameEvolutionsCache[gameId]) {
    try {
      const res = await fetch(`data/games/evolutions/${gameId}.json`);
      if (!res.ok) throw new Error(`Failed to fetch evolutions for ${gameId}`);
      gameEvolutionsCache[gameId] = await res.json();
    } catch (err) {
      console.warn(
        `Could not load evolutions for game ${gameId}, falling back to master evolutions:`,
        err,
      );
      gameEvolutionsCache[gameId] = await getAllEvolutionData();
    }
  }
  return gameEvolutionsCache[gameId];
}

/**
 * Retrieves game-specific evolution data on demand.
 * Backward-compatible / naming alias to loadEvolutions.
 *
 * @param {string} gameId - The game identifier.
 * @returns {Promise<Record<number, Object>>} The game evolutions dictionary.
 */
export async function getGameEvolutionData(gameId) {
  return loadEvolutions(gameId);
}

/**
 * Retrieves evolution chain data by its chain ID and optional game scope.
 *
 * @param {number|string} chainId - The evolution chain ID.
 * @param {string|null} [gameId=null] - Optional game identifier (e.g. 'rby', 'pla', 'home').
 * @returns {Promise<Object|null>} The evolution chain object or null if not found.
 */
export async function getEvolutionData(chainId, gameId = null) {
  if (!chainId) return null;
  const allEvolutions = gameId
    ? await loadEvolutions(gameId)
    : await getAllEvolutionData();
  return allEvolutions[Number(chainId)] || null;
}

/**
 * Retrieves evolution chain data for a species by species ID and optional game scope.
 *
 * @param {number|string} speciesId - The National Pokédex species ID.
 * @param {string|null} [gameId=null] - Optional game identifier.
 * @returns {Promise<Object|null>} The evolution chain object or null if not found.
 */
export async function getEvolutionChain(speciesId, gameId = null) {
  const species = await getSpeciesData(speciesId);
  if (!species || !species.evolutionChainId) return null;
  return getEvolutionData(species.evolutionChainId, gameId);
}

/**
 * Retrieves game-specific Pokédex roster and section configurations.
 *
 * @param {string} gameId - The game identifier (e.g., 'sv', 'swsh').
 * @returns {Promise<Object>} The game dex configuration object.
 */
export async function getGameDexData(gameId) {
  if (!gameDexDataCache[gameId]) {
    const res = await fetch(`data/games/dex/${gameId}.json`);
    if (!res.ok) throw new Error(`Failed to fetch game dex data for ${gameId}`);
    gameDexDataCache[gameId] = await res.json();
  }
  return gameDexDataCache[gameId];
}

/**
 * Retrieves game-specific encounter locations on demand.
 *
 * @param {string} gameId - The game identifier (e.g., 'sv', 'swsh').
 * @returns {Promise<Object>} The game encounters object.
 */
export async function getGameEncounterData(gameId) {
  if (!gameEncountersCache[gameId]) {
    try {
      const res = await fetch(`data/games/encounters/${gameId}.json`);
      if (!res.ok) throw new Error(`Failed to fetch encounters for ${gameId}`);
      gameEncountersCache[gameId] = await res.json();
    } catch (err) {
      console.warn(`Could not load encounters for game ${gameId}:`, err);
      gameEncountersCache[gameId] = { gameId, encounters: {} };
    }
  }
  return gameEncountersCache[gameId];
}

/**
 * Retrieves game configuration and Pokédex sections.
 * Backward-compatible alias to getGameDexData.
 *
 * @param {string} gameId - The game identifier.
 * @returns {Promise<Object>} The game dex configuration object.
 */
export async function getGameData(gameId) {
  return getGameDexData(gameId);
}

/**
 * Resolves encounter details for a given species and game version from sparse/deduplicated keys.
 * Supports exact version matches, 'all', and slash-delimited version groupings (e.g. 'scarlet/violet').
 *
 * @param {Record<string, Record<string, Object>>|undefined} encounters - Encounters map keyed by species ID.
 * @param {number|string} speciesId - Target National Pokédex species ID.
 * @param {string} version - Specific game version string (e.g. 'scarlet', 'sword').
 * @returns {Object|null} The resolved encounter details object or null if not found.
 */
export function getVersionEncounters(encounters, speciesId, version) {
  const sp = encounters?.[speciesId];
  if (!sp) return null;
  if (sp[version]) return sp[version];
  if (sp["all"]) return sp["all"];
  const match = Object.entries(sp).find(([key]) =>
    key.split("/").includes(version),
  );
  return match ? match[1] : null;
}

/**
 * Retrieves the flavor text dictionary for a given language lazily on-demand.
 *
 * @param {string} [lang="en"] - Language code (e.g. 'en', 'de', 'ja', 'fr').
 * @returns {Promise<Record<string, string>>} Dictionary mapping species ID to flavor text.
 */
export async function getFlavorData(lang = "en") {
  if (!flavorDataCache[lang]) {
    try {
      const res = await fetch(`data/flavor/${lang}.json`);
      if (!res.ok) {
        if (lang !== "en") {
          return getFlavorData("en");
        }
        throw new Error(`Failed to fetch flavor/${lang}.json`);
      }
      flavorDataCache[lang] = await res.json();
    } catch (err) {
      if (lang !== "en") {
        return getFlavorData("en");
      }
      console.error("Failed to load flavor text:", err);
      flavorDataCache[lang] = {};
    }
  }
  return flavorDataCache[lang];
}

/**
 * Retrieves the localized flavor text for a specific species with fallback to English.
 *
 * @param {number|string} speciesId - National Pokédex species ID.
 * @param {string} [lang="en"] - Target language code.
 * @returns {Promise<string>} Localized flavor text description or '—' if unavailable.
 */
export async function getFlavorText(speciesId, lang = "en") {
  const langFlavor = await getFlavorData(lang);
  let text = langFlavor?.[String(speciesId)] || langFlavor?.[Number(speciesId)];
  if (!text && lang !== "en") {
    const enFlavor = await getFlavorData("en");
    text = enFlavor?.[String(speciesId)] || enFlavor?.[Number(speciesId)];
  }
  return text || "—";
}

/**
 * Retrieves localized species names dictionary on-demand for languages other than English.
 *
 * @param {string} [lang="en"] - Target language code.
 * @returns {Promise<Record<string, string>|null>} Dictionary mapping species ID to localized name or null for English.
 */
export async function getNamesData(lang = "en") {
  if (lang === "en") return null;
  if (!namesDataCache[lang]) {
    try {
      const res = await fetch(`data/names/${lang}.json`);
      if (!res.ok) {
        throw new Error(`Failed to fetch names/${lang}.json`);
      }
      namesDataCache[lang] = await res.json();
    } catch (err) {
      console.warn(
        `Failed to load localized names for language '${lang}':`,
        err,
      );
      namesDataCache[lang] = {};
    }
  }
  return namesDataCache[lang];
}

/**
 * Computes active Pokédex sections for the currently selected game based on game configuration
 * and user-enabled segment settings, using the local database.
 *
 * @returns {Promise<{ sections: Array<Object>, warnings: Array<Object> }>} Object containing resolved sections and any warnings.
 */
export async function buildActiveDexSections() {
  const segmentConfig = loadSegmentConfig();
  const enabled = segmentConfig.enabled;
  const preferredOrder = Array.isArray(segmentConfig.order)
    ? segmentConfig.order
    : [];

  const [gameData] = await Promise.all([
    getGameDexData(ACTIVE_GAME_ID),
    getAllSpeciesData(),
  ]);

  const sections = [];
  const warnings = [];

  if (gameData && Array.isArray(gameData.sections)) {
    // Map sections by id for fast lookup
    const sectionMap = new Map();
    for (const seg of gameData.sections) {
      sectionMap.set(seg.id, seg);
    }

    // Determine final ordered section list:
    // 1. Items in preferredOrder that exist in game data
    // 2. Any newly scraped or discovered sections not yet in preferredOrder
    const orderedSections = [];
    const seenIds = new Set();

    for (const id of preferredOrder) {
      if (sectionMap.has(id)) {
        orderedSections.push(sectionMap.get(id));
        seenIds.add(id);
      }
    }

    for (const seg of gameData.sections) {
      if (!seenIds.has(seg.id)) {
        orderedSections.push(seg);
        seenIds.add(seg.id);
      }
    }

    for (const seg of orderedSections) {
      // Check if this segment is enabled in local storage
      const isEnabled = !seg.optional || enabled.has(seg.id);
      if (!isEnabled) continue;

      try {
        sections.push({
          key: seg.id,
          title: seg.title,
          kind: seg.type,
          entries: seg.entries || [],
          startIndex:
            seg.startIndex ||
            seg.startEntry ||
            (seg.entries?.[0]?.dexNumber ?? 1),
        });
      } catch (err) {
        warnings.push({
          segmentId: seg.id,
          title: seg.title,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { sections, warnings };
}

/**
 * Loads species names into the global window.__livingDexNames cache for quick UI access.
 * Fetches localized name dictionaries lazily when the active language is non-English.
 *
 * @param {Array<number|string>} speciesOrder - Ordered array of species IDs.
 * @returns {Promise<{ cacheState: string, failedIds: number[] }>} Validation state.
 */
export async function loadSpeciesNames(speciesOrder) {
  const language = loadSettings().language || "en";

  // Initialize global cache if not present
  if (!window.__livingDexNames) {
    window.__livingDexNames = {};
  }

  try {
    const allSpecies = await getAllSpeciesData();
    const localizedNames =
      language !== "en" ? await getNamesData(language) : null;

    // Map translated names to the global cache
    for (const [idStr, data] of Object.entries(allSpecies)) {
      const id = Number(idStr);
      let name;
      if (localizedNames && localizedNames[id]) {
        name = localizedNames[id];
      } else if (data.names && data.names[language]) {
        name = data.names[language];
      } else if (data.names && data.names.en) {
        name = data.names.en;
      } else if (data.name) {
        name = data.name;
      } else {
        name = `Species #${id}`;
      }
      window.__livingDexNames[id] = name;
    }

    // Refresh the DOM
    applyNamesToCells();

    return { cacheState: "fresh", failedIds: [] };
  } catch (err) {
    console.error("Failed to load species names from local database", err);
    return {
      cacheState: "error",
      failedIds: Array.isArray(speciesOrder) ? speciesOrder.map(Number) : [],
    };
  }
}

// =============================================================================
// MODAL DATA AGGREGATION & BUSINESS LOGIC
// =============================================================================

/**
 * Formats a game version name for user display.
 *
 * @param {string} name - Raw version identifier.
 * @returns {string} Prettified version name.
 */
function prettifyVersionName(name) {
  return String(name || "")
    .split("-")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
    .join(" ")
    .replace(/\bX\b/g, "X")
    .replace(/\bY\b/g, "Y")
    .trim();
}

/**
 * Joins a list of version names into a formatted slash-separated string.
 * Supports clean grouping of expansion pass versions (e.g. 'Sword / Shield Expansion Pass').
 *
 * @param {string[]} versions - Array of version identifiers.
 * @returns {string} Formatted version list.
 */
function joinVersionNames(versions) {
  if (!versions || !versions.length) return "";

  const allExpansion =
    versions.length > 1 && versions.every((v) => v.endsWith("-expansion-pass"));

  if (allExpansion) {
    const baseNames = versions.map((v) =>
      prettifyVersionName(v.replace(/-expansion-pass$/, "")),
    );
    if (baseNames.length === 2) {
      return `${baseNames[0]} / ${baseNames[1]} Expansion Pass`;
    }
    return `${baseNames.slice(0, -1).join(" / ")} / ${baseNames[baseNames.length - 1]} Expansion Pass`;
  }

  const names = versions.map(prettifyVersionName).filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} / ${names[1]}`;
  return `${names.slice(0, -1).join(" / ")} / ${names[names.length - 1]}`;
}

/**
 * Formats a list of trade source versions into a readable string.
 *
 * @param {string[]} versions - Array of version identifiers.
 * @returns {string} Trade instruction text.
 */
function formatTradeSourceList(versions) {
  const names = versions.map(prettifyVersionName).filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return `Trade from ${names[0]}`;
  if (names.length === 2) return `Trade from ${names[0]} or ${names[1]}`;
  return `Trade from ${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/**
 * Resolves localized display name for a species from global cache.
 *
 * @param {number|string} speciesId - Species ID.
 * @param {string} [fallbackName=""] - Fallback name.
 * @returns {string} Resolved display name.
 */
function resolveSpeciesDisplayName(speciesId, fallbackName = "") {
  return (
    window.__livingDexNames?.[speciesId] ||
    fallbackName ||
    `Species #${speciesId}`
  );
}

/**
 * Resolves the appropriate sprite/form ID for a member of an evolution chain.
 *
 * @param {Record<number, Object>} allSpecies - Master species dataset.
 * @param {number} targetSpeciesId - Species ID of the chain member.
 * @param {number} activeSpeciesId - The species ID currently opened in the modal.
 * @param {number} activeFormId - The form ID currently opened in the modal.
 * @param {string|null} activeRegion - Region key if a regional form (e.g. 'alola', 'galar', 'hisui', 'paldea').
 * @returns {number} Form ID or Species ID to use for the sprite.
 */
function resolveMemberSpriteId(
  allSpecies,
  targetSpeciesId,
  activeSpeciesId,
  activeFormId,
  activeRegion,
) {
  if (targetSpeciesId === activeSpeciesId) {
    return activeFormId;
  }

  if (activeRegion) {
    const targetSpecies = allSpecies[targetSpeciesId];
    if (targetSpecies && Array.isArray(targetSpecies.forms)) {
      const matchingForm = targetSpecies.forms.find(
        (f) =>
          f.region === activeRegion ||
          (f.isRegional && f.region === activeRegion) ||
          f.formKey === activeRegion,
      );
      if (matchingForm) {
        return matchingForm.formId;
      }
    }
  }

  return targetSpeciesId;
}

export function getSpeciesTypes(
  speciesId,
  formId = null,
  generationNumber = null,
) {
  if (!speciesDataCache) return [];
  const species = speciesDataCache[Number(speciesId)];
  if (!species) return [];
  return resolveTypes(species, Number(formId || speciesId), generationNumber);
}

/**
 * Resolves types taking historical past generation types and sparse form properties into account.
 *
 * @param {Object} speciesData - Species record from species.json.
 * @param {number} formId - Selected form ID.
 * @param {number|null} generationNumber - Active game generation number.
 * @returns {string[]} Resolved array of type names.
 */
function resolveTypes(speciesData, formId, generationNumber) {
  const form =
    speciesData.forms?.find((f) => f.formId === formId) ||
    speciesData.forms?.find((f) => Boolean(f.isDefault)) ||
    speciesData.forms?.[0];
  if (!form) return [];

  if (generationNumber && form.pastTypes) {
    const genKeys = Object.keys(form.pastTypes)
      .map(Number)
      .sort((a, b) => b - a);
    for (const pastGen of genKeys) {
      if (generationNumber <= pastGen) {
        return form.pastTypes[pastGen] || [];
      }
    }
  }

  return form.types || [];
}

const REGIONAL_SPECIES_MAP = {
  alola: [19, 26, 27, 28, 37, 38, 50, 51, 52, 53, 74, 75, 76, 88, 89, 103, 105],
  galar: [
    52, 77, 78, 79, 80, 83, 110, 122, 144, 145, 146, 199, 222, 263, 264, 554,
    555, 562, 618,
  ],
  hisui: [
    58, 59, 100, 101, 157, 211, 215, 503, 549, 570, 571, 628, 705, 706, 713,
    724,
  ],
  paldea: [128, 194],
};

/**
 * Resolves and formats evolution flowchart paths based on game scope, generation, and form context.
 * Adapts to sparse format where isBaby, region, reverseBreeding, and conditions are omitted when false/null.
 *
 * @param {Object} evoData - Evolution chain object from evolutions.json or game-specific evolution JSON.
 * @param {number} speciesId - Active species ID.
 * @param {number} formId - Active form ID.
 * @param {string} gameId - Active game identifier.
 * @param {number|null} generationNumber - Active game generation number.
 * @param {Record<number, Object>} allSpecies - Master species dataset.
 * @returns {Array<Object>} Processed evolution paths ready for UI rendering.
 */
function resolveEvolutionFlowchart(
  evoData,
  speciesId,
  formId,
  gameId,
  generationNumber,
  allSpecies,
) {
  if (!evoData || !evoData.paths || !evoData.paths.length) {
    return [
      {
        root: {
          speciesId,
          spriteId: formId,
          name: resolveSpeciesDisplayName(speciesId),
        },
        steps: [],
      },
    ];
  }

  const activeSpecies = allSpecies[speciesId];
  const activeForm =
    activeSpecies?.forms?.find((f) => f.formId === formId) ||
    activeSpecies?.forms?.[0];
  const activeRegion =
    activeForm?.region ||
    (activeForm?.formKey &&
    ["alola", "galar", "hisui", "paldea"].includes(activeForm.formKey)
      ? activeForm.formKey
      : null);

  const nodeGenMap = new Map();
  (evoData.nodes || []).forEach((node) => {
    nodeGenMap.set(node.speciesId, node.generation || 1);
  });

  const isLgpe = gameId === "lgpe";
  const filteredPaths = [];

  for (const path of evoData.paths) {
    const fullLine = [
      { speciesId: path.root.speciesId, name: path.root.name },
      ...path.steps.map((s) => ({ speciesId: s.toSpeciesId, name: s.toName })),
    ];

    // Find lowest-generation ancestor introduced in or before generationNumber
    const rootIndex = fullLine.findIndex((member) => {
      const gen = nodeGenMap.get(member.speciesId) || 1;
      if (generationNumber && gen > generationNumber) return false;
      if (
        isLgpe &&
        member.speciesId > 151 &&
        member.speciesId !== 808 &&
        member.speciesId !== 809
      )
        return false;
      return true;
    });

    if (rootIndex === -1) continue;

    const newRootSpecies = fullLine[rootIndex];
    const validSteps = [];

    for (let i = rootIndex; i < path.steps.length; i += 1) {
      const step = path.steps[i];
      const stepGen = nodeGenMap.get(step.toSpeciesId) || 1;

      // Generation scope check
      if (generationNumber && stepGen > generationNumber) continue;

      // LGPE Kanto scope check
      if (
        isLgpe &&
        step.toSpeciesId > 151 &&
        step.toSpeciesId !== 808 &&
        step.toSpeciesId !== 809
      ) {
        continue;
      }

      // Regional form filtering:
      // 1. When viewing a regional form, exclude steps for mismatched regions
      if (step.region && activeRegion && step.region !== activeRegion) continue;

      // 2. When viewing a non-regional form of a species that has a regional variant,
      // skip steps specific to the regional variant (unless the active species being inspected is the evolved form itself)
      if (
        step.region &&
        !activeRegion &&
        speciesId !== step.toSpeciesId &&
        REGIONAL_SPECIES_MAP[step.region]?.includes(newRootSpecies.speciesId)
      ) {
        continue;
      }

      // 3. Skip standard steps when inspecting regional forms that have their own exclusive evolution paths
      if (!step.region && activeRegion) {
        if (
          activeRegion === "alola" &&
          [19, 27, 37, 52].includes(newRootSpecies.speciesId)
        )
          continue;
        if (
          activeRegion === "galar" &&
          [52, 79, 122, 222, 264, 554, 562].includes(newRootSpecies.speciesId)
        )
          continue;
        if (
          activeRegion === "hisui" &&
          [100, 211, 215].includes(newRootSpecies.speciesId)
        )
          continue;
        if (
          activeRegion === "paldea" &&
          [194].includes(newRootSpecies.speciesId)
        )
          continue;
      }

      validSteps.push({
        toSpeciesId: step.toSpeciesId,
        toSpriteId: resolveMemberSpriteId(
          allSpecies,
          step.toSpeciesId,
          speciesId,
          formId,
          activeRegion,
        ),
        toName: resolveSpeciesDisplayName(step.toSpeciesId, step.toName),
        description: step.description,
        reverseBreeding:
          generationNumber === 1 ? null : step.reverseBreeding || null,
      });
    }

    const pathSpecies = [
      newRootSpecies.speciesId,
      ...validSteps.map((s) => s.toSpeciesId),
    ];
    if (!pathSpecies.includes(speciesId)) continue;

    filteredPaths.push({
      root: {
        speciesId: newRootSpecies.speciesId,
        spriteId: resolveMemberSpriteId(
          allSpecies,
          newRootSpecies.speciesId,
          speciesId,
          formId,
          activeRegion,
        ),
        name: resolveSpeciesDisplayName(
          newRootSpecies.speciesId,
          newRootSpecies.name,
        ),
      },
      steps: validSteps,
    });
  }

  // Discard empty residual paths if valid evolution paths exist
  const hasPathsWithSteps = filteredPaths.some((p) => p.steps.length > 0);
  const candidatePaths = hasPathsWithSteps
    ? filteredPaths.filter((p) => p.steps.length > 0)
    : filteredPaths;

  // Deduplicate identical paths
  const uniquePaths = [];
  const seenSignatures = new Set();

  for (const path of candidatePaths) {
    const signature = `${path.root.spriteId}->${path.steps.map((s) => `${s.toSpriteId}:${s.description}`).join("->")}`;
    if (!seenSignatures.has(signature)) {
      seenSignatures.add(signature);
      uniquePaths.push(path);
    }
  }

  return uniquePaths.length
    ? uniquePaths
    : [
        {
          root: {
            speciesId,
            spriteId: formId,
            name: resolveSpeciesDisplayName(speciesId),
          },
          steps: [],
        },
      ];
}

/**
 * Finds the pre-evolution species display name if available in filtered paths.
 *
 * @param {Array<Object>} paths - Resolved evolution flowchart paths.
 * @param {number} speciesId - Target species ID.
 * @returns {string} Name of pre-evolution or empty string.
 */
function findPreEvolutionName(paths, speciesId) {
  for (const path of paths) {
    if (path.root.speciesId === speciesId) continue;
    let prevName = path.root.name;
    for (const step of path.steps) {
      if (step.toSpeciesId === speciesId) {
        return prevName;
      }
      prevName = step.toName;
    }
  }
  return "";
}

/**
 * Clusters game versions by identical location arrays into unified display groups.
 * Handles base game versions and expansion pass versions separately using on-demand encounters data.
 *
 * @param {Object} gameDexData - Game dex dataset from games/dex/*.json.
 * @param {Object} gameEncountersData - Game encounters dataset from games/encounters/*.json.
 * @param {number} speciesId - Target species ID.
 * @param {string} preEvolutionName - Pre-evolution name if applicable.
 * @returns {Array<Object>} Formatted encounter groups for UI.
 */
function resolveEncounterGroups(
  gameDexData,
  gameEncountersData,
  speciesId,
  preEvolutionName,
) {
  if (!gameDexData || !gameDexData.versions) return [];

  const allVersions = gameDexData.versions;
  const rawEncounters = gameEncountersData?.encounters || {};

  const baseVersions = allVersions.filter(
    (v) => !v.endsWith("-expansion-pass"),
  );
  const expansionVersions = allVersions.filter((v) =>
    v.endsWith("-expansion-pass"),
  );

  /**
   * Clusters a subset of versions by identical location entries.
   *
   * @param {string[]} versions - Versions to cluster.
   * @param {boolean} [isExpansion=false] - Whether these are expansion versions.
   * @returns {Array<Object>} Clustered encounter groups.
   */
  function clusterVersionSet(versions, isExpansion = false) {
    if (!versions.length) return [];

    const versionLocationMap = new Map();
    for (const version of versions) {
      const enc = getVersionEncounters(rawEncounters, speciesId, version);
      const locs = enc?.locations || [];
      versionLocationMap.set(version, locs);
    }

    const groupMap = new Map();
    for (const version of versions) {
      const locs = versionLocationMap.get(version) || [];
      const key = locs.slice().sort().join("|||");
      if (!groupMap.has(key)) {
        groupMap.set(key, { versions: [], entries: locs });
      }
      groupMap.get(key).versions.push(version);
    }

    const groups = Array.from(groupMap.values());
    const populatedGroups = groups.filter((g) => g.entries.length > 0);
    const populatedVersions = populatedGroups.flatMap((g) => g.versions);

    // Expansion groups are omitted completely if no expansion encounters exist
    if (isExpansion && !populatedGroups.length) {
      return [];
    }

    // If no versions in this set have encounters
    if (!populatedGroups.length) {
      return [];
    }

    // All versions in this set share identical encounters
    if (
      populatedGroups.length === 1 &&
      populatedGroups[0].versions.length === versions.length
    ) {
      return [
        {
          versionHeader: joinVersionNames(versions),
          locations: populatedGroups[0].entries,
        },
      ];
    }

    // Mixed versions
    return groups
      .filter((groupData) => groupData.entries.length > 0 || !isExpansion)
      .map((groupData) => {
        const header = joinVersionNames(groupData.versions);
        if (groupData.entries.length > 0) {
          return {
            versionHeader: header,
            locations: groupData.entries,
          };
        }

        const tradeSources = populatedVersions.filter(
          (v) => !groupData.versions.includes(v),
        );
        return {
          versionHeader: header,
          locations: [],
          tradeNote: formatTradeSourceList(tradeSources),
        };
      });
  }

  const baseGroups = clusterVersionSet(baseVersions, false);
  const expansionGroups = clusterVersionSet(expansionVersions, true);
  const combined = [...baseGroups, ...expansionGroups];

  if (!combined.length) {
    if (preEvolutionName) {
      return [
        {
          versionHeader: joinVersionNames(
            baseVersions.length ? baseVersions : allVersions,
          ),
          locations: [],
          evolveNote: `Evolve ${preEvolutionName}`,
        },
      ];
    }
    return [
      {
        versionHeader: "",
        locations: [],
        emptyNote: "No encounters in this generation.",
      },
    ];
  }

  return combined;
}

/**
 * Retrieves fully formatted and scoped data for rendering the Pokémon Info modal.
 * Decouples game dex, encounters, and flavor text loading on-demand.
 *
 * @param {number} speciesId - National Pokédex species ID.
 * @param {number} formId - Specific form ID or sprite ID.
 * @param {string} gameId - Active game identifier (e.g. 'home', 'rby', 'sv').
 * @returns {Promise<Object>} Aggregated Pokémon modal view model.
 */
export async function getPokemonModalData(speciesId, formId, gameId) {
  const allSpecies = await getAllSpeciesData();
  const speciesData = allSpecies[speciesId];
  if (!speciesData) {
    throw new Error(`Species #${speciesId} not found in database.`);
  }

  const [gameDexData, evoData] = await Promise.all([
    getGameDexData(gameId),
    getEvolutionData(speciesData.evolutionChainId, gameId),
  ]);

  const language = loadSettings().language || "en";
  const generationNumber = gameDexData?.generation || null;

  const name = resolveSpeciesDisplayName(
    speciesId,
    speciesData.names?.[language] || speciesData.names?.en || speciesData.name,
  );
  const types = resolveTypes(speciesData, formId, generationNumber);
  const flavorText = await getFlavorText(speciesId, language);

  const evolutionPaths = resolveEvolutionFlowchart(
    evoData,
    speciesId,
    formId,
    gameId,
    generationNumber,
    allSpecies,
  );
  const preEvolutionName = findPreEvolutionName(evolutionPaths, speciesId);

  const showEncounters = gameId !== "home";
  let encounterGroups = [];
  if (showEncounters) {
    const gameEncountersData = await getGameEncounterData(gameId);
    encounterGroups = resolveEncounterGroups(
      gameDexData,
      gameEncountersData,
      speciesId,
      preEvolutionName,
    );
  }

  return {
    speciesId,
    formId,
    name,
    dexNumber: `#${speciesId}`,
    types,
    flavorText,
    showEncounters,
    encounterGroups,
    evolutionPaths,
  };
}
