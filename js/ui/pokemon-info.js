import { loadSettings } from "../storage.js";
import {
  ACTIVE_GAME_ID,
  spriteUrlForSpecies,
  remoteSpriteUrlForSpecies,
} from "../config.js";
import { attachModalHandlers } from "./modals.js";
import { isShinyMode } from "../state.js";
import { getPokemonModalData } from "../db.js";

// =============================================================================
// POKÉMON INFO MODAL (VIEW LAYER)
// =============================================================================

/** One-time setup state for the info modal handlers. */
let _infoModalHandlers = null;

/**
 * Lazily initializes and returns the modal dialog open/close handlers for the info modal.
 *
 * @returns {{ openModal: () => void, closeModal: () => void }} Modal controller methods.
 */
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

/**
 * Creates an encounter location list DOM element with a toggle button if entries exceed `maxVisible`.
 *
 * @param {string[]} entries - List of location names.
 * @param {Object} [options] - Configuration options.
 * @param {number} [options.maxVisible=5] - Maximum number of items shown before collapsing.
 * @returns {HTMLUListElement|null} The created `<ul>` element, or `null` if entries is empty.
 */
function createEncounterList(entries, { maxVisible = 5 } = {}) {
  if (!entries || !entries.length) {
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

/**
 * Creates a DOM member card element for a species in an evolution chain view.
 *
 * @param {Object} options - Member options.
 * @param {number} options.speciesId - National Pokédex species ID.
 * @param {number} [options.spriteId=options.speciesId] - Sprite/form ID to display.
 * @param {string} [options.name] - Localized species/form display name.
 * @param {string} [options.spriteStyle] - Sprite style preference key.
 * @returns {HTMLDivElement} Member container element.
 */
function createEvolutionMember({
  speciesId,
  spriteId = speciesId,
  name,
  spriteStyle,
}) {
  const member = document.createElement("div");
  member.className = "evo-member";

  const sprite = document.createElement("img");
  sprite.className = "evo-sprite";
  sprite.src = spriteUrlForSpecies(spriteId, spriteStyle, isShinyMode);
  sprite.alt = name || `Species #${speciesId}`;
  sprite.loading = "lazy";
  sprite.decoding = "async";
  sprite.onerror = function onEvolutionSpriteError() {
    if (!this.dataset.fallbackTried) {
      this.dataset.fallbackTried = "true";
      this.src = remoteSpriteUrlForSpecies(spriteId, spriteStyle, isShinyMode);
    } else {
      this.style.opacity = "0.2";
    }
  };

  const label = document.createElement("span");
  label.className = "evo-name";
  label.textContent = name || `Species #${speciesId}`;

  member.append(sprite, label);
  return member;
}

/**
 * Creates a DOM connector element with forward and optional reverse evolution arrows and method condition labels.
 *
 * @param {Object} options - Connector options.
 * @param {string} options.arrowSymbol - Primary forward arrow symbol (e.g. "→").
 * @param {string[]} options.methods - Array of method description strings.
 * @param {string} [options.reverseArrowSymbol=""] - Optional reverse arrow symbol (e.g. "←").
 * @param {string[]} [options.reverseMethods=[]] - Array of reverse method strings (e.g. incense breeding).
 * @returns {HTMLDivElement} Connector element.
 */
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

/**
 * Renders encounter groups into the encounter container element.
 *
 * @param {HTMLElement} encounterEl - Container DOM element for encounter details.
 * @param {Array<Object>} encounterGroups - Array of encounter groups from db.js.
 * @returns {void}
 */
function renderEncounterDetails(encounterEl, encounterGroups) {
  encounterEl.innerHTML = "";

  if (!encounterGroups || !encounterGroups.length) {
    const empty = document.createElement("div");
    empty.className = "pokemon-info-encounter-note";
    empty.textContent = "No encounters in this generation.";
    encounterEl.appendChild(empty);
    return;
  }

  encounterGroups.forEach((groupData) => {
    if (groupData.emptyNote) {
      const empty = document.createElement("div");
      empty.className = "pokemon-info-encounter-note";
      empty.textContent = groupData.emptyNote;
      encounterEl.appendChild(empty);
      return;
    }

    const group = document.createElement("div");
    group.className = "pokemon-info-encounter-group";

    if (groupData.versionHeader) {
      const header = document.createElement("div");
      header.className = "pokemon-info-encounter-header";
      header.textContent = groupData.versionHeader;
      group.appendChild(header);
    }

    if (groupData.locations && groupData.locations.length > 0) {
      const list = createEncounterList(groupData.locations);
      if (list) group.appendChild(list);
    } else if (groupData.evolveNote) {
      const list = document.createElement("ul");
      list.className = "pokemon-info-encounter-list";
      const item = document.createElement("li");
      item.textContent = groupData.evolveNote;
      list.appendChild(item);
      group.appendChild(list);
    } else if (groupData.tradeNote) {
      const list = document.createElement("ul");
      list.className = "pokemon-info-encounter-list";
      const item = document.createElement("li");
      item.textContent = groupData.tradeNote;
      list.appendChild(item);
      group.appendChild(list);
    }

    encounterEl.appendChild(group);
  });
}

/**
 * Renders evolution flowchart paths, member cards, and connectors into the evolution container.
 *
 * @param {HTMLElement} evoEl - Evolution container DOM element.
 * @param {Array<Object>} evolutionPaths - Resolved evolution paths from db.js.
 * @param {string} spriteStyle - Sprite style preference key.
 * @returns {void}
 */
function renderEvolutionDetails(evoEl, evolutionPaths, spriteStyle) {
  evoEl.innerHTML = "";

  if (!evolutionPaths || !evolutionPaths.length) {
    return;
  }

  evolutionPaths.forEach((path) => {
    const row = document.createElement("div");
    row.className = "evo-row";

    const rootMember = createEvolutionMember({
      speciesId: path.root.speciesId,
      spriteId: path.root.spriteId || path.root.speciesId,
      name: path.root.name,
      spriteStyle,
    });
    row.appendChild(rootMember);

    (path.steps || []).forEach((step) => {
      row.appendChild(
        createEvolutionConnector({
          arrowSymbol: "→",
          methods: [step.description],
          reverseArrowSymbol: step.reverseBreeding ? "←" : "",
          reverseMethods: step.reverseBreeding
            ? [`Hold ${step.reverseBreeding.itemName}`]
            : [],
        }),
      );

      row.appendChild(
        createEvolutionMember({
          speciesId: step.toSpeciesId,
          spriteId: step.toSpriteId || step.toSpeciesId,
          name: step.toName,
          spriteStyle,
        }),
      );
    });

    evoEl.appendChild(row);
  });
}

/**
 * Fetch and display info for a Pokémon in the info modal.
 * Uses local database to avoid redundant API calls and parse operations.
 *
 * @param {number} speciesId - National Pokédex species ID.
 * @param {number} formId - Pokémon form ID or sprite ID.
 * @param {string} name - Species/form display name.
 * @returns {Promise<void>}
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

  const spriteStyle = loadSettings().spriteStyle || "pokesprites";

  // Immediate placeholder state
  titleEl.textContent = name;
  numberEl.textContent = `#${speciesId}`;
  spriteEl.decoding = "async";
  spriteEl.style.opacity = "";
  delete spriteEl.dataset.fallbackTried;
  spriteEl.onerror = function onModalSpriteError() {
    if (!this.dataset.fallbackTried) {
      this.dataset.fallbackTried = "true";
      this.src = remoteSpriteUrlForSpecies(formId, spriteStyle, isShinyMode);
    } else {
      this.style.opacity = "0.2";
    }
  };
  spriteEl.src = spriteUrlForSpecies(formId, spriteStyle, isShinyMode);
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

  try {
    const data = await getPokemonModalData(speciesId, formId, ACTIVE_GAME_ID);

    if (encounterLabelEl) encounterLabelEl.hidden = !data.showEncounters;
    if (encounterEl) encounterEl.hidden = !data.showEncounters;

    typesEl.innerHTML = data.types
      .map((t) => `<span class="type-badge" data-type="${t}">${t}</span>`)
      .join("");

    flavorEl.textContent = data.flavorText;

    if (data.showEncounters) {
      renderEncounterDetails(encounterEl, data.encounterGroups);
    }

    renderEvolutionDetails(evoEl, data.evolutionPaths, spriteStyle);

    loadingEl.hidden = true;
    bodyEl.hidden = false;
  } catch (err) {
    console.error("Error loading pokemon info modal", err);
    loadingEl.hidden = true;
    errorEl.textContent =
      "Could not load Pokémon info. Check your connection and try again.";
    errorEl.hidden = false;
  }
}
