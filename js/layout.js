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
 * Generational / Regional Clean Layout:
 * Splits the base National Pokédex entries into 9 distinct generational sections.
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
        key: `gen-${gen}`,
        title: name,
        kind: "base",
        entries: genEntries,
        startIndex: start,
      });
    }
  }

  // Append other enabled sections (regional forms, alternate forms, gender, etc.)
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
 * @returns {Array<Object>} Single or generational sections with variants inlined.
 */
function transformToInline(sections, speciesData) {
  // Collect all entries across all enabled sections, tagging their section kind
  const allEntries = [];
  for (const sec of sections) {
    for (const entry of sec.entries) {
      allEntries.push({
        ...entry,
        kind: entry.kind || sec.kind || "base",
        specimenKey: getSpecimenKey(entry),
      });
    }
  }

  // Group entries by speciesId
  const speciesMap = new Map();
  for (const entry of allEntries) {
    if (!speciesMap.has(entry.speciesId)) {
      speciesMap.set(entry.speciesId, []);
    }
    speciesMap.get(entry.speciesId).push(entry);
  }

  // Sort entries within each species (Base -> Female -> Regional -> Forms -> GMax)
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
    flattenedEntries.push(...variants);
  }

  return [
    {
      key: "national-inline",
      title: "National Pokédex (All Variants Inline)",
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
 * @returns {Array<Object>} Evolutionary sections with inlined variants.
 */
function transformToEvolutionary(sections, speciesData, evolutionsData) {
  // 1. Collect and tag all enabled entries
  const allEntries = [];
  for (const sec of sections) {
    for (const entry of sec.entries) {
      allEntries.push({
        ...entry,
        kind: entry.kind || sec.kind || "base",
        specimenKey: getSpecimenKey(entry),
      });
    }
  }

  // 2. Group entries by speciesId first
  const speciesEntriesMap = new Map();
  for (const entry of allEntries) {
    if (!speciesEntriesMap.has(entry.speciesId)) {
      speciesEntriesMap.set(entry.speciesId, []);
    }
    speciesEntriesMap.get(entry.speciesId).push(entry);
  }

  // 3. Group species into evolution families
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

  // 4. Sort families by the lowest speciesId in the family
  const sortedChainIds = Array.from(chainMap.keys()).sort((a, b) => {
    const minA = Math.min(...Array.from(chainMap.get(a)));
    const minB = Math.min(...Array.from(chainMap.get(b)));
    return minA - minB;
  });

  // 5. Within each family, order species by evolution stage (using nodes from evolutionsData)
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

    // For each species in the ordered family, append its variants in priority order
    for (const sId of orderedSpecies) {
      const variants = speciesEntriesMap.get(sId) || [];
      variants.sort((a, b) => {
        const pA = getVariantSortPriority(a);
        const pB = getVariantSortPriority(b);
        if (pA !== pB) return pA - pB;
        return (Number(a.formId) || 0) - (Number(b.formId) || 0);
      });
      flattenedEntries.push(...variants);
    }
  }

  return [
    {
      key: "national-evolutionary",
      title: "National Pokédex (Evolutionary Families)",
      kind: "base",
      entries: flattenedEntries,
      startIndex: 1,
    },
  ];
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
    case LAYOUT_PRESETS.GENERATIONAL:
      return transformToGenerational(sections, speciesData, gameId);
    case LAYOUT_PRESETS.INLINE:
      return transformToInline(sections, speciesData);
    case LAYOUT_PRESETS.EVOLUTIONARY:
      return transformToEvolutionary(sections, speciesData, evolutionsData);
    case LAYOUT_PRESETS.STANDARD:
    default:
      return transformToStandard(sections);
  }
}
