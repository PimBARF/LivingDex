import {
  ACTIVE_GAME_ID,
  spriteUrlForSpecies,
  itemSpriteUrl,
  normalizeItemName,
} from "../config.js";
import {
  loadSettings,
  loadCaughtSlots,
  loadShinyCaughtSlots,
  loadItemInventory,
  saveItemInventory,
  loadSpecimenInventory,
  saveSpecimenInventory,
  getSelectedGameVersion,
  setSelectedGameVersion,
} from "../storage.js";
import { isShinyMode, syncCaughtState, countCaughtSlots } from "../state.js";
import {
  getMissingPokemonData,
  getEvolutionFamilyChecklist,
  getEvolutionItemsSummary,
  buildActiveDexSections,
  getGameDexData,
  formatVersionName,
} from "../db.js";
import { attachModalHandlers } from "./modals.js";
import { openPokemonInfoModal } from "./pokemon-info.js";

// =============================================================================
// MISSING GUIDE & LIVING DEX PREREQUISITES CONTROLLER
// =============================================================================

const GUIDE_PREFERENCES_KEY = "livingdex-missing-guide-preferences-v1";

function loadGuidePreferences() {
  try {
    return JSON.parse(localStorage.getItem(GUIDE_PREFERENCES_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveGuidePreferences(update) {
  try {
    const current = loadGuidePreferences();
    localStorage.setItem(
      GUIDE_PREFERENCES_KEY,
      JSON.stringify({ ...current, ...update }),
    );
  } catch {
    // Preferences are optional; keep the guide usable when storage is unavailable.
  }
}

const guidePreferences = loadGuidePreferences();

/** Active view mode tab in the modal: 'missing' | 'family' | 'items' */
let currentTab = ["missing", "family", "items"].includes(guidePreferences.tab)
  ? guidePreferences.tab
  : "missing";
let guideViewMode =
  guidePreferences.viewMode === "compact" ? "compact" : "cards";
let pendingUndo = null;

/** Filter and sorting state */
let filterState = {
  search: "",
  method: "all",
  type: "",
  segment: "",
  version: "all",
  sort: "regional-asc",
  familyFilter: "all",
};

/** Cached data for the current modal session */
let cachedMissingData = null;
let cachedFamilyData = null;
let cachedItemsData = null;
let cachedSlotCount = 0;

/** Modal handlers instance */
let _missingModalHandlers = null;

/**
 * Returns active caught slots map based on current shiny tracking mode.
 * @returns {Record<number, boolean>}
 */
function getActiveCaughtSlots() {
  return isShinyMode ? loadShinyCaughtSlots() : loadCaughtSlots();
}

/**
 * Updates the header badge showing the remaining missing Pokémon count.
 *
 * @param {number} [slotCount] - Optional total living dex slot count.
 */
export function updateMissingGuideBadge(slotCount) {
  const badge = document.getElementById("missingGuideBadge");
  if (!badge) return;

  const total =
    typeof slotCount === "number" && slotCount > 0
      ? slotCount
      : document.querySelectorAll(".cell:not(.is-placeholder)").length;

  if (total <= 0) {
    badge.hidden = true;
    return;
  }

  const caught = countCaughtSlots(total);
  const missing = Math.max(0, total - caught);

  badge.textContent = String(missing);
  badge.hidden = missing === 0;
  badge.setAttribute("aria-label", `${missing} missing Pokémon`);
}

/**
 * Attaches event listeners and initializes the Missing Guide modal.
 *
 * @returns {{ openModal: () => void, closeModal: () => void }}
 */
export function registerMissingGuideModal() {
  const modal = document.getElementById("modalMissingGuide");
  const openBtn = document.getElementById("missingGuideBtn");
  const closeBtn = document.getElementById("closeMissingGuide");
  const backdrop = modal?.querySelector("[data-close]");

  if (!modal) return { openModal: () => {}, closeModal: () => {} };

  _missingModalHandlers = attachModalHandlers({
    modal,
    openBtn,
    closeBtn,
    backdrop,
    onOpen: async () => {
      filterState.version = getSelectedGameVersion(ACTIVE_GAME_ID) || "all";
      cachedFamilyData = null;
      cachedItemsData = null;
      await populateVersionFilterDropdown();
      await refreshMissingGuideData();
      populateSegmentFilterDropdown();
      updateActiveFilterBadge();
      await ensureActiveTabData();
      syncTabUI();
      renderActiveTab();
    },
    onClose: () => {
      if (pendingUndo) {
        clearTimeout(pendingUndo._dismissTimer);
        pendingUndo.remove();
        pendingUndo = null;
      }
    },
    focusSelector: "#missingSearch",
  });

  setupTabListeners();
  setupFilterListeners();
  setupViewToggle();

  return _missingModalHandlers;
}

/**
 * Programmatically opens the Missing Guide modal.
 */
export function openMissingGuideModal() {
  if (_missingModalHandlers) {
    _missingModalHandlers.openModal();
  }
}

/**
 * Updates the active filter badge count and toggle button highlight.
 */
function updateActiveFilterBadge() {
  const badge = document.getElementById("missingActiveFilterBadge");
  const toggleBtn = document.getElementById("missingToggleFiltersBtn");
  if (!badge) return;

  let count = 0;
  if (filterState.version && filterState.version !== "all") count += 1;
  if (filterState.method !== "all") count += 1;
  if (filterState.type) count += 1;
  if (filterState.segment) count += 1;
  if (filterState.sort !== "regional-asc") count += 1;
  if (filterState.familyFilter !== "all" && currentTab === "family") count += 1;

  badge.textContent = String(count);
  badge.hidden = count === 0;
  if (toggleBtn) {
    toggleBtn.classList.toggle("has-active-filters", count > 0);
  }
}

function updateGuideFeedback(filteredCount = null) {
  const summary = document.getElementById("missingResultsSummary");
  const chips = document.getElementById("missingActiveFilterChips");
  if (summary) {
    if (currentTab === "family") {
      const total = cachedFamilyData?.length || 0;
      const visible =
        filteredCount ?? getFilteredFamilyList(cachedFamilyData).length;
      summary.textContent = `${visible} of ${total} families`;
    } else {
      const total = cachedMissingData?.length || 0;
      const visible =
        filteredCount ?? getFilteredMissingList(cachedMissingData).length;
      summary.textContent = `${visible} of ${total} missing`;
    }
  }
  if (!chips) return;

  chips.innerHTML = "";
  const active = [];
  if (filterState.search) active.push(["Search", "search"]);
  if (filterState.version !== "all") active.push(["Version", "version"]);
  if (filterState.method !== "all") active.push(["Method", "method"]);
  if (filterState.type) active.push(["Type", "type"]);
  if (filterState.segment) active.push(["Segment", "segment"]);
  if (filterState.familyFilter !== "all" && currentTab === "family") {
    active.push(["Family", "familyFilter"]);
  }

  active.forEach(([label, key]) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "missing-filter-chip";
    chip.textContent = `${label}: ${key === "search" ? filterState.search : "active"} ×`;
    chip.setAttribute("aria-label", `Remove ${label} filter`);
    chip.addEventListener("click", () => {
      if (key === "search") filterState.search = "";
      else if (key === "version") filterState.version = "all";
      else if (key === "method") filterState.method = "all";
      else if (key === "type") filterState.type = "";
      else if (key === "segment") filterState.segment = "";
      else filterState.familyFilter = "all";
      syncFilterControls();
      updateActiveFilterBadge();
      renderActiveTab();
    });
    chips.appendChild(chip);
  });
}

function syncFilterControls() {
  const values = {
    missingSearch: filterState.search,
    missingFilterVersion: filterState.version,
    missingFilterMethod: filterState.method,
    missingFilterFamily: filterState.familyFilter,
    missingFilterType: filterState.type,
    missingFilterSegment: filterState.segment,
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.value = value;
  });
  const clear = document.getElementById("missingSearchClear");
  if (clear) clear.hidden = !filterState.search;
}

function setupViewToggle() {
  const toggle = document.getElementById("missingViewToggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    guideViewMode = guideViewMode === "cards" ? "compact" : "cards";
    saveGuidePreferences({ viewMode: guideViewMode });
    updateViewToggle();
    renderActiveTab();
  });
  updateViewToggle();
}

function updateViewToggle() {
  const toggle = document.getElementById("missingViewToggle");
  if (!toggle) return;
  const compact = guideViewMode === "compact";
  toggle.setAttribute("aria-pressed", String(compact));
  toggle.title = compact
    ? "Switch to card view"
    : "Switch to compact list view";
  const label = toggle.querySelector(".view-toggle-label");
  if (label) label.textContent = compact ? "Cards" : "Compact";
}

/**
 * Refreshes data from db.js for missing Pokémon, families, and items.
 */
async function refreshMissingGuideData() {
  const caught = getActiveCaughtSlots();
  const { sections } = await buildActiveDexSections();
  cachedSlotCount = sections.reduce(
    (sum, s) => sum + (s.entries ? s.entries.length : 0),
    0,
  );

  const missing = await getMissingPokemonData(
    ACTIVE_GAME_ID,
    caught,
    filterState.version,
  );
  cachedMissingData = missing;
  cachedFamilyData = null;
  cachedItemsData = null;

  updateModalHeaderStats();
}

async function ensureActiveTabData() {
  const caught = getActiveCaughtSlots();
  if (currentTab === "family" && !cachedFamilyData) {
    cachedFamilyData = await getEvolutionFamilyChecklist(
      ACTIVE_GAME_ID,
      caught,
    );
  }
  if (currentTab === "items" && !cachedItemsData) {
    if (!cachedMissingData) await refreshMissingGuideData();
    cachedItemsData = await getEvolutionItemsSummary(
      ACTIVE_GAME_ID,
      caught,
      cachedMissingData,
    );
  }
  updateModalHeaderStats();
}

/**
 * Updates the modal header stats counter.
 */
function updateModalHeaderStats() {
  const statsEl = document.getElementById("missingGuideStats");
  if (!statsEl) return;

  const missingCount = cachedMissingData ? cachedMissingData.length : 0;
  const familiesCount = cachedFamilyData ? cachedFamilyData.length : 0;
  const itemsCount = cachedItemsData ? cachedItemsData.totalItemsCount : 0;
  const remainingItemsCount = cachedItemsData
    ? cachedItemsData.totalRemainingCount
    : itemsCount;

  if (currentTab === "missing") {
    statsEl.innerHTML = `<span class="stats-label-full">${missingCount} Pokémon Remaining</span><span class="stats-label-short">${missingCount} Remaining</span>`;
  } else if (currentTab === "family") {
    statsEl.innerHTML = `<span class="stats-label-full">${familiesCount} Incomplete Families</span><span class="stats-label-short">${familiesCount} Incomplete</span>`;
  } else if (currentTab === "items") {
    statsEl.innerHTML = `<span class="stats-label-full">${remainingItemsCount} / ${itemsCount} Items Needed</span><span class="stats-label-short">${remainingItemsCount} Items Needed</span>`;
  }
}

/**
 * Populates game version filter dropdown options based on active game's versions.
 */
async function populateVersionFilterDropdown() {
  const versionWrap = document.getElementById("missingFilterVersionWrap");
  const versionSelect = document.getElementById("missingFilterVersion");
  if (!versionSelect || !versionWrap) return;

  const gameDexData = await getGameDexData(ACTIVE_GAME_ID);
  const versions = gameDexData?.versions || [];

  if (versions.length <= 1 || ACTIVE_GAME_ID === "home") {
    versionWrap.hidden = true;
    return;
  }

  versionWrap.hidden = false;
  const currentSaved = getSelectedGameVersion(ACTIVE_GAME_ID) || "all";
  versionSelect.innerHTML = "";

  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = `All Versions (${versions.map(formatVersionName).join(" / ")})`;
  versionSelect.appendChild(allOpt);

  versions.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = formatVersionName(v);
    versionSelect.appendChild(opt);
  });

  versionSelect.value = filterState.version || currentSaved;
}

/**
 * Populates segment filter dropdown options based on active dex sections.
 */
async function populateSegmentFilterDropdown() {
  const segmentSelect = document.getElementById("missingFilterSegment");
  if (!segmentSelect) return;

  const { sections } = await buildActiveDexSections();
  const currentVal = segmentSelect.value;
  segmentSelect.innerHTML = '<option value="">All Segments</option>';

  sections.forEach((sec) => {
    const opt = document.createElement("option");
    opt.value = sec.key;
    opt.textContent = sec.title;
    segmentSelect.appendChild(opt);
  });

  if (currentVal && sections.some((s) => s.key === currentVal)) {
    segmentSelect.value = currentVal;
  }
}

/**
 * Sets up tab switching listeners.
 */
function setupTabListeners() {
  const tabButtons = document.querySelectorAll(
    "#missingGuideTabs .segmented-btn",
  );
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tab = btn.dataset.tab;
      if (!tab || tab === currentTab) return;

      currentTab = tab;
      saveGuidePreferences({ tab: currentTab });
      tabButtons.forEach((b) => {
        const active = b.dataset.tab === currentTab;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
        b.tabIndex = active ? 0 : -1;
      });

      // Update toolbar visibility per tab
      const methodFilter = document.getElementById("missingFilterMethodWrap");
      const familyFilter = document.getElementById("missingFilterFamilyWrap");
      const typeFilter = document.getElementById("missingFilterTypeWrap");
      const segmentFilter = document.getElementById("missingFilterSegmentWrap");
      const sortSelect = document.getElementById("missingSortWrap");

      if (methodFilter) methodFilter.hidden = currentTab !== "missing";
      if (familyFilter) familyFilter.hidden = currentTab !== "family";
      if (typeFilter) typeFilter.hidden = currentTab === "items";
      if (segmentFilter) segmentFilter.hidden = currentTab === "items";
      if (sortSelect) sortSelect.hidden = currentTab === "items";

      syncTabUI();
      updateActiveFilterBadge();
      await ensureActiveTabData();
      updateModalHeaderStats();
      renderActiveTab();
    });
  });
}

function syncTabUI() {
  const tabButtons = document.querySelectorAll(
    "#missingGuideTabs .segmented-btn",
  );
  tabButtons.forEach((button) => {
    const active = button.dataset.tab === currentTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  const methodFilter = document.getElementById("missingFilterMethodWrap");
  const familyFilter = document.getElementById("missingFilterFamilyWrap");
  const versionFilter = document.getElementById("missingFilterVersionWrap");
  const typeFilter = document.getElementById("missingFilterTypeWrap");
  const segmentFilter = document.getElementById("missingFilterSegmentWrap");
  const sortSelect = document.getElementById("missingSortWrap");
  const searchWrap = document.querySelector(".missing-search-wrap");
  const filterToggle = document.getElementById("missingToggleFiltersBtn");
  const viewToggle = document.getElementById("missingViewToggle");
  const activeChips = document.getElementById("missingActiveFilterChips");
  const resultsSummary = document.getElementById("missingResultsSummary");
  const filtersCollapse = document.getElementById("missingFiltersCollapse");
  setGuideElementVisibility(methodFilter, currentTab === "missing");
  setGuideElementVisibility(familyFilter, currentTab === "family");
  setGuideElementVisibility(versionFilter, currentTab === "missing");
  setGuideElementVisibility(typeFilter, currentTab !== "items");
  setGuideElementVisibility(segmentFilter, currentTab !== "items");
  setGuideElementVisibility(sortSelect, currentTab !== "items");
  setGuideElementVisibility(searchWrap, currentTab !== "items");
  setGuideElementVisibility(filterToggle, currentTab !== "items");
  setGuideElementVisibility(viewToggle, currentTab === "missing");
  setGuideElementVisibility(activeChips, currentTab !== "items");
  setGuideElementVisibility(resultsSummary, currentTab !== "items");
  if (filtersCollapse && currentTab === "items") {
    filtersCollapse.hidden = true;
    filtersCollapse.style.display = "none";
  } else if (filtersCollapse) {
    filtersCollapse.style.display = "";
  }
  syncSortOptions();
}

function setGuideElementVisibility(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  element.style.display = visible ? "" : "none";
}

function syncSortOptions() {
  const sortSelect = document.getElementById("missingSort");
  if (!sortSelect) return;

  const options =
    currentTab === "family"
      ? [
          ["route-smart", "Catching Order (Recommended Routes)"],
          ["route-asc", "Catching Order (Earliest Route first)"],
          ["regional-asc", "Regional Dex # (Lowest first)"],
          ["regional-desc", "Regional Dex # (Highest first)"],
          ["national-asc", "National Dex # (Lowest first)"],
          ["national-desc", "National Dex # (Highest first)"],
          ["name-asc", "Family Name (A → Z)"],
          ["name-desc", "Family Name (Z → A)"],
          ["family-completion", "Completion (Most first)"],
          ["family-needed", "Specimens Needed (Fewest first)"],
        ]
      : [
          ["route-smart", "Catching Order (Recommended Routes)"],
          ["route-asc", "Catching Order (Earliest Route first)"],
          ["regional-asc", "Regional Dex # (Lowest first)"],
          ["regional-desc", "Regional Dex # (Highest first)"],
          ["national-asc", "National Dex # (Lowest first)"],
          ["national-desc", "National Dex # (Highest first)"],
          ["name-asc", "Name (A → Z)"],
          ["name-desc", "Name (Z → A)"],
          ["category", "Acquisition Method"],
          ["readiness", "Ready to Evolve first"],
        ];

  const currentSort = filterState.sort;
  sortSelect.replaceChildren(
    ...options.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );
  if (options.some(([value]) => value === currentSort)) {
    sortSelect.value = currentSort;
  } else {
    filterState.sort = "regional-asc";
    sortSelect.value = filterState.sort;
  }
}

/**
 * Sets up filter, search, and sorting event listeners.
 */
function setupFilterListeners() {
  const searchInput = document.getElementById("missingSearch");
  const searchClear = document.getElementById("missingSearchClear");
  const toggleFiltersBtn = document.getElementById("missingToggleFiltersBtn");
  const filtersCollapse = document.getElementById("missingFiltersCollapse");
  const versionSelect = document.getElementById("missingFilterVersion");
  const methodSelect = document.getElementById("missingFilterMethod");
  const familySelect = document.getElementById("missingFilterFamily");
  const typeSelect = document.getElementById("missingFilterType");
  const segmentSelect = document.getElementById("missingFilterSegment");
  const sortSelect = document.getElementById("missingSort");
  const resetFiltersBtn = document.getElementById("missingResetFilters");

  if (toggleFiltersBtn && filtersCollapse) {
    toggleFiltersBtn.addEventListener("click", () => {
      const isExpanded = !filtersCollapse.hidden;
      filtersCollapse.hidden = isExpanded;
      toggleFiltersBtn.setAttribute("aria-expanded", String(!isExpanded));
      toggleFiltersBtn.classList.toggle("is-active", !isExpanded);
    });
  }

  if (versionSelect) {
    versionSelect.addEventListener("change", async (e) => {
      filterState.version = e.target.value;
      setSelectedGameVersion(ACTIVE_GAME_ID, filterState.version);
      updateActiveFilterBadge();
      await refreshMissingGuideData();
      await ensureActiveTabData();
      updateModalHeaderStats();
      renderActiveTab();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filterState.search = e.target.value.trim().toLowerCase();
      if (searchClear) searchClear.hidden = !filterState.search;
      updateGuideFeedback();
      renderActiveTab();
    });
  }

  if (searchClear) {
    searchClear.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        filterState.search = "";
        searchClear.hidden = true;
        searchInput.focus();
        updateGuideFeedback();
        renderActiveTab();
      }
    });
  }

  if (methodSelect) {
    methodSelect.addEventListener("change", (e) => {
      filterState.method = e.target.value;
      updateActiveFilterBadge();
      updateGuideFeedback();
      renderActiveTab();
    });
  }

  if (familySelect) {
    familySelect.addEventListener("change", (e) => {
      filterState.familyFilter = e.target.value;
      updateActiveFilterBadge();
      updateGuideFeedback();
      renderActiveTab();
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener("change", (e) => {
      filterState.type = e.target.value;
      updateActiveFilterBadge();
      updateGuideFeedback();
      renderActiveTab();
    });
  }

  if (segmentSelect) {
    segmentSelect.addEventListener("change", (e) => {
      filterState.segment = e.target.value;
      updateActiveFilterBadge();
      updateGuideFeedback();
      renderActiveTab();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      filterState.sort = e.target.value;
      updateActiveFilterBadge();
      updateGuideFeedback();
      renderActiveTab();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", async () => {
      filterState = {
        search: "",
        method: "all",
        type: "",
        segment: "",
        version: "all",
        sort: "regional-asc",
        familyFilter: "all",
      };
      setSelectedGameVersion(ACTIVE_GAME_ID, "all");
      if (versionSelect) versionSelect.value = "all";
      if (searchInput) searchInput.value = "";
      if (searchClear) searchClear.hidden = true;
      if (methodSelect) methodSelect.value = "all";
      if (familySelect) familySelect.value = "all";
      if (typeSelect) typeSelect.value = "";
      if (segmentSelect) segmentSelect.value = "";
      if (sortSelect) sortSelect.value = "regional-asc";
      updateActiveFilterBadge();
      updateGuideFeedback();
      await refreshMissingGuideData();
      await ensureActiveTabData();
      updateModalHeaderStats();
      renderActiveTab();
    });
  }
}

/**
 * Renders the currently selected view tab.
 */
function renderActiveTab() {
  const missingContainer = document.getElementById("missingListContainer");
  const familyContainer = document.getElementById("missingFamilyContainer");
  const itemsContainer = document.getElementById("missingItemsContainer");

  if (!missingContainer || !familyContainer || !itemsContainer) return;

  missingContainer.hidden = currentTab !== "missing";
  familyContainer.hidden = currentTab !== "family";
  itemsContainer.hidden = currentTab !== "items";

  if (currentTab === "missing") {
    renderMissingList(missingContainer);
  } else if (currentTab === "family") {
    renderFamilyQuotas(familyContainer);
  } else if (currentTab === "items") {
    renderItemsShoppingList(itemsContainer);
  }
  updateGuideFeedback();
}

// =============================================================================
// TAB 1: INDIVIDUAL MISSING POKÉMON LIST
// =============================================================================

/**
 * Filters and sorts individual missing Pokémon data.
 *
 * @param {Array<Object>} list - Raw missing entries.
 * @returns {Array<Object>} Filtered and sorted entries.
 */
function getFilteredMissingList(list) {
  if (!list) return [];

  let result = list.filter((p) => {
    // Search filter
    if (filterState.search) {
      const q = filterState.search;
      const matchName = p.name.toLowerCase().includes(q);
      const matchNum =
        String(p.nationalDexNumber) === q ||
        String(p.regionalDexNumber) === q ||
        p.dexNumber.toLowerCase().includes(q);
      const matchItem =
        p.requiredItem && p.requiredItem.toLowerCase().includes(q);
      const matchLoc = p.locations.some((l) =>
        (typeof l === "string" ? l : l?.location || "")
          .toLowerCase()
          .includes(q),
      );
      if (!matchName && !matchNum && !matchItem && !matchLoc) return false;
    }

    // Method filter
    if (filterState.method !== "all") {
      if (filterState.method === "ready") {
        if (!p.isReadyToEvolve && !p.isSacrificeEvolve) return false;
      } else if (filterState.method === "starter") {
        if (p.methodCategory !== "starter") return false;
      } else if (filterState.method === "gift") {
        if (p.methodCategory !== "gift") return false;
      } else if (filterState.method === "wild") {
        if (
          !p.hasWildLocations ||
          p.methodCategory === "starter" ||
          p.methodCategory === "gift"
        )
          return false;
      } else if (filterState.method === "item") {
        if (p.methodCategory !== "item" && !p.requiredItem) return false;
      } else if (filterState.method === "trade") {
        if (
          p.evolveDetails?.trigger !== "trade" &&
          p.methodCategory !== "trade"
        )
          return false;
      } else if (filterState.method === "level") {
        if (
          p.methodCategory !== "level" &&
          p.evolveDetails?.trigger !== "level-up"
        )
          return false;
      } else if (filterState.method === "special") {
        if (p.methodCategory !== "special") return false;
      } else if (filterState.method === "transfer") {
        if (
          p.methodCategory !== "transfer" &&
          (p.hasWildLocations || p.evolveDetails)
        )
          return false;
      }
    }

    // Type filter
    if (filterState.type) {
      if (!p.types.includes(filterState.type)) return false;
    }

    // Segment filter
    if (filterState.segment) {
      if (p.sectionKey !== filterState.segment) return false;
    }

    return true;
  });

  // Sorting
  result.sort((a, b) => {
    if (filterState.sort === "route-smart") {
      const scoreA = a.smartRouteIndex ?? 9999;
      const scoreB = b.smartRouteIndex ?? 9999;
      return (
        scoreA - scoreB ||
        a.regionalDexNumber - b.regionalDexNumber ||
        a.slotNumber - b.slotNumber
      );
    }
    if (filterState.sort === "route-asc") {
      const scoreA = a.earliestRouteIndex ?? 9999;
      const scoreB = b.earliestRouteIndex ?? 9999;
      return (
        scoreA - scoreB ||
        a.regionalDexNumber - b.regionalDexNumber ||
        a.slotNumber - b.slotNumber
      );
    }
    if (
      filterState.sort === "regional-asc" ||
      filterState.sort === "regional-desc"
    ) {
      const direction = filterState.sort === "regional-asc" ? 1 : -1;
      return (
        direction * (a.regionalDexNumber - b.regionalDexNumber) ||
        direction * (a.nationalDexNumber - b.nationalDexNumber) ||
        a.slotNumber - b.slotNumber
      );
    }
    if (
      filterState.sort === "national-asc" ||
      filterState.sort === "national-desc"
    ) {
      const direction = filterState.sort === "national-asc" ? 1 : -1;
      return (
        direction * (a.nationalDexNumber - b.nationalDexNumber) ||
        direction * (a.regionalDexNumber - b.regionalDexNumber) ||
        a.slotNumber - b.slotNumber
      );
    }
    if (filterState.sort === "name-asc") {
      return a.name.localeCompare(b.name);
    }
    if (filterState.sort === "name-desc") {
      return b.name.localeCompare(a.name);
    }
    if (filterState.sort === "category") {
      const order = {
        starter: 1,
        gift: 2,
        wild: 3,
        level: 4,
        item: 5,
        trade: 6,
        special: 7,
        transfer: 8,
      };
      return (order[a.methodCategory] || 99) - (order[b.methodCategory] || 99);
    }
    if (filterState.sort === "readiness") {
      const scoreA = a.isReadyToEvolve ? 2 : a.isSacrificeEvolve ? 1 : 0;
      const scoreB = b.isReadyToEvolve ? 2 : b.isSacrificeEvolve ? 1 : 0;
      return scoreB - scoreA;
    }
    return 0;
  });

  return result;
}

/**
 * Renders the missing Pokémon card list.
 *
 * @param {HTMLElement} container
 */
function renderMissingList(container) {
  container.innerHTML = "";

  const filtered = getFilteredMissingList(cachedMissingData);
  const spriteStyle = loadSettings().spriteStyle || "pokesprites";
  const isHome = ACTIVE_GAME_ID === "home";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "missing-empty-state";
    if (cachedMissingData && cachedMissingData.length === 0) {
      empty.innerHTML = `
        <div class="empty-icon">🏆</div>
        <h4>Living Dex 100% Complete!</h4>
        <p>You have caught every single Pokémon for this Pokédex. Congratulations, Master Trainer!</p>
      `;
    } else {
      empty.innerHTML = `
        <div class="empty-icon">🔍</div>
        <h4>No matching Pokémon found</h4>
        <p>Try adjusting your search query or filter options.</p>
      `;
    }
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = `missing-cards-grid ${guideViewMode === "compact" ? "is-compact" : ""}`;

  filtered.forEach((p) => {
    const card = document.createElement("div");
    card.className = "missing-card";
    card.dataset.slot = String(p.slotNumber);

    // Primary sprite & fallback
    const spriteUrl = spriteUrlForSpecies(
      p.spriteId,
      spriteStyle,
      isShinyMode,
      p.gender,
    );
    const fallbackUrl = spriteUrlForSpecies(
      p.speciesId,
      spriteStyle,
      isShinyMode,
    );

    // Header info (Sprite + Meta)
    const header = document.createElement("div");
    header.className = "missing-card-header";

    const spriteWrap = document.createElement("div");
    spriteWrap.className = "missing-card-sprite-wrap";
    const img = document.createElement("img");
    img.className = "missing-card-sprite";
    img.src = spriteUrl;
    img.dataset.fallback = fallbackUrl;
    img.alt = p.name;
    img.loading = "lazy";
    img.crossOrigin = "anonymous";
    img.onerror = function onMissingSpriteErr() {
      if (this.dataset.fallback && this.src !== this.dataset.fallback) {
        this.src = this.dataset.fallback;
      }
    };
    spriteWrap.appendChild(img);

    const meta = document.createElement("div");
    meta.className = "missing-card-meta";

    const numSpan = document.createElement("span");
    numSpan.className = "missing-card-number";
    numSpan.textContent = filterState.sort.startsWith("national")
      ? `#${String(p.nationalDexNumber).padStart(3, "0")}`
      : `#${String(p.regionalDexNumber).padStart(3, "0")}`;

    const nameSpan = document.createElement("h4");
    nameSpan.className = "missing-card-name";
    nameSpan.textContent = p.name;

    const typesWrap = document.createElement("div");
    typesWrap.className = "missing-card-types";
    p.types.forEach((t) => {
      const tb = document.createElement("span");
      tb.className = "type-badge";
      tb.dataset.type = t;
      tb.textContent = t;
      typesWrap.appendChild(tb);
    });

    meta.append(numSpan, nameSpan, typesWrap);
    header.append(spriteWrap, meta);

    // Acquisition Details Body
    const body = document.createElement("div");
    body.className = "missing-card-body";

    // Readiness / inventory banner
    if (p.isReadyToEvolve && p.preEvolutionName) {
      const readyBanner = document.createElement("div");
      readyBanner.className = "missing-ready-badge";
      readyBanner.innerHTML = `<span>🟢</span> Ready: <strong>${p.preSpecimenCount} ${p.preEvolutionName}</strong> owned (extra to spare)${p.requiredItem ? ` &amp; item in bag` : ""}!`;
      body.appendChild(readyBanner);
    } else if (p.isSacrificeEvolve && p.preEvolutionName) {
      const warnBanner = document.createElement("div");
      warnBanner.className = "missing-ready-badge is-warning";
      warnBanner.innerHTML = `<span>⚠️</span> Warning: Only 1 <strong>${p.preEvolutionName}</strong> owned—evolving will vacate its Living Dex slot!`;
      body.appendChild(warnBanner);
    } else if (p.hasPreEvo && p.requiredItem && !p.hasItem) {
      const partialBanner = document.createElement("div");
      partialBanner.className = "missing-ready-badge is-item-missing";
      const countLabel = p.preSpecimenCount > 0 ? `${p.preSpecimenCount} ` : "";
      partialBanner.innerHTML = `<span>🟡</span> Has <strong>${countLabel}${p.preEvolutionName}</strong>, needs <strong>${normalizeItemName(p.requiredItem)}</strong>`;
      body.appendChild(partialBanner);
    }

    // Acquisition Method Pill
    const methodBadge = document.createElement("div");
    methodBadge.className = `missing-method-badge method-${p.methodCategory}`;

    if (p.methodCategory === "starter") {
      const rawLoc =
        p.locations?.find((l) => /\(Starter\)/i.test(getLocStr(l))) ||
        p.locations?.[0] ||
        "Starter Choice";
      const starterLoc = getLocStr(rawLoc);
      const cleanLoc = starterLoc.replace(/\s*\([^)]+\)$/, "").trim();
      methodBadge.innerHTML = `
        <span class="method-icon">🌟</span>
        <span class="method-label">Starter: ${cleanLoc}</span>
      `;
    } else if (p.methodCategory === "gift") {
      const rawLoc =
        p.locations?.find((l) =>
          /\((?:Gift|Fossil|Gift Egg|Mystery Gift)\)/i.test(getLocStr(l)),
        ) ||
        p.locations?.[0] ||
        "In-Game Gift";
      const giftLoc = getLocStr(rawLoc);
      const isFossil = /\(Fossil\)/i.test(giftLoc);
      const isEgg = /\(Gift Egg\)/i.test(giftLoc);
      const icon = isFossil ? "🦖" : isEgg ? "🥚" : "🎁";
      const prefix = isFossil ? "Fossil" : isEgg ? "Gift Egg" : "Gift";
      const cleanLoc = giftLoc.replace(/\s*\([^)]+\)$/, "").trim();
      methodBadge.innerHTML = `
        <span class="method-icon">${icon}</span>
        <span class="method-label">${prefix}: ${cleanLoc}</span>
      `;
    } else if (p.requiredItem) {
      const itemImg = itemSpriteUrl(p.requiredItem);
      methodBadge.innerHTML = `
        <span class="method-icon"><img src="${itemImg}" alt="${normalizeItemName(p.requiredItem)}" class="missing-inline-item-icon" loading="lazy" onerror="this.style.display='none'"/></span>
        <span class="method-label">${p.requiredCondition || `Use ${normalizeItemName(p.requiredItem)}`}</span>
      `;
    } else if (p.evolveDetails) {
      const icon = p.evolveDetails.trigger === "trade" ? "🔄" : "⚡";
      methodBadge.innerHTML = `
        <span class="method-icon">${icon}</span>
        <span class="method-label">${p.evolveDetails.description || `Evolve ${p.preEvolutionName}`}</span>
      `;
    } else if (p.hasWildLocations) {
      const hasRaids = ACTIVE_GAME_ID === "swsh" || ACTIVE_GAME_ID === "sv";
      const wildLabel = hasRaids ? "Catch in Wild / Raids" : "Catch in Wild";
      methodBadge.innerHTML = `
        <span class="method-icon">🌿</span>
        <span class="method-label">${wildLabel}</span>
      `;
    } else if (p.exclusiveTo && p.exclusiveTo.length > 0) {
      methodBadge.className = "missing-method-badge method-transfer";
      methodBadge.innerHTML = `
        <span class="method-icon">🔄</span>
        <span class="method-label">Trade from ${p.exclusiveTo.join(", ")}</span>
      `;
    } else {
      methodBadge.innerHTML = `
        <span class="method-icon">📦</span>
        <span class="method-label">${isHome ? "Pokémon HOME National Dex" : "Transfer / Trade Only"}</span>
      `;
    }
    body.appendChild(methodBadge);

    // Locations / Obtainable Games / Version Exclusives preview
    if (p.locations && p.locations.length > 0) {
      const locWrap = document.createElement("div");
      locWrap.className = "missing-locations-wrap";

      if (isHome) {
        const locTitle = document.createElement("span");
        locTitle.className = "missing-locations-title";
        locTitle.textContent = "🎮 Obtainable in Games:";
        locWrap.appendChild(locTitle);

        const gamesList = document.createElement("div");
        gamesList.className = "missing-games-tags-list";
        p.locations.forEach((gameTitle) => {
          const gTag = document.createElement("span");
          gTag.className = "missing-game-tag";
          gTag.textContent =
            typeof gameTitle === "string" ? gameTitle : gameTitle.location;
          gamesList.appendChild(gTag);
        });
        locWrap.appendChild(gamesList);
      } else {
        const isRouteSort = filterState.sort.startsWith("route");
        if (isRouteSort && (p.recommendedLocation || p.earliestLocation)) {
          const recBadge = document.createElement("div");
          recBadge.className = "missing-recommended-route-pill";
          const isAsc = filterState.sort === "route-asc";
          const titleLabel = isAsc ? "Earliest Encounter" : "Recommended Spot";
          const locToShow = isAsc
            ? p.earliestLocation || p.recommendedLocation
            : p.recommendedLocation || p.earliestLocation;
          const rateText = p.rateBadgeText
            ? `<span class="missing-rate-tag rate-${p.rateBadgeType}">${p.rateBadgeText}</span>`
            : "";
          const subtext =
            p.isSmartBetter && !isAsc && p.earliestLocation
              ? `<span class="missing-smart-alt-hint">Earliest: ${p.earliestLocation}${typeof p.earliestChance === "number" ? ` (${p.earliestChance}%)` : ""}</span>`
              : "";

          recBadge.innerHTML = `
            <div class="missing-rec-header">
              <span class="missing-rec-title">📍 ${titleLabel}:</span>
              <strong class="missing-rec-location">${locToShow}</strong>
              ${rateText}
            </div>
            ${subtext}
          `;
          locWrap.appendChild(recBadge);
        }

        const locTitle = document.createElement("span");
        locTitle.className = "missing-locations-title";
        locTitle.textContent = isRouteSort ? "All Locations:" : "📍 Locations:";
        locWrap.appendChild(locTitle);

        const locList = document.createElement("ul");
        locList.className = "missing-locations-list";
        const maxLocs = 2;
        p.locations.slice(0, maxLocs).forEach((loc) => {
          const li = document.createElement("li");
          const isObj = typeof loc === "object" && loc !== null;
          const locName = isObj ? loc.location : loc;
          li.textContent = locName;
          if (isObj && typeof loc.chance === "number") {
            const rateSpan = document.createElement("span");
            rateSpan.className = "missing-location-rate";
            rateSpan.textContent = ` (${loc.chance}%)`;
            li.appendChild(rateSpan);
          }
          locList.appendChild(li);
        });
        if (p.locations.length > maxLocs) {
          const moreLi = document.createElement("li");
          moreLi.className = "locations-more-tag";
          moreLi.textContent = `+${p.locations.length - maxLocs} more locations`;
          locList.appendChild(moreLi);
        }
        locWrap.appendChild(locList);
      }
      body.appendChild(locWrap);
    } else if (p.exclusiveTo && p.exclusiveTo.length > 0) {
      const locWrap = document.createElement("div");
      locWrap.className = "missing-locations-wrap";

      const locTitle = document.createElement("span");
      locTitle.className = "missing-locations-title";
      locTitle.textContent = "✨ Version Exclusive:";
      locWrap.appendChild(locTitle);

      const gamesList = document.createElement("div");
      gamesList.className = "missing-games-tags-list";
      p.exclusiveTo.forEach((vTitle) => {
        const gTag = document.createElement("span");
        gTag.className = "missing-game-tag missing-version-tag";
        gTag.textContent = vTitle;
        gamesList.appendChild(gTag);
      });
      locWrap.appendChild(gamesList);
      body.appendChild(locWrap);
    }

    // Card Actions
    const actions = document.createElement("div");
    actions.className = "missing-card-actions";

    const catchBtn = document.createElement("button");
    catchBtn.type = "button";
    catchBtn.className = "btn btn-sm btn-primary missing-catch-btn";
    catchBtn.innerHTML = `<span>✓</span> Mark Caught`;
    catchBtn.setAttribute("aria-label", `Mark ${p.name} as caught`);
    catchBtn.addEventListener("click", async () => {
      await markPokemonCaught(p.specimenKey, p.slotNumber, card, p.name);
    });

    const infoBtn = document.createElement("button");
    infoBtn.type = "button";
    infoBtn.className = "btn btn-sm btn-secondary missing-info-btn";
    infoBtn.innerHTML = `<span>ℹ️</span> Info`;
    infoBtn.setAttribute("aria-label", `View detailed info for ${p.name}`);
    infoBtn.addEventListener("click", () => {
      openPokemonInfoModal(
        p.speciesId,
        p.formId,
        p.name,
        p.gender,
        "",
        p.spriteId,
      );
    });

    actions.append(catchBtn, infoBtn);

    card.append(header, body, actions);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

/**
 * Toggles a slot as caught, syncs state, animates the card out, and updates counters.
 *
 * @param {string} specimenKey
 * @param {number} slotNumber
 * @param {HTMLElement} [cardElement]
 * @param {string} [pokemonName]
 */
async function markPokemonCaught(
  specimenKey,
  slotNumber,
  cardElement,
  pokemonName = "",
) {
  const caught = getActiveCaughtSlots();
  const caughtKey = specimenKey || slotNumber;
  caught[caughtKey] = true;

  syncCaughtState(caught, cachedSlotCount);
  updateMissingGuideBadge(cachedSlotCount);
  showUndoToast(caughtKey, pokemonName);

  if (cardElement) {
    cardElement.classList.add("is-caught-animating");
    setTimeout(async () => {
      await refreshMissingGuideData();
      await ensureActiveTabData();
      renderActiveTab();
    }, 250);
  } else {
    await refreshMissingGuideData();
    await ensureActiveTabData();
    renderActiveTab();
  }
}

function showUndoToast(caughtKey, pokemonName = "") {
  if (pendingUndo) {
    clearTimeout(pendingUndo._dismissTimer);
    pendingUndo.remove();
    pendingUndo = null;
  }

  const modalContainer = document.querySelector(".missing-guide-modal-card");
  if (!modalContainer) return;

  const toast = document.createElement("div");
  toast.className = "missing-undo-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const messageSpan = document.createElement("span");
  messageSpan.className = "missing-undo-toast-message";

  const checkIcon = document.createElement("span");
  checkIcon.className = "missing-undo-check";
  checkIcon.textContent = "✓";

  const textSpan = document.createElement("span");
  textSpan.textContent = pokemonName
    ? `Marked ${pokemonName} caught`
    : "Marked caught";

  messageSpan.append(checkIcon, textSpan);

  const undoButton = document.createElement("button");
  undoButton.type = "button";
  undoButton.className = "btn missing-undo-btn";
  undoButton.textContent = "Undo";
  undoButton.setAttribute(
    "aria-label",
    pokemonName
      ? `Undo marking ${pokemonName} as caught`
      : "Undo marking as caught",
  );
  undoButton.addEventListener("click", async () => {
    const caught = getActiveCaughtSlots();
    delete caught[caughtKey];
    syncCaughtState(caught, cachedSlotCount);
    updateMissingGuideBadge(cachedSlotCount);
    clearTimeout(toast._dismissTimer);
    toast.classList.remove("show");
    toast.classList.add("hide");
    setTimeout(() => {
      toast.remove();
      if (pendingUndo === toast) pendingUndo = null;
    }, 200);
    await refreshMissingGuideData();
    await ensureActiveTabData();
    updateModalHeaderStats();
    renderActiveTab();
  });

  toast.append(messageSpan, undoButton);
  modalContainer.appendChild(toast);
  pendingUndo = toast;

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  toast._dismissTimer = setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hide");
    setTimeout(() => {
      toast.remove();
      if (pendingUndo === toast) pendingUndo = null;
    }, 250);
  }, 4000);
}

/**
 * Updates specimen inventory quantity for a species and syncs caught status.
 *
 * @param {number} speciesId
 * @param {number} newCount
 * @param {number} slotNumber
 * @param {string} specimenKey
 */
async function updateSpecimenCount(
  speciesId,
  newCount,
  slotNumber,
  specimenKey,
) {
  const inv = loadSpecimenInventory();
  inv[speciesId] = newCount;
  saveSpecimenInventory(inv);

  const caught = getActiveCaughtSlots();
  const caughtKey = specimenKey || slotNumber;
  if (newCount > 0 && !caught[caughtKey]) {
    caught[caughtKey] = true;
    syncCaughtState(caught, cachedSlotCount);
    updateMissingGuideBadge(cachedSlotCount);
  } else if (newCount === 0 && caught[caughtKey]) {
    delete caught[caughtKey];
    syncCaughtState(caught, cachedSlotCount);
    updateMissingGuideBadge(cachedSlotCount);
  }

  await refreshMissingGuideData();
  await ensureActiveTabData();
  renderActiveTab();
}

/**
 * Updates owned count of an evolution item in inventory.
 *
 * @param {string} itemKey
 * @param {number} newCount
 */
async function updateItemInventoryCount(itemKey, newCount) {
  const inv = loadItemInventory();
  inv[itemKey] = newCount;
  saveItemInventory(inv);

  await refreshMissingGuideData();
  await ensureActiveTabData();
  renderActiveTab();
}

// =============================================================================
// TAB 2: EVOLUTION FAMILY CHECKLIST & BASE SPECIMEN QUOTAS
// =============================================================================

/**
 * Filters family quota data.
 *
 * @param {Array<Object>} families
 * @returns {Array<Object>}
 */
function getFilteredFamilyList(families) {
  if (!families) return [];

  const filtered = families.filter((f) => {
    if (filterState.search) {
      const q = filterState.search;
      const matchRoot = f.rootName.toLowerCase().includes(q);
      const matchMembers = f.members.some(
        (m) => m.name.toLowerCase().includes(q) || String(m.speciesId) === q,
      );
      const matchItems = f.requiredItems.some((i) =>
        i.itemName.toLowerCase().includes(q),
      );
      if (!matchRoot && !matchMembers && !matchItems) return false;
    }

    if (filterState.familyFilter === "ready") {
      const rootMember = f.members.find((m) => m.speciesId === f.rootSpeciesId);
      if (!rootMember || rootMember.specimenCount === 0) return false;
    } else if (filterState.familyFilter === "zero") {
      if (f.totalSpecimensOwnedInFamily > 0) return false;
    }

    if (filterState.type) {
      const hasType = f.members.some((m) => m.types.includes(filterState.type));
      if (!hasType) return false;
    }

    if (filterState.segment) {
      const hasSegment = f.members.some(
        (m) => m.sectionKey === filterState.segment,
      );
      if (!hasSegment) return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    if (filterState.sort === "route-smart") {
      return (
        (a.smartRouteIndex ?? 9999) - (b.smartRouteIndex ?? 9999) ||
        a.rootRegionalDexNumber - b.rootRegionalDexNumber
      );
    }
    if (filterState.sort === "route-asc") {
      return (
        (a.earliestRouteIndex ?? 9999) - (b.earliestRouteIndex ?? 9999) ||
        a.rootRegionalDexNumber - b.rootRegionalDexNumber
      );
    }
    if (filterState.sort === "regional-desc") {
      return b.rootRegionalDexNumber - a.rootRegionalDexNumber;
    }
    if (filterState.sort === "national-asc") {
      return a.rootSpeciesId - b.rootSpeciesId;
    }
    if (filterState.sort === "national-desc") {
      return b.rootSpeciesId - a.rootSpeciesId;
    }
    if (filterState.sort === "name-asc") {
      return a.rootName.localeCompare(b.rootName);
    }
    if (filterState.sort === "name-desc") {
      return b.rootName.localeCompare(a.rootName);
    }
    if (filterState.sort === "family-completion") {
      return (
        b.caughtCount / b.totalCount - a.caughtCount / a.totalCount ||
        a.rootRegionalDexNumber - b.rootRegionalDexNumber
      );
    }
    if (filterState.sort === "family-needed") {
      return (
        a.baseQuota - b.baseQuota ||
        a.rootRegionalDexNumber - b.rootRegionalDexNumber
      );
    }
    return (
      a.rootRegionalDexNumber - b.rootRegionalDexNumber ||
      a.rootSpeciesId - b.rootSpeciesId
    );
  });

  return filtered;
}

/**
 * Renders the evolution family checklist and catch/breed quota view.
 *
 * @param {HTMLElement} container
 */
function renderFamilyQuotas(container) {
  container.innerHTML = "";

  const filtered = getFilteredFamilyList(cachedFamilyData);
  const spriteStyle = loadSettings().spriteStyle || "pokesprites";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "missing-empty-state";
    if (cachedFamilyData && cachedFamilyData.length === 0) {
      empty.innerHTML = `
        <div class="empty-icon">🌳</div>
        <h4>All Evolution Trees Complete!</h4>
        <p>Every evolutionary line in your Living Dex is 100% full.</p>
      `;
    } else {
      empty.innerHTML = `
        <div class="empty-icon">🔍</div>
        <h4>No matching evolution families</h4>
        <p>Try clearing your filters or search terms.</p>
      `;
    }
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "family-quotas-list";

  filtered.forEach((fam) => {
    const card = document.createElement("div");
    card.className = "family-quota-card";

    // Header
    const header = document.createElement("div");
    header.className = "family-quota-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "family-quota-title-wrap";

    const rootSprite = document.createElement("img");
    rootSprite.className = "family-root-sprite";
    rootSprite.src = spriteUrlForSpecies(
      fam.rootSpriteId,
      spriteStyle,
      isShinyMode,
    );
    rootSprite.alt = fam.rootName;
    rootSprite.loading = "lazy";
    rootSprite.crossOrigin = "anonymous";

    const titleText = document.createElement("h4");
    titleText.className = "family-quota-title";
    titleText.textContent = `${fam.rootName} Family`;

    titleWrap.append(rootSprite, titleText);

    const progressBadge = document.createElement("span");
    progressBadge.className = "family-progress-badge";
    progressBadge.textContent = `${fam.caughtCount}/${fam.totalCount} Caught (${fam.totalSpecimensOwnedInFamily} Owned)`;

    header.append(titleWrap, progressBadge);

    const progressTrack = document.createElement("div");
    progressTrack.className = "family-progress-track";
    const progressFill = document.createElement("span");
    progressFill.className = "family-progress-fill";
    progressFill.style.width = `${Math.round((fam.caughtCount / fam.totalCount) * 100)}%`;
    progressFill.setAttribute("aria-hidden", "true");
    progressTrack.appendChild(progressFill);

    // Catch/Breed Quota Banner
    const quotaBanner = document.createElement("div");
    quotaBanner.className = `family-quota-banner ${fam.baseQuota === 0 ? "is-fulfilled" : ""}`;
    if (fam.baseQuota > 0) {
      quotaBanner.innerHTML = `
        <span class="quota-icon">🥚</span>
        <div class="quota-text">
          <strong>Need ${fam.baseQuota}× ${fam.baseSpeciesName}</strong> (catch or breed) to complete remaining evolutions for this family.
        </div>
      `;
    } else {
      quotaBanner.innerHTML = `
        <span class="quota-icon">🎉</span>
        <div class="quota-text">
          <strong>Quota fulfilled!</strong> You own enough specimens (${fam.totalSpecimensOwnedInFamily}/${fam.totalCount}) to evolve and complete this family.
        </div>
      `;
    }

    // Interactive Members Flowchart / Row with Quantity Steppers
    const membersRow = document.createElement("div");
    membersRow.className = "family-members-row";

    fam.members.forEach((m) => {
      const chip = document.createElement("div");
      chip.className = `family-member-chip ${m.specimenCount > 0 ? "is-caught" : "is-missing"}`;
      chip.title = `${m.name} (${m.specimenCount > 0 ? `${m.specimenCount} Owned` : "Missing"})`;
      chip.setAttribute("role", "group");

      const mSprite = document.createElement("img");
      mSprite.className = "family-member-sprite";
      mSprite.src = spriteUrlForSpecies(
        m.spriteId,
        spriteStyle,
        isShinyMode,
        m.gender,
      );
      mSprite.alt = m.name;
      mSprite.loading = "lazy";
      mSprite.crossOrigin = "anonymous";

      const mMeta = document.createElement("div");
      mMeta.className = "family-member-meta";
      const mName = document.createElement("span");
      mName.className = "family-member-name";
      mName.textContent = m.name;

      mMeta.appendChild(mName);
      if (m.evolveText && m.specimenCount === 0) {
        const mEvo = document.createElement("span");
        mEvo.className = "family-member-evo";
        mEvo.textContent = m.evolveText;
        mMeta.appendChild(mEvo);
      }

      // Quantity Stepper
      const stepperWrap = document.createElement("div");
      stepperWrap.className = "quantity-stepper-wrap";
      stepperWrap.title = `Number of ${m.name} owned`;

      const decBtn = document.createElement("button");
      decBtn.type = "button";
      decBtn.className = "stepper-btn stepper-btn-dec";
      decBtn.textContent = "−";
      decBtn.setAttribute("aria-label", `Decrease ${m.name} quantity`);
      decBtn.addEventListener("click", () => {
        const nextVal = Math.max(0, m.specimenCount - 1);
        updateSpecimenCount(m.speciesId, nextVal, m.slotNumber, m.specimenKey);
      });

      const numInput = document.createElement("input");
      numInput.type = "number";
      numInput.min = "0";
      numInput.max = "99";
      numInput.className = "stepper-input";
      numInput.value = String(m.specimenCount);
      numInput.setAttribute("aria-label", `Owned count for ${m.name}`);
      numInput.addEventListener("change", (e) => {
        const val = Math.max(
          0,
          Math.min(99, parseInt(e.target.value, 10) || 0),
        );
        updateSpecimenCount(m.speciesId, val, m.slotNumber, m.specimenKey);
      });

      const incBtn = document.createElement("button");
      incBtn.type = "button";
      incBtn.className = "stepper-btn stepper-btn-inc";
      incBtn.textContent = "+";
      incBtn.setAttribute("aria-label", `Increase ${m.name} quantity`);
      incBtn.addEventListener("click", () => {
        const nextVal = Math.min(99, m.specimenCount + 1);
        updateSpecimenCount(m.speciesId, nextVal, m.slotNumber, m.specimenKey);
      });

      stepperWrap.append(decBtn, numInput, incBtn);
      chip.append(mSprite, mMeta, stepperWrap);
      membersRow.appendChild(chip);
    });

    // Required Evolution Items for this family
    let itemsWrap = null;
    if (fam.requiredItems.length > 0) {
      itemsWrap = document.createElement("div");
      itemsWrap.className = "family-items-wrap";
      const itemsLabel = document.createElement("span");
      itemsLabel.className = "family-items-label";
      itemsLabel.textContent = "Required Items:";
      itemsWrap.appendChild(itemsLabel);

      fam.requiredItems.forEach((it) => {
        const itChip = document.createElement("span");
        itChip.className = `family-item-chip ${it.isComplete ? "is-complete" : ""}`;
        const itImg = itemSpriteUrl(it.itemKey);
        itChip.innerHTML = `
          <img src="${itImg}" alt="${it.itemName}" class="family-item-sprite" loading="lazy" onerror="this.style.display='none'"/>
          <span>${it.itemName} (Owned: ${it.ownedCount}/${it.count})</span>
        `;
        itemsWrap.appendChild(itChip);
      });
    }

    card.append(header, progressTrack, quotaBanner, membersRow);
    if (itemsWrap) card.appendChild(itemsWrap);
    list.appendChild(card);
  });

  container.appendChild(list);
}

// =============================================================================
// TAB 3: AGGREGATE EVOLUTION ITEMS & TASKS SHOPPING LIST
// =============================================================================

/**
 * Renders the aggregated evolution items, trades, and condition tasks shopping list.
 *
 * @param {HTMLElement} container
 */
function renderItemsShoppingList(container) {
  container.innerHTML = "";

  const itemsSummary = cachedItemsData;
  const spriteStyle = loadSettings().spriteStyle || "pokesprites";

  if (
    !itemsSummary ||
    (!itemsSummary.items.length &&
      !itemsSummary.tradeList.length &&
      !itemsSummary.friendshipList.length &&
      !itemsSummary.moveList.length &&
      !itemsSummary.timeList.length)
  ) {
    const empty = document.createElement("div");
    empty.className = "missing-empty-state";
    empty.innerHTML = `
      <div class="empty-icon">🛍️</div>
      <h4>No Evolution Items Required!</h4>
      <p>You do not need any evolution items or special trade partners for your remaining Pokémon.</p>
    `;
    container.appendChild(empty);
    return;
  }

  // Section 1: Evolution Stones & Usable Items
  if (itemsSummary.items.length > 0) {
    const section = document.createElement("section");
    section.className = "items-shopping-section";

    const title = document.createElement("h4");
    title.className = "items-section-title";
    title.textContent = `💎 Evolution Items Needed (${itemsSummary.totalRemainingCount} remaining / ${itemsSummary.totalItemsCount} total)`;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "items-shopping-grid";

    itemsSummary.items.forEach((item) => {
      const card = document.createElement("div");
      card.className = `shopping-item-card ${item.isComplete ? "is-fulfilled" : ""}`;

      const top = document.createElement("div");
      top.className = "shopping-item-top";

      const img = document.createElement("img");
      img.className = "shopping-item-sprite";
      img.src = itemSpriteUrl(item.itemKey);
      img.alt = item.itemName;
      img.loading = "lazy";
      img.onerror = function onShoppingItemSpriteErr() {
        this.style.display = "none";
      };

      const nameWrap = document.createElement("div");
      nameWrap.className = "shopping-item-name-wrap";
      const nameEl = document.createElement("span");
      nameEl.className = "shopping-item-name";
      nameEl.textContent = item.itemName;
      const countEl = document.createElement("span");
      countEl.className = "shopping-item-count";
      countEl.textContent = `×${item.count} needed`;
      nameWrap.append(nameEl, countEl);

      top.append(img, nameWrap);

      // Item inventory stepper
      const invRow = document.createElement("div");
      invRow.className = "shopping-item-inv-row";

      const label = document.createElement("span");
      label.className = "shopping-inv-label";
      label.textContent = "Owned:";

      const stepperWrap = document.createElement("div");
      stepperWrap.className = "quantity-stepper-wrap";

      const decBtn = document.createElement("button");
      decBtn.type = "button";
      decBtn.className = "stepper-btn stepper-btn-dec";
      decBtn.textContent = "−";
      decBtn.setAttribute("aria-label", `Decrease ${item.itemName} quantity`);
      decBtn.addEventListener("click", () => {
        const nextVal = Math.max(0, item.ownedCount - 1);
        updateItemInventoryCount(item.itemKey, nextVal);
      });

      const numInput = document.createElement("input");
      numInput.type = "number";
      numInput.min = "0";
      numInput.max = "99";
      numInput.className = "stepper-input";
      numInput.value = String(item.ownedCount);
      numInput.setAttribute("aria-label", `Owned count for ${item.itemName}`);
      numInput.addEventListener("change", (e) => {
        const val = Math.max(
          0,
          Math.min(99, parseInt(e.target.value, 10) || 0),
        );
        updateItemInventoryCount(item.itemKey, val);
      });

      const incBtn = document.createElement("button");
      incBtn.type = "button";
      incBtn.className = "stepper-btn stepper-btn-inc";
      incBtn.textContent = "+";
      incBtn.setAttribute("aria-label", `Increase ${item.itemName} quantity`);
      incBtn.addEventListener("click", () => {
        const nextVal = Math.min(99, item.ownedCount + 1);
        updateItemInventoryCount(item.itemKey, nextVal);
      });

      stepperWrap.append(decBtn, numInput, incBtn);

      const statusBadge = document.createElement("span");
      statusBadge.className = `shopping-status-badge ${item.isComplete ? "is-complete" : "is-needed"}`;
      statusBadge.textContent = item.isComplete
        ? `✓ Complete`
        : `Need ${item.remainingCount}`;

      invRow.append(label, stepperWrap, statusBadge);

      const targetList = document.createElement("div");
      targetList.className = "shopping-item-targets";
      item.pokemonList.forEach((poke) => {
        const tag = document.createElement("span");
        tag.className = "shopping-target-tag";
        const pSprite = spriteUrlForSpecies(
          poke.spriteId,
          spriteStyle,
          isShinyMode,
        );
        tag.innerHTML = `
          <img src="${pSprite}" alt="${poke.name}" class="shopping-target-sprite" loading="lazy" crossOrigin="anonymous"/>
          <span>${poke.name}</span>
        `;
        targetList.appendChild(tag);
      });

      card.append(top, invRow, targetList);
      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  }

  // Section 2: Trade Evolutions
  const totalTrades =
    itemsSummary.tradeList.length + itemsSummary.tradeHoldingItemList.length;
  if (totalTrades > 0) {
    const section = document.createElement("section");
    section.className = "items-shopping-section";

    const title = document.createElement("h4");
    title.className = "items-section-title";
    title.textContent = `🔄 Trade Requirements (${totalTrades} Pokémon)`;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "items-shopping-grid";

    if (itemsSummary.tradeList.length > 0) {
      const card = document.createElement("div");
      card.className = "shopping-item-card";
      card.innerHTML = `
        <div class="shopping-item-top">
          <span class="shopping-trade-icon">🤝</span>
          <div class="shopping-item-name-wrap">
            <span class="shopping-item-name">Direct Trade (No Item)</span>
            <span class="shopping-item-count">×${itemsSummary.tradeList.length} Pokémon</span>
          </div>
        </div>
      `;
      const targets = document.createElement("div");
      targets.className = "shopping-item-targets";
      itemsSummary.tradeList.forEach((p) => {
        const tag = document.createElement("span");
        tag.className = "shopping-target-tag";
        const pSprite = spriteUrlForSpecies(
          p.spriteId,
          spriteStyle,
          isShinyMode,
        );
        tag.innerHTML = `
          <img src="${pSprite}" alt="${p.name}" class="shopping-target-sprite" loading="lazy" crossOrigin="anonymous"/>
          <span>${p.name}</span>
        `;
        targets.appendChild(tag);
      });
      card.appendChild(targets);
      grid.appendChild(card);
    }

    if (itemsSummary.tradeHoldingItemList.length > 0) {
      const card = document.createElement("div");
      card.className = "shopping-item-card";
      card.innerHTML = `
        <div class="shopping-item-top">
          <span class="shopping-trade-icon">📦</span>
          <div class="shopping-item-name-wrap">
            <span class="shopping-item-name">Trade While Holding Item</span>
            <span class="shopping-item-count">×${itemsSummary.tradeHoldingItemList.length} Pokémon</span>
          </div>
        </div>
      `;
      const targets = document.createElement("div");
      targets.className = "shopping-item-targets";
      itemsSummary.tradeHoldingItemList.forEach((p) => {
        const tag = document.createElement("span");
        tag.className = "shopping-target-tag";
        const pSprite = spriteUrlForSpecies(
          p.spriteId,
          spriteStyle,
          isShinyMode,
        );
        tag.innerHTML = `
          <img src="${pSprite}" alt="${p.name}" class="shopping-target-sprite" loading="lazy" crossOrigin="anonymous"/>
          <span>${p.name} (${normalizeItemName(p.requiredItem)})</span>
        `;
        targets.appendChild(tag);
      });
      card.appendChild(targets);
      grid.appendChild(card);
    }

    section.appendChild(grid);
    container.appendChild(section);
  }

  // Section 3: Special Condition Tasks
  const totalTasks =
    itemsSummary.friendshipList.length +
    itemsSummary.moveList.length +
    itemsSummary.timeList.length;

  if (totalTasks > 0) {
    const section = document.createElement("section");
    section.className = "items-shopping-section";

    const title = document.createElement("h4");
    title.className = "items-section-title";
    title.textContent = `✨ Special Evolution Conditions (${totalTasks} Pokémon)`;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "items-shopping-grid";

    if (itemsSummary.friendshipList.length > 0) {
      const card = document.createElement("div");
      card.className = "shopping-item-card";
      card.innerHTML = `
        <div class="shopping-item-top">
          <span class="shopping-trade-icon">❤️</span>
          <div class="shopping-item-name-wrap">
            <span class="shopping-item-name">High Friendship / Happiness</span>
            <span class="shopping-item-count">×${itemsSummary.friendshipList.length} Pokémon</span>
          </div>
        </div>
      `;
      const targets = document.createElement("div");
      targets.className = "shopping-item-targets";
      itemsSummary.friendshipList.forEach((p) => {
        const tag = document.createElement("span");
        tag.className = "shopping-target-tag";
        const pSprite = spriteUrlForSpecies(
          p.spriteId,
          spriteStyle,
          isShinyMode,
        );
        tag.innerHTML = `
          <img src="${pSprite}" alt="${p.name}" class="shopping-target-sprite" loading="lazy" crossOrigin="anonymous"/>
          <span>${p.name}</span>
        `;
        targets.appendChild(tag);
      });
      card.appendChild(targets);
      grid.appendChild(card);
    }

    if (itemsSummary.timeList.length > 0) {
      const card = document.createElement("div");
      card.className = "shopping-item-card";
      card.innerHTML = `
        <div class="shopping-item-top">
          <span class="shopping-trade-icon">🌗</span>
          <div class="shopping-item-name-wrap">
            <span class="shopping-item-name">Time of Day (Day / Night)</span>
            <span class="shopping-item-count">×${itemsSummary.timeList.length} Pokémon</span>
          </div>
        </div>
      `;
      const targets = document.createElement("div");
      targets.className = "shopping-item-targets";
      itemsSummary.timeList.forEach((p) => {
        const tag = document.createElement("span");
        tag.className = "shopping-target-tag";
        const pSprite = spriteUrlForSpecies(
          p.spriteId,
          spriteStyle,
          isShinyMode,
        );
        tag.innerHTML = `
          <img src="${pSprite}" alt="${p.name}" class="shopping-target-sprite" loading="lazy" crossOrigin="anonymous"/>
          <span>${p.name} (${p.requiredCondition || "Time of day"})</span>
        `;
        targets.appendChild(tag);
      });
      card.appendChild(targets);
      grid.appendChild(card);
    }

    if (itemsSummary.moveList.length > 0) {
      const card = document.createElement("div");
      card.className = "shopping-item-card";
      card.innerHTML = `
        <div class="shopping-item-top">
          <span class="shopping-trade-icon">⚔️</span>
          <div class="shopping-item-name-wrap">
            <span class="shopping-item-name">Specific Move or Battle Feat</span>
            <span class="shopping-item-count">×${itemsSummary.moveList.length} Pokémon</span>
          </div>
        </div>
      `;
      const targets = document.createElement("div");
      targets.className = "shopping-item-targets";
      itemsSummary.moveList.forEach((p) => {
        const tag = document.createElement("span");
        tag.className = "shopping-target-tag";
        const pSprite = spriteUrlForSpecies(
          p.spriteId,
          spriteStyle,
          isShinyMode,
        );
        tag.innerHTML = `
          <img src="${pSprite}" alt="${p.name}" class="shopping-target-sprite" loading="lazy" crossOrigin="anonymous"/>
          <span>${p.name} (${p.requiredCondition || "Move"})</span>
        `;
        targets.appendChild(tag);
      });
      card.appendChild(targets);
      grid.appendChild(card);
    }

    section.appendChild(grid);
    container.appendChild(section);
  }
}
