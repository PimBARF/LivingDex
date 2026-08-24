import { loadSettings } from "../storage.js";
import { ACTIVE_GAME, ACTIVE_GAME_ID, spriteUrlForSpecies } from "../config.js";
import { attachModalHandlers } from "./modals.js";

// =============================================================================
// POKÉMON INFO MODAL
// =============================================================================

/** In-memory cache for fetched Pokémon info, keyed by speciesId + selected generation. */
const _pokemonInfoCache = {};
const _speciesGenerationCache = {};
const _pokemonFormIdByNameCache = {};

/** One-time setup state for the info modal. */
let _infoModalHandlers = null;

function getSelectedGenerationNumber() {
  const group = ACTIVE_GAME?.group || "special";
  if (!group.startsWith("gen")) return null;
  return Number(group.replace("gen", ""));
}

function getGenerationNumberFromName(name) {
  const key = String(name || "").replace(/^generation-/, "");
  const map = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
  };
  return map[key] ?? null;
}

function getInfoCacheKey(
  speciesId,
  formId,
  generationNumber = getSelectedGenerationNumber(),
) {
  return `${speciesId}:${formId}:${generationNumber ?? "all"}`;
}

function resolveTypeNamesForGeneration(pokemonData, generationNumber) {
  const currentTypes = (pokemonData?.types || [])
    .map((typeEntry) => typeEntry?.type?.name)
    .filter(Boolean);
  if (!generationNumber) return currentTypes;

  const sortedHistory = [...(pokemonData?.past_types || [])]
    .map((entry) => ({
      ...entry,
      generationNumber: getGenerationNumberFromName(entry?.generation?.name),
    }))
    .filter((entry) => Number.isInteger(entry.generationNumber))
    .sort((left, right) => left.generationNumber - right.generationNumber);

  if (!sortedHistory.length) return currentTypes;

  const latestHistoryGeneration =
    sortedHistory[sortedHistory.length - 1]?.generationNumber ?? null;
  if (
    latestHistoryGeneration != null &&
    generationNumber > latestHistoryGeneration
  ) {
    return currentTypes;
  }

  let snapshot = sortedHistory[0];
  for (let i = sortedHistory.length - 1; i >= 0; i -= 1) {
    const candidate = sortedHistory[i];
    if (candidate.generationNumber <= generationNumber) {
      snapshot = candidate;
      break;
    }
  }

  if (!snapshot) return currentTypes;
  return (snapshot.types || [])
    .map((typeEntry) => typeEntry?.type?.name)
    .filter(Boolean);
}

async function fetchSpeciesGenerationNumber(speciesId) {
  if (_speciesGenerationCache[speciesId] !== undefined)
    return _speciesGenerationCache[speciesId];

  try {
    const response = await fetch(
      `https://pokeapi.co/api/v2/pokemon-species/${speciesId}`,
    );
    if (!response.ok) {
      _speciesGenerationCache[speciesId] = null;
      return null;
    }
    const data = await response.json();
    const generationNumber = getGenerationNumberFromName(
      data?.generation?.name,
    );
    _speciesGenerationCache[speciesId] = generationNumber;
    return generationNumber;
  } catch {
    _speciesGenerationCache[speciesId] = null;
    return null;
  }
}

function getInfoModalHandlers() {
  if (_infoModalHandlers) return _infoModalHandlers;
  const modal = document.getElementById("modalPokemonInfo");
  const closeBtn = document.getElementById("closePokemonInfo");
  const backdrop = modal?.querySelector("[data-close]");
  _infoModalHandlers = attachModalHandlers({
    modal,
    openBtn: null,
    closeBtn,
    backdrop,
    onOpen: () => closeBtn?.focus(),
    onClose: () => {},
    focusSelector: "#closePokemonInfo",
  });
  return _infoModalHandlers;
}

function parseSpeciesIdFromUrl(url) {
  const match = String(url || "").match(/\/pokemon-species\/(\d+)\//);
  return match ? Number(match[1]) : null;
}

const GAME_VERSION_GROUPS = {
  rby: ["red", "blue", "yellow"],
  gsc: ["gold", "silver", "crystal"],
  rse: ["ruby", "sapphire", "emerald"],
  frlg: ["firered", "leafgreen"],
  dppt: ["diamond", "pearl", "platinum"],
  hgss: ["heartgold", "soulsilver"],
  bw: ["black", "white"],
  b2w2: ["black-2", "white-2"],
  xy: ["x", "y"],
  oras: ["omega-ruby", "alpha-sapphire"],
  sm: ["sun", "moon"],
  usum: ["ultra-sun", "ultra-moon"],
  lgpe: ["lets-go-pikachu", "lets-go-eevee"],
  swsh: ["sword", "shield"],
  bdsp: ["brilliant-diamond", "shining-pearl"],
  sv: ["scarlet", "violet"],
};

function prettifyResourceName(name) {
  return String(name || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (chr) => chr.toUpperCase())
    .trim();
}

function normalizeEncounterLocationName(name) {
  return prettifyResourceName(name)
    .replace(/^[A-Z][a-z]+ Route /, "Route ")
    .replace(/\s+Area$/, "");
}

function prettifyVersionName(name) {
  return String(name || "")
    .split("-")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
    .join(" ")
    .replace(/\bX\b/g, "X")
    .replace(/\bY\b/g, "Y")
    .trim();
}

function getEncounterVersionNames() {
  return GAME_VERSION_GROUPS[ACTIVE_GAME_ID] || [];
}

function buildEncounterEntriesForVersion(versionName, encounterData) {
  const entries = new Set();

  (Array.isArray(encounterData) ? encounterData : []).forEach((location) => {
    const matchingVersion = (location?.version_details || []).find(
      (detail) => String(detail?.version?.name || "") === String(versionName),
    );

    if (!matchingVersion) return;

    const areaName = normalizeEncounterLocationName(
      location?.location_area?.name || "Unknown location",
    );
    if (areaName) {
      entries.add(areaName);
    }
  });

  return Array.from(entries).sort((left, right) => left.localeCompare(right));
}

function joinVersionNames(versions) {
  const names = versions.map(prettifyVersionName).filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} / ${names[1]}`;
  return `${names.slice(0, -1).join(" / ")} / ${names[names.length - 1]}`;
}

function formatTradeSourceList(versions) {
  const names = versions.map(prettifyVersionName).filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return `Trade from ${names[0]}`;
  if (names.length === 2) return `Trade from ${names[0]} or ${names[1]}`;
  return `Trade from ${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

function createEncounterList(entries, { maxVisible = 5 } = {}) {
  if (!entries.length) {
    return null;
  }

  const list = document.createElement("ul");
  list.className = "pokemon-info-encounter-list";

  const collapsed = entries.length > maxVisible;
  const visibleEntries = collapsed ? entries.slice(0, maxVisible) : entries;

  visibleEntries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "pokemon-info-encounter-item";
    item.textContent = entry;
    list.appendChild(item);
  });

  if (collapsed) {
    const hiddenEntries = entries.slice(maxVisible);
    hiddenEntries.forEach((entry) => {
      const item = document.createElement("li");
      item.className =
        "pokemon-info-encounter-item pokemon-info-encounter-item-hidden";
      item.textContent = entry;
      item.hidden = true;
      list.appendChild(item);
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "pokemon-info-encounter-toggle";
    toggle.textContent = `Show ${hiddenEntries.length} more`;
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      const hiddenItems = list.querySelectorAll(
        ".pokemon-info-encounter-item-hidden",
      );
      hiddenItems.forEach((item) => {
        item.hidden = isExpanded;
      });

      toggle.setAttribute("aria-expanded", String(!isExpanded));
      toggle.textContent = isExpanded
        ? `Show ${hiddenEntries.length} more`
        : "Show fewer";
    });
    list.appendChild(toggle);
  }

  return list;
}

function getPreEvolutionNameFromTransitions(transitions, speciesId) {
  if (!Array.isArray(transitions) || !transitions.length) return "";

  const names = transitions
    .filter(
      (transition) => Number(transition?.toSpeciesId) === Number(speciesId),
    )
    .map((transition) => {
      if (transition?.fromName)
        return prettifyResourceName(transition.fromName);
      const fromId = Number(transition?.fromSpeciesId);
      return fromId ? resolveSpeciesDisplayName(fromId, "") : "";
    })
    .filter(Boolean);

  return names[0] || "";
}

function shouldShowEncounterDetails() {
  return (
    ACTIVE_GAME_ID !== "home" &&
    ACTIVE_GAME_ID !== "pla" &&
    ACTIVE_GAME_ID !== "za"
  );
}

function renderEncounterDetails(
  encounterEl,
  encounterData,
  { preEvolutionName = "" } = {},
) {
  encounterEl.innerHTML = "";

  const versionNames = getEncounterVersionNames();
  const groups = versionNames.map((version) => ({
    version,
    entries: buildEncounterEntriesForVersion(version, encounterData),
  }));

  const populatedGroups = groups.filter((group) => group.entries.length > 0);
  if (!populatedGroups.length) {
    if (preEvolutionName) {
      const group = document.createElement("div");
      group.className = "pokemon-info-encounter-group";

      const header = document.createElement("div");
      header.className = "pokemon-info-encounter-header";
      header.textContent = joinVersionNames(versionNames);

      const list = document.createElement("ul");
      list.className = "pokemon-info-encounter-list";
      const item = document.createElement("li");
      item.textContent = `Evolve ${preEvolutionName}`;
      list.appendChild(item);

      group.append(header, list);
      encounterEl.appendChild(group);
    } else {
      const empty = document.createElement("div");
      empty.className = "pokemon-info-encounter-note";
      empty.textContent = "No encounters in this generation.";
      encounterEl.appendChild(empty);
    }
    return;
  }

  const allSame =
    populatedGroups.length > 1 &&
    populatedGroups.every((group) => {
      const other = populatedGroups[0].entries;
      if (group.entries.length !== other.length) return false;
      return group.entries.every((entry, index) => entry === other[index]);
    });

  if (allSame && populatedGroups.length > 1) {
    const group = document.createElement("div");
    group.className = "pokemon-info-encounter-group";

    const header = document.createElement("div");
    header.className = "pokemon-info-encounter-header";
    header.textContent = joinVersionNames(
      populatedGroups.map((groupItem) => groupItem.version),
    );

    const list = createEncounterList(populatedGroups[0].entries);
    if (list) {
      group.append(header, list);
      encounterEl.appendChild(group);
    }
    return;
  }

  const hasEvolutionOnlyAcrossAllVersions =
    !!preEvolutionName && populatedGroups.length === versionNames.length;
  if (hasEvolutionOnlyAcrossAllVersions && populatedGroups.length > 0) {
    const group = document.createElement("div");
    group.className = "pokemon-info-encounter-group";

    const header = document.createElement("div");
    header.className = "pokemon-info-encounter-header";
    header.textContent = joinVersionNames(versionNames);

    const uniqueEntries = Array.from(
      new Set(populatedGroups.flatMap((groupItem) => groupItem.entries)),
    ).sort();
    const list = createEncounterList(uniqueEntries);
    if (list) {
      group.append(header, list);
      encounterEl.appendChild(group);
    }
    return;
  }

  versionNames.forEach((version) => {
    const groupData = groups.find((entry) => entry.version === version);
    const group = document.createElement("div");
    group.className = "pokemon-info-encounter-group";

    const header = document.createElement("div");
    header.className = "pokemon-info-encounter-header";
    header.textContent = prettifyVersionName(version);
    group.appendChild(header);

    if (groupData && groupData.entries.length) {
      const list = createEncounterList(groupData.entries);
      if (list) group.appendChild(list);
    } else {
      const tradeSources = versionNames.filter((source) =>
        groups.some(
          (candidate) =>
            candidate.version === source && candidate.entries.length,
        ),
      );
      const list = document.createElement("ul");
      list.className = "pokemon-info-encounter-list";
      const item = document.createElement("li");
      item.textContent = formatTradeSourceList(tradeSources);
      list.appendChild(item);
      group.appendChild(list);
    }

    encounterEl.appendChild(group);
  });
}

function resolveSpeciesDisplayName(speciesId, fallbackName = "") {
  return window.__livingDexNames?.[speciesId] || fallbackName || "Unknown";
}

function collectEvolutionSpecies(chainNode, species = []) {
  if (!chainNode) return species;
  const speciesId = parseSpeciesIdFromUrl(chainNode.species?.url);
  const name = chainNode.species?.name || "";
  if (speciesId) species.push({ speciesId, name });
  for (const next of chainNode.evolves_to || []) {
    collectEvolutionSpecies(next, species);
  }
  return species;
}

function dedupeSpeciesEntries(entries) {
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    if (!entry?.speciesId || seen.has(entry.speciesId)) continue;
    seen.add(entry.speciesId);
    result.push(entry);
  }
  return result;
}

function collectEvolutionTransitions(
  chainNode,
  allowedSpeciesIds,
  transitions = [],
) {
  if (!chainNode) return transitions;
  const fromSpeciesId = parseSpeciesIdFromUrl(chainNode.species?.url);
  const fromName = chainNode.species?.name || "";
  if (!fromSpeciesId || !allowedSpeciesIds.has(fromSpeciesId)) {
    // Continue traversing down the chain to find valid descendants (e.g., bypassing Gen 2 babies for Gen 1 games)
    for (const next of chainNode.evolves_to || []) {
      collectEvolutionTransitions(next, allowedSpeciesIds, transitions);
    }
    return transitions;
  }

  for (const next of chainNode.evolves_to || []) {
    const toSpeciesId = parseSpeciesIdFromUrl(next.species?.url);
    const toName = next.species?.name || "";
    if (!toSpeciesId || !allowedSpeciesIds.has(toSpeciesId)) continue;

    transitions.push({
      fromSpeciesId,
      fromName,
      toSpeciesId,
      toName,
      details: Array.isArray(next.evolution_details)
        ? next.evolution_details
        : [],
    });

    collectEvolutionTransitions(next, allowedSpeciesIds, transitions);
  }

  return transitions;
}

function formatEvolutionDetail(detail) {
  if (!detail || typeof detail !== "object") return null;
  const trigger = detail.trigger?.name || "";
  const conditions = [];

  const minLevel = Number.isInteger(detail.min_level) ? detail.min_level : null;
  const minHappiness = Number.isInteger(detail.min_happiness)
    ? detail.min_happiness
    : null;
  const minAffection = Number.isInteger(detail.min_affection)
    ? detail.min_affection
    : null;
  const minBeauty = Number.isInteger(detail.min_beauty)
    ? detail.min_beauty
    : null;
  const minSteps = Number.isInteger(detail.min_steps) ? detail.min_steps : null;
  const minMoveCount = Number.isInteger(detail.min_move_count)
    ? detail.min_move_count
    : null;
  const minDamageTaken = Number.isInteger(detail.min_damage_taken)
    ? detail.min_damage_taken
    : null;

  if (detail.held_item?.name)
    conditions.push(`holding ${prettifyResourceName(detail.held_item.name)}`);
  if (detail.known_move?.name)
    conditions.push(`knowing ${prettifyResourceName(detail.known_move.name)}`);
  if (detail.used_move?.name)
    conditions.push(
      `after using ${prettifyResourceName(detail.used_move.name)}`,
    );
  if (detail.known_move_type?.name)
    conditions.push(
      `knowing a ${prettifyResourceName(detail.known_move_type.name)}-type move`,
    );
  if (detail.location?.name)
    conditions.push(`at ${prettifyResourceName(detail.location.name)}`);
  if (minHappiness !== null) conditions.push(`friendship ${minHappiness}+`);
  if (minAffection !== null) conditions.push(`affection ${minAffection}+`);
  if (minBeauty !== null) conditions.push(`beauty ${minBeauty}+`);
  if (minMoveCount !== null)
    conditions.push(`knowing at least ${minMoveCount} moves`);
  if (minSteps !== null) conditions.push(`walking at least ${minSteps} steps`);
  if (minDamageTaken !== null)
    conditions.push(
      `after taking at least ${minDamageTaken} damage without fainting`,
    );
  if (detail.needs_overworld_rain) conditions.push("while raining");
  if (detail.near_special_rock) conditions.push("near a special rock");
  if (detail.needs_multiplayer) conditions.push("in multiplayer");
  if (detail.time_of_day)
    conditions.push(`during the ${prettifyResourceName(detail.time_of_day)}`);
  if (detail.trade_species?.name)
    conditions.push(
      `when traded for ${prettifyResourceName(detail.trade_species.name)}`,
    );
  if (detail.party_species?.name)
    conditions.push(
      `with ${prettifyResourceName(detail.party_species.name)} in party`,
    );
  if (detail.party_type?.name)
    conditions.push(
      `with a ${prettifyResourceName(detail.party_type.name)}-type Pokémon in party`,
    );
  if (detail.turn_upside_down)
    conditions.push("while the console is upside down");
  if (detail.region?.name)
    conditions.push(`in ${prettifyResourceName(detail.region.name)}`);

  if (detail.gender === 1) conditions.push("for female Pokémon");
  if (detail.gender === 2) conditions.push("for male Pokémon");

  if (detail.relative_physical_stats === 1)
    conditions.push("with Attack > Defense");
  if (detail.relative_physical_stats === -1)
    conditions.push("with Attack < Defense");
  if (detail.relative_physical_stats === 0)
    conditions.push("with Attack = Defense");

  let baseText = "Special condition";
  if (trigger === "level-up") {
    baseText = minLevel !== null ? `Level ${minLevel}` : "Level up";
  } else if (trigger === "trade") {
    baseText = "Trade";
  } else if (trigger === "use-item") {
    baseText = detail.item?.name
      ? `Use ${prettifyResourceName(detail.item.name)}`
      : "Use item";
  } else if (trigger === "shed") {
    baseText = "Shed";
  } else if (trigger) {
    baseText = prettifyResourceName(trigger);
  }

  const methodText = conditions.length
    ? `${baseText} (${conditions.join("; ")})`
    : baseText;
  return methodText.trim();
}

function getEvolutionMethodLines(details) {
  const methods = (Array.isArray(details) ? details : [])
    .map(formatEvolutionDetail)
    .filter(Boolean);
  if (!methods.length) return ["Unknown"];
  return Array.from(new Set(methods));
}

function createEvolutionMember({
  speciesId,
  spriteId = speciesId,
  fallbackName,
  spriteStyle,
}) {
  const resolvedName = resolveSpeciesDisplayName(speciesId, fallbackName);
  const member = document.createElement("div");
  member.className = "evo-member";

  const sprite = document.createElement("img");
  sprite.className = "evo-sprite";
  sprite.src = spriteUrlForSpecies(spriteId, spriteStyle);
  sprite.alt = resolvedName;
  sprite.loading = "lazy";
  sprite.onerror = function onEvolutionSpriteError() {
    this.style.opacity = "0.2";
  };

  const label = document.createElement("span");
  label.className = "evo-name";
  label.textContent = resolvedName;

  member.append(sprite, label);
  return member;
}

function normalizeFormName(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

async function fetchPokemonIdByName(formName) {
  const normalizedName = normalizeFormName(formName);
  if (!normalizedName) return null;
  if (_pokemonFormIdByNameCache[normalizedName] !== undefined) {
    return _pokemonFormIdByNameCache[normalizedName];
  }

  try {
    const response = await fetch(
      `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(normalizedName)}`,
    );
    if (!response.ok) {
      _pokemonFormIdByNameCache[normalizedName] = null;
      return null;
    }
    const payload = await response.json();
    const pokemonId = Number(payload?.id);
    const resolvedId =
      Number.isInteger(pokemonId) && pokemonId > 0 ? pokemonId : null;
    _pokemonFormIdByNameCache[normalizedName] = resolvedId;
    return resolvedId;
  } catch {
    _pokemonFormIdByNameCache[normalizedName] = null;
    return null;
  }
}

function filterEvolutionDetailsForForms(
  details,
  fromFormName = "",
  toFormName = "",
  fromIsDefault = undefined,
  toIsDefault = undefined,
) {
  const allDetails = Array.isArray(details) ? details : [];
  if (allDetails.length <= 1) return allDetails;

  let filtered = allDetails;
  const normalizedFromForm = normalizeFormName(fromFormName);
  const normalizedToForm = normalizeFormName(toFormName);

  if (normalizedFromForm) {
    const fromMatches = filtered.filter(
      (detail) =>
        normalizeFormName(detail?.base_form?.name) === normalizedFromForm,
    );
    if (fromMatches.length) {
      filtered = fromMatches;
    } else {
      const defaultFromMatches = filtered.filter(
        (detail) => !normalizeFormName(detail?.base_form?.name),
      );
      if (defaultFromMatches.length) filtered = defaultFromMatches;
    }
  }

  if (normalizedToForm) {
    const toMatches = filtered.filter(
      (detail) =>
        normalizeFormName(detail?.evolved_form?.name) === normalizedToForm,
    );
    if (toMatches.length) {
      filtered = toMatches;
    } else {
      const defaultToMatches = filtered.filter(
        (detail) => !normalizeFormName(detail?.evolved_form?.name),
      );
      if (defaultToMatches.length) filtered = defaultToMatches;
    }
  }

  if (filtered.length > 1 && fromIsDefault !== undefined) {
    const fromDefaultMatches = filtered.filter(
      (detail) =>
        typeof detail?.is_default === "boolean" &&
        detail.is_default === fromIsDefault,
    );
    if (fromDefaultMatches.length) filtered = fromDefaultMatches;
  }

  if (filtered.length > 1 && toIsDefault !== undefined) {
    const toDefaultMatches = filtered.filter(
      (detail) =>
        typeof detail?.is_default === "boolean" &&
        detail.is_default === toIsDefault,
    );
    if (toDefaultMatches.length) filtered = toDefaultMatches;
  }

  return filtered;
}

function inferPreferredEvolutionContext({
  transitions,
  selectedSpeciesId,
  selectedFormName,
  selectedIsDefault,
}) {
  const preferredForms = new Map();
  const preferredDefaults = new Map();
  const normalizedSelectedForm = normalizeFormName(selectedFormName);
  if (selectedSpeciesId && normalizedSelectedForm) {
    preferredForms.set(selectedSpeciesId, normalizedSelectedForm);
  }
  if (selectedSpeciesId && typeof selectedIsDefault === "boolean") {
    preferredDefaults.set(selectedSpeciesId, selectedIsDefault);
  }

  const maxPasses = Math.max(1, transitions.length * 2);
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    for (const transition of transitions) {
      const fromHint = preferredForms.get(transition.fromSpeciesId) || "";
      const toHint = preferredForms.get(transition.toSpeciesId) || "";
      const fromDefaultHint = preferredDefaults.has(transition.fromSpeciesId)
        ? preferredDefaults.get(transition.fromSpeciesId)
        : undefined;
      const toDefaultHint = preferredDefaults.has(transition.toSpeciesId)
        ? preferredDefaults.get(transition.toSpeciesId)
        : undefined;
      const matchingDetails = filterEvolutionDetailsForForms(
        transition.details,
        fromHint,
        toHint,
        fromDefaultHint,
        toDefaultHint,
      );

      if (!fromHint) {
        const baseFormValues = matchingDetails.map((detail) =>
          normalizeFormName(detail?.base_form?.name),
        );
        const hasUnnamedBaseForm = baseFormValues.some((value) => !value);
        const baseForms = Array.from(new Set(baseFormValues.filter(Boolean)));
        if (!hasUnnamedBaseForm && baseForms.length === 1) {
          preferredForms.set(transition.fromSpeciesId, baseForms[0]);
          changed = true;
        }
      }

      if (!toHint) {
        const evolvedFormValues = matchingDetails.map((detail) =>
          normalizeFormName(detail?.evolved_form?.name),
        );
        const hasUnnamedEvolvedForm = evolvedFormValues.some((value) => !value);
        const evolvedForms = Array.from(
          new Set(evolvedFormValues.filter(Boolean)),
        );
        if (!hasUnnamedEvolvedForm && evolvedForms.length === 1) {
          preferredForms.set(transition.toSpeciesId, evolvedForms[0]);
          changed = true;
        }
      }

      if (!preferredDefaults.has(transition.fromSpeciesId)) {
        const fromDefaults = Array.from(
          new Set(
            matchingDetails
              .map((detail) => detail?.is_default)
              .filter((value) => typeof value === "boolean"),
          ),
        );
        if (fromDefaults.length === 1) {
          preferredDefaults.set(transition.fromSpeciesId, fromDefaults[0]);
          changed = true;
        }
      }

      if (!preferredDefaults.has(transition.toSpeciesId)) {
        const toDefaults = Array.from(
          new Set(
            matchingDetails
              .map((detail) => detail?.is_default)
              .filter((value) => typeof value === "boolean"),
          ),
        );
        if (toDefaults.length === 1) {
          preferredDefaults.set(transition.toSpeciesId, toDefaults[0]);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  return { preferredForms, preferredDefaults };
}

function applyFormContextToTransitions(
  transitions,
  { preferredForms, preferredDefaults },
) {
  return transitions.map((transition) => {
    const fromFormName = preferredForms.get(transition.fromSpeciesId) || "";
    const toFormName = preferredForms.get(transition.toSpeciesId) || "";
    const fromIsDefault = preferredDefaults.has(transition.fromSpeciesId)
      ? preferredDefaults.get(transition.fromSpeciesId)
      : undefined;
    const toIsDefault = preferredDefaults.has(transition.toSpeciesId)
      ? preferredDefaults.get(transition.toSpeciesId)
      : undefined;
    return {
      ...transition,
      details: filterEvolutionDetailsForForms(
        transition.details,
        fromFormName,
        toFormName,
        fromIsDefault,
        toIsDefault,
      ),
    };
  });
}

async function resolveEvolutionSpriteMap({
  selectedSpeciesId,
  selectedFormId,
  preferredForms,
  speciesIds = [],
}) {
  const spriteMap = {};
  if (Number.isInteger(selectedSpeciesId) && Number.isInteger(selectedFormId)) {
    spriteMap[selectedSpeciesId] = selectedFormId;
  }

  const uniqueSpeciesIds = Array.from(
    new Set(
      (Array.isArray(speciesIds) ? speciesIds : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );

  await Promise.all(
    uniqueSpeciesIds.map(async (speciesId) => {
      const preferredFormName = preferredForms.get(speciesId) || "";
      const normalizedFormName = normalizeFormName(preferredFormName);
      if (!normalizedFormName || !normalizedFormName.includes("-")) return;
      const formPokemonId = await fetchPokemonIdByName(normalizedFormName);
      if (Number.isInteger(formPokemonId) && formPokemonId > 0) {
        spriteMap[speciesId] = formPokemonId;
      }
    }),
  );

  return spriteMap;
}

function buildEvolutionPaths(base, transitions) {
  if (!Array.isArray(transitions) || !transitions.length) return [];

  const adjacency = new Map();
  const fromIds = new Set();
  const toIds = new Set();

  transitions.forEach((transition) => {
    if (!transition?.fromSpeciesId || !transition?.toSpeciesId) return;
    fromIds.add(transition.fromSpeciesId);
    toIds.add(transition.toSpeciesId);
    if (!adjacency.has(transition.fromSpeciesId))
      adjacency.set(transition.fromSpeciesId, []);
    adjacency.get(transition.fromSpeciesId).push(transition);
  });

  let roots = [];
  if (base?.speciesId && fromIds.has(base.speciesId)) {
    roots = [{ speciesId: base.speciesId, name: base.name || "" }];
  } else {
    roots = Array.from(fromIds)
      .filter((speciesId) => !toIds.has(speciesId))
      .map((speciesId) => {
        const firstTransition = transitions.find(
          (t) => t.fromSpeciesId === speciesId,
        );
        return { speciesId, name: firstTransition?.fromName || "" };
      });
  }

  const paths = [];
  const dfs = (root, currentSpeciesId, chain, visitedSpeciesIds) => {
    const outgoing = adjacency.get(currentSpeciesId) || [];
    if (!outgoing.length) {
      paths.push({ root, chain });
      return;
    }

    outgoing.forEach((transition) => {
      if (visitedSpeciesIds.has(transition.toSpeciesId)) {
        paths.push({ root, chain });
        return;
      }
      const nextVisited = new Set(visitedSpeciesIds);
      nextVisited.add(transition.toSpeciesId);
      dfs(root, transition.toSpeciesId, [...chain, transition], nextVisited);
    });
  };

  roots.forEach((root) => {
    dfs(root, root.speciesId, [], new Set([root.speciesId]));
  });

  return paths.filter((path) => path.chain.length > 0);
}

function createEvolutionConnector({
  arrowSymbol,
  methods,
  reverseArrowSymbol = "",
  reverseMethods = [],
}) {
  const connector = document.createElement("div");
  connector.className = "evo-connector";

  const arrow = document.createElement("span");
  arrow.className = "evo-arrow";
  arrow.textContent = arrowSymbol;
  connector.appendChild(arrow);

  const methodLines = document.createElement("div");
  methodLines.className = "evo-method-lines";
  methods.forEach((method) => {
    const line = document.createElement("span");
    line.className = "evo-method-line";
    line.textContent = method;
    methodLines.appendChild(line);
  });
  connector.appendChild(methodLines);

  if (reverseArrowSymbol) {
    const reverseArrow = document.createElement("span");
    reverseArrow.className = "evo-arrow evo-arrow-reverse";
    reverseArrow.textContent = reverseArrowSymbol;
    connector.appendChild(reverseArrow);
  }

  if (reverseMethods.length) {
    const reverseMethodLines = document.createElement("div");
    reverseMethodLines.className = "evo-method-lines evo-method-lines-reverse";
    reverseMethods.forEach((method) => {
      const line = document.createElement("span");
      line.className = "evo-method-line";
      line.textContent = method;
      reverseMethodLines.appendChild(line);
    });
    connector.appendChild(reverseMethodLines);
  }

  return connector;
}

function renderEvolutionDetails(
  evoEl,
  { base, transitions, breeding, speciesSpriteMap, spriteStyle },
) {
  evoEl.innerHTML = "";

  if (!transitions.length) {
    if (base?.speciesId) {
      evoEl.appendChild(
        createEvolutionMember({
          speciesId: base.speciesId,
          spriteId: speciesSpriteMap?.[base.speciesId] || base.speciesId,
          fallbackName: base.name,
          spriteStyle,
        }),
      );
      return;
    }
    const empty = document.createElement("div");
    empty.className = "evo-empty";
    empty.textContent = "No additional evolution information available.";
    evoEl.appendChild(empty);
    return;
  }

  const paths = buildEvolutionPaths(base, transitions);
  const fallbackPaths = paths.length
    ? paths
    : [
        {
          root: {
            speciesId: transitions[0].fromSpeciesId,
            name: transitions[0].fromName,
          },
          chain: transitions,
        },
      ];

  fallbackPaths.forEach((path) => {
    const row = document.createElement("div");
    row.className = "evo-row";

    const rootMember = createEvolutionMember({
      speciesId: path.root.speciesId,
      spriteId: speciesSpriteMap?.[path.root.speciesId] || path.root.speciesId,
      fallbackName: path.root.name,
      spriteStyle,
    });

    const hasBreedingForRoot =
      breeding?.itemName &&
      breeding?.baby?.speciesId &&
      breeding.baby.speciesId === path.root.speciesId;

    row.appendChild(rootMember);

    path.chain.forEach((transition, index) => {
      const isBreedingTransition = hasBreedingForRoot && index === 0;
      const parentSpeciesIds = new Set(
        (breeding?.parents || []).map((parent) => parent.speciesId),
      );
      const includeReverseBreeding =
        isBreedingTransition &&
        (!parentSpeciesIds.size ||
          parentSpeciesIds.has(transition.toSpeciesId));

      row.appendChild(
        createEvolutionConnector({
          arrowSymbol: "→",
          methods: getEvolutionMethodLines(transition.details),
          reverseArrowSymbol: includeReverseBreeding ? "←" : "",
          reverseMethods: includeReverseBreeding
            ? [`Hold ${prettifyResourceName(breeding.itemName)}`]
            : [],
        }),
      );

      row.appendChild(
        createEvolutionMember({
          speciesId: transition.toSpeciesId,
          spriteId:
            speciesSpriteMap?.[transition.toSpeciesId] ||
            transition.toSpeciesId,
          fallbackName: transition.toName,
          spriteStyle,
        }),
      );
    });

    evoEl.appendChild(row);
  });
}

/**
 * Fetch and display info for a Pokémon in the info modal.
 * Uses a simple in-memory cache to avoid redundant API calls.
 */
export async function openPokemonInfoModal(speciesId, formId, name) {
  const modal = document.getElementById("modalPokemonInfo");
  if (!modal) return;
  const titleEl = document.getElementById("pokemonInfoTitle");
  const numberEl = document.getElementById("pokemonInfoNumber");
  const spriteEl = document.getElementById("pokemonInfoSprite");
  const typesEl = document.getElementById("pokemonInfoTypes");
  const flavorEl = document.getElementById("pokemonInfoFlavor");
  const encounterEl = document.getElementById("pokemonInfoEncounter");
  const encounterLabelEl = document.getElementById("pokemonInfoEncounterLabel");
  const evoEl = document.getElementById("pokemonInfoEvo");
  const bodyEl = document.getElementById("pokemonInfoBody");
  const loadingEl = document.getElementById("pokemonInfoLoading");
  const errorEl = document.getElementById("pokemonInfoError");
  const showEncounterDetails = shouldShowEncounterDetails();

  if (encounterLabelEl) encounterLabelEl.hidden = !showEncounterDetails;
  if (encounterEl) encounterEl.hidden = !showEncounterDetails;

  // Set initial state: show name/sprite immediately, load the rest
  const spriteStyle = loadSettings().spriteStyle || "pokesprites";
  titleEl.textContent = name;
  numberEl.textContent = `#${speciesId}`;
  spriteEl.src = spriteUrlForSpecies(formId, spriteStyle);
  spriteEl.alt = name;
  typesEl.innerHTML = "";
  flavorEl.textContent = "";
  encounterEl.innerHTML = "";
  evoEl.innerHTML = "";
  bodyEl.hidden = true;
  errorEl.hidden = true;
  loadingEl.hidden = false;

  const { openModal } = getInfoModalHandlers();
  openModal();

  const selectedGeneration = getSelectedGenerationNumber();
  const cacheKey = getInfoCacheKey(speciesId, formId, selectedGeneration);

  try {
    if (!_pokemonInfoCache[cacheKey]) {
      const language = loadSettings().language || "en";

      const [pokemonRes, speciesRes] = await Promise.all([
        fetch(`https://pokeapi.co/api/v2/pokemon/${formId}`),
        fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`),
      ]);

      if (!pokemonRes.ok || !speciesRes.ok)
        throw new Error("Failed to fetch Pokémon data");

      const [pokemonData, speciesData] = await Promise.all([
        pokemonRes.json(),
        speciesRes.json(),
      ]);

      const flavorEntries = speciesData.flavor_text_entries || [];
      const langFlavor =
        flavorEntries.find((e) => e.language.name === language) ||
        flavorEntries.find((e) => e.language.name === "en") ||
        flavorEntries[0];
      const flavorText = langFlavor
        ? langFlavor.flavor_text.replace(/[\f\n\r]/g, " ")
        : "";

      let encounters = [];
      try {
        const encounterRes = await fetch(
          `https://pokeapi.co/api/v2/pokemon/${formId}/encounters`,
        );
        if (encounterRes.ok) {
          encounters = await encounterRes.json();
        }
      } catch {
        encounters = [];
      }

      let evolution = { base: null, transitions: [], breeding: null };
      const evoUrl = speciesData.evolution_chain?.url;
      if (evoUrl) {
        const evoRes = await fetch(evoUrl);
        if (evoRes.ok) {
          const evoData = await evoRes.json();
          const allEntries = dedupeSpeciesEntries(
            collectEvolutionSpecies(evoData.chain),
          );
          let allowedSpeciesIds = new Set(
            allEntries.map((entry) => entry.speciesId),
          );

          if (selectedGeneration) {
            const entriesWithGenerations = await Promise.all(
              allEntries.map(async (entry) => ({
                ...entry,
                generationNumber: await fetchSpeciesGenerationNumber(
                  entry.speciesId,
                ),
              })),
            );

            allowedSpeciesIds = new Set(
              entriesWithGenerations
                .filter(
                  (entry) =>
                    !Number.isInteger(entry.generationNumber) ||
                    entry.generationNumber <= selectedGeneration,
                )
                .map((entry) => entry.speciesId),
            );
          }

          const chainRootId = parseSpeciesIdFromUrl(
            evoData?.chain?.species?.url,
          );
          const chainRootName = evoData?.chain?.species?.name || "";
          const base =
            chainRootId && allowedSpeciesIds.has(chainRootId)
              ? { speciesId: chainRootId, name: chainRootName }
              : allEntries.find((entry) =>
                  allowedSpeciesIds.has(entry.speciesId),
                ) || null;

          const transitions = collectEvolutionTransitions(
            evoData.chain,
            allowedSpeciesIds,
          );
          const preferredEvolutionContext = inferPreferredEvolutionContext({
            transitions,
            selectedSpeciesId: speciesId,
            selectedFormName: pokemonData?.name || "",
            selectedIsDefault:
              typeof pokemonData?.is_default === "boolean"
                ? pokemonData.is_default
                : undefined,
          });
          const contextualTransitions = applyFormContextToTransitions(
            transitions,
            preferredEvolutionContext,
          );
          const speciesSpriteMap = await resolveEvolutionSpriteMap({
            selectedSpeciesId: speciesId,
            selectedFormId: formId,
            preferredForms: preferredEvolutionContext.preferredForms,
            speciesIds: Array.from(allowedSpeciesIds),
          });
          let breeding = null;
          const babyTriggerItem = evoData?.baby_trigger_item?.name || "";
          const parentCandidates = (evoData?.chain?.evolves_to || [])
            .map((entry) => ({
              speciesId: parseSpeciesIdFromUrl(entry?.species?.url),
              name: entry?.species?.name || "",
            }))
            .filter(
              (entry) =>
                entry.speciesId && allowedSpeciesIds.has(entry.speciesId),
            );

          if (babyTriggerItem && base?.speciesId) {
            const uniqueParents = [];
            const seenParentIds = new Set();
            parentCandidates.forEach((parent) => {
              if (seenParentIds.has(parent.speciesId)) return;
              seenParentIds.add(parent.speciesId);
              uniqueParents.push(parent);
            });

            breeding = {
              itemName: babyTriggerItem,
              baby: base,
              parents: uniqueParents,
            };
          }

          evolution = {
            base,
            transitions: contextualTransitions,
            breeding,
            speciesSpriteMap,
          };
        }
      }

      _pokemonInfoCache[cacheKey] = {
        types: resolveTypeNamesForGeneration(pokemonData, selectedGeneration),
        flavorText,
        encounters,
        evolution,
      };
    }

    const { types, flavorText, encounters, evolution } =
      _pokemonInfoCache[cacheKey];

    typesEl.innerHTML = types
      .map((t) => `<span class="type-badge" data-type="${t}">${t}</span>`)
      .join("");

    flavorEl.textContent = flavorText || "—";
    const preEvolutionName = getPreEvolutionNameFromTransitions(
      evolution?.transitions || [],
      speciesId,
    );
    if (showEncounterDetails) {
      renderEncounterDetails(encounterEl, encounters || [], {
        preEvolutionName,
      });
    } else {
      if (encounterEl) encounterEl.innerHTML = "";
    }

    renderEvolutionDetails(evoEl, {
      base: evolution?.base || null,
      transitions: evolution?.transitions || [],
      breeding: evolution?.breeding || null,
      speciesSpriteMap: evolution?.speciesSpriteMap || {},
      spriteStyle,
    });

    loadingEl.hidden = true;
    bodyEl.hidden = false;
  } catch {
    loadingEl.hidden = true;
    errorEl.textContent =
      "Could not load Pokémon info. Check your connection and try again.";
    errorEl.hidden = false;
  }
}
