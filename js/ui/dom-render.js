import {
  loadSettings,
  loadCaughtSlots,
  saveCaughtSlots,
  loadShinyCaughtSlots,
  saveShinyCaughtSlots,
} from "../storage.js";
import { BOX_CAPACITY, spriteUrlForSpecies } from "../config.js";
import { openPokemonInfoModal } from "./pokemon-info.js";
import { applyHideCaughtFilter } from "./controls.js";
import { updateProgressBar, isShinyMode } from "../state.js";

// =============================================================================
// DOM RENDERING & BOX MANAGEMENT
// =============================================================================

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
  // Heading for section
  const heading = document.createElement("h2");
  heading.className = "section-title";
  heading.textContent = sectionTitle;
  container.appendChild(heading);

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
    const section = document.createElement("section");
    section.className = "box";
    section.dataset.section = sectionKey;
    section.innerHTML = `
      <h2>
        <span>${sectionTitle} — #${String(localStart).padStart(3, "0")}–${String(localEnd).padStart(3, "0")}</span>
        <span class="tools">
          <button class="btn box-toggle" type="button" data-range="${globalStart}-${globalEnd}"></button>
        </span>
      </h2>
      <div class="grid"></div>
    `;
    container.appendChild(section);
  }
}

/**
 * Generate an interactive cell button representing a single dex slot.
 * Includes sprite, name label, slot index badge, and info button trigger.
 *
 * @param {number} slotIndex - Global slot index for storage and dataset tracking.
 * @param {number} speciesId - National Pokédex species ID for lookup and modal info.
 * @param {number|string} formId - Form ID for sprite lookup (may differ from speciesId for regional/alternate forms).
 * @param {string} name - Display name of the Pokémon.
 * @param {string} displayIndex - Formatted index string to show in cell badge (e.g. "001").
 * @returns {HTMLButtonElement} The generated interactive dex slot button element.
 */
export function createDexSlot(
  slotIndex,
  speciesId,
  formId,
  name,
  displayIndex,
) {
  const button = document.createElement("button");
  button.className = "cell";
  button.type = "button";
  button.setAttribute("aria-pressed", "false");
  button.dataset.regional = slotIndex;
  button.dataset.national = speciesId;
  button.dataset.form = formId;
  button.dataset.name = name.toLowerCase();
  button.title = `#${displayIndex} — ${name} (${speciesId})`;
  const spriteStyle = loadSettings().spriteStyle || "pokesprites";
  button.innerHTML = `
    <div class="index">${displayIndex}</div>
    <img class="sprite" src="${spriteUrlForSpecies(formId, spriteStyle, isShinyMode)}" alt="${name}" loading="lazy" onerror="this.style.opacity=.2"/>
    <div class="label">${name}</div>
    <span class="cell-info-btn" role="button" aria-label="View info for ${name}" tabindex="0">i</span>
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
      if (!formId) return;
      img.style.opacity = "";
      img.src = spriteUrlForSpecies(formId, spriteStyle, isShinyMode);
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
 * Applies caught state from storage, registers click handlers, sets up info modal triggers,
 * and appends placeholder cells for partially filled trailing boxes.
 *
 * @param {DexSection[]} sections - Array of section configuration objects.
 * @param {number} slotCount - Total number of dex slots across all sections (used for progress tracking).
 * @returns {void}
 */
export function populateDexSlots(sections, slotCount) {
  const caught = isShinyMode ? loadShinyCaughtSlots() : loadCaughtSlots();
  let globalSlotIndex = 1; // continuous global slot numbering for storage

  sections.forEach((section) => {
    const { key, entries, startIndex } = section;
    // Select all grids for this section (in order)
    const sectionBoxes = Array.from(
      document.querySelectorAll(`.box[data-section='${key}'] .grid`),
    );
    let localIndex = (startIndex || 1) - 1;
    let boxCursor = 0;
    let slotsPlacedInCurrentBox = 0;

    entries.forEach((entry) => {
      const { speciesId, formId, dexNumber } = entry;
      const speciesName =
        window.__livingDexNames?.[speciesId] || `#${speciesId}`;
      const num = dexNumber != null ? dexNumber : localIndex + 1;
      const displayIndex = String(num).padStart(3, "0");
      const cell = createDexSlot(
        globalSlotIndex,
        speciesId,
        formId,
        speciesName,
        displayIndex,
      );

      if (caught[globalSlotIndex]) {
        cell.classList.add("caught");
        cell.setAttribute("aria-pressed", "true");
      }

      cell.onclick = () => {
        const nextCaught = isShinyMode
          ? loadShinyCaughtSlots()
          : loadCaughtSlots();
        const regionalSlot = Number(cell.dataset.regional);
        const isCaught = !cell.classList.contains("caught");
        cell.classList.toggle("caught", isCaught);
        cell.setAttribute("aria-pressed", String(isCaught));
        nextCaught[regionalSlot] = isCaught;
        if (isShinyMode) {
          saveShinyCaughtSlots(nextCaught);
        } else {
          saveCaughtSlots(nextCaught);
        }
        updateProgressBar(slotCount);
        applyHideCaughtFilter();
      };

      // Info button: open info modal without toggling caught state
      const infoBtn = cell.querySelector(".cell-info-btn");
      if (infoBtn) {
        /**
         * Event handler to open the Pokémon info modal without toggling caught state.
         * @param {MouseEvent|KeyboardEvent} event - The click or keydown event.
         */
        const handleInfo = (event) => {
          event.stopPropagation();
          const latestName =
            window.__livingDexNames?.[speciesId] || speciesName;
          openPokemonInfoModal(speciesId, formId, latestName);
        };
        infoBtn.addEventListener("click", handleInfo);
        infoBtn.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleInfo(event);
          }
        });
      }

      // Append to current box
      sectionBoxes[boxCursor]?.appendChild(cell);
      globalSlotIndex += 1;
      localIndex += 1;
      slotsPlacedInCurrentBox += 1;

      // Move to next box if capacity reached
      if (slotsPlacedInCurrentBox >= BOX_CAPACITY) {
        boxCursor += 1;
        slotsPlacedInCurrentBox = 0;
      }
    });

    // Fill remaining empty slots in the last partially filled box with placeholders
    while (
      slotsPlacedInCurrentBox > 0 &&
      slotsPlacedInCurrentBox < BOX_CAPACITY
    ) {
      const placeholder = document.createElement("div");
      placeholder.className = "cell is-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.style.cursor = "default";
      placeholder.innerHTML = `
        <div class="index">—</div>
        <div class="label">Empty</div>
      `;
      sectionBoxes[boxCursor]?.appendChild(placeholder);
      slotsPlacedInCurrentBox += 1;
    }
  });
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
    if (!toggleBtn) return;

    /**
     * Retrieve all non-placeholder interactive cells within this box.
     * @returns {HTMLElement[]} Array of interactive cell elements.
     */
    function interactiveCells() {
      return Array.from(grid.querySelectorAll(".cell:not(.is-placeholder)"));
    }

    /**
     * Update the box toggle button label and aria-label according to the caught state of its cells.
     * @returns {void}
     */
    function updateToggleBtnLabel() {
      const caught = loadCaughtSlots();
      const cells = interactiveCells();
      const allCaught = cells.every(
        (cell) => caught[Number(cell.dataset.regional)],
      );
      toggleBtn.textContent = allCaught ? "Unmark all" : "Mark all";
      toggleBtn.setAttribute(
        "aria-label",
        `${allCaught ? "Mark all uncaught" : "Mark all caught"} in this box`,
      );
    }

    updateToggleBtnLabel();

    toggleBtn.onclick = () => {
      const caught = loadCaughtSlots();
      const cells = interactiveCells();
      const allCaught = cells.every(
        (cell) => caught[Number(cell.dataset.regional)],
      );
      cells.forEach((cell) => {
        cell.classList.toggle("caught", !allCaught);
        cell.setAttribute("aria-pressed", String(!allCaught));
        caught[Number(cell.dataset.regional)] = !allCaught;
      });
      saveCaughtSlots(caught);
      updateProgressBar(slotCount);
      applyHideCaughtFilter();
      updateToggleBtnLabel();
    };
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
    const name =
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
