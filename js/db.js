import { ACTIVE_GAME_ID } from "./config.js";
import { loadEnabledSegments, loadSettings } from "./storage.js";
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
 * In-memory cache for the loaded game configurations dataset.
 * @type {Record<string, Object>}
 */
const gameDataCache = {};

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
 * Retrieves evolution chain data by its chain ID.
 *
 * @param {number|string} chainId - The evolution chain ID.
 * @returns {Promise<Object|null>} The evolution chain object or null if not found.
 */
export async function getEvolutionData(chainId) {
  if (!chainId) return null;
  const allEvolutions = await getAllEvolutionData();
  return allEvolutions[Number(chainId)] || null;
}

/**
 * Retrieves game-specific configurations and encounter data.
 *
 * @param {string} gameId - The game identifier (e.g., 'sv', 'swsh').
 * @returns {Promise<Object>} The game configuration object.
 */
export async function getGameData(gameId) {
  if (!gameDataCache[gameId]) {
    const res = await fetch(`data/games/${gameId}.json`);
    if (!res.ok) throw new Error(`Failed to fetch game data for ${gameId}`);
    gameDataCache[gameId] = await res.json();
  }
  return gameDataCache[gameId];
}

/**
 * Computes active Pokédex sections for the currently selected game based on game configuration
 * and user-enabled segment settings, using the local database.
 *
 * @returns {Promise<{ sections: Array<Object>, warnings: Array<Object> }>} Object containing resolved sections and any warnings.
 */
export async function buildActiveDexSections() {
  const enabled = loadEnabledSegments();
  const gameData = await getGameData(ACTIVE_GAME_ID);

  const sections = [];
  const warnings = [];

  if (gameData && Array.isArray(gameData.sections)) {
    for (const seg of gameData.sections) {
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
 *
 * @param {Array<number|string>} speciesOrder - Ordered array of species IDs (can be ignored now as we load all).
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

    // Map translated names to the global cache
    for (const [id, data] of Object.entries(allSpecies)) {
      const name = data.names[language] || data.names.en || `Species #${id}`;
      window.__livingDexNames[Number(id)] = name;
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
        (f) => f.region === activeRegion || f.formKey === activeRegion,
      );
      if (matchingForm) {
        return matchingForm.formId;
      }
    }
  }

  return targetSpeciesId;
}

/**
 * Resolves types taking historical past generation types into account.
 *
 * @param {Object} speciesData - Species record from species.json.
 * @param {number} formId - Selected form ID.
 * @param {number|null} generationNumber - Active game generation number.
 * @returns {string[]} Resolved array of type names.
 */
function resolveTypes(speciesData, formId, generationNumber) {
  const form =
    speciesData.forms?.find((f) => f.formId === formId) ||
    speciesData.forms?.find((f) => f.isDefault) ||
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

/**
 * Resolves and formats evolution flowchart paths based on game scope, generation, and form context.
 *
 * @param {Object} evoData - Evolution chain object from evolutions.json.
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
  const activeRegion = activeForm?.region || null;

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

      // Regional form filtering
      if (step.region && step.region !== activeRegion) continue;
      if (!step.region && activeRegion) {
        // Skip standard steps when inspecting regional forms that have their own exclusive evolution paths
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
 * Handles base game versions and expansion pass versions separately so expansion passes
 * are only displayed when encounter locations are present.
 *
 * @param {Object} gameData - Game dataset from games/*.json.
 * @param {number} speciesId - Target species ID.
 * @param {string} preEvolutionName - Pre-evolution name if applicable.
 * @returns {Array<Object>} Formatted encounter groups for UI.
 */
function resolveEncounterGroups(gameData, speciesId, preEvolutionName) {
  if (!gameData || !gameData.versions) return [];

  const allVersions = gameData.versions;
  const rawEncounters = gameData.encounters?.[String(speciesId)] || {};

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
      const locs = rawEncounters[version]?.locations || [];
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

  const gameData = await getGameData(gameId);
  const evoData = await getEvolutionData(speciesData.evolutionChainId);

  const language = loadSettings().language || "en";
  const generationNumber = gameData?.generation || null;

  const name = resolveSpeciesDisplayName(
    speciesId,
    speciesData.names?.[language] || speciesData.names?.en,
  );
  const types = resolveTypes(speciesData, formId, generationNumber);
  const flavorText =
    speciesData.flavorText?.[language] || speciesData.flavorText?.en || "—";

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
  const encounterGroups = showEncounters
    ? resolveEncounterGroups(gameData, speciesId, preEvolutionName)
    : [];

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
