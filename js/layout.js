import { BOX_CAPACITY, GENERATION_RANGES, LAYOUT_PRESETS } from "./config.js";

/**
 * Computes a unique and canonical specimen identifier for an entry or cell.
 * Used to stably track caught status across layout preset switches.
 *
 * @param {Object|number|string} entryOrSpeciesId - Entry object or National Dex species ID.
 * @param {number|string} [formId] - Optional form ID.
 * @param {string} [gender] - Optional gender ('female' or '').
 * @param {number|string} [spriteId] - Optional sprite ID.
 * @returns {string} Canonical specimen key (e.g. "25:25::25" or "25:25:female:25").
 */
export function getSpecimenKey(entryOrSpeciesId, formId, gender, spriteId) {
  if (typeof entryOrSpeciesId === "object" && entryOrSpeciesId !== null) {
    const sId =
      entryOrSpeciesId.speciesId ??
      entryOrSpeciesId.dataset?.national ??
      entryOrSpeciesId.national ??
      0;
    const fId =
      entryOrSpeciesId.formId ??
      entryOrSpeciesId.dataset?.form ??
      entryOrSpeciesId.form ??
      sId;
    const g = entryOrSpeciesId.gender ?? entryOrSpeciesId.dataset?.gender ?? "";
    const spr =
      entryOrSpeciesId.spriteId ?? entryOrSpeciesId.dataset?.sprite ?? fId;
    return `${sId}:${fId}:${g}:${spr}`;
  }

  const sId = Number(entryOrSpeciesId) || 0;
  const fId = formId !== undefined && formId !== null ? formId : sId;
  const g = gender || "";
  const spr = spriteId !== undefined && spriteId !== null ? spriteId : fId;
  return `${sId}:${fId}:${g}:${spr}`;
}

/**
 * Determines sorting weight for variants of the same species in inline layouts.
 * Base -> Female -> Regional -> Cosmetic/Alt Forms -> Gigantamax
 *
 * @param {Object} entry - Pokémon dex entry.
 * @returns {number} Sorting weight (lower numbers appear first).
 */
function getVariantSortPriority(entry) {
  if (entry.kind === "base" && !entry.gender) return 0;
  if (entry.gender === "female") return 1;
  if (entry.kind === "regional" || entry.isRegional) return 2;
  if (entry.kind === "gigantamax" || entry.isGmax) return 4;
  return 3;
}

/**
 * Standard Layout: Returns sections in the configured order as defined by the user.
 *
 * @param {Array<Object>} sections - Raw active Pokédex sections.
 * @returns {Array<Object>} Processed sections.
 */
function transformToStandard(sections) {
  return sections.map((sec) => ({
    ...sec,
    entries: sec.entries.map((entry) => ({
      ...entry,
      specimenKey: getSpecimenKey(entry),
    })),
  }));
}

/**
 * National Pokédex Order Layout:
 * Collects all unique specimen entries across enabled sections and sorts them strictly
 * by National Pokédex number (#001–#1025).
 *
 * @param {Array<Object>} sections - Raw active Pokédex sections.
 * @param {Record<number, Object>} [speciesData] - Master species dataset.
 * @returns {Array<Object>} Single section sorted by National Dex number.
 */
function transformToNational(sections, speciesData = {}) {
  const seenKeys = new Set();
  const allEntries = [];

  for (const sec of sections) {
    for (const entry of sec.entries || []) {
      const key = getSpecimenKey(entry);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const sId = entry.speciesId || 0;
        allEntries.push({
          ...entry,
          dexNumber: sId,
          kind: entry.kind || sec.kind || "base",
          specimenKey: key,
        });
      }
    }
  }

  allEntries.sort((a, b) => {
    if (a.speciesId !== b.speciesId) return a.speciesId - b.speciesId;
    const pA = getVariantSortPriority(a);
    const pB = getVariantSortPriority(b);
    if (pA !== pB) return pA - pB;
    return (Number(a.formId) || 0) - (Number(b.formId) || 0);
  });

  return [
    {
      id: "national-dex",
      key: "national-dex",
      title: "National Pokédex Order",
      kind: "base",
      entries: allEntries,
      startIndex: 1,
    },
  ];
}

/**
 * Generational / Regional Clean Layout:
 * Splits the base National Pokédex entries into 10 distinct generational sections (HOME).
 * Trailing slots of each generation's final box are left empty so that each new region
 * starts cleanly on Box N+1, Slot 1.
 *
 * @param {Array<Object>} sections - Raw active Pokédex sections.
 * @param {Record<number, Object>} speciesData - Master species dataset.
 * @param {string} [gameId="home"] - Active game ID.
 * @returns {Array<Object>} Generational sections followed by enabled form sections.
 */
function transformToGenerational(sections, speciesData, gameId = "home") {
  const baseSection = sections.find(
    (s) => s.kind === "base" || s.key === "national",
  );
  const otherSections = sections.filter((s) => s !== baseSection);

  if (
    !baseSection ||
    !baseSection.entries ||
    baseSection.entries.length === 0
  ) {
    return transformToStandard(sections);
  }

  const baseEntries = baseSection.entries;
  const generationalSections = [];

  for (const { gen, name, start, end } of GENERATION_RANGES) {
    const genEntries = baseEntries
      .filter((e) => e.speciesId >= start && e.speciesId <= end)
      .map((entry) => ({
        ...entry,
        specimenKey: getSpecimenKey(entry),
      }));

    if (genEntries.length > 0) {
      generationalSections.push({
        id: `gen-${gen}`,
        key: `gen-${gen}`,
        title: name,
        kind: "base",
        entries: genEntries,
        startIndex: start,
      });
    }
  }

  const formattedOtherSections = otherSections.map((sec) => ({
    ...sec,
    entries: sec.entries.map((entry) => ({
      ...entry,
      specimenKey: getSpecimenKey(entry),
    })),
  }));

  return [...generationalSections, ...formattedOtherSections];
}

/**
 * Species-Complete / Inline Variants Layout:
 * Groups all enabled forms, regional variants, and gender variants directly behind their base species.
 *
 * @param {Array<Object>} sections - Raw active Pokédex sections.
 * @param {Record<number, Object>} speciesData - Master species dataset.
 * @returns {Array<Object>} Single section with variants inlined.
 */
function transformToInline(sections, speciesData) {
  const allEntries = [];
  for (const sec of sections) {
    for (const entry of sec.entries || []) {
      allEntries.push({
        ...entry,
        kind: entry.kind || sec.kind || "base",
        specimenKey: getSpecimenKey(entry),
      });
    }
  }

  const speciesMap = new Map();
  for (const entry of allEntries) {
    if (!speciesMap.has(entry.speciesId)) {
      speciesMap.set(entry.speciesId, []);
    }
    speciesMap.get(entry.speciesId).push(entry);
  }

  const sortedSpeciesIds = Array.from(speciesMap.keys()).sort((a, b) => a - b);
  const flattenedEntries = [];

  for (const sId of sortedSpeciesIds) {
    const variants = speciesMap.get(sId);
    variants.sort((a, b) => {
      const pA = getVariantSortPriority(a);
      const pB = getVariantSortPriority(b);
      if (pA !== pB) return pA - pB;
      return (Number(a.formId) || 0) - (Number(b.formId) || 0);
    });
    for (const v of variants) {
      flattenedEntries.push({
        ...v,
        dexNumber: v.dexNumber ?? sId,
      });
    }
  }

  return [
    {
      id: "national-inline",
      key: "national-inline",
      title: "Pokédex (All Forms Inline)",
      kind: "base",
      entries: flattenedEntries,
      startIndex: 1,
    },
  ];
}

/**
 * Evolutionary Families Layout:
 * Groups Pokémon by full evolutionary trees across generations (e.g. Pichu -> Pikachu -> Raichu -> Alolan Raichu).
 * Families are sorted by the lowest National Dex species ID in the family line.
 *
 * @param {Array<Object>} sections - Raw active Pokédex sections.
 * @param {Record<number, Object>} speciesData - Master species dataset.
 * @param {Record<number, Object>} evolutionsData - Master evolution chains dataset.
 * @returns {Array<Object>} Evolutionary section with inlined variants.
 */
function transformToEvolutionary(sections, speciesData, evolutionsData) {
  const allEntries = [];
  for (const sec of sections) {
    for (const entry of sec.entries || []) {
      allEntries.push({
        ...entry,
        kind: entry.kind || sec.kind || "base",
        specimenKey: getSpecimenKey(entry),
      });
    }
  }

  const speciesEntriesMap = new Map();
  for (const entry of allEntries) {
    if (!speciesEntriesMap.has(entry.speciesId)) {
      speciesEntriesMap.set(entry.speciesId, []);
    }
    speciesEntriesMap.get(entry.speciesId).push(entry);
  }

  const chainMap = new Map(); // chainId -> Set of speciesIds
  const speciesToChain = new Map();

  for (const sId of speciesEntriesMap.keys()) {
    const spec = speciesData?.[sId];
    const chainId = spec?.evolutionChainId || sId;
    speciesToChain.set(sId, chainId);

    if (!chainMap.has(chainId)) {
      chainMap.set(chainId, new Set());
    }
    chainMap.get(chainId).add(sId);
  }

  const sortedChainIds = Array.from(chainMap.keys()).sort((a, b) => {
    const minA = Math.min(...Array.from(chainMap.get(a)));
    const minB = Math.min(...Array.from(chainMap.get(b)));
    return minA - minB;
  });

  const flattenedEntries = [];

  for (const chainId of sortedChainIds) {
    const presentSpeciesIds = Array.from(chainMap.get(chainId));
    const chainInfo = evolutionsData?.[chainId];

    let orderedSpecies = presentSpeciesIds;
    if (
      chainInfo &&
      Array.isArray(chainInfo.nodes) &&
      chainInfo.nodes.length > 0
    ) {
      const nodeOrder = new Map(
        chainInfo.nodes.map((node, idx) => [node.speciesId, idx]),
      );
      orderedSpecies.sort((a, b) => {
        const orderA = nodeOrder.has(a) ? nodeOrder.get(a) : 999;
        const orderB = nodeOrder.has(b) ? nodeOrder.get(b) : 999;
        if (orderA !== orderB) return orderA - orderB;
        return a - b;
      });
    } else {
      orderedSpecies.sort((a, b) => a - b);
    }

    for (const sId of orderedSpecies) {
      const variants = speciesEntriesMap.get(sId) || [];
      variants.sort((a, b) => {
        const pA = getVariantSortPriority(a);
        const pB = getVariantSortPriority(b);
        if (pA !== pB) return pA - pB;
        return (Number(a.formId) || 0) - (Number(b.formId) || 0);
      });
      for (const v of variants) {
        flattenedEntries.push({
          ...v,
          dexNumber: sId,
        });
      }
    }
  }

  return [
    {
      id: "national-evolutionary",
      key: "national-evolutionary",
      title: "Pokédex (Evolution Lines)",
      kind: "base",
      entries: flattenedEntries,
      startIndex: 1,
    },
  ];
}

/**
 * Alphabetical (A–Z) Layout:
 * Sorts all active Pokémon alphabetically by localized species name.
 *
 * @param {Array<Object>} sections - Raw active Pokédex sections.
 * @param {Record<number, Object>} speciesData - Master species dataset.
 * @returns {Array<Object>} Single Alphabetical section.
 */
function transformToAlphabetical(sections, speciesData) {
  const allEntries = [];
  for (const sec of sections) {
    for (const entry of sec.entries || []) {
      allEntries.push({
        ...entry,
        dexNumber: entry.speciesId,
        kind: entry.kind || sec.kind || "base",
        specimenKey: getSpecimenKey(entry),
      });
    }
  }

  const nameMap =
    typeof window !== "undefined" ? window.__livingDexNames : null;

  allEntries.sort((a, b) => {
    const nameA =
      nameMap?.[a.speciesId] ||
      speciesData?.[a.speciesId]?.name ||
      `#${a.speciesId}`;
    const nameB =
      nameMap?.[b.speciesId] ||
      speciesData?.[b.speciesId]?.name ||
      `#${b.speciesId}`;
    const cmp = nameA.localeCompare(nameB);
    if (cmp !== 0) return cmp;
    if (a.speciesId !== b.speciesId) return a.speciesId - b.speciesId;
    const pA = getVariantSortPriority(a);
    const pB = getVariantSortPriority(b);
    if (pA !== pB) return pA - pB;
    return (Number(a.formId) || 0) - (Number(b.formId) || 0);
  });

  return [
    {
      id: "national-alphabetical",
      key: "national-alphabetical",
      title: "Pokédex (Alphabetical A-Z)",
      kind: "base",
      entries: allEntries,
      startIndex: 1,
    },
  ];
}

/**
 * Alola Island Dexes Layout:
 * Partitions the Alola Pokédex (Sun/Moon & Ultra Sun/Ultra Moon) into 4 distinct
 * island sections: Melemele Island, Akala Island, Ula'ula Island, and Poni Island.
 * Each island starts cleanly in its own box.
 *
 * @param {Array<Object>} sections - Raw active Pokédex sections.
 * @param {Record<number, Object>} speciesData - Master species dataset.
 * @param {string} [gameId="sm"] - Active game ID ('sm' or 'usum').
 * @returns {Array<Object>} 4 island sections followed by any active form sections.
 */
function transformToAlolaIslands(sections, speciesData, gameId = "sm") {
  const baseSection = sections.find(
    (s) => s.kind === "base" || s.id === "alola" || s.key === "alola",
  );
  const otherSections = sections.filter((s) => s !== baseSection);

  if (
    !baseSection ||
    !baseSection.entries ||
    baseSection.entries.length === 0
  ) {
    return transformToStandard(sections);
  }

  const entries = baseSection.entries;
  const isUSUM = gameId === "usum";

  // Partition criteria based on official Island Pokédex assignments
  const melemeleFilter = isUSUM
    ? (e) => (e.dexNumber >= 1 && e.dexNumber <= 149) || e.dexNumber === 383
    : (e) => (e.dexNumber >= 1 && e.dexNumber <= 119) || e.dexNumber === 285;

  const akalaFilter = isUSUM
    ? (e) => (e.dexNumber >= 150 && e.dexNumber <= 262) || e.dexNumber === 384
    : (e) => (e.dexNumber >= 120 && e.dexNumber <= 204) || e.dexNumber === 286;

  const ulaulaFilter = isUSUM
    ? (e) => (e.dexNumber >= 263 && e.dexNumber <= 338) || e.dexNumber === 385
    : (e) => (e.dexNumber >= 205 && e.dexNumber <= 257) || e.dexNumber === 287;

  const poniFilter = isUSUM
    ? (e) =>
        (e.dexNumber >= 339 && e.dexNumber <= 382) ||
        (e.dexNumber >= 386 && e.dexNumber <= 403)
    : (e) =>
        (e.dexNumber >= 258 && e.dexNumber <= 284) ||
        (e.dexNumber >= 288 && e.dexNumber <= 302);

  const melemeleEntries = entries.filter(melemeleFilter).map((e, idx) => ({
    ...e,
    dexNumber: idx + 1,
    specimenKey: getSpecimenKey(e),
  }));
  const akalaEntries = entries.filter(akalaFilter).map((e, idx) => ({
    ...e,
    dexNumber: idx + 1,
    specimenKey: getSpecimenKey(e),
  }));
  const ulaulaEntries = entries.filter(ulaulaFilter).map((e, idx) => ({
    ...e,
    dexNumber: idx + 1,
    specimenKey: getSpecimenKey(e),
  }));
  const poniEntries = entries.filter(poniFilter).map((e, idx) => ({
    ...e,
    dexNumber: idx + 1,
    specimenKey: getSpecimenKey(e),
  }));

  const islandSections = [
    {
      id: "island-melemele",
      key: "island-melemele",
      title: "Melemele Island",
      kind: "base",
      entries: melemeleEntries,
      startIndex: 1,
    },
    {
      id: "island-akala",
      key: "island-akala",
      title: "Akala Island",
      kind: "base",
      entries: akalaEntries,
      startIndex: 1,
    },
    {
      id: "island-ulaula",
      key: "island-ulaula",
      title: "Ula'ula Island",
      kind: "base",
      entries: ulaulaEntries,
      startIndex: 1,
    },
    {
      id: "island-poni",
      key: "island-poni",
      title: "Poni Island",
      kind: "base",
      entries: poniEntries,
      startIndex: 1,
    },
  ];

  const formattedOtherSections = otherSections.map((sec) => ({
    ...sec,
    entries: sec.entries.map((entry) => ({
      ...entry,
      specimenKey: getSpecimenKey(entry),
    })),
  }));

  return [...islandSections, ...formattedOtherSections];
}

/**
 * Unified Regional / DLC Layout:
 * Merges multiple sub-regional or DLC sections (e.g. XY Central/Coastal/Mountain,
 * SwSh Galar/Armor/Tundra, SV Paldea/Kitakami/Blueberry) into one seamless continuous sequence.
 *
 * @param {Array<Object>} sections - Raw active Pokédex sections.
 * @param {string} title - Section title for the combined Pokédex.
 * @returns {Array<Object>} Single unified base section followed by any optional form sections.
 */
function transformToUnified(sections, title = "Unified Pokédex") {
  const baseSections = sections.filter(
    (s) =>
      s.kind === "base" ||
      s.kind === "dlc" ||
      s.type === "base" ||
      s.type === "dlc",
  );
  const otherSections = sections.filter((s) => !baseSections.includes(s));

  const unifiedEntries = [];
  const seenKeys = new Set();

  for (const sec of baseSections) {
    for (const entry of sec.entries || []) {
      const key = getSpecimenKey(entry);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        unifiedEntries.push({
          ...entry,
          dexNumber: unifiedEntries.length + 1,
          kind: entry.kind || sec.kind || "base",
          specimenKey: key,
        });
      }
    }
  }

  const result = [
    {
      id: "unified-dex",
      key: "unified-dex",
      title,
      kind: "base",
      entries: unifiedEntries,
      startIndex: 1,
    },
  ];

  for (const sec of otherSections) {
    result.push({
      ...sec,
      entries: sec.entries.map((e) => ({
        ...e,
        specimenKey: getSpecimenKey(e),
      })),
    });
  }

  return result;
}

/**
 * Hisui Expedition Areas Layout:
 * Partitions Legends: Arceus entries into Hisui's 5 exploration regions:
 * Obsidian Fieldlands, Crimson Mirelands, Cobalt Coastlands, Coronet Highlands, and Alabaster Icelands.
 *
 * @param {Array<Object>} sections - Raw active Pokédex sections.
 * @param {Record<number, Object>} speciesData - Master species dataset.
 * @returns {Array<Object>} 5 expedition area sections followed by any active form sections.
 */
function transformToHisuiAreas(sections, speciesData) {
  const baseSection = sections.find(
    (s) => s.kind === "base" || s.id === "hisui" || s.key === "hisui",
  );
  const otherSections = sections.filter((s) => s !== baseSection);

  if (
    !baseSection ||
    !baseSection.entries ||
    baseSection.entries.length === 0
  ) {
    return transformToStandard(sections);
  }

  const entries = baseSection.entries;

  const fieldlandsEntries = [];
  const mirelandsEntries = [];
  const coastlandsEntries = [];
  const highlandsEntries = [];
  const icelandsEntries = [];

  for (const entry of entries) {
    const sId = entry.speciesId;
    const dexNum = entry.dexNumber || sId;
    const formatted = { ...entry, specimenKey: getSpecimenKey(entry) };

    if (
      (dexNum >= 1 && dexNum <= 65) ||
      (dexNum >= 74 && dexNum <= 83) ||
      dexNum === 492
    ) {
      fieldlandsEntries.push(formatted);
    } else if (
      (dexNum >= 66 && dexNum <= 73) ||
      (dexNum >= 84 && dexNum <= 135) ||
      dexNum === 482 ||
      dexNum === 201
    ) {
      mirelandsEntries.push(formatted);
    } else if (
      (dexNum >= 136 && dexNum <= 176) ||
      dexNum === 485 ||
      dexNum === 487 ||
      dexNum === 489 ||
      dexNum === 490
    ) {
      coastlandsEntries.push(formatted);
    } else if (
      (dexNum >= 177 && dexNum <= 214) ||
      dexNum === 483 ||
      dexNum === 484 ||
      dexNum === 488 ||
      dexNum === 491 ||
      dexNum === 493
    ) {
      highlandsEntries.push(formatted);
    } else {
      icelandsEntries.push(formatted);
    }
  }

  const areaSections = [
    {
      id: "area-fieldlands",
      key: "area-fieldlands",
      title: "Obsidian Fieldlands",
      kind: "base",
      entries: fieldlandsEntries,
      startIndex: 1,
    },
    {
      id: "area-mirelands",
      key: "area-mirelands",
      title: "Crimson Mirelands",
      kind: "base",
      entries: mirelandsEntries,
      startIndex: 1,
    },
    {
      id: "area-coastlands",
      key: "area-coastlands",
      title: "Cobalt Coastlands",
      kind: "base",
      entries: coastlandsEntries,
      startIndex: 1,
    },
    {
      id: "area-highlands",
      key: "area-highlands",
      title: "Coronet Highlands",
      kind: "base",
      entries: highlandsEntries,
      startIndex: 1,
    },
    {
      id: "area-icelands",
      key: "area-icelands",
      title: "Alabaster Icelands",
      kind: "base",
      entries: icelandsEntries,
      startIndex: 1,
    },
  ].filter((sec) => sec.entries.length > 0);

  const formattedOtherSections = otherSections.map((sec) => ({
    ...sec,
    entries: sec.entries.map((entry) => ({
      ...entry,
      specimenKey: getSpecimenKey(entry),
    })),
  }));

  return [...areaSections, ...formattedOtherSections];
}

/**
 * Main entry point: Applies a layout preset to raw active Pokédex sections.
 *
 * @param {Array<Object>} sections - Raw active Pokédex sections.
 * @param {string} [preset=LAYOUT_PRESETS.STANDARD] - Selected layout preset key.
 * @param {Object} [context={}] - Context metadata including speciesData, evolutionsData, gameId.
 * @returns {Array<Object>} Layout-transformed Pokédex sections.
 */
export function applyLayoutPreset(
  sections,
  preset = LAYOUT_PRESETS.STANDARD,
  context = {},
) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return [];
  }

  const { speciesData = {}, evolutionsData = {}, gameId = "home" } = context;

  switch (preset) {
    case LAYOUT_PRESETS.NATIONAL:
      return transformToNational(sections, speciesData);

    case LAYOUT_PRESETS.GENERATIONAL:
      if (gameId === "home") {
        return transformToGenerational(sections, speciesData, gameId);
      }
      return transformToStandard(sections);

    case LAYOUT_PRESETS.INLINE:
      return transformToInline(sections, speciesData);

    case LAYOUT_PRESETS.EVOLUTIONARY:
      return transformToEvolutionary(sections, speciesData, evolutionsData);

    case LAYOUT_PRESETS.ALPHABETICAL:
      return transformToAlphabetical(sections, speciesData);

    case LAYOUT_PRESETS.ALOLA_ISLANDS:
      if (gameId === "sm" || gameId === "usum") {
        return transformToAlolaIslands(sections, speciesData, gameId);
      }
      return transformToStandard(sections);

    case LAYOUT_PRESETS.KALOS_UNIFIED:
      if (gameId === "xy") {
        return transformToUnified(sections, "Unified Kalos Pokédex");
      }
      return transformToStandard(sections);

    case LAYOUT_PRESETS.SWSH_UNIFIED:
      if (gameId === "swsh") {
        return transformToUnified(sections, "Unified Galar + DLC Pokédex");
      }
      return transformToStandard(sections);

    case LAYOUT_PRESETS.SV_UNIFIED:
      if (gameId === "sv") {
        return transformToUnified(sections, "Unified Paldea + DLC Pokédex");
      }
      return transformToStandard(sections);

    case LAYOUT_PRESETS.HISUI_AREAS:
      if (gameId === "pla") {
        return transformToHisuiAreas(sections, speciesData);
      }
      return transformToStandard(sections);

    case LAYOUT_PRESETS.STANDARD:
    default:
      return transformToStandard(sections);
  }
}
