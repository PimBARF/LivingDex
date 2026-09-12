import { ACTIVE_GAME_ID, normalizeItemName } from "./config.js";
import {
  loadSegmentConfig,
  loadEnabledSegments,
  loadSettings,
  getGameLayoutPreset,
  loadItemInventory,
  loadSpecimenInventory,
  getSelectedGameVersion,
} from "./storage.js";
import { applyLayoutPreset } from "./layout.js";
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

  const [gameData, speciesData, evolutionsData] = await Promise.all([
    getGameDexData(ACTIVE_GAME_ID),
    getAllSpeciesData(),
    getAllEvolutionData(),
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

  const activePreset = getGameLayoutPreset(ACTIVE_GAME_ID);
  const transformedSections = applyLayoutPreset(sections, activePreset, {
    speciesData,
    evolutionsData,
    gameId: ACTIVE_GAME_ID,
  });

  return { sections: transformedSections, warnings };
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
    const activeSpecies = allSpecies[activeSpeciesId];
    const activeForm = activeSpecies?.forms?.find(
      (f) => f.formId === activeFormId,
    );
    return activeForm?.spriteId || activeFormId || targetSpeciesId;
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
        return matchingForm.spriteId || matchingForm.formId;
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
  const activeSpecies = allSpecies[speciesId];
  const activeForm =
    activeSpecies?.forms?.find((f) => f.formId === formId) ||
    activeSpecies?.forms?.[0];
  const resolvedRootSpriteId = activeForm?.spriteId || formId || speciesId;

  if (!evoData || !evoData.paths || !evoData.paths.length) {
    return [
      {
        root: {
          speciesId,
          spriteId: resolvedRootSpriteId,
          name: resolveSpeciesDisplayName(speciesId),
        },
        steps: [],
      },
    ];
  }
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
            spriteId: resolvedRootSpriteId,
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
 * Detects if a set of encounter locations exclusively requires a specific method.
 *
 * @param {string[]} locations - List of location strings.
 * @returns {string|null} Descriptive note or null if no single exclusive method applies.
 */
export function detectExclusiveEncounterMethod(locations) {
  if (!locations || !locations.length) return null;

  const wildLocs = locations.filter(
    (loc) => !/^(Evolve|Trade|Breed|Received|Buy|Gift|Event)/i.test(loc.trim()),
  );
  if (!wildLocs.length) return null;

  // 1. Fishing exclusively
  const isAllFishing = wildLocs.every(
    (loc) =>
      /\b(fishing|old rod|good rod|super rod|rod)\b/i.test(loc) &&
      !/\b(surfing|swimming|walking|grass|cave|overworld)\b/i.test(loc),
  );
  if (isAllFishing) {
    const isAllSuperRod = wildLocs.every((loc) => /super rod/i.test(loc));
    const isAllOldRod = wildLocs.every((loc) => /old rod/i.test(loc));
    const isAllGoodRod = wildLocs.every((loc) => /good rod/i.test(loc));
    if (isAllSuperRod) return "Encountered only via fishing (Super Rod)";
    if (isAllOldRod) return "Encountered only via fishing (Old Rod)";
    if (isAllGoodRod) return "Encountered only via fishing (Good Rod)";
    return "Encountered only via fishing";
  }

  // 2. Surfing / Swimming exclusively
  const isAllSurfing = wildLocs.every(
    (loc) =>
      /\b(surfing|swimming|sea skim)\b/i.test(loc) &&
      !/\b(fishing|rod|walking|grass|cave)\b/i.test(loc),
  );
  if (isAllSurfing) {
    return "Encountered only while swimming / surfing";
  }

  // 3. Diving / Underwater exclusively
  const isAllDiving = wildLocs.every((loc) =>
    /\b(underwater|diving)\b/i.test(loc),
  );
  if (isAllDiving) {
    return "Encountered only underwater (Diving)";
  }

  // 4. Rock Smash exclusively
  const isAllRockSmash = wildLocs.every((loc) => /\b(rock smash)\b/i.test(loc));
  if (isAllRockSmash) {
    return "Encountered only by using Rock Smash";
  }

  // 5. Trees / Headbutt / Honey Trees exclusively
  const isAllTrees = wildLocs.every((loc) =>
    /\b(honey trees?|headbutt|tree shaking)\b/i.test(loc),
  );
  if (isAllTrees) {
    return "Encountered only in trees (Headbutt / Honey Trees)";
  }

  // 6. Raids exclusively
  const isAllRaids = wildLocs.every((loc) =>
    /\b(max raid|tera raid|dynamax adventure)\b/i.test(loc),
  );
  if (isAllRaids) {
    return "Encountered only in Raid Battles";
  }

  return null;
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
          methodNote: detectExclusiveEncounterMethod(
            populatedGroups[0].entries,
          ),
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
            methodNote: detectExclusiveEncounterMethod(groupData.entries),
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

/**
/**
 * In-memory cache for species availability mapping in Pokemon HOME.
 * @type {Map<number, string[]>|null}
 */
let homeSpeciesGamesCache = null;

/**
 * Maps each species ID to the list of games where it is obtainable in their Pokédexes.
 *
 * @returns {Promise<Map<number, string[]>>} Map of speciesId -> array of game titles.
 */
export async function getHomeSpeciesGamesMap() {
  if (homeSpeciesGamesCache) return homeSpeciesGamesCache;

  const map = new Map();
  const GAME_LIST = [
    { id: "sv", name: "Scarlet / Violet" },
    { id: "swsh", name: "Sword / Shield" },
    { id: "pla", name: "Legends: Arceus" },
    { id: "bdsp", name: "BD / SP" },
    { id: "lgpe", name: "Let's Go Pikachu / Eevee" },
    { id: "usum", name: "Ultra Sun / Ultra Moon" },
    { id: "sm", name: "Sun / Moon" },
    { id: "oras", name: "Omega Ruby / Alpha Sapphire" },
    { id: "xy", name: "X / Y" },
    { id: "b2w2", name: "Black 2 / White 2" },
    { id: "bw", name: "Black / White" },
    { id: "hgss", name: "HeartGold / SoulSilver" },
    { id: "dppt", name: "Diamond / Pearl / Platinum" },
    { id: "frlg", name: "FireRed / LeafGreen" },
    { id: "rse", name: "Ruby / Sapphire / Emerald" },
    { id: "gsc", name: "Gold / Silver / Crystal" },
    { id: "rby", name: "Red / Blue / Yellow" },
  ];

  await Promise.all(
    GAME_LIST.map(async (g) => {
      try {
        const dexData = await getGameDexData(g.id);
        if (dexData && Array.isArray(dexData.sections)) {
          dexData.sections.forEach((sec) => {
            if (Array.isArray(sec.entries)) {
              sec.entries.forEach((e) => {
                if (!map.has(e.speciesId)) {
                  map.set(e.speciesId, []);
                }
                const list = map.get(e.speciesId);
                if (!list.includes(g.name)) {
                  list.push(g.name);
                }
              });
            }
          });
        }
      } catch {
        // Skip games that fail to load
      }
    }),
  );

  homeSpeciesGamesCache = map;
  return map;
}

/**
 * Formats a game version code into a human-readable title (e.g. 'black-2' -> 'Black 2').
 *
 * @param {string} v - The raw version code.
 * @returns {string} Formatted version display name.
 */
export function formatVersionName(v) {
  if (!v) return "";
  const map = {
    red: "Red",
    blue: "Blue",
    yellow: "Yellow",
    gold: "Gold",
    silver: "Silver",
    crystal: "Crystal",
    ruby: "Ruby",
    sapphire: "Sapphire",
    emerald: "Emerald",
    firered: "FireRed",
    leafgreen: "LeafGreen",
    diamond: "Diamond",
    pearl: "Pearl",
    platinum: "Platinum",
    heartgold: "HeartGold",
    soulsilver: "SoulSilver",
    black: "Black",
    white: "White",
    "black-2": "Black 2",
    "white-2": "White 2",
    x: "X",
    y: "Y",
    "omega-ruby": "Omega Ruby",
    "alpha-sapphire": "Alpha Sapphire",
    sun: "Sun",
    moon: "Moon",
    "ultra-sun": "Ultra Sun",
    "ultra-moon": "Ultra Moon",
    "lets-go-pikachu": "Let's Go Pikachu",
    "lets-go-eevee": "Let's Go Eevee",
    sword: "Sword",
    shield: "Shield",
    "brilliant-diamond": "Brilliant Diamond",
    "shining-pearl": "Shining Pearl",
    "legends-arceus": "Legends: Arceus",
    scarlet: "Scarlet",
    violet: "Violet",
    "legends-z-a": "Legends: Z-A",
    home: "HOME",
  };
  return map[v] || v.charAt(0).toUpperCase() + v.slice(1).replace(/-/g, " ");
}

/**
 * Retrieves enriched data for all uncaught Pokémon in the active game / living dex.
 *
 * @param {string} gameId - Active game identifier.
 * @param {Record<number, boolean>} [caughtSlots={}] - Map of caught slot indices.
 * @param {string} [targetVersion=""] - Optional specific game version (e.g. 'yellow' or 'all').
 * @returns {Promise<Array<Object>>} List of missing Pokémon records with acquisition details.
 */
export async function getMissingPokemonData(
  gameId,
  caughtSlots = {},
  targetVersion = "",
) {
  const allSpecies = await getAllSpeciesData();
  const gameDexData = await getGameDexData(gameId);
  const evoDataMap = await loadEvolutions(gameId);
  const encountersData =
    gameId !== "home" ? await getGameEncounterData(gameId) : { encounters: {} };
  const { sections } = await buildActiveDexSections();
  const language = loadSettings().language || "en";
  const generationNumber = gameDexData?.generation || null;
  const itemInventory = loadItemInventory();
  const specimenInventory = loadSpecimenInventory();

  const caughtSpeciesIds = new Set();
  const caughtSlotsMap = caughtSlots || {};

  let runningSlot = 0;
  const allSlots = [];
  sections.forEach((section) => {
    (section.entries || []).forEach((entry) => {
      runningSlot += 1;
      const specimenKey =
        entry.specimenKey ||
        `${entry.speciesId}:${entry.formId || entry.speciesId}:${entry.gender || ""}:${entry.spriteId || entry.formId || entry.speciesId}`;
      const isCaught = specimenKey
        ? Boolean(caughtSlotsMap[specimenKey])
        : Boolean(caughtSlotsMap[runningSlot]);
      if (isCaught) {
        caughtSpeciesIds.add(entry.speciesId);
      }
      allSlots.push({
        slotNumber: runningSlot,
        speciesId: entry.speciesId,
        formId: entry.formId || entry.speciesId,
        gender: entry.gender || "",
        sectionKey: section.key,
        sectionTitle: section.title,
        isCaught,
      });
    });
  });

  const missingEntries = allSlots.filter((slot) => !slot.isCaught);
  const isHome = gameId === "home";
  const homeGamesMap = isHome ? await getHomeSpeciesGamesMap() : null;
  const effectiveVersion =
    targetVersion || getSelectedGameVersion(gameId) || "all";
  const results = [];

  for (const slot of missingEntries) {
    const species = allSpecies[slot.speciesId];
    if (!species) continue;

    const form =
      species.forms?.find((f) => f.formId === slot.formId) ||
      species.forms?.[0];
    const spriteId =
      slot.gender === "female"
        ? slot.speciesId
        : form?.spriteId || slot.formId || slot.speciesId;
    const displayName = resolveSpeciesDisplayName(
      slot.speciesId,
      species.names?.[language] || species.names?.en || species.name,
    );
    const types = resolveTypes(species, slot.formId, generationNumber);

    // Locations or obtainable games
    let locations = [];
    let exclusiveTo = [];
    if (isHome) {
      locations = homeGamesMap?.get(slot.speciesId) || [];
    } else if (gameDexData?.versions) {
      const rawEnc = encountersData?.encounters || {};
      if (effectiveVersion && effectiveVersion !== "all") {
        const vEnc = getVersionEncounters(
          rawEnc,
          slot.speciesId,
          effectiveVersion,
        );
        if (vEnc?.locations?.length) {
          locations = [...vEnc.locations];
        } else {
          // Check sibling versions for availability
          const siblings = gameDexData.versions.filter(
            (v) => v !== effectiveVersion,
          );
          for (const sib of siblings) {
            const sEnc = getVersionEncounters(rawEnc, slot.speciesId, sib);
            if (sEnc?.locations?.length) {
              exclusiveTo.push(formatVersionName(sib));
            }
          }
        }
      } else {
        for (const version of gameDexData.versions) {
          const vEnc = getVersionEncounters(rawEnc, slot.speciesId, version);
          if (vEnc?.locations?.length) {
            locations.push(...vEnc.locations);
          }
        }
        locations = Array.from(new Set(locations));
      }
    }

    // Evolution path analysis
    const chain = species.evolutionChainId
      ? evoDataMap[species.evolutionChainId]
      : null;
    let evolveDetails = null;
    let preEvolutionSpeciesId = null;
    let preEvolutionName = "";
    let preSpecimenCount = 0;
    let hasSurplusPreEvo = false;
    let hasExactOnePreEvo = false;
    let isReadyToEvolve = false;
    let isSacrificeEvolve = false;
    let hasPreEvo = false;
    let hasItem = true;
    let requiredItem = null;
    let requiredCondition = "";
    let methodCategory = locations.length > 0 ? "wild" : "transfer";

    if (chain && Array.isArray(chain.transitions)) {
      const incomingTransition = chain.transitions.find(
        (t) => t.toSpeciesId === slot.speciesId,
      );
      if (incomingTransition) {
        preEvolutionSpeciesId = incomingTransition.fromSpeciesId;
        const preSpec = allSpecies[preEvolutionSpeciesId];
        preEvolutionName = resolveSpeciesDisplayName(
          preEvolutionSpeciesId,
          preSpec?.names?.[language] || preSpec?.names?.en || preSpec?.name,
        );

        const preInventoryCount = specimenInventory[preEvolutionSpeciesId];
        const preCaughtInDex = caughtSpeciesIds.has(preEvolutionSpeciesId);
        preSpecimenCount =
          typeof preInventoryCount === "number"
            ? preInventoryCount
            : preCaughtInDex
              ? 1
              : 0;

        hasSurplusPreEvo = preSpecimenCount >= 2;
        hasExactOnePreEvo = preSpecimenCount === 1;
        hasPreEvo = preSpecimenCount > 0;

        requiredItem =
          incomingTransition.item || incomingTransition.heldItem || null;
        requiredCondition = incomingTransition.description || "";

        hasItem = requiredItem ? (itemInventory[requiredItem] || 0) > 0 : true;

        isReadyToEvolve = Boolean(hasSurplusPreEvo && hasItem);
        isSacrificeEvolve = Boolean(hasExactOnePreEvo && hasItem);

        evolveDetails = {
          fromSpeciesId: preEvolutionSpeciesId,
          fromName: preEvolutionName,
          trigger: incomingTransition.trigger,
          description: incomingTransition.description,
          item: requiredItem,
          hasPreEvo,
          hasSurplusPreEvo,
          hasExactOnePreEvo,
          preSpecimenCount,
          hasItem,
          isReady: isReadyToEvolve,
          isSacrifice: isSacrificeEvolve,
        };

        if (requiredItem) {
          methodCategory = "item";
        } else if (incomingTransition.trigger === "trade") {
          methodCategory = "trade";
        } else if (incomingTransition.trigger === "level-up") {
          methodCategory = "level";
        } else {
          methodCategory = "special";
        }
      }
    }

    results.push({
      slotNumber: slot.slotNumber,
      speciesId: slot.speciesId,
      formId: slot.formId,
      gender: slot.gender,
      spriteId,
      name: displayName,
      dexNumber: `#${slot.speciesId}`,
      types,
      sectionKey: slot.sectionKey,
      sectionTitle: slot.sectionTitle,
      locations,
      hasWildLocations: locations.length > 0,
      exclusiveTo,
      targetVersion: effectiveVersion,
      evolveDetails,
      preEvolutionSpeciesId,
      preEvolutionName,
      preSpecimenCount,
      hasSurplusPreEvo,
      hasExactOnePreEvo,
      isReadyToEvolve,
      isSacrificeEvolve,
      hasPreEvo,
      hasItem,
      requiredItem,
      requiredCondition,
      methodCategory,
    });
  }

  return results;
}

/**
 * Calculates evolution family Living Dex quotas and checklist for incomplete evolutionary trees.
 *
 * @param {string} gameId - Active game identifier.
 * @param {Record<number, boolean>} [caughtSlots={}] - Map of caught slot indices.
 * @returns {Promise<Array<Object>>} List of incomplete evolution families with quota calculations.
 */
export async function getEvolutionFamilyChecklist(gameId, caughtSlots = {}) {
  const allSpecies = await getAllSpeciesData();
  const gameDexData = await getGameDexData(gameId);
  const evoDataMap = await loadEvolutions(gameId);
  const { sections } = await buildActiveDexSections();
  const language = loadSettings().language || "en";
  const generationNumber = gameDexData?.generation || null;
  const specimenInventory = loadSpecimenInventory();
  const itemInventory = loadItemInventory();

  const caughtSlotsMap = caughtSlots || {};

  // Map all active slots by evolutionChainId
  const chainSlotsMap = new Map();
  let runningSlot = 0;

  sections.forEach((section) => {
    (section.entries || []).forEach((entry) => {
      runningSlot += 1;
      const species = allSpecies[entry.speciesId];
      if (!species) return;

      const chainId = species.evolutionChainId || `single-${entry.speciesId}`;
      if (!chainSlotsMap.has(chainId)) {
        chainSlotsMap.set(chainId, []);
      }

      const specimenKey =
        entry.specimenKey ||
        `${entry.speciesId}:${entry.formId || entry.speciesId}:${entry.gender || ""}:${entry.spriteId || entry.formId || entry.speciesId}`;
      const isCaught = specimenKey
        ? Boolean(caughtSlotsMap[specimenKey])
        : Boolean(caughtSlotsMap[runningSlot]);
      const form =
        species.forms?.find((f) => f.formId === entry.formId) ||
        species.forms?.[0];
      const spriteId =
        entry.gender === "female"
          ? entry.speciesId
          : form?.spriteId || entry.formId || entry.speciesId;
      const displayName = resolveSpeciesDisplayName(
        entry.speciesId,
        species.names?.[language] || species.names?.en || species.name,
      );
      const types = resolveTypes(species, entry.formId, generationNumber);

      chainSlotsMap.get(chainId).push({
        slotNumber: runningSlot,
        speciesId: entry.speciesId,
        formId: entry.formId || entry.speciesId,
        gender: entry.gender || "",
        spriteId,
        name: displayName,
        dexNumber: `#${entry.speciesId}`,
        types,
        sectionKey: section.key,
        sectionTitle: section.title,
        isCaught,
      });
    });
  });

  const familyList = [];

  for (const [chainId, slots] of chainSlotsMap.entries()) {
    const totalCount = slots.length;
    const caughtCount = slots.filter((s) => s.isCaught).length;
    const missingCount = totalCount - caughtCount;

    // Only include incomplete families
    if (missingCount === 0) continue;

    const chain = typeof chainId === "number" ? evoDataMap[chainId] : null;

    // Identify root/base species
    let rootSpeciesId = slots[0].speciesId;
    let rootName = slots[0].name;
    let rootSpriteId = slots[0].spriteId;

    if (chain && Array.isArray(chain.nodes) && chain.nodes.length > 0) {
      const baseNode = chain.nodes[0];
      const baseSpec = allSpecies[baseNode.speciesId];
      rootSpeciesId = baseNode.speciesId;
      rootName = resolveSpeciesDisplayName(
        baseNode.speciesId,
        baseSpec?.names?.[language] || baseSpec?.names?.en || baseSpec?.name,
      );
      const rootForm = baseSpec?.forms?.[0];
      rootSpriteId = rootForm?.spriteId || baseNode.speciesId;
    }

    // Required items and specimen counts for this family
    let totalSpecimensOwnedInFamily = 0;
    const requiredItemsMap = new Map();
    const membersWithEvolutions = slots.map((slot) => {
      let evolveText = "";
      let evolveItem = null;

      if (chain && Array.isArray(chain.transitions)) {
        const transition = chain.transitions.find(
          (t) => t.toSpeciesId === slot.speciesId,
        );
        if (transition) {
          evolveText = transition.description || "";
          evolveItem = transition.item || transition.heldItem || null;
          if (!slot.isCaught && evolveItem) {
            requiredItemsMap.set(
              evolveItem,
              (requiredItemsMap.get(evolveItem) || 0) + 1,
            );
          }
        }
      }

      const explicitCount = specimenInventory[slot.speciesId];
      const specimenCount =
        typeof explicitCount === "number"
          ? explicitCount
          : slot.isCaught
            ? 1
            : 0;
      totalSpecimensOwnedInFamily += specimenCount;

      return {
        ...slot,
        specimenCount,
        evolveText,
        evolveItem,
      };
    });

    const requiredItems = Array.from(requiredItemsMap.entries()).map(
      ([item, count]) => {
        const ownedCount = itemInventory[item] || 0;
        const remainingCount = Math.max(0, count - ownedCount);
        return {
          itemKey: item,
          itemName: normalizeItemName(item),
          count,
          ownedCount,
          remainingCount,
          isComplete: ownedCount >= count,
        };
      },
    );

    const baseQuota = Math.max(0, totalCount - totalSpecimensOwnedInFamily);

    familyList.push({
      chainId,
      rootSpeciesId,
      rootName,
      rootSpriteId,
      baseSpeciesName: rootName,
      totalCount,
      caughtCount,
      missingCount,
      totalSpecimensOwnedInFamily,
      baseQuota,
      members: membersWithEvolutions,
      requiredItems,
    });
  }

  // Sort families by root species ID
  familyList.sort((a, b) => a.rootSpeciesId - b.rootSpeciesId);
  return familyList;
}

/**
 * Aggregates all evolution items, trade items, and condition tasks needed across all uncaught Pokémon.
 *
 * @param {string} gameId - Active game identifier.
 * @param {Record<number, boolean>} [caughtSlots={}] - Map of caught slot indices.
 * @returns {Promise<Object>} Aggregated shopping list of items, trades, and conditions.
 */
export async function getEvolutionItemsSummary(gameId, caughtSlots = {}) {
  const missingPokemon = await getMissingPokemonData(gameId, caughtSlots);
  const itemInventory = loadItemInventory();

  const itemsMap = new Map();
  const tradeList = [];
  const tradeHoldingItemList = [];
  const friendshipList = [];
  const moveList = [];
  const timeList = [];

  for (const p of missingPokemon) {
    if (!p.evolveDetails) continue;

    const { item, trigger, description } = p.evolveDetails;

    if (item) {
      if (!itemsMap.has(item)) {
        const owned = itemInventory[item] || 0;
        itemsMap.set(item, {
          itemKey: item,
          itemName: normalizeItemName(item),
          count: 0,
          ownedCount: owned,
          remainingCount: 0,
          isComplete: false,
          pokemonList: [],
        });
      }
      const entry = itemsMap.get(item);
      entry.count += 1;
      entry.remainingCount = Math.max(0, entry.count - entry.ownedCount);
      entry.isComplete = entry.ownedCount >= entry.count;
      entry.pokemonList.push({
        speciesId: p.speciesId,
        name: p.name,
        spriteId: p.spriteId,
        slotNumber: p.slotNumber,
      });
    }

    if (trigger === "trade") {
      if (item) {
        tradeHoldingItemList.push(p);
      } else {
        tradeList.push(p);
      }
    }

    if (
      description &&
      (description.toLowerCase().includes("friendship") ||
        description.toLowerCase().includes("happiness"))
    ) {
      friendshipList.push(p);
    }

    if (
      description &&
      (description.toLowerCase().includes("knowing") ||
        description.toLowerCase().includes("move") ||
        description.toLowerCase().includes("fist"))
    ) {
      moveList.push(p);
    }

    if (
      description &&
      (description.toLowerCase().includes("night") ||
        description.toLowerCase().includes("day"))
    ) {
      timeList.push(p);
    }
  }

  const itemsArray = Array.from(itemsMap.values()).sort(
    (a, b) => b.count - a.count || a.itemName.localeCompare(b.itemName),
  );

  return {
    items: itemsArray,
    totalItemsCount: itemsArray.reduce((sum, item) => sum + item.count, 0),
    totalRemainingCount: itemsArray.reduce(
      (sum, item) => sum + item.remainingCount,
      0,
    ),
    tradeList,
    tradeHoldingItemList,
    friendshipList,
    moveList,
    timeList,
  };
}

// =============================================================================
// SPECIES CLASSIFICATION, EVOLUTION STAGES & FILTER CAPABILITIES
// =============================================================================

export const ALL_POKEMON_TYPES = [
  "normal",
  "fire",
  "water",
  "grass",
  "electric",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "steel",
  "dark",
  "fairy",
];

export const GEN1_TYPES = [
  "normal",
  "fire",
  "water",
  "grass",
  "electric",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
];

export const GEN2_5_TYPES = [
  "normal",
  "fire",
  "water",
  "grass",
  "electric",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "steel",
  "dark",
];

export const STARTER_SPECIES_IDS = new Set([
  // Gen 1
  1, 2, 3, 4, 5, 6, 7, 8, 9,
  // Gen 2
  152, 153, 154, 155, 156, 157, 158, 159, 160,
  // Gen 3
  252, 253, 254, 255, 256, 257, 258, 259, 260,
  // Gen 4
  387, 388, 389, 390, 391, 392, 393, 394, 395,
  // Gen 5
  495, 496, 497, 498, 499, 500, 501, 502, 503,
  // Gen 6
  650, 651, 652, 653, 654, 655, 656, 657, 658,
  // Gen 7
  722, 723, 724, 725, 726, 727, 728, 729, 730,
  // Gen 8
  810, 811, 812, 813, 814, 815, 816, 817, 818,
  // Gen 9
  906, 907, 908, 909, 910, 911, 912, 913, 914,
]);

export const BABY_SPECIES_IDS = new Set([
  172, 173, 174, 175, 236, 238, 239, 240, 298, 360, 406, 433, 438, 439, 440,
  446, 447, 458, 848,
]);

export const FOSSIL_SPECIES_IDS = new Set([
  138, 139, 140, 141, 142, 345, 346, 347, 348, 408, 409, 410, 411, 564, 565,
  566, 567, 696, 697, 698, 699, 880, 881, 882, 883,
]);

export const LEGENDARY_SPECIES_IDS = new Set([
  144, 145, 146, 150, 243, 244, 245, 249, 250, 377, 378, 379, 380, 381, 382,
  383, 384, 480, 481, 482, 483, 484, 485, 486, 487, 488, 638, 639, 640, 641,
  642, 643, 644, 645, 646, 716, 717, 718, 772, 773, 785, 786, 787, 788, 789,
  790, 791, 792, 800, 888, 889, 890, 891, 892, 894, 895, 896, 897, 898, 905,
  1001, 1002, 1003, 1004, 1007, 1008, 1014, 1015, 1016, 1017, 1024,
]);

export const MYTHICAL_SPECIES_IDS = new Set([
  151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648, 649, 719, 720,
  721, 801, 802, 807, 808, 809, 893, 1025,
]);

export const ULTRA_BEAST_SPECIES_IDS = new Set([
  793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806,
]);

export const PARADOX_SPECIES_IDS = new Set([
  984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 1005, 1006, 1009,
  1010, 1020, 1021, 1022, 1023,
]);

/**
 * Resolves the generation number for a given species ID.
 *
 * @param {number|string} speciesId - National Pokédex species ID.
 * @returns {number} Generation index (1–9).
 */
export function getSpeciesGeneration(speciesId) {
  const id = Number(speciesId);
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  if (id <= 649) return 5;
  if (id <= 721) return 6;
  if (id <= 809) return 7;
  if (id <= 905) return 8;
  return 9;
}

/**
 * Returns available types for a given game generation era.
 *
 * @param {number|string} [generationNumber] - Game generation number.
 * @returns {string[]} Array of type names.
 */
export function getEraAvailableTypes(generationNumber) {
  if (!generationNumber || generationNumber === "home")
    return ALL_POKEMON_TYPES;
  const gen = Number(generationNumber);
  if (gen === 1) return GEN1_TYPES;
  if (gen >= 2 && gen <= 5) return GEN2_5_TYPES;
  return ALL_POKEMON_TYPES;
}

/**
 * Builds a lookup map of evolution stages across all species.
 *
 * @param {Record<number, Object>} allEvolutions - Evolution dictionary.
 * @returns {Record<number, 'base'|'middle'|'final'|'single'>}
 */
export function buildEvolutionStageMap(allEvolutions) {
  const stageMap = {};
  if (!allEvolutions) return stageMap;

  for (const chain of Object.values(allEvolutions)) {
    const transitions = chain.transitions || [];
    if (!transitions.length) {
      if (chain.nodes) {
        for (const node of chain.nodes) {
          stageMap[node.speciesId] = "single";
        }
      }
      continue;
    }

    const fromSet = new Set(transitions.map((t) => Number(t.fromSpeciesId)));
    const toSet = new Set(transitions.map((t) => Number(t.toSpeciesId)));

    if (chain.nodes) {
      for (const node of chain.nodes) {
        const sid = Number(node.speciesId);
        const evolvesFrom = toSet.has(sid);
        const evolvesTo = fromSet.has(sid);

        if (!evolvesFrom && evolvesTo) {
          stageMap[sid] = "base";
        } else if (evolvesFrom && evolvesTo) {
          stageMap[sid] = "middle";
        } else if (evolvesFrom && !evolvesTo) {
          stageMap[sid] = "final";
        } else {
          stageMap[sid] = "single";
        }
      }
    }
  }

  return stageMap;
}

/**
 * Returns available filter capabilities and metadata for the current game.
 *
 * @param {string} gameId - Active game ID.
 * @param {Object} [dexData] - Loaded game dex data.
 * @returns {Promise<Object>} Capabilities object.
 */
export async function getGameFilterCapabilities(gameId, dexData) {
  const genNumber = dexData?.generation || (gameId === "home" ? 9 : 1);
  const availableTypes = getEraAvailableTypes(genNumber);

  const dexSpeciesIds = new Set();
  const availableGens = new Set();
  let hasRegional = false;
  let hasGender = false;
  let hasSpecial = false;

  if (dexData?.sections) {
    for (const section of dexData.sections) {
      for (const entry of section.entries || []) {
        if (entry.speciesId) {
          dexSpeciesIds.add(Number(entry.speciesId));
          availableGens.add(getSpeciesGeneration(entry.speciesId));
        }
        if (
          entry.formId &&
          entry.formId > 0 &&
          entry.formId !== entry.speciesId
        ) {
          hasSpecial = true;
        }
      }
    }
  }

  const cells = document.querySelectorAll(".cell:not(.is-placeholder)");
  if (cells.length > 0) {
    cells.forEach((cell) => {
      const sid = Number(cell.dataset.national);
      if (sid) {
        dexSpeciesIds.add(sid);
        availableGens.add(getSpeciesGeneration(sid));
      }
      const formName = (cell.dataset.formName || "").toLowerCase();
      if (
        formName.includes("alola") ||
        formName.includes("galar") ||
        formName.includes("hisui") ||
        formName.includes("paldea")
      ) {
        hasRegional = true;
      }
      if (cell.dataset.gender) {
        hasGender = true;
      }
    });
  }

  const hasStarters = Array.from(dexSpeciesIds).some((id) =>
    STARTER_SPECIES_IDS.has(id),
  );
  const hasBabies =
    genNumber > 1 &&
    Array.from(dexSpeciesIds).some((id) => BABY_SPECIES_IDS.has(id));
  const hasFossils = Array.from(dexSpeciesIds).some((id) =>
    FOSSIL_SPECIES_IDS.has(id),
  );
  const hasLegendaries = Array.from(dexSpeciesIds).some((id) =>
    LEGENDARY_SPECIES_IDS.has(id),
  );
  const hasMythicals = Array.from(dexSpeciesIds).some((id) =>
    MYTHICAL_SPECIES_IDS.has(id),
  );
  const hasUltraBeasts = Array.from(dexSpeciesIds).some((id) =>
    ULTRA_BEAST_SPECIES_IDS.has(id),
  );
  const hasParadox = Array.from(dexSpeciesIds).some((id) =>
    PARADOX_SPECIES_IDS.has(id),
  );

  return {
    gameId,
    generation: genNumber,
    availableTypes,
    availableGens: Array.from(availableGens).sort((a, b) => a - b),
    hasStarters,
    hasBabies,
    hasFossils,
    hasLegendaries,
    hasMythicals,
    hasUltraBeasts,
    hasParadox,
    hasRegionalForms: hasRegional || genNumber >= 7 || gameId === "home",
    hasGenderForms: hasGender,
    hasSpecialForms: hasSpecial,
  };
}
