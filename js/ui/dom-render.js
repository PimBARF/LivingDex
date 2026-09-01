import {
  loadSettings,
  loadCaughtSlots,
  saveCaughtSlots,
  loadShinyCaughtSlots,
  saveShinyCaughtSlots,
  loadBoxLabels,
  saveBoxLabels,
  loadCollapsedBoxes,
  saveCollapsedBoxes,
} from "../storage.js";
import { BOX_CAPACITY, spriteUrlForSpecies } from "../config.js";
import { openPokemonInfoModal } from "./pokemon-info.js";
import { applyHideCaughtFilter } from "./controls.js";
import { updateProgressBar, isShinyMode } from "../state.js";
import { getSpeciesTypes } from "../db.js";

// =============================================================================
// DOM RENDERING & BOX MANAGEMENT
// =============================================================================

/**
 * Tracks the last clicked regional slot index for shift-click range selection.
 * @type {number|null}
 */
let lastClickedSlotIndex = null;

/**
 * In-memory set of collapsed box IDs for active session persistence.
 * @type {Set<string>}
 */
export const sessionCollapsedBoxes = new Set();

/**
 * Retrieve the active collapsed box IDs based on the user's settings.
 * Uses localStorage when rememberCollapsedBoxes is enabled, otherwise active session memory.
 *
 * @returns {Set<string>} Set of collapsed box IDs.
 */
/**
 * In-memory set tracking box IDs that were collapsed automatically due to being full.
 * @type {Set<string>}
 */
export const autoCollapsedBoxes = new Set();

export function getActiveCollapsedBoxes() {
  const settings = loadSettings();
  return settings.rememberCollapsedBoxes
    ? loadCollapsedBoxes()
    : sessionCollapsedBoxes;
}

/**
 * Set the collapsed state of a box element and update persistence.
 *
 * @param {HTMLElement} box - The box element to collapse or expand.
 * @param {boolean} isCollapsed - Whether the box should be collapsed.
 * @param {boolean} [isAuto=false] - Whether this collapse was triggered automatically.
 * @returns {void}
 */
export function setBoxCollapsedState(box, isCollapsed, isAuto = false) {
  if (!box) return;
  const boxId = box.dataset.boxId;
  const currentlyCollapsed = box.classList.contains("is-collapsed");

  if (isAuto) {
    if (isCollapsed) {
      autoCollapsedBoxes.add(boxId);
      box.dataset.autoCollapsed = "true";
    } else {
      autoCollapsedBoxes.delete(boxId);
      delete box.dataset.autoCollapsed;
    }
  } else {
    // Manual user action clears auto-collapse tracking for this box
    autoCollapsedBoxes.delete(boxId);
    delete box.dataset.autoCollapsed;
  }

  if (currentlyCollapsed === isCollapsed) return;

  box.classList.toggle("is-collapsed", isCollapsed);

  const collapseBtn = box.querySelector(".box-collapse-btn");
  const collapseIcon = box.querySelector(".box-collapse-icon");
  const titleSpan = box.querySelector(".box-title");
  const displayTitle = titleSpan?.textContent || "box";

  if (collapseBtn) {
    collapseBtn.setAttribute("aria-expanded", String(!isCollapsed));
    collapseBtn.setAttribute(
      "aria-label",
      `${isCollapsed ? "Expand" : "Collapse"} ${displayTitle}`,
    );
  }
  if (collapseIcon) {
    collapseIcon.textContent = isCollapsed ? "▼" : "▲";
  }

  const settings = loadSettings();
  if (isCollapsed) {
    sessionCollapsedBoxes.add(boxId);
  } else {
    sessionCollapsedBoxes.delete(boxId);
  }

  if (settings.rememberCollapsedBoxes) {
    const persistent = loadCollapsedBoxes();
    if (isCollapsed) {
      persistent.add(boxId);
    } else {
      persistent.delete(boxId);
    }
    saveCollapsedBoxes(persistent);
  }
}

/**
 * Toggle the collapsed state of a box element and update persistence.
 *
 * @param {HTMLElement} box - The box element to collapse or expand.
 * @returns {void}
 */
export function toggleBoxCollapse(box) {
  if (!box) return;
  setBoxCollapsedState(box, !box.classList.contains("is-collapsed"), false);
}

/**
 * Render the title wrap contents for a box, supporting custom names and edit triggers.
 *
 * @param {HTMLElement} box - The box element.
 * @returns {void}
 */
export function renderBoxTitleWrap(box) {
  if (!box) return;
  const boxId = box.dataset.boxId;
  const titleWrap = box.querySelector(".box-title-wrap");
  if (!titleWrap) return;

  const labels = loadBoxLabels();
  const defaultTitle = box.dataset.defaultTitle || "";
  const customTitle = labels[boxId] || "";
  const displayTitle = customTitle || defaultTitle;

  titleWrap.innerHTML = `
    <span class="box-title" role="button" tabindex="0" title="Click to rename box" aria-label="Box name: ${displayTitle}. Click to rename">${displayTitle}</span>
  `;

  const collapseBtn = box.querySelector(".box-collapse-btn");
  if (collapseBtn) {
    const isCollapsed = box.classList.contains("is-collapsed");
    collapseBtn.setAttribute(
      "aria-label",
      `${isCollapsed ? "Expand" : "Collapse"} ${displayTitle}`,
    );
  }
}

/**
 * Start inline renaming of a box title.
 *
 * @param {HTMLElement} box - The box element whose title is being edited.
 * @returns {void}
 */
export function startRenamingBox(box) {
  if (!box) return;
  const boxId = box.dataset.boxId;
  const titleWrap = box.querySelector(".box-title-wrap");
  if (!titleWrap || titleWrap.querySelector(".box-title-input")) return;

  const labels = loadBoxLabels();
  const currentCustom = labels[boxId] || "";
  const defaultTitle = box.dataset.defaultTitle || "";
  const currentVal = currentCustom || defaultTitle;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "box-title-input";
  input.maxLength = 50;
  input.value = currentVal;
  input.placeholder = defaultTitle;
  input.setAttribute("aria-label", "Edit box name");

  titleWrap.innerHTML = "";
  titleWrap.appendChild(input);
  input.focus();
  input.select();

  let committed = false;

  function finish(save) {
    if (committed) return;
    committed = true;

    if (save) {
      const nextVal = input.value.trim();
      const updatedLabels = loadBoxLabels();
      if (!nextVal || nextVal === defaultTitle) {
        delete updatedLabels[boxId];
      } else {
        updatedLabels[boxId] = nextVal;
      }
      saveBoxLabels(updatedLabels);
    }

    renderBoxTitleWrap(box);
    bindBoxHeaderEvents(box);
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });

  input.addEventListener("blur", () => {
    finish(true);
  });
}

/**
 * Bind click and keyboard listeners to the box title.
 *
 * @param {HTMLElement} box - The box element.
 * @returns {void}
 */
function bindBoxHeaderEvents(box) {
  const titleSpan = box.querySelector(".box-title");

  const onRenameTrigger = (event) => {
    event.stopPropagation();
    startRenamingBox(box);
  };

  if (titleSpan) {
    titleSpan.onclick = onRenameTrigger;
    titleSpan.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRenameTrigger(event);
      }
    };
  }
}

/**
 * Update the caught counter badge, completion class, and toggle button text for a box.
 *
 * @param {HTMLElement} box - The box element to update.
 * @returns {void}
 */
export function updateBoxProgress(box) {
  if (!box) return;
  const grid = box.querySelector(".grid");
  const badge = box.querySelector(".box-progress-badge");
  const toggleBtn = box.querySelector(".box-toggle");
  if (!grid || !badge) return;

  const cells = Array.from(grid.querySelectorAll(".cell:not(.is-placeholder)"));
  const totalSlots = cells.length;
  if (totalSlots === 0) return;

  const caught = isShinyMode ? loadShinyCaughtSlots() : loadCaughtSlots();
  let caughtCount = 0;
  for (const cell of cells) {
    const slot = Number(cell.dataset.regional);
    if (caught[slot]) {
      caughtCount += 1;
    }
  }

  const isComplete = caughtCount === totalSlots && totalSlots > 0;
  box.classList.toggle("is-completed", isComplete);

  if (isComplete) {
    badge.textContent = `${totalSlots}/${totalSlots}`;
    badge.classList.add("is-completed");
    badge.setAttribute(
      "aria-label",
      `Box complete: ${totalSlots} of ${totalSlots} caught`,
    );
  } else {
    badge.textContent = `${caughtCount}/${totalSlots}`;
    badge.classList.remove("is-completed");
    badge.setAttribute(
      "aria-label",
      `Box progress: ${caughtCount} of ${totalSlots} caught`,
    );
  }

  if (toggleBtn) {
    const rangeText = box.dataset.rangeText || "";
    toggleBtn.textContent = isComplete ? "✗ All" : "✓ All";
    toggleBtn.setAttribute(
      "aria-label",
      `${isComplete ? "Mark all uncaught" : "Mark all caught"} in ${rangeText}`,
    );
  }

  const settings = loadSettings();
  const boxId = box.dataset.boxId;
  const isAutoCollapsed =
    autoCollapsedBoxes.has(boxId) || box.dataset.autoCollapsed === "true";

  if (settings.autoCollapseFullBoxes) {
    if (isComplete) {
      if (!box.classList.contains("is-collapsed")) {
        setBoxCollapsedState(box, true, true);
      }
    } else if (isAutoCollapsed) {
      setBoxCollapsedState(box, false, true);
    }
  } else if (isAutoCollapsed) {
    setBoxCollapsedState(box, false, true);
  }
}

/**
 * Update the progress badges and completion states for all boxes in the DOM.
 *
 * @returns {void}
 */
export function updateAllBoxProgress() {
  document.querySelectorAll(".box").forEach((box) => {
    updateBoxProgress(box);
  });
}

/**
 * Re-apply saved box labels across all rendered box headers.
 *
 * @returns {void}
 */
export function applyBoxLabelsToHeaders() {
  document.querySelectorAll(".box").forEach((box) => {
    renderBoxTitleWrap(box);
    bindBoxHeaderEvents(box);
  });
}

/**
 * Create shell sections that mirror in-game storage boxes.
 * Each box contains up to BOX_CAPACITY slots.
 *
 * @param {HTMLElement} container - The container element to append box sections and headings into.
 * @param {string} sectionKey - Identifier/key for the dex section (set as data-section).
 * @param {string} sectionTitle - Human-readable section title displayed in the header.
 * @param {number} slotsInSection - Total count of slots in this section.
 * @param {number} startGlobalSlot - Starting 1-based global slot index for this section.
 * @param {number} [startLocalIndex=1] - Starting 1-based local dex numbering index for this section.
 * @returns {void}
 */
export function renderDexSectionBoxes(
  container,
  sectionKey,
  sectionTitle,
  slotsInSection,
  startGlobalSlot,
  startLocalIndex = 1,
) {
  const fragment = document.createDocumentFragment();

  // Heading for section
  const heading = document.createElement("h2");
  heading.className = "section-title";
  heading.textContent = sectionTitle;
  fragment.appendChild(heading);

  const labels = loadBoxLabels();
  const collapsedBoxes = getActiveCollapsedBoxes();

  const boxCount = Math.ceil(slotsInSection / BOX_CAPACITY);
  for (let boxIndex = 0; boxIndex < boxCount; boxIndex += 1) {
    const localStart = startLocalIndex + boxIndex * BOX_CAPACITY;
    const localEnd = Math.min(
      startLocalIndex + (boxIndex + 1) * BOX_CAPACITY - 1,
      startLocalIndex + slotsInSection - 1,
    );
    const globalStart = startGlobalSlot + boxIndex * BOX_CAPACITY;
    const globalEnd = Math.min(
      startGlobalSlot + (boxIndex + 1) * BOX_CAPACITY - 1,
      startGlobalSlot + slotsInSection - 1,
    );
    const boxId = `${sectionKey}:${boxIndex}`;
    const rangeText = `#${String(localStart).padStart(3, "0")}–${String(localEnd).padStart(3, "0")}`;
    const defaultTitle = `${sectionTitle} — ${rangeText}`;
    const customTitle = labels[boxId] || "";
    const displayTitle = customTitle || defaultTitle;
    const isCollapsed = collapsedBoxes.has(boxId);

    const section = document.createElement("section");
    section.className = `box${isCollapsed ? " is-collapsed" : ""}`;
    section.dataset.section = sectionKey;
    section.dataset.boxId = boxId;
    section.dataset.defaultTitle = defaultTitle;
    section.dataset.rangeText = rangeText;

    section.innerHTML = `
      <div class="box-header">
        <div class="box-header-left">
          <button class="btn btn-icon box-collapse-btn" type="button" aria-expanded="${isCollapsed ? "false" : "true"}" aria-label="${isCollapsed ? "Expand" : "Collapse"} ${displayTitle}">
            <span class="box-collapse-icon" aria-hidden="true">${isCollapsed ? "▼" : "▲"}</span>
          </button>
          <div class="box-title-wrap">
            <span class="box-title" role="button" tabindex="0" title="Click to rename box" aria-label="Box name: ${displayTitle}. Click to rename">${displayTitle}</span>
          </div>
        </div>
        <div class="box-action-pill" role="group" aria-label="Box actions for ${displayTitle}">
          <span class="box-progress-badge" aria-label="Box progress">0/30</span>
          <button class="box-toggle" type="button" data-range="${globalStart}-${globalEnd}" aria-label="Mark all caught in ${rangeText}">✓ All</button>
        </div>
      </div>
      <div class="box-content">
        <div class="grid"></div>
      </div>
    `;
    fragment.appendChild(section);
  }
  container.appendChild(fragment);
}

/**
 * Generate an interactive cell button representing a single dex slot.
 * Includes sprite, name label, slot index badge, and info button trigger.
 *
 * @param {number} slotIndex - Global slot index for storage and dataset tracking.
 * @param {number} speciesId - National Pokédex species ID for lookup and modal info.
 * @param {number|string} formId - Form ID for sprite lookup (may differ from speciesId for regional/alternate forms).
 * @param {string} name - Display name of the Pokémon.
 * @param {number} slotIndex - Global slot index for storage and dataset tracking.
 * @param {number} speciesId - National Pokédex species ID for lookup and modal info.
 * @param {number|string} formId - Form ID for sprite lookup (may differ from speciesId for regional/alternate forms).
 * @param {string} name - Display name of the Pokémon (or base species name).
 * @param {string} displayIndex - Formatted index string to show in cell badge (e.g. "001").
 * @param {string[]} [types=[]] - Pokémon types.
 * @param {string} [gender=""] - Gender variant ('female' or '').
 * @param {string} [formName=""] - Explicit form name if available.
 * @returns {HTMLButtonElement} The generated interactive dex slot button element.
 */
export function createDexSlot(
  slotIndex,
  speciesId,
  formId,
  name,
  displayIndex,
  types = [],
  gender = "",
  formName = "",
) {
  const button = document.createElement("button");
  button.className = "cell";
  button.type = "button";
  button.setAttribute("aria-pressed", "false");
  button.dataset.regional = slotIndex;
  button.dataset.national = speciesId;
  button.dataset.form = formId;
  button.dataset.gender = gender || "";
  button.dataset.formName = formName || "";

  const displayName = formName || name;
  button.dataset.name = displayName.toLowerCase();

  const resolvedTypes = types.length
    ? types
    : getSpeciesTypes(speciesId, formId);
  button.dataset.types = resolvedTypes.join(" ");
  button.title = `#${displayIndex} — ${displayName} (${speciesId})`;

  const spriteStyle = loadSettings().spriteStyle || "pokesprites";
  const targetSpriteId = gender === "female" ? speciesId : formId;
  const primarySpriteUrl = spriteUrlForSpecies(
    targetSpriteId,
    spriteStyle,
    isShinyMode,
    gender,
  );
  const fallbackSpriteUrl = spriteUrlForSpecies(
    speciesId,
    spriteStyle,
    isShinyMode,
  );

  button.innerHTML = `
    <div class="index">${displayIndex}</div>
    <img class="sprite" src="${primarySpriteUrl}" data-fallback="${fallbackSpriteUrl}" alt="${displayName}" width="96" height="96" loading="lazy" decoding="async" crossorigin="anonymous" onerror="if (this.dataset.fallback &amp;&amp; this.src !== this.dataset.fallback) { this.src = this.dataset.fallback; } else { this.style.opacity = '.2'; }"/>
    <div class="label">${displayName}</div>
    <span class="cell-info-btn" role="button" aria-label="View info for ${displayName}" tabindex="0">i</span>
  `;
  return button;
}

/**
 * Refresh the `src` and opacity of every rendered sprite image to match the currently
 * selected sprite style setting and shiny mode, without re-building the whole DOM.
 *
 * @returns {void}
 */
export function applySpriteStyleToCells() {
  const spriteStyle = loadSettings().spriteStyle || "pokesprites";
  document
    .querySelectorAll(".cell:not(.is-placeholder) img.sprite")
    .forEach((img) => {
      const cell = img.closest(".cell");
      const formId = cell?.dataset.form;
      const speciesId = cell?.dataset.national;
      const gender = cell?.dataset.gender || "";
      if (!formId || !speciesId) return;

      const targetId = gender === "female" ? speciesId : formId;
      const primaryUrl = spriteUrlForSpecies(
        targetId,
        spriteStyle,
        isShinyMode,
        gender,
      );
      const fallbackUrl = spriteUrlForSpecies(
        speciesId,
        spriteStyle,
        isShinyMode,
      );

      img.style.opacity = "";
      img.dataset.fallback = fallbackUrl;
      img.onerror = function onSpriteError() {
        if (this.dataset.fallback && this.src !== this.dataset.fallback) {
          this.src = this.dataset.fallback;
        } else {
          this.style.opacity = ".2";
        }
      };
      img.src = primaryUrl;
    });
}

/**
 * @typedef {Object} DexSectionEntry
 * @property {number} speciesId - National Pokédex species ID.
 * @property {number|string} formId - Form ID for sprite lookup.
 */

/**
 * @typedef {Object} DexSection
 * @property {string} key - Section identifier key matching box dataset.
 * @property {DexSectionEntry[]} entries - List of Pokémon slot entries in this section.
 * @property {number} [startIndex] - Optional starting local index offset (defaults to 1).
 */

/**
 * Populate all boxes with cells following the configured living dex order.
 * Uses DocumentFragments and progressive batching to maximize FCP/LCP speed
 * and eliminate main-thread blocking (TBT).
 *
 * @param {DexSection[]} sections - Array of section configuration objects.
 * @param {number} slotCount - Total number of dex slots across all sections (used for progress tracking).
 * @param {() => void} [onComplete] - Optional callback when all boxes finish populating.
 * @returns {void}
 */
export function populateDexSlots(sections, slotCount, onComplete) {
  const caught = isShinyMode ? loadShinyCaughtSlots() : loadCaughtSlots();
  let globalSlotIndex = 1; // continuous global slot numbering for storage

  const boxTasks = [];

  sections.forEach((section) => {
    const { key, entries, startIndex } = section;
    const sectionBoxes = Array.from(
      document.querySelectorAll(`.box[data-section='${key}'] .grid`),
    );
    let localIndex = (startIndex || 1) - 1;
    let boxCursor = 0;
    let slotsPlacedInCurrentBox = 0;
    let currentBoxEntries = [];

    entries.forEach((entry) => {
      currentBoxEntries.push({
        entry,
        globalSlotIndex,
        localIndex,
      });

      globalSlotIndex += 1;
      localIndex += 1;
      slotsPlacedInCurrentBox += 1;

      if (slotsPlacedInCurrentBox >= BOX_CAPACITY) {
        boxTasks.push({
          grid: sectionBoxes[boxCursor],
          entries: currentBoxEntries,
          placeholderCount: 0,
        });
        boxCursor += 1;
        slotsPlacedInCurrentBox = 0;
        currentBoxEntries = [];
      }
    });

    if (slotsPlacedInCurrentBox > 0) {
      boxTasks.push({
        grid: sectionBoxes[boxCursor],
        entries: currentBoxEntries,
        placeholderCount: BOX_CAPACITY - slotsPlacedInCurrentBox,
      });
    }
  });

  /**
   * Renders a single box task's cells using DocumentFragment.
   * @param {Object} task - Box render task definition.
   */
  function renderBoxTask(task) {
    if (!task || !task.grid) return;
    const fragment = document.createDocumentFragment();

    task.entries.forEach(
      ({ entry, globalSlotIndex: slotIdx, localIndex: locIdx }) => {
        const { speciesId, formId, dexNumber, gender, formName } = entry;
        const speciesName =
          window.__livingDexNames?.[speciesId] || `#${speciesId}`;
        const num = dexNumber != null ? dexNumber : locIdx + 1;
        const displayIndex = String(num).padStart(3, "0");
        const cell = createDexSlot(
          slotIdx,
          speciesId,
          formId,
          speciesName,
          displayIndex,
          [],
          gender,
          formName,
        );

        if (caught[slotIdx]) {
          cell.classList.add("caught");
          cell.setAttribute("aria-pressed", "true");
        }

        cell.onclick = (event) => {
          const nextCaught = isShinyMode
            ? loadShinyCaughtSlots()
            : loadCaughtSlots();
          const regionalSlot = Number(cell.dataset.regional);
          const isCaught = !cell.classList.contains("caught");

          if (
            event.shiftKey &&
            lastClickedSlotIndex !== null &&
            lastClickedSlotIndex !== regionalSlot
          ) {
            const start = Math.min(lastClickedSlotIndex, regionalSlot);
            const end = Math.max(lastClickedSlotIndex, regionalSlot);
            const targetState = isCaught;

            for (let slot = start; slot <= end; slot += 1) {
              const targetCell = document.querySelector(
                `.cell[data-regional='${slot}']`,
              );
              if (targetCell) {
                targetCell.classList.toggle("caught", targetState);
                targetCell.setAttribute("aria-pressed", String(targetState));
                nextCaught[slot] = targetState;
              }
            }
          } else {
            cell.classList.toggle("caught", isCaught);
            cell.setAttribute("aria-pressed", String(isCaught));
            nextCaught[regionalSlot] = isCaught;
          }

          lastClickedSlotIndex = regionalSlot;

          if (isShinyMode) {
            saveShinyCaughtSlots(nextCaught);
          } else {
            saveCaughtSlots(nextCaught);
          }
          updateProgressBar(slotCount);
          applyHideCaughtFilter();
        };

        const infoBtn = cell.querySelector(".cell-info-btn");
        if (infoBtn) {
          /**
           * Event handler to open the Pokémon info modal without toggling caught state.
           * @param {MouseEvent|KeyboardEvent} event - The click or keydown event.
           */
          const handleInfo = (event) => {
            event.stopPropagation();
            const latestBaseName =
              window.__livingDexNames?.[speciesId] || speciesName;
            const latestDisplayName = formName || latestBaseName;
            openPokemonInfoModal(
              speciesId,
              formId,
              latestDisplayName,
              gender,
              formName,
            );
          };
          infoBtn.addEventListener("click", handleInfo);
          infoBtn.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleInfo(event);
            }
          });
        }

        fragment.appendChild(cell);
      },
    );

    for (let p = 0; p < task.placeholderCount; p += 1) {
      const placeholder = document.createElement("div");
      placeholder.className = "cell is-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.style.cursor = "default";
      placeholder.innerHTML = `
        <div class="index">—</div>
        <div class="label">Empty</div>
      `;
      fragment.appendChild(placeholder);
    }

    task.grid.appendChild(fragment);
  }

  // Populate first 2 boxes synchronously for instant LCP (above the fold)
  const syncCount = Math.min(2, boxTasks.length);
  for (let i = 0; i < syncCount; i += 1) {
    renderBoxTask(boxTasks[i]);
  }

  // Stream remaining boxes in non-blocking batches
  if (boxTasks.length > syncCount) {
    let cursor = syncCount;
    const batchSize = 4;

    function processNextBatch() {
      const limit = Math.min(cursor + batchSize, boxTasks.length);
      for (let i = cursor; i < limit; i += 1) {
        renderBoxTask(boxTasks[i]);
      }
      cursor = limit;

      if (cursor < boxTasks.length) {
        if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(processNextBatch);
        } else {
          setTimeout(processNextBatch, 0);
        }
      } else {
        if (typeof onComplete === "function") onComplete();
      }
    }

    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(processNextBatch);
    } else {
      setTimeout(processNextBatch, 0);
    }
  } else {
    if (typeof onComplete === "function") onComplete();
  }
}

/**
 * Register per-box controls (Mark all caught, Clear box).
 * These buttons enable bulk operations on entire boxes.
 *
 * @param {number} slotCount - Total number of dex slots across all sections (passed to progress updates).
 * @returns {void}
 */
export function registerBoxControls(slotCount) {
  document.querySelectorAll(".box").forEach((box) => {
    const grid = box.querySelector(".grid");
    const toggleBtn = box.querySelector(".box-toggle");
    const collapseBtn = box.querySelector(".box-collapse-btn");

    bindBoxHeaderEvents(box);

    if (collapseBtn) {
      collapseBtn.onclick = (event) => {
        event.stopPropagation();
        toggleBoxCollapse(box);
      };
    }

    if (toggleBtn && grid) {
      function interactiveCells() {
        return Array.from(grid.querySelectorAll(".cell:not(.is-placeholder)"));
      }

      updateBoxProgress(box);

      toggleBtn.onclick = () => {
        const caught = isShinyMode ? loadShinyCaughtSlots() : loadCaughtSlots();
        const cells = interactiveCells();
        const allCaught = cells.every(
          (cell) => caught[Number(cell.dataset.regional)],
        );
        cells.forEach((cell) => {
          cell.classList.toggle("caught", !allCaught);
          cell.setAttribute("aria-pressed", String(!allCaught));
          caught[Number(cell.dataset.regional)] = !allCaught;
        });

        if (isShinyMode) {
          saveShinyCaughtSlots(caught);
        } else {
          saveCaughtSlots(caught);
        }

        updateProgressBar(slotCount);
        applyHideCaughtFilter();
        updateBoxProgress(box);
      };
    }
  });
}

/**
 * Update species name display on all cells.
 * Applies names from window.__livingDexNames to cell labels and tooltips.
 *
 * @returns {void}
 */
export function applyNamesToCells() {
  document.querySelectorAll(".cell:not(.is-placeholder)").forEach((cell) => {
    const national = Number(cell.dataset.national);
    const regional = Number(cell.dataset.regional);
    const formName = cell.dataset.formName;
    const name =
      formName ||
      window.__livingDexNames?.[national] ||
      cell.dataset.name ||
      `#${national}`;
    cell.dataset.name = String(name).toLowerCase();
    // Keep existing title format using the number shown in the badge
    const indexText =
      cell.querySelector(".index")?.textContent || String(regional);
    cell.title = `#${indexText} — ${name} (${national})`;
    const label = cell.querySelector(".label");
    if (label) label.textContent = name;
  });
}
