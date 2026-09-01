import {
  loadSettings,
  loadCaughtSlots,
  encodeCaughtState,
} from "../storage.js";
import { applyTheme, isMotionReduced } from "./theme.js";
import { showToast } from "./modals.js";
import { isShinyMode, setShinyMode, rebuildDexView } from "../state.js";
import { buildActiveDexSections } from "../db.js";

/**
 * List of standard 18 Pokémon types with their display labels.
 */
export const POKEMON_TYPES = [
  { id: "normal", name: "Normal" },
  { id: "fire", name: "Fire" },
  { id: "water", name: "Water" },
  { id: "grass", name: "Grass" },
  { id: "electric", name: "Electric" },
  { id: "ice", name: "Ice" },
  { id: "fighting", name: "Fighting" },
  { id: "poison", name: "Poison" },
  { id: "ground", name: "Ground" },
  { id: "flying", name: "Flying" },
  { id: "psychic", name: "Psychic" },
  { id: "bug", name: "Bug" },
  { id: "rock", name: "Rock" },
  { id: "ghost", name: "Ghost" },
  { id: "dragon", name: "Dragon" },
  { id: "dark", name: "Dark" },
  { id: "steel", name: "Steel" },
  { id: "fairy", name: "Fairy" },
];

/**
 * Active status filter mode: 'all' | 'uncaught' | 'caught'
 * @type {'all'|'uncaught'|'caught'}
 */
let currentStatusFilter = "all";

/**
 * Set of active selected type filters.
 * @type {Set<string>}
 */
const activeTypeFilters = new Set();

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
 * Updates the active filter badge count and button styling on the main header.
 * @returns {void}
 */
function updateTypeFilterBadge() {
  const badge = document.getElementById("activeFilterBadge");
  const filtersBtn = document.getElementById("filtersBtn");
  const count = activeTypeFilters.size;

  if (badge) {
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  if (filtersBtn) {
    filtersBtn.classList.toggle("has-filters", count > 0);
  }
}

/**
 * Applies active type filters to all dex cells.
 * Hides non-matching cells by adding the `type-hidden` CSS class.
 *
 * @returns {void}
 */
export function applyTypeFilter() {
  const hasActiveTypes = activeTypeFilters.size > 0;
  document.body.classList.toggle("type-filter-active", hasActiveTypes);

  const cells = document.querySelectorAll(".cell:not(.is-placeholder)");
  if (!hasActiveTypes) {
    cells.forEach((cell) => cell.classList.remove("type-hidden"));
    updateTypeFilterBadge();
    return;
  }

  const selectedList = Array.from(activeTypeFilters);
  cells.forEach((cell) => {
    const cellTypes = (cell.dataset.types || "").split(" ").filter(Boolean);
    const matchesAll = selectedList.every((type) => cellTypes.includes(type));
    cell.classList.toggle("type-hidden", !matchesAll);
  });

  updateTypeFilterBadge();
}

/**
 * Clears all active type filters and refreshes the dex view.
 * @returns {void}
 */
export function clearTypeFilters() {
  activeTypeFilters.clear();
  const buttons = document.querySelectorAll(".filter-type-btn");
  buttons.forEach((btn) => btn.classList.remove("is-active"));
  applyTypeFilter();
}

/**
 * Toggles an individual type filter on or off.
 *
 * @param {string} typeId - Pokémon type identifier (e.g. 'fire').
 * @returns {void}
 */
export function toggleTypeFilter(typeId) {
  if (activeTypeFilters.has(typeId)) {
    activeTypeFilters.delete(typeId);
  } else {
    activeTypeFilters.add(typeId);
  }

  const btn = document.querySelector(`.filter-type-btn[data-type='${typeId}']`);
  if (btn) {
    btn.classList.toggle("is-active", activeTypeFilters.has(typeId));
  }

  applyTypeFilter();
}

// =============================================================================
// HEADER CONTROLS & USER INTERACTIONS
// =============================================================================

/**
 * Filters and highlights Pokémon cells based on a search query.
 * Supports searching by regional or national Pokédex number (e.g. "#42", "42") or by Pokémon name.
 * Highlights matching cells, dims non-matching cells, and scrolls the first match into view.
 *
 * @param {string} query - The search query string entered by the user.
 * @returns {void}
 */
export function applySearchFilter(query) {
  const trimmed = query.trim().toLowerCase();
  const cells = [...document.querySelectorAll(".cell:not(.is-placeholder)")];
  cells.forEach((cell) => cell.classList.remove("highlight", "dimmed"));

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
    matches[0].scrollIntoView({
      behavior: isMotionReduced() ? "auto" : "smooth",
      block: "center",
    });
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
 * Initializes and binds all type filter modal buttons and controls.
 * @returns {void}
 */
function initializeTypeFilterControls() {
  const grid = document.getElementById("typeFilterGrid");
  const clearBtn = document.getElementById("clearAllFiltersBtn");

  if (grid && !grid.hasChildNodes()) {
    const fragment = document.createDocumentFragment();
    POKEMON_TYPES.forEach((type) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-type-btn";
      button.dataset.type = type.id;
      button.textContent = type.name;
      button.addEventListener("click", () => toggleTypeFilter(type.id));
      fragment.appendChild(button);
    });
    grid.appendChild(fragment);
  }

  clearBtn?.addEventListener("click", () => {
    clearTypeFilters();
  });
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

  initializeTypeFilterControls();
  registerKeyboardShortcuts();

  // Search input
  searchInput?.addEventListener("input", (event) =>
    applySearchFilter(event.target.value),
  );

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

  // Mobile: collapse the search bar after scrolling down
  const isMobile = () => window.matchMedia("(max-width: 640px)").matches;
  const COLLAPSE_Y = 120;
  const EXPAND_Y = 60;

  const updateSearchCollapse = () => {
    document.body.classList.toggle("is-scrolled", window.scrollY > COLLAPSE_Y);
    if (!isMobile()) {
      document.body.classList.remove("search-collapsed");
      return;
    }
    if (window.scrollY > COLLAPSE_Y) {
      document.body.classList.add("search-collapsed");
    } else if (window.scrollY < EXPAND_Y) {
      document.body.classList.remove("search-collapsed");
    }
  };

  searchInput?.addEventListener("focus", () => {
    document.body.classList.remove("search-collapsed");
  });

  window.addEventListener("scroll", updateSearchCollapse, { passive: true });
  window.addEventListener("resize", updateSearchCollapse);
  updateSearchCollapse();
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
