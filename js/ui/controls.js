import {
  loadSettings,
  saveSettings,
  loadCaughtSlots,
  encodeCaughtState,
} from "../storage.js";
import { applyTheme, isMotionReduced } from "./theme.js";
import { showToast } from "./modals.js";
import { isShinyMode, setShinyMode, rebuildDexView } from "../state.js";
import {
  buildActiveDexSections,
  loadSpeciesNames,
  buildEvolutionStageMap,
  getAllEvolutionData,
  getGameFilterCapabilities,
  getGameDexData,
} from "../db.js";
import {
  ACTIVE_GAME_ID,
  POKEMON_TYPES,
  ALL_POKEMON_TYPES,
  getSpeciesGeneration,
  STARTER_SPECIES_IDS,
  BABY_SPECIES_IDS,
  FOSSIL_SPECIES_IDS,
  LEGENDARY_SPECIES_IDS,
  MYTHICAL_SPECIES_IDS,
  ULTRA_BEAST_SPECIES_IDS,
  PARADOX_SPECIES_IDS,
} from "../config.js";
import { updateMissingGuideBadge } from "./missing-guide.js";

export { updateMissingGuideBadge };

/**
 * Cached evolution stage map: Record<speciesId, 'base'|'middle'|'final'|'single'>
 */
let cachedEvolutionStageMap = null;

export async function ensureEvolutionStageMap() {
  if (!cachedEvolutionStageMap) {
    try {
      const evolutions = await getAllEvolutionData();
      cachedEvolutionStageMap = buildEvolutionStageMap(evolutions);
    } catch {
      cachedEvolutionStageMap = {};
    }
  }
  return cachedEvolutionStageMap;
}

export { POKEMON_TYPES };

/**
 * Active status filter mode: 'all' | 'uncaught' | 'caught'
 * @type {'all'|'uncaught'|'caught'}
 */
let currentStatusFilter = "all";

/**
 * Comprehensive multi-criteria filter state.
 */
export const activeFilterState = {
  types: new Set(),
  typeMode: "any", // 'any' | 'all' | 'mono'
  generations: new Set(),
  categories: new Set(), // 'starter' | 'fossil' | 'baby' | 'legendary' | 'mythical' | 'ultra-beast' | 'paradox'
  stages: new Set(), // 'base' | 'middle' | 'final' | 'single'
  forms: new Set(), // 'standard' | 'regional' | 'gender' | 'special'
};

/**
 * Returns the currently active status filter mode.
 * @returns {'all'|'uncaught'|'caught'}
 */
export function getStatusFilter() {
  return currentStatusFilter;
}

/**
 * Sets the active status filter mode and updates UI states.
 *
 * @param {'all'|'uncaught'|'caught'} mode - The filter mode to apply.
 * @returns {void}
 */
export function setStatusFilter(mode) {
  if (mode !== "all" && mode !== "uncaught" && mode !== "caught") return;
  currentStatusFilter = mode;

  // Update segmented control buttons
  const segButtons = document.querySelectorAll("#statusFilter .segmented-btn");
  segButtons.forEach((btn) => {
    const active = btn.dataset.status === mode;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-checked", String(active));
  });

  applyHideCaughtFilter();
}

/**
 * Toggles the visibility of caught Pokémon slots based on the active status filter.
 * Adds or removes `hide-caught` and `hide-uncaught` CSS classes on `document.body`.
 *
 * @returns {void}
 */
export function applyHideCaughtFilter() {
  const isUncaughtOnly = currentStatusFilter === "uncaught";
  const isCaughtOnly = currentStatusFilter === "caught";

  document.body.classList.toggle("hide-caught", isUncaughtOnly);
  document.body.classList.toggle("hide-uncaught", isCaughtOnly);
}

/**
 * Computes total number of active filter constraints.
 * @returns {number}
 */
export function getActiveFilterCount() {
  return (
    activeFilterState.types.size +
    activeFilterState.generations.size +
    activeFilterState.categories.size +
    activeFilterState.stages.size +
    activeFilterState.forms.size +
    (activeFilterState.types.size > 0 && activeFilterState.typeMode !== "any"
      ? 1
      : 0)
  );
}

/**
 * Updates the active filter badge count and button styling on the main header and modal.
 * @returns {void}
 */
export function updateFilterBadge() {
  const badge = document.getElementById("activeFilterBadge");
  const modalBadge = document.getElementById("activeFilterCountBadge");
  const filtersBtn = document.getElementById("filtersBtn");
  const count = getActiveFilterCount();

  if (badge) {
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
  if (modalBadge) {
    modalBadge.textContent = String(count);
    modalBadge.hidden = count === 0;
  }

  if (filtersBtn) {
    filtersBtn.classList.toggle("has-filters", count > 0);
  }
}

/**
 * Updates the real-time match status counter in the filter modal footer.
 * @returns {void}
 */
export function updateFilterLiveStatus() {
  const statusEl = document.getElementById("filtersLiveCountText");
  if (!statusEl) return;

  const totalCells = document.querySelectorAll(
    ".cell:not(.is-placeholder)",
  ).length;
  if (totalCells === 0) {
    statusEl.textContent = "No Pokémon available";
    return;
  }

  const activeCount = getActiveFilterCount();
  if (activeCount === 0) {
    statusEl.textContent = `Showing all ${totalCells} Pokémon`;
    return;
  }

  const matchingCells = document.querySelectorAll(
    ".cell:not(.is-placeholder):not(.filter-hidden):not(.type-hidden)",
  ).length;
  statusEl.textContent = `Showing ${matchingCells} of ${totalCells} Pokémon matching filters`;
}

/**
 * Synchronizes visual active classes on all filter buttons in the modal.
 * @returns {void}
 */
export function syncFilterModalActiveStates() {
  // Type buttons
  document.querySelectorAll(".filter-type-btn").forEach((btn) => {
    btn.classList.toggle(
      "is-active",
      activeFilterState.types.has(btn.dataset.type),
    );
  });

  // Type mode
  document.querySelectorAll(".type-mode-btn").forEach((btn) => {
    const isActive = btn.dataset.mode === activeFilterState.typeMode;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-checked", String(isActive));
  });

  // Generations
  document.querySelectorAll(".filter-gen-btn").forEach((btn) => {
    btn.classList.toggle(
      "is-active",
      activeFilterState.generations.has(Number(btn.dataset.gen)),
    );
  });

  // Categories
  document
    .querySelectorAll("#categoryFilterGrid [data-category]")
    .forEach((btn) => {
      btn.classList.toggle(
        "is-active",
        activeFilterState.categories.has(btn.dataset.category),
      );
    });

  // Stages
  document.querySelectorAll("#stageFilterGrid [data-stage]").forEach((btn) => {
    btn.classList.toggle(
      "is-active",
      activeFilterState.stages.has(btn.dataset.stage),
    );
  });

  // Forms
  document.querySelectorAll("#formFilterGrid [data-form]").forEach((btn) => {
    btn.classList.toggle(
      "is-active",
      activeFilterState.forms.has(btn.dataset.form),
    );
  });

  // Presets active highlight
  document.querySelectorAll(".filter-preset-chip").forEach((btn) => {
    const preset = btn.dataset.preset;
    let isActive = false;
    if (
      preset === "starters" &&
      activeFilterState.categories.has("starter") &&
      activeFilterState.categories.size === 1
    ) {
      isActive = true;
    }
    if (
      preset === "legendary-mythical" &&
      activeFilterState.categories.has("legendary") &&
      activeFilterState.categories.has("mythical") &&
      activeFilterState.categories.size === 2
    ) {
      isActive = true;
    }
    if (
      preset === "fossils" &&
      activeFilterState.categories.has("fossil") &&
      activeFilterState.categories.size === 1
    ) {
      isActive = true;
    }
    if (
      preset === "babies" &&
      activeFilterState.categories.has("baby") &&
      activeFilterState.categories.size === 1
    ) {
      isActive = true;
    }
    if (
      preset === "paradox" &&
      activeFilterState.categories.has("paradox") &&
      activeFilterState.categories.size === 1
    ) {
      isActive = true;
    }
    if (
      preset === "regionals" &&
      activeFilterState.forms.has("regional") &&
      activeFilterState.forms.size === 1
    ) {
      isActive = true;
    }
    if (
      preset === "final" &&
      activeFilterState.stages.has("final") &&
      activeFilterState.stages.has("single") &&
      activeFilterState.stages.size === 2
    ) {
      isActive = true;
    }
    btn.classList.toggle("is-active", isActive);
  });
}

/**
 * Dynamically configures the filter modal based on the capabilities and era of the active game.
 *
 * @param {string} [gameId=ACTIVE_GAME_ID] - Active game ID.
 * @returns {Promise<void>}
 */
export async function syncFilterModalWithGame(gameId = ACTIVE_GAME_ID) {
  await ensureEvolutionStageMap();

  let dexData = null;
  try {
    dexData = await getGameDexData(gameId);
  } catch {
    dexData = null;
  }

  const caps = await getGameFilterCapabilities(gameId, dexData);

  // 1. Populate Type Buttons for the game's era
  const typeGrid = document.getElementById("typeFilterGrid");
  if (typeGrid) {
    typeGrid.innerHTML = "";
    caps.availableTypes.forEach((typeId) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-type-btn";
      btn.dataset.type = typeId;
      btn.textContent = typeId.charAt(0).toUpperCase() + typeId.slice(1);
      btn.addEventListener("click", () => {
        if (activeFilterState.types.has(typeId)) {
          activeFilterState.types.delete(typeId);
        } else {
          activeFilterState.types.add(typeId);
        }
        syncFilterModalActiveStates();
        applyAllFilters();
      });
      typeGrid.appendChild(btn);
    });
  }

  // 2. Populate Generation Chips (or hide generation section if only 1 generation in dex)
  const genSection = document.getElementById("filterSectionGens");
  const genGrid = document.getElementById("genFilterGrid");
  if (genSection && genGrid) {
    if (caps.availableGens.length <= 1) {
      genSection.hidden = true;
    } else {
      genSection.hidden = false;
      genGrid.innerHTML = "";
      const genLabels = [
        "",
        "Kanto (Gen 1)",
        "Johto (Gen 2)",
        "Hoenn (Gen 3)",
        "Sinnoh (Gen 4)",
        "Unova (Gen 5)",
        "Kalos (Gen 6)",
        "Alola (Gen 7)",
        "Galar/Hisui (Gen 8)",
        "Paldea (Gen 9)",
      ];
      caps.availableGens.forEach((genNum) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-chip-btn filter-gen-btn";
        btn.dataset.gen = String(genNum);
        btn.textContent = genLabels[genNum] || `Gen ${genNum}`;
        btn.addEventListener("click", () => {
          if (activeFilterState.generations.has(genNum)) {
            activeFilterState.generations.delete(genNum);
          } else {
            activeFilterState.generations.add(genNum);
          }
          syncFilterModalActiveStates();
          applyAllFilters();
        });
        genGrid.appendChild(btn);
      });
    }
  }

  // 3. Conditional Category & Preset buttons
  const catBaby = document.getElementById("filterCatBaby");
  const presetBabies = document.getElementById("presetBabies");
  if (catBaby) catBaby.hidden = !caps.hasBabies;
  if (presetBabies) presetBabies.hidden = !caps.hasBabies;

  const catFossil = document.getElementById("filterCatFossil");
  const presetFossils = document.getElementById("presetFossils");
  if (catFossil) catFossil.hidden = !caps.hasFossils;
  if (presetFossils) presetFossils.hidden = !caps.hasFossils;

  const catParadox = document.getElementById("filterCatParadox");
  const presetParadox = document.getElementById("presetParadox");
  if (catParadox) catParadox.hidden = !caps.hasParadox;
  if (presetParadox) presetParadox.hidden = !caps.hasParadox;

  const catUB = document.getElementById("filterCatUltraBeast");
  if (catUB) catUB.hidden = !caps.hasUltraBeasts;

  const formRegional = document.getElementById("filterFormRegional");
  const presetRegionals = document.getElementById("presetRegionals");
  if (formRegional) formRegional.hidden = !caps.hasRegionalForms;
  if (presetRegionals) presetRegionals.hidden = !caps.hasRegionalForms;

  const formGender = document.getElementById("filterFormGender");
  if (formGender) formGender.hidden = !caps.hasGenderForms;

  const formSpecial = document.getElementById("filterFormSpecial");
  if (formSpecial) formSpecial.hidden = !caps.hasSpecialForms;

  syncFilterModalActiveStates();
  updateFilterLiveStatus();
}

/**
 * Applies all active multi-criteria filters to all Pokémon cells in the Pokédex.
 * Hides non-matching cells by adding the `filter-hidden` / `type-hidden` CSS classes.
 *
 * @returns {void}
 */
export function applyAllFilters() {
  const hasActiveFilters = getActiveFilterCount() > 0;
  document.body.classList.toggle("filter-active", hasActiveFilters);
  document.body.classList.toggle("type-filter-active", hasActiveFilters);

  const cells = document.querySelectorAll(".cell:not(.is-placeholder)");
  if (!hasActiveFilters) {
    cells.forEach((cell) => {
      cell.classList.remove("filter-hidden");
      cell.classList.remove("type-hidden");
    });
    updateFilterBadge();
    updateFilterLiveStatus();
    return;
  }

  const selectedTypesList = Array.from(activeFilterState.types);
  const typeMode = activeFilterState.typeMode;
  const stageMap = cachedEvolutionStageMap || {};

  cells.forEach((cell) => {
    let matches = true;

    // 1. Type matching
    if (activeFilterState.types.size > 0) {
      const cellTypes = (cell.dataset.types || "").split(" ").filter(Boolean);
      if (typeMode === "any") {
        matches = cellTypes.some((t) => activeFilterState.types.has(t));
      } else if (typeMode === "all") {
        matches = selectedTypesList.every((t) => cellTypes.includes(t));
      } else if (typeMode === "mono") {
        matches =
          cellTypes.length === 1 && activeFilterState.types.has(cellTypes[0]);
      }
    }

    // 2. Generation matching
    if (matches && activeFilterState.generations.size > 0) {
      const gen =
        Number(cell.dataset.generation) ||
        getSpeciesGeneration(cell.dataset.national);
      matches = activeFilterState.generations.has(gen);
    }

    // 3. Category & Rarity matching
    if (matches && activeFilterState.categories.size > 0) {
      const sid = Number(cell.dataset.national);
      let catMatch = false;

      if (
        activeFilterState.categories.has("starter") &&
        STARTER_SPECIES_IDS.has(sid)
      ) {
        catMatch = true;
      }
      if (
        activeFilterState.categories.has("baby") &&
        BABY_SPECIES_IDS.has(sid)
      ) {
        catMatch = true;
      }
      if (
        activeFilterState.categories.has("fossil") &&
        FOSSIL_SPECIES_IDS.has(sid)
      ) {
        catMatch = true;
      }
      if (
        activeFilterState.categories.has("legendary") &&
        LEGENDARY_SPECIES_IDS.has(sid)
      ) {
        catMatch = true;
      }
      if (
        activeFilterState.categories.has("mythical") &&
        MYTHICAL_SPECIES_IDS.has(sid)
      ) {
        catMatch = true;
      }
      if (
        activeFilterState.categories.has("ultra-beast") &&
        ULTRA_BEAST_SPECIES_IDS.has(sid)
      ) {
        catMatch = true;
      }
      if (
        activeFilterState.categories.has("paradox") &&
        PARADOX_SPECIES_IDS.has(sid)
      ) {
        catMatch = true;
      }

      matches = catMatch;
    }

    // 4. Evolution Stage matching
    if (matches && activeFilterState.stages.size > 0) {
      const sid = Number(cell.dataset.national);
      const stage = stageMap[sid] || "single";
      matches = activeFilterState.stages.has(stage);
    }

    // 5. Form & Variant matching
    if (matches && activeFilterState.forms.size > 0) {
      const formName = (cell.dataset.formName || "").toLowerCase();
      const isRegional =
        formName.includes("alola") ||
        formName.includes("galar") ||
        formName.includes("hisui") ||
        formName.includes("paldea");
      const isGender = Boolean(cell.dataset.gender);
      const formId = Number(cell.dataset.form);
      const sid = Number(cell.dataset.national);
      const isSpecial = Boolean(
        formId && formId > 0 && formId !== sid && !isRegional && !isGender,
      );
      const isStandard = !isRegional && !isGender && !isSpecial;

      let formMatch = false;
      if (activeFilterState.forms.has("standard") && isStandard)
        formMatch = true;
      if (activeFilterState.forms.has("regional") && isRegional)
        formMatch = true;
      if (activeFilterState.forms.has("gender") && isGender) formMatch = true;
      if (activeFilterState.forms.has("special") && isSpecial) formMatch = true;

      matches = formMatch;
    }

    cell.classList.toggle("filter-hidden", !matches);
    cell.classList.toggle("type-hidden", !matches);
  });

  updateFilterBadge();
  updateFilterLiveStatus();
}

/**
 * Backward compatibility alias for applyAllFilters.
 */
export function applyTypeFilter() {
  applyAllFilters();
}

/**
 * Clears all active filters and restores the dex view.
 * @returns {void}
 */
export function clearAllFilters() {
  activeFilterState.types.clear();
  activeFilterState.typeMode = "any";
  activeFilterState.generations.clear();
  activeFilterState.categories.clear();
  activeFilterState.stages.clear();
  activeFilterState.forms.clear();

  syncFilterModalActiveStates();
  applyAllFilters();
}

/**
 * Backward compatibility alias for clearAllFilters.
 */
export function clearTypeFilters() {
  clearAllFilters();
}

/**
 * Toggles an individual type filter on or off.
 *
 * @param {string} typeId - Pokémon type identifier (e.g. 'fire').
 * @returns {void}
 */
export function toggleTypeFilter(typeId) {
  if (activeFilterState.types.has(typeId)) {
    activeFilterState.types.delete(typeId);
  } else {
    activeFilterState.types.add(typeId);
  }

  syncFilterModalActiveStates();
  applyAllFilters();
}

/**
 * Applies a quick preset filter bundle.
 *
 * @param {string} presetName - Preset identifier.
 * @returns {void}
 */
export function applyFilterPreset(presetName) {
  // Clear other active filters to cleanly activate preset
  activeFilterState.types.clear();
  activeFilterState.generations.clear();
  activeFilterState.categories.clear();
  activeFilterState.stages.clear();
  activeFilterState.forms.clear();
  activeFilterState.typeMode = "any";

  switch (presetName) {
    case "starters":
      activeFilterState.categories.add("starter");
      break;
    case "legendary-mythical":
      activeFilterState.categories.add("legendary");
      activeFilterState.categories.add("mythical");
      break;
    case "fossils":
      activeFilterState.categories.add("fossil");
      break;
    case "babies":
      activeFilterState.categories.add("baby");
      break;
    case "paradox":
      activeFilterState.categories.add("paradox");
      break;
    case "regionals":
      activeFilterState.forms.add("regional");
      break;
    case "final":
      activeFilterState.stages.add("final");
      activeFilterState.stages.add("single");
      break;
  }

  syncFilterModalActiveStates();
  applyAllFilters();
}

/**
 * Queries all Pokémon cells in the dex that are currently visible and matching
 * the active status filter, type filters, search query, and non-hidden sections.
 *
 * @returns {HTMLButtonElement[]} Array of active, visible cell elements.
 */
export function getVisiblePokemonCells() {
  const isSearchActive = Boolean(
    document.getElementById("search")?.value.trim(),
  );
  const allCells = Array.from(
    document.querySelectorAll(".cell:not(.is-placeholder)"),
  );

  return allCells.filter((cell) => {
    // Exclude cells in hidden sections / tabs
    if (cell.closest("[hidden]")) return false;
    if (
      cell.offsetParent === null &&
      window.getComputedStyle(cell).display === "none"
    ) {
      return false;
    }
    // Exclude dimmed non-matching search results
    if (isSearchActive && cell.classList.contains("dimmed")) return false;
    // Exclude hidden filters
    if (
      cell.classList.contains("filter-hidden") ||
      cell.classList.contains("type-hidden")
    ) {
      return false;
    }
    // Exclude caught/uncaught filter mismatches
    if (
      document.body.classList.contains("hide-caught") &&
      cell.classList.contains("caught")
    ) {
      return false;
    }
    if (
      document.body.classList.contains("hide-uncaught") &&
      !cell.classList.contains("caught")
    ) {
      return false;
    }
    return true;
  });
}

// =============================================================================
// HEADER CONTROLS & USER INTERACTIONS
/**
 * Timer handle for debouncing smooth scroll to the first search match.
 * Prevents viewport jumping and keyboard cursor resets during rapid mobile typing.
 * @type {number|null}
 */
let searchScrollTimer = null;

/**
 * Filters and highlights Pokémon cells based on a search query.
 * Supports searching by regional or national Pokédex number (e.g. "#42", "42") or by Pokémon name.
 * Highlights matching cells, dims non-matching cells, and smoothly scrolls to the first match below the sticky header.
 *
 * @param {string} query - The search query string entered by the user.
 * @param {object} [options] - Optional settings for applying the filter.
 * @param {boolean} [options.immediateScroll=false] - Whether to scroll immediately instead of debouncing.
 * @returns {void}
 */
export function applySearchFilter(query, { immediateScroll = false } = {}) {
  const trimmed = query.trim().toLowerCase();
  const cells = [...document.querySelectorAll(".cell:not(.is-placeholder)")];
  cells.forEach((cell) => cell.classList.remove("highlight", "dimmed"));

  if (searchScrollTimer) {
    clearTimeout(searchScrollTimer);
    searchScrollTimer = null;
  }

  if (!trimmed) return;

  let matches = [];

  // Match by number (regional or national ID)
  if (/^#?\d+$/.test(trimmed)) {
    const number = Number(trimmed.replace("#", ""));
    matches = cells.filter((cell) => {
      const regional = Number(cell.dataset.regional) || NaN;
      const national = Number(cell.dataset.national) || NaN;
      const label = (cell.querySelector(".label")?.textContent || "").trim();
      return (
        regional === number ||
        national === number ||
        label === `#${number}` ||
        label === String(number)
      );
    });
  } else {
    // Match by name
    matches = cells.filter((cell) => {
      const name =
        cell.dataset.name || cell.querySelector(".label")?.textContent || "";
      return name.toLowerCase().includes(trimmed);
    });
  }

  if (matches.length) {
    const matchedCells = new Set(matches);
    cells.forEach((cell) => {
      if (!matchedCells.has(cell)) cell.classList.add("dimmed");
    });
    matches.forEach((cell) => cell.classList.add("highlight"));

    const scrollToMatch = () => {
      const firstMatch = matches[0];
      if (!firstMatch) return;

      const searchInput = document.getElementById("search");
      const isFocused = document.activeElement === searchInput;
      const start = isFocused ? searchInput?.selectionStart : null;
      const end = isFocused ? searchInput?.selectionEnd : null;

      // Calculate combined sticky height (header + sticky progress bar + padding)
      const isMobileScreen = window.matchMedia("(max-width: 768px)").matches;
      const progressWrap = document.getElementById("progressWrap");
      const header = document.querySelector("header");

      let stickyOffset = 0;
      if (header) {
        stickyOffset += header.offsetHeight;
      }
      if (progressWrap && !progressWrap.hidden) {
        stickyOffset += progressWrap.offsetHeight + (isMobileScreen ? 18 : 22);
      } else {
        stickyOffset += 16;
      }

      const cellAbsoluteTop =
        firstMatch.getBoundingClientRect().top + window.scrollY;
      const targetY = Math.max(0, cellAbsoluteTop - stickyOffset);

      // Skip scroll only if already at the target scroll position
      if (Math.abs(window.scrollY - targetY) < 4) return;

      window.scrollTo({
        top: targetY,
        behavior: isMotionReduced() ? "auto" : "smooth",
      });

      // Guard against mobile browser resetting input cursor on document scroll
      if (isFocused && typeof start === "number" && typeof end === "number") {
        if (
          searchInput.selectionStart !== start ||
          searchInput.selectionEnd !== end
        ) {
          searchInput.setSelectionRange(start, end);
        }
        requestAnimationFrame(() => {
          if (
            document.activeElement === searchInput &&
            searchInput.selectionStart === 0 &&
            start > 0
          ) {
            searchInput.setSelectionRange(start, end);
          }
        });
      }
    };

    if (immediateScroll) {
      scrollToMatch();
    } else {
      searchScrollTimer = setTimeout(scrollToMatch, 180);
    }
  } else {
    cells.forEach((cell) => cell.classList.add("dimmed"));
  }
}

/**
 * Smoothly scrolls to the previous or next PC storage box in the viewport.
 *
 * @param {'prev'|'next'} direction - Jump direction.
 * @returns {void}
 */
export function jumpToBox(direction) {
  const boxes = Array.from(document.querySelectorAll(".box"));
  if (!boxes.length) return;

  const viewportTop = window.scrollY + 120;
  let currentIndex = 0;

  for (let i = 0; i < boxes.length; i += 1) {
    const top = boxes[i].getBoundingClientRect().top + window.scrollY;
    if (top <= viewportTop) {
      currentIndex = i;
    }
  }

  const targetIndex =
    direction === "next"
      ? Math.min(currentIndex + 1, boxes.length - 1)
      : Math.max(currentIndex - 1, 0);

  boxes[targetIndex].scrollIntoView({
    behavior: isMotionReduced() ? "auto" : "smooth",
    block: "start",
  });
}

/**
 * Registers global keyboard hotkey listener for power-user navigation.
 * @returns {void}
 */
export function registerKeyboardShortcuts() {
  window.addEventListener("keydown", (event) => {
    const targetTag = event.target?.tagName?.toLowerCase();
    const isInput =
      targetTag === "input" ||
      targetTag === "textarea" ||
      targetTag === "select" ||
      event.target?.isContentEditable;

    if (event.key === "/" && !isInput) {
      event.preventDefault();
      const searchInput = document.getElementById("search");
      searchInput?.focus();
      searchInput?.select();
      return;
    }

    if (event.key === "Escape") {
      const searchInput = document.getElementById("search");
      if (document.activeElement === searchInput) {
        if (searchInput.value) {
          searchInput.value = "";
          searchInput.dispatchEvent(new Event("input"));
        }
        searchInput.blur();
        return;
      }
      return;
    }

    if (isInput) return;

    // Check if any modal is currently visible
    const openModal = document.querySelector(".modal:not([hidden])");
    if (openModal) return;

    if (event.key === "s" || event.key === "S") {
      event.preventDefault();
      document.getElementById("shinyToggle")?.click();
      return;
    }

    if (event.key === "m" || event.key === "M") {
      event.preventDefault();
      document.getElementById("missingGuideBtn")?.click();
      return;
    }

    if (event.key === "h" || event.key === "H") {
      event.preventDefault();
      const order = ["all", "uncaught", "caught"];
      const nextIndex = (order.indexOf(currentStatusFilter) + 1) % order.length;
      setStatusFilter(order[nextIndex]);
      return;
    }

    if (event.key === "[") {
      event.preventDefault();
      jumpToBox("prev");
      return;
    }

    if (event.key === "]") {
      event.preventDefault();
      jumpToBox("next");
      return;
    }

    if (event.key === "?" || (event.shiftKey && event.key === "/")) {
      event.preventDefault();
      document.getElementById("shortcutsBtn")?.click();
      return;
    }
  });
}

/**
 * Initializes and binds all filter modal event listeners and controls.
 * @returns {void}
 */
export function initializeFilterControls() {
  const clearBtn = document.getElementById("clearAllFiltersBtn");
  clearBtn?.addEventListener("click", () => {
    clearAllFilters();
  });

  // Type Match Mode buttons
  const modeButtons = document.querySelectorAll(".type-mode-btn");
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode) {
        activeFilterState.typeMode = mode;
        modeButtons.forEach((b) => {
          const isActive = b.dataset.mode === mode;
          b.classList.toggle("is-active", isActive);
          b.setAttribute("aria-checked", String(isActive));
        });
        applyAllFilters();
      }
    });
  });

  // Category buttons
  const catButtons = document.querySelectorAll(
    "#categoryFilterGrid [data-category]",
  );
  catButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.category;
      if (activeFilterState.categories.has(cat)) {
        activeFilterState.categories.delete(cat);
      } else {
        activeFilterState.categories.add(cat);
      }
      syncFilterModalActiveStates();
      applyAllFilters();
    });
  });

  // Stage buttons
  const stageButtons = document.querySelectorAll(
    "#stageFilterGrid [data-stage]",
  );
  stageButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const stage = btn.dataset.stage;
      if (activeFilterState.stages.has(stage)) {
        activeFilterState.stages.delete(stage);
      } else {
        activeFilterState.stages.add(stage);
      }
      syncFilterModalActiveStates();
      applyAllFilters();
    });
  });

  // Form buttons
  const formButtons = document.querySelectorAll("#formFilterGrid [data-form]");
  formButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const form = btn.dataset.form;
      if (activeFilterState.forms.has(form)) {
        activeFilterState.forms.delete(form);
      } else {
        activeFilterState.forms.add(form);
      }
      syncFilterModalActiveStates();
      applyAllFilters();
    });
  });

  // Quick Preset chips
  const presetChips = document.querySelectorAll(".filter-preset-chip");
  presetChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const preset = chip.dataset.preset;
      if (preset) {
        applyFilterPreset(preset);
      }
    });
  });

  // Pre-load evolution stage map in background
  ensureEvolutionStageMap();
}

/**
 * Backward compatibility alias for initializeFilterControls.
 */
export function initializeTypeFilterControls() {
  initializeFilterControls();
}

/**
 * Registers all header control event listeners and initializes their UI state.
 * Handles search input, segmented status filter, type filters, theme toggle,
 * shiny mode toggle, share URL generation, and mobile search bar collapse on scroll.
 *
 * @param {number} [slotCount] - Total number of slots in the active Pokédex used as a fallback for share link encoding.
 * @returns {void}
 */
export function registerHeaderControls(slotCount) {
  const searchInput = document.getElementById("search");
  const themeToggle = document.getElementById("themeToggle");
  const shareButton = document.getElementById("shareDex");
  const shinyToggle = document.getElementById("shinyToggle");
  const statusFilter = document.getElementById("statusFilter");

  initializeFilterControls();
  registerKeyboardShortcuts();

  const searchClear = document.getElementById("searchClear");

  const updateSearchClearVisibility = () => {
    if (searchClear) {
      searchClear.hidden = !searchInput || !searchInput.value;
    }
  };

  // Search input
  searchInput?.addEventListener("input", (event) => {
    const input = event.target;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    applySearchFilter(input.value);
    updateSearchCollapse();
    updateSearchClearVisibility();
    if (
      typeof start === "number" &&
      typeof end === "number" &&
      input.selectionStart === 0 &&
      start > 0
    ) {
      input.setSelectionRange(start, end);
    }
  });

  // Dedicated clear button (works across Firefox, Chrome, Safari, Edge)
  searchClear?.addEventListener("click", () => {
    if (searchInput) {
      searchInput.value = "";
      applySearchFilter("", { immediateScroll: true });
      searchInput.blur();
      updateSearchClearVisibility();
      updateSearchCollapse();
    }
  });

  searchInput?.addEventListener("search", () => {
    applySearchFilter(searchInput.value, { immediateScroll: true });
    updateSearchClearVisibility();
    if (!searchInput.value) {
      searchInput.blur();
    }
    updateSearchCollapse();
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applySearchFilter(searchInput.value, { immediateScroll: true });
    }
  });

  updateSearchClearVisibility();

  // 3-way Segmented status buttons (All / Uncaught / Caught)
  statusFilter?.querySelectorAll(".segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.status;
      if (mode) setStatusFilter(mode);
    });
  });

  // Theme toggle
  themeToggle?.addEventListener("click", () => {
    const settings = loadSettings();
    const currentMode = settings.theme || "light";
    let nextMode;
    if (currentMode === "auto") {
      const resolved =
        document.documentElement.getAttribute("data-theme") || "light";
      nextMode = resolved === "dark" ? "light" : "dark";
    } else {
      nextMode = currentMode === "dark" ? "light" : "dark";
    }
    applyTheme(nextMode);
  });

  // Shiny toggle
  shinyToggle?.addEventListener("click", async () => {
    const nextMode = !isShinyMode;
    setShinyMode(nextMode);

    document.body.classList.toggle("shiny-mode", nextMode);

    shinyToggle.setAttribute("aria-pressed", String(nextMode));
    shinyToggle.classList.toggle("active", nextMode);

    // Rebuild the dex view to reflect shiny mode change
    const { sections } = await buildActiveDexSections();
    const combinedSpeciesIds = sections.flatMap((s) =>
      s.entries.map((e) => e.speciesId),
    );
    const currentSlotCount = combinedSpeciesIds.length;
    rebuildDexView({ sections, slotCount: currentSlotCount });
  });

  // Share button
  shareButton?.addEventListener("click", async () => {
    const activeSlotCount =
      document.querySelectorAll(".cell:not(.is-placeholder)").length ||
      slotCount;
    const shareHash = await encodeCaughtState(
      loadCaughtSlots(),
      activeSlotCount,
    );
    const url =
      location.origin + location.pathname + location.search + shareHash;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard!", "success");
    } catch {
      prompt("Copy this link:", url);
      showToast("Manual copy required.", "warning");
    }
  });

  // Initialize status filter from persisted user settings
  const hideDefault = !!loadSettings().hideCaughtDefault;
  setStatusFilter(hideDefault ? "uncaught" : "all");

  // Mobile: collapse the search bar after scrolling down (when not actively searching)
  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;
  const COLLAPSE_Y = 120;
  let lastScrollY = window.scrollY;

  // Dynamically compute mobile header heights to prevent layout shifts when collapsing/expanding
  const updateHeaderMetrics = () => {
    if (!isMobile()) {
      document.documentElement.style.removeProperty("--searchrow-height");
      document.documentElement.style.removeProperty("--searchrow-height-only");
      document.documentElement.style.removeProperty("--header-expanded-height");
      document.documentElement.style.removeProperty(
        "--header-collapsed-height",
      );
      return;
    }

    const header = document.querySelector("header");
    const searchRow = document.querySelector("header .searchrow");
    if (!header || !searchRow) return;

    if (!document.body.classList.contains("search-collapsed")) {
      const searchRowHeight = searchRow.offsetHeight;
      const headerHeight = header.offsetHeight;
      // Searchrow delta: searchRow height + searchrow margin-bottom (8px) + header padding delta (10px - 6px = 4px)
      const searchRowDelta = searchRowHeight + 8 + 4;
      const collapsedHeaderHeight = Math.max(0, headerHeight - searchRowDelta);

      document.documentElement.style.setProperty(
        "--searchrow-height-only",
        `${searchRowHeight}px`,
      );
      document.documentElement.style.setProperty(
        "--searchrow-height",
        `${searchRowDelta}px`,
      );
      document.documentElement.style.setProperty(
        "--header-expanded-height",
        `${headerHeight + 8}px`,
      );
      document.documentElement.style.setProperty(
        "--header-collapsed-height",
        `${collapsedHeaderHeight + 8}px`,
      );
    }
  };

  const updateSearchCollapse = () => {
    const currentScrollY = Math.max(0, window.scrollY);
    const scrollDelta = currentScrollY - lastScrollY;

    document.body.classList.toggle("is-scrolled", currentScrollY > COLLAPSE_Y);

    if (!isMobile()) {
      document.body.classList.remove("search-collapsed");
      lastScrollY = currentScrollY;
      return;
    }

    const isSearching = Boolean(
      (searchInput && searchInput.value.trim().length > 0) ||
      document.activeElement === searchInput,
    );

    if (isSearching) {
      document.body.classList.remove("search-collapsed");
      lastScrollY = currentScrollY;
      return;
    }

    // Always expand when user is at the top of the page
    if (currentScrollY <= 40) {
      document.body.classList.remove("search-collapsed");
    }
    // Collapse when actively scrolling down past the threshold
    else if (scrollDelta > 10 && currentScrollY > COLLAPSE_Y) {
      document.body.classList.add("search-collapsed");
    }
    // Reveal when user scrolls up with intent
    else if (scrollDelta < -15) {
      document.body.classList.remove("search-collapsed");
    }

    lastScrollY = currentScrollY;
  };

  searchInput?.addEventListener("focus", updateSearchCollapse);
  searchInput?.addEventListener("blur", updateSearchCollapse);

  window.addEventListener("scroll", updateSearchCollapse, { passive: true });
  window.addEventListener("resize", () => {
    updateHeaderMetrics();
    updateSearchCollapse();
  });
  window.addEventListener("orientationchange", () => {
    setTimeout(updateHeaderMetrics, 100);
  });

  updateHeaderMetrics();
  updateSearchCollapse();
  requestAnimationFrame(updateHeaderMetrics);
}

/**
 * Registers event listeners for the "scroll to top" button.
 * Shows the button after scrolling down past a threshold and scrolls back smoothly when clicked.
 *
 * @returns {void}
 */
export function registerScrollToTopButton() {
  const button = document.getElementById("scrollTop");
  if (!button) return;

  const threshold = 320;

  function onScroll() {
    if (window.scrollY > threshold) {
      button.classList.add("is-visible");
    } else {
      button.classList.remove("is-visible");
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  button.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: isMotionReduced() ? "auto" : "smooth",
    });
  });
}
