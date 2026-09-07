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
} from "../storage.js";
import { isShinyMode, syncCaughtState, countCaughtSlots } from "../state.js";
import {
  getMissingPokemonData,
  getEvolutionFamilyChecklist,
  getEvolutionItemsSummary,
  buildActiveDexSections,
} from "../db.js";
import { attachModalHandlers } from "./modals.js";
import { openPokemonInfoModal } from "./pokemon-info.js";

// =============================================================================
// MISSING GUIDE & LIVING DEX PREREQUISITES CONTROLLER
// =============================================================================

/** Active view mode tab in the modal: 'missing' | 'family' | 'items' */
let currentTab = "missing";

/** Filter and sorting state */
let filterState = {
  search: "",
  method: "all",
  type: "",
  segment: "",
  sort: "dex-asc",
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
      await refreshMissingGuideData();
      populateSegmentFilterDropdown();
      renderActiveTab();
    },
    onClose: () => {
      // Clean up search on close if desired
    },
    focusSelector: "#missingSearch",
  });

  setupTabListeners();
  setupFilterListeners();

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
 * Refreshes data from db.js for missing Pokémon, families, and items.
 */
async function refreshMissingGuideData() {
  const caught = getActiveCaughtSlots();
  const { sections } = await buildActiveDexSections();
  cachedSlotCount = sections.reduce(
    (sum, s) => sum + (s.entries ? s.entries.length : 0),
    0,
  );

  const [missing, families, items] = await Promise.all([
    getMissingPokemonData(ACTIVE_GAME_ID, caught),
    getEvolutionFamilyChecklist(ACTIVE_GAME_ID, caught),
    getEvolutionItemsSummary(ACTIVE_GAME_ID, caught),
  ]);

  cachedMissingData = missing;
  cachedFamilyData = families;
  cachedItemsData = items;

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
    statsEl.textContent = `${missingCount} Pokémon remaining`;
  } else if (currentTab === "family") {
    statsEl.textContent = `${familiesCount} incomplete evolution families`;
  } else if (currentTab === "items") {
    statsEl.textContent = `${itemsCount} evolution items required (${remainingItemsCount} still needed)`;
  }
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
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (!tab || tab === currentTab) return;

      currentTab = tab;
      tabButtons.forEach((b) => {
        const active = b.dataset.tab === currentTab;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
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

      updateModalHeaderStats();
      renderActiveTab();
    });
  });
}

/**
 * Sets up filter, search, and sorting event listeners.
 */
function setupFilterListeners() {
  const searchInput = document.getElementById("missingSearch");
  const searchClear = document.getElementById("missingSearchClear");
  const methodSelect = document.getElementById("missingFilterMethod");
  const familySelect = document.getElementById("missingFilterFamily");
  const typeSelect = document.getElementById("missingFilterType");
  const segmentSelect = document.getElementById("missingFilterSegment");
  const sortSelect = document.getElementById("missingSort");
  const resetFiltersBtn = document.getElementById("missingResetFilters");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filterState.search = e.target.value.trim().toLowerCase();
      if (searchClear) searchClear.hidden = !filterState.search;
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
        renderActiveTab();
      }
    });
  }

  if (methodSelect) {
    methodSelect.addEventListener("change", (e) => {
      filterState.method = e.target.value;
      renderActiveTab();
    });
  }

  if (familySelect) {
    familySelect.addEventListener("change", (e) => {
      filterState.familyFilter = e.target.value;
      renderActiveTab();
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener("change", (e) => {
      filterState.type = e.target.value;
      renderActiveTab();
    });
  }

  if (segmentSelect) {
    segmentSelect.addEventListener("change", (e) => {
      filterState.segment = e.target.value;
      renderActiveTab();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      filterState.sort = e.target.value;
      renderActiveTab();
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", () => {
      filterState = {
        search: "",
        method: "all",
        type: "",
        segment: "",
        sort: "dex-asc",
        familyFilter: "all",
      };
      if (searchInput) searchInput.value = "";
      if (searchClear) searchClear.hidden = true;
      if (methodSelect) methodSelect.value = "all";
      if (familySelect) familySelect.value = "all";
      if (typeSelect) typeSelect.value = "";
      if (segmentSelect) segmentSelect.value = "";
      if (sortSelect) sortSelect.value = "dex-asc";
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
        String(p.speciesId) === q || p.dexNumber.toLowerCase().includes(q);
      const matchItem =
        p.requiredItem && p.requiredItem.toLowerCase().includes(q);
      const matchLoc = p.locations.some((l) => l.toLowerCase().includes(q));
      if (!matchName && !matchNum && !matchItem && !matchLoc) return false;
    }

    // Method filter
    if (filterState.method !== "all") {
      if (filterState.method === "ready") {
        if (!p.isReadyToEvolve) return false;
      } else if (filterState.method === "wild") {
        if (!p.hasWildLocations) return false;
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
    if (filterState.sort === "dex-asc") {
      return a.speciesId - b.speciesId || a.slotNumber - b.slotNumber;
    }
    if (filterState.sort === "dex-desc") {
      return b.speciesId - a.speciesId || b.slotNumber - a.slotNumber;
    }
    if (filterState.sort === "name-asc") {
      return a.name.localeCompare(b.name);
    }
    if (filterState.sort === "name-desc") {
      return b.name.localeCompare(a.name);
    }
    if (filterState.sort === "category") {
      const order = {
        wild: 1,
        level: 2,
        item: 3,
        trade: 4,
        special: 5,
        transfer: 6,
      };
      return (order[a.methodCategory] || 99) - (order[b.methodCategory] || 99);
    }
    if (filterState.sort === "readiness") {
      return (b.isReadyToEvolve ? 1 : 0) - (a.isReadyToEvolve ? 1 : 0);
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
  grid.className = "missing-cards-grid";

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
    numSpan.textContent = p.dexNumber;

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
      readyBanner.innerHTML = `<span>🟢</span> Ready: <strong>${p.preEvolutionName}</strong> is owned${p.requiredItem ? ` &amp; item in bag` : ""}!`;
      body.appendChild(readyBanner);
    } else if (p.hasPreEvo && p.requiredItem && !p.hasItem) {
      const partialBanner = document.createElement("div");
      partialBanner.className = "missing-ready-badge is-item-missing";
      partialBanner.innerHTML = `<span>🟡</span> Has <strong>${p.preEvolutionName}</strong>, needs <strong>${normalizeItemName(p.requiredItem)}</strong>`;
      body.appendChild(partialBanner);
    }

    // Acquisition Method Pill
    const methodBadge = document.createElement("div");
    methodBadge.className = `missing-method-badge method-${p.methodCategory}`;

    if (p.requiredItem) {
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
      methodBadge.innerHTML = `
        <span class="method-icon">🌿</span>
        <span class="method-label">Catch in Wild / Raids</span>
      `;
    } else {
      methodBadge.innerHTML = `
        <span class="method-icon">📦</span>
        <span class="method-label">${isHome ? "Pokémon HOME National Dex" : "Transfer / Trade Only"}</span>
      `;
    }
    body.appendChild(methodBadge);

    // Locations / Obtainable Games preview
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
          gTag.textContent = gameTitle;
          gamesList.appendChild(gTag);
        });
        locWrap.appendChild(gamesList);
      } else {
        const locTitle = document.createElement("span");
        locTitle.className = "missing-locations-title";
        locTitle.textContent = "📍 Locations:";
        locWrap.appendChild(locTitle);

        const locList = document.createElement("ul");
        locList.className = "missing-locations-list";
        const maxLocs = 2;
        p.locations.slice(0, maxLocs).forEach((loc) => {
          const li = document.createElement("li");
          li.textContent = loc;
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
      await markPokemonCaught(p.slotNumber, card);
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
 * @param {number} slotNumber
 * @param {HTMLElement} cardElement
 */
async function markPokemonCaught(slotNumber, cardElement) {
  const caught = getActiveCaughtSlots();
  caught[slotNumber] = true;

  syncCaughtState(caught, cachedSlotCount);
  updateMissingGuideBadge(cachedSlotCount);

  if (cardElement) {
    cardElement.classList.add("is-caught-animating");
    setTimeout(async () => {
      await refreshMissingGuideData();
      renderActiveTab();
    }, 250);
  } else {
    await refreshMissingGuideData();
    renderActiveTab();
  }
}

/**
 * Updates specimen inventory quantity for a species and syncs caught status.
 *
 * @param {number} speciesId
 * @param {number} newCount
 * @param {number} slotNumber
 */
async function updateSpecimenCount(speciesId, newCount, slotNumber) {
  const inv = loadSpecimenInventory();
  inv[speciesId] = newCount;
  saveSpecimenInventory(inv);

  const caught = getActiveCaughtSlots();
  if (newCount > 0 && !caught[slotNumber]) {
    caught[slotNumber] = true;
    syncCaughtState(caught, cachedSlotCount);
    updateMissingGuideBadge(cachedSlotCount);
  } else if (newCount === 0 && caught[slotNumber]) {
    delete caught[slotNumber];
    syncCaughtState(caught, cachedSlotCount);
    updateMissingGuideBadge(cachedSlotCount);
  }

  await refreshMissingGuideData();
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

  return families.filter((f) => {
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
        updateSpecimenCount(m.speciesId, nextVal, m.slotNumber);
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
        updateSpecimenCount(m.speciesId, val, m.slotNumber);
      });

      const incBtn = document.createElement("button");
      incBtn.type = "button";
      incBtn.className = "stepper-btn stepper-btn-inc";
      incBtn.textContent = "+";
      incBtn.setAttribute("aria-label", `Increase ${m.name} quantity`);
      incBtn.addEventListener("click", () => {
        const nextVal = Math.min(99, m.specimenCount + 1);
        updateSpecimenCount(m.speciesId, nextVal, m.slotNumber);
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

    card.append(header, quotaBanner, membersRow);
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
