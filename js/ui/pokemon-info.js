import {
  loadSettings,
  loadSpecimenInventory,
  saveSpecimenInventory,
  loadCaughtSlots,
  saveCaughtSlots,
  loadShinyCaughtSlots,
  saveShinyCaughtSlots,
} from "../storage.js";
import { ACTIVE_GAME_ID, spriteUrlForSpecies } from "../config.js";
import { attachModalHandlers } from "./modals.js";
import { isShinyMode, updateProgressBar } from "../state.js";
import { getPokemonModalData, calculateFamilyQuota } from "../db.js";
import { getVisiblePokemonCells, applyHideCaughtFilter } from "./controls.js";
import { getCellDisplayInfo, updateCellSpecimenBadge } from "./dom-render.js";
import { updateMissingGuideBadge } from "./missing-guide.js";

// =============================================================================
// POKÉMON INFO MODAL (VIEW LAYER)
// =============================================================================

/** One-time setup state for the info modal handlers. */
let _infoModalHandlers = null;

/** Currently active HTML5 Audio element for cries. */
let currentAudio = null;

/**
 * Opens the info modal for the specified Pokémon cell.
 *
 * @param {HTMLElement} targetCell - The target cell element.
 * @returns {void}
 */
function navigateToCell(targetCell) {
  if (!targetCell) return;
  const info = getCellDisplayInfo(targetCell);
  if (!info) return;
  openPokemonInfoModal(
    info.speciesId,
    info.formId,
    info.displayName,
    info.gender,
    info.formName,
    info.spriteId,
    targetCell,
  );
}

/**
 * Updates the state and metadata of the Previous and Next buttons in the modal footer.
 *
 * @param {HTMLElement|null} activeCell - The currently active cell in the modal.
 * @param {number} speciesId - Fallback species ID if cell is not in DOM.
 * @param {number} formId - Fallback form ID.
 * @param {string} gender - Fallback gender.
 */
function updateNavigationButtons(activeCell, speciesId, formId, gender) {
  const prevBtn = document.getElementById("prevPokemonBtn");
  const nextBtn = document.getElementById("nextPokemonBtn");
  const prevMeta = document.getElementById("prevPokemonMeta");
  const nextMeta = document.getElementById("nextPokemonMeta");

  if (!prevBtn || !nextBtn) return;

  const visibleCells = getVisiblePokemonCells();
  let resolvedCell = activeCell;

  if (!resolvedCell || !visibleCells.includes(resolvedCell)) {
    resolvedCell =
      visibleCells.find(
        (c) =>
          Number(c.dataset.national) === speciesId &&
          Number(c.dataset.form) === formId &&
          (c.dataset.gender || "") === gender,
      ) ||
      visibleCells.find((c) => Number(c.dataset.national) === speciesId) ||
      null;
  }

  const currentIndex = resolvedCell ? visibleCells.indexOf(resolvedCell) : -1;

  const prevCell = currentIndex > 0 ? visibleCells[currentIndex - 1] : null;
  const nextCell =
    currentIndex >= 0 && currentIndex < visibleCells.length - 1
      ? visibleCells[currentIndex + 1]
      : null;

  if (prevCell) {
    const prevInfo = getCellDisplayInfo(prevCell);
    prevBtn.disabled = false;
    prevBtn.removeAttribute("aria-disabled");
    if (prevMeta) prevMeta.textContent = prevInfo?.metaText || "";
    prevBtn.setAttribute(
      "aria-label",
      prevInfo ? `Previous Pokémon: ${prevInfo.metaText}` : "Previous Pokémon",
    );
    prevBtn.onclick = () => {
      navigateToCell(prevCell);
    };
  } else {
    prevBtn.disabled = true;
    prevBtn.setAttribute("aria-disabled", "true");
    if (prevMeta) prevMeta.textContent = "";
    prevBtn.setAttribute("aria-label", "Previous Pokémon");
    prevBtn.onclick = null;
  }

  if (nextCell) {
    const nextInfo = getCellDisplayInfo(nextCell);
    nextBtn.disabled = false;
    nextBtn.removeAttribute("aria-disabled");
    if (nextMeta) nextMeta.textContent = nextInfo?.metaText || "";
    nextBtn.setAttribute(
      "aria-label",
      nextInfo ? `Next Pokémon: ${nextInfo.metaText}` : "Next Pokémon",
    );
    nextBtn.onclick = () => {
      navigateToCell(nextCell);
    };
  } else {
    nextBtn.disabled = true;
    nextBtn.setAttribute("aria-disabled", "true");
    if (nextMeta) nextMeta.textContent = "";
    nextBtn.setAttribute("aria-label", "Next Pokémon");
    nextBtn.onclick = null;
  }
}

/**
 * Stop any currently playing Pokémon cry audio and reset button visual states.
 *
 * @returns {void}
 */
export function stopCurrentAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
    currentAudio = null;
  }
  const cryBtn = document.getElementById("pokemonInfoCryBtn");
  if (cryBtn) {
    cryBtn.classList.remove("is-playing");
    cryBtn.setAttribute("aria-label", "Play Pokémon cry");
  }
}

/**
 * Plays the iconic in-game audio cry for the given species ID.
 *
 * @param {number} speciesId - National Pokédex species ID.
 * @param {string} [name=""] - Pokémon name for fallback / aria-label.
 * @returns {void}
 */
export function playPokemonCry(speciesId, name = "") {
  stopCurrentAudio();
  const cryBtn = document.getElementById("pokemonInfoCryBtn");

  if (!speciesId) return;

  const primaryUrl = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${speciesId}.ogg`;
  const sanitizedName = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const fallbackUrl = `https://play.pokemonshowdown.com/audio/cries/${sanitizedName}.mp3`;

  const audio = new Audio(primaryUrl);
  audio.volume = 0.5;
  currentAudio = audio;

  if (cryBtn) {
    cryBtn.classList.add("is-playing");
    cryBtn.setAttribute("aria-label", `Playing cry for ${name || speciesId}`);
  }

  audio.onended = () => {
    if (currentAudio === audio) {
      stopCurrentAudio();
    }
  };

  audio.onerror = () => {
    // If primary PokéAPI cry fails and we have a fallback name, try Showdown
    if (fallbackUrl && sanitizedName) {
      const fallbackAudio = new Audio(fallbackUrl);
      fallbackAudio.volume = 0.5;
      currentAudio = fallbackAudio;

      fallbackAudio.onended = () => {
        if (currentAudio === fallbackAudio) {
          stopCurrentAudio();
        }
      };

      fallbackAudio.onerror = () => {
        stopCurrentAudio();
      };

      fallbackAudio.play().catch(() => {
        stopCurrentAudio();
      });
    } else {
      stopCurrentAudio();
    }
  };

  audio.play().catch(() => {
    stopCurrentAudio();
  });
}

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
    onClose: () => {
      stopCurrentAudio();
    },
    onKeydown: (event) => {
      if (event.key === "ArrowLeft") {
        const prevBtn = document.getElementById("prevPokemonBtn");
        if (prevBtn && !prevBtn.disabled && prevBtn.onclick) {
          event.preventDefault();
          prevBtn.click();
        }
      } else if (event.key === "ArrowRight") {
        const nextBtn = document.getElementById("nextPokemonBtn");
        if (nextBtn && !nextBtn.disabled && nextBtn.onclick) {
          event.preventDefault();
          nextBtn.click();
        }
      }
    },
    focusSelector: "#closePokemonInfo",
  });
  return _infoModalHandlers;
}

/**
 * Splits a location string into a base location name, concise tags, and notes.
 *
 * @param {string} entry - Raw location entry string (e.g. "Route 12 (Surfing)").
 * @returns {{ name: string, tags: string[], notes: string[] }} Parsed location details.
 */
export function parseLocationEntry(entry) {
  if (!entry) return { name: "", tags: [], notes: [] };
  if (/^(?:Tera Raid|Evolve|Trade|Buy|Breed|Received|Gift|Event)/i.test(entry.trim())) {
    return { name: entry, tags: [], notes: [] };
  }

  let current = entry;
  const tags = [];
  const notes = [];
  const floorPattern = /^(?:b?\d+f|main|area\s*\d+|outside|inside|exterior|entrance)$/i;
  const compactPattern =
    /^(?:b?\d+f,\s*)?(?:dual-slot|morning|day|night|swarm|radar|surfing|swimming|fishing|underwater|diving|rock smash|headbutt|honey tree|starter|gift|gift egg|fossil|(?:max|tera|gigantamax) raid|amped\s+\(sword\)\s*\/\s*low key\s+\(shield\)\s+form|[a-z]+(?:\s+[a-z]+)* form)\b/i;
  const notePattern =
    /^(?:cannot|requires?|only one|after|before|available|must|changed|transfer)/i;

  while (true) {
    const match = getTrailingParenthetical(current);
    if (!match) break;
    const tagContent = match.content.trim();
    if (floorPattern.test(tagContent)) {
      break;
    }
    if (
      !compactPattern.test(tagContent) &&
      (tagContent.length > 42 || /[;.!?]/.test(tagContent) || notePattern.test(tagContent))
    ) {
      notes.unshift(tagContent);
    } else {
      tags.unshift(tagContent);
    }
    current = current.slice(0, match.start).trim();
  }

  return { name: current || entry, tags, notes };
}

function getTrailingParenthetical(text) {
  const trimmed = text.trim();
  if (!trimmed.endsWith(")")) return null;

  let depth = 0;
  for (let index = trimmed.length - 1; index >= 0; index--) {
    if (trimmed[index] === ")") depth++;
    if (trimmed[index] === "(") depth--;
    if (depth === 0) {
      return {
        content: trimmed.slice(index + 1, -1),
        start: index,
      };
    }
  }

  return null;
}

/**
 * Formats a condition rate chip label with appropriate emoji icon.
 *
 * @param {Object} rate - Condition rate object.
 * @returns {string} Formatted label text.
 */
export function formatConditionChipText(rate) {
  const cond = rate?.condition || "";
  let icon = "";
  if (/morning/i.test(cond)) icon = "🌅 ";
  else if (/\bday\b/i.test(cond)) icon = "☀️ ";
  else if (/night/i.test(cond)) icon = "🌙 ";
  else if (/radar/i.test(cond)) icon = "📡 ";
  else if (/swarm/i.test(cond)) icon = "🦗 ";
  else if (/spring/i.test(cond)) icon = "🌸 ";
  else if (/summer/i.test(cond)) icon = "☀️ ";
  else if (/autumn|fall/i.test(cond)) icon = "🍂 ";
  else if (/winter/i.test(cond)) icon = "❄️ ";
  else if (/dual-slot/i.test(cond)) icon = "🎮 ";
  else if (/sound|radio/i.test(cond)) icon = "📻 ";
  else if (/sandstorm/i.test(cond)) icon = "🏜️ ";
  else if (/snowstorm|blizzard/i.test(cond)) icon = "❄️ ";
  else if (/snowing|snow/i.test(cond)) icon = "🌨️ ";
  else if (/thunderstorm/i.test(cond)) icon = "⛈️ ";
  else if (/raining|rain/i.test(cond)) icon = "🌧️ ";
  else if (/fog/i.test(cond)) icon = "🌫️ ";
  else if (/overcast/i.test(cond)) icon = "☁️ ";
  else if (/intense-sun|intense sun/i.test(cond)) icon = "☀️ ";

  const label = cond ? `${icon}${cond}` : icon;
  return typeof rate.chance === "number" ? `${label}: ${rate.chance}%` : label;
}

/**
 * Formats a single location tag string with contextual icon.
 *
 * @param {string} tag - Tag label string.
 * @returns {string} Formatted label with icon.
 */
export function formatConditionTag(tag) {
  if (!tag) return "";
  const t = String(tag).trim();
  let icon = "";
  if (/morning/i.test(t)) icon = "🌅 ";
  else if (/\bday\b/i.test(t)) icon = "☀️ ";
  else if (/night/i.test(t)) icon = "🌙 ";
  else if (/radar/i.test(t)) icon = "📡 ";
  else if (/swarm/i.test(t)) icon = "🦗 ";
  else if (/spring/i.test(t)) icon = "🌸 ";
  else if (/summer/i.test(t)) icon = "☀️ ";
  else if (/autumn|fall/i.test(t)) icon = "🍂 ";
  else if (/winter/i.test(t)) icon = "❄️ ";
  else if (/dual-slot/i.test(t)) icon = "🎮 ";
  else if (/sound|radio/i.test(t)) icon = "📻 ";
  else if (/sandstorm/i.test(t)) icon = "🏜️ ";
  else if (/snowstorm|blizzard/i.test(t)) icon = "❄️ ";
  else if (/snowing|snow/i.test(t)) icon = "🌨️ ";
  else if (/thunderstorm/i.test(t)) icon = "⛈️ ";
  else if (/raining|rain/i.test(t)) icon = "🌧️ ";
  else if (/fog/i.test(t)) icon = "🌫️ ";
  else if (/overcast/i.test(t)) icon = "☁️ ";
  else if (/intense-sun|intense sun/i.test(t)) icon = "☀️ ";
  else if (/headbutt|honey tree/i.test(t)) icon = "🌳 ";
  else if (/surfing|swimming/i.test(t)) icon = "🌊 ";
  else if (/fishing|old rod|good rod|super rod/i.test(t)) icon = "🎣 ";
  else if (/underwater|diving/i.test(t)) icon = "🤿 ";
  else if (/rock smash/i.test(t)) icon = "🪨 ";
  else if (/fossil/i.test(t)) icon = "🦴 ";
  else if (/starter/i.test(t)) icon = "🌟 ";
  else if (/gift egg/i.test(t)) icon = "🥚 ";
  else if (/gift/i.test(t)) icon = "🎁 ";
  else if (/contest/i.test(t)) icon = "🏆 ";

  return `${icon}${t}`;
}

/**
 * Gets a contextual emoji icon for exclusive encounter method notes.
 *
 * @param {string} note - Method note string.
 * @returns {string} Emoji icon.
 */
function getMethodNoteIcon(note) {
  if (!note) return "💡";
  const lower = note.toLowerCase();
  if (lower.includes("night")) return "🌙";
  if (lower.includes("morning")) return "🌅";
  if (lower.includes("day")) return "☀️";
  if (lower.includes("swarm")) return "🦗";
  if (lower.includes("radar")) return "📡";
  if (lower.includes("dual-slot")) return "🎮";
  if (lower.includes("radio") || lower.includes("sound")) return "📻";
  if (lower.includes("sandstorm")) return "🏜️";
  if (lower.includes("snowstorm") || lower.includes("blizzard")) return "❄️";
  if (lower.includes("snowing") || lower.includes("snow")) return "🌨️";
  if (lower.includes("thunderstorm")) return "⛈️";
  if (lower.includes("raining") || lower.includes("rain")) return "🌧️";
  if (lower.includes("fog")) return "🌫️";
  if (lower.includes("overcast")) return "☁️";
  if (lower.includes("fishing") || lower.includes("rod")) return "🎣";
  if (lower.includes("surfing") || lower.includes("swimming")) return "🌊";
  if (lower.includes("underwater") || lower.includes("diving")) return "🤿";
  if (lower.includes("rock smash")) return "🪨";
  if (lower.includes("trees") || lower.includes("headbutt")) return "🌳";
  if (lower.includes("fossil")) return "🦴";
  if (lower.includes("gift egg")) return "🥚";
  if (lower.includes("gift")) return "🎁";
  if (lower.includes("starter")) return "⭐";
  if (lower.includes("raid")) return "⚔️";
  return "💡";
}

/**
 * Filters out redundant location tags when a global top-level method note already communicates the condition.
 *
 * @param {string[]} tags - Extracted location tags.
 * @param {string} [methodNote=""] - Top-level exclusive method note.
 * @returns {string[]} Filtered tags.
 */
function filterRedundantTags(tags, methodNote = "") {
  if (!methodNote || !Array.isArray(tags) || tags.length === 0) return tags;
  const noteLower = methodNote.toLowerCase();

  return tags.filter((tag) => {
    const tLower = tag.toLowerCase();
    if (noteLower.includes("night") && tLower === "night") return false;
    if (noteLower.includes("morning") && tLower === "morning") return false;
    if (noteLower.includes("day") && tLower === "day") return false;
    if (noteLower.includes("starter") && tLower === "starter") return false;
    if (noteLower.includes("fossil") && tLower === "fossil") return false;
    if (noteLower.includes("gift egg") && tLower === "gift egg") return false;
    if (noteLower.includes("gift") && (tLower === "gift" || tLower === "in-game gift"))
      return false;
    if (noteLower.includes("super rod") && tLower.includes("super rod")) return false;
    if (noteLower.includes("old rod") && tLower.includes("old rod")) return false;
    if (noteLower.includes("good rod") && tLower.includes("good rod")) return false;
    if (noteLower.includes("fishing") && tLower === "fishing") return false;
    if (noteLower.includes("surfing") && (tLower === "surfing" || tLower === "swimming"))
      return false;
    if (noteLower.includes("underwater") && (tLower === "underwater" || tLower === "diving"))
      return false;
    if (noteLower.includes("rock smash") && tLower === "rock smash") return false;
    if (noteLower.includes("trees") && (tLower === "headbutt" || tLower === "honey tree"))
      return false;
    if (noteLower.includes("poké radar") && (tLower === "poké radar" || tLower === "poke radar"))
      return false;
    if (noteLower.includes("swarms") && tLower === "swarm") return false;
    if (noteLower.includes("dual-slot") && tLower.startsWith("dual-slot")) return false;
    if (
      noteLower.includes("raid") &&
      (tLower === "max raid" || tLower === "max raid battle" || tLower === "gigantamax raid battle")
    )
      return false;
    return true;
  });
}

/**
 * Populates an `<li>` element with a styled location name, rate badge, and tags.
 *
 * @param {HTMLLIElement} li - Target list item element.
 * @param {string|Object} entry - Location entry string or structured encounter object.
 * @param {string} [methodNote=""] - Active exclusive encounter note if applicable.
 * @returns {void}
 */
function renderLocationItemContent(li, entry, methodNote = "") {
  li.textContent = "";

  const isObject = typeof entry === "object" && entry !== null;
  const rawLoc = isObject ? entry.location || "" : entry;
  const { name, tags: rawTags, notes } = parseLocationEntry(rawLoc);
  const tags = filterRedundantTags(rawTags, methodNote);

  const mainRow = document.createElement("div");
  mainRow.className = "pokemon-info-encounter-main";

  const nameSpan = document.createElement("span");
  nameSpan.className = "pokemon-info-encounter-location";
  nameSpan.textContent = name;
  mainRow.appendChild(nameSpan);

  // Render Rate Badge if chance is present
  if (isObject && typeof entry.chance === "number") {
    const rateBadge = document.createElement("span");
    rateBadge.className = "pokemon-info-encounter-rate";
    if (entry.chance < 10) {
      rateBadge.classList.add("rate-rare");
    } else if (entry.chance < 20) {
      rateBadge.classList.add("rate-uncommon");
    } else {
      rateBadge.classList.add("rate-common");
    }
    rateBadge.textContent = `${entry.chance}%`;
    mainRow.appendChild(rateBadge);
  }

  // Level range badge if present
  if (isObject && entry.levels) {
    const lvlSpan = document.createElement("span");
    lvlSpan.className = "pokemon-info-encounter-tag tag-levels";
    lvlSpan.textContent = entry.levels;
    mainRow.appendChild(lvlSpan);
  }

  // Render location tags (Starter, Gift, Fossil, methods)
  if (tags.length > 0) {
    tags.forEach((tag) => {
      const tagSpan = document.createElement("span");
      tagSpan.className = "pokemon-info-encounter-tag";
      const lower = tag.toLowerCase();
      if (lower.includes("starter")) {
        tagSpan.classList.add("tag-starter");
      } else if (lower.includes("fossil")) {
        tagSpan.classList.add("tag-fossil");
      } else if (lower.includes("gift") || lower.includes("egg")) {
        tagSpan.classList.add("tag-gift");
      }
      tagSpan.textContent = tag;
      mainRow.appendChild(tagSpan);
    });
  }

  if (notes.length > 0) {
    const noteSpan = document.createElement("span");
    noteSpan.className = "pokemon-info-encounter-detail";
    noteSpan.textContent = notes.join("; ");
    mainRow.appendChild(noteSpan);
  }

  li.appendChild(mainRow);

  // Render condition chips if rates breakdown exists
  if (isObject && Array.isArray(entry.rates) && entry.rates.length > 0) {
    const validRates = entry.rates.filter((r) => r && r.condition);
    if (validRates.length > 0) {
      const conditionsRow = document.createElement("div");
      conditionsRow.className = "pokemon-info-encounter-conditions";

      validRates.forEach((rate) => {
        const chip = document.createElement("span");
        chip.className = "pokemon-info-condition-chip";
        chip.textContent = formatConditionChipText(rate);
        conditionsRow.appendChild(chip);
      });

      li.appendChild(conditionsRow);
    }
  }
}

/**
 * Creates an encounter location list DOM element with a toggle button if entries exceed `maxVisible`.
 *
 * @param {string[]} entries - List of location names.
 * @param {Object} [options] - Configuration options.
 * @param {number} [options.maxVisible=5] - Maximum number of items shown before collapsing.
 * @param {string} [options.methodNote=""] - Active exclusive encounter note.
 * @returns {HTMLUListElement|null} The created `<ul>` element, or `null` if entries is empty.
 */
function createEncounterList(entries, { maxVisible = 5, methodNote = "" } = {}) {
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
    renderLocationItemContent(item, entry, methodNote);
    list.appendChild(item);
  });

  if (collapsed) {
    const hiddenEntries = entries.slice(maxVisible);
    hiddenEntries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "pokemon-info-encounter-item pokemon-info-encounter-item-hidden";
      renderLocationItemContent(item, entry, methodNote);
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
      const hiddenItems = list.querySelectorAll(".pokemon-info-encounter-item-hidden");
      hiddenItems.forEach((item) => {
        item.hidden = isExpanded;
      });

      toggle.setAttribute("aria-expanded", String(!isExpanded));
      toggle.textContent = isExpanded ? `Show ${hiddenEntries.length} more` : "Show fewer";
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
function createEvolutionMember({ speciesId, spriteId = speciesId, name, spriteStyle }) {
  const member = document.createElement("div");
  member.className = "evo-member";

  const primarySpriteUrl = spriteUrlForSpecies(spriteId, spriteStyle, isShinyMode);
  const fallbackSpriteUrl = spriteUrlForSpecies(speciesId, spriteStyle, isShinyMode);

  const sprite = document.createElement("img");
  sprite.className = "evo-sprite";
  sprite.crossOrigin = "anonymous";
  sprite.src = primarySpriteUrl;
  sprite.dataset.fallback = fallbackSpriteUrl;
  sprite.alt = name || `Species #${speciesId}`;
  sprite.loading = "lazy";
  sprite.decoding = "async";
  sprite.onerror = function onEvolutionSpriteError() {
    if (this.dataset.fallback && this.src !== this.dataset.fallback) {
      this.src = this.dataset.fallback;
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
    if (groupData.isHome) {
      const homeGroup = document.createElement("div");
      homeGroup.className = "pokemon-info-home-encounter-group";

      if (groupData.debut) {
        const debutCard = document.createElement("div");
        debutCard.className = "pokemon-info-home-debut";

        const label = document.createElement("div");
        label.className = "pokemon-info-home-label";
        label.textContent = "First Introduced";
        debutCard.appendChild(label);

        const valRow = document.createElement("div");
        valRow.className = "pokemon-info-home-debut-val";

        const gameSpan = document.createElement("span");
        gameSpan.className = "pokemon-info-home-debut-game";
        gameSpan.textContent = groupData.debut.game;
        valRow.appendChild(gameSpan);

        if (groupData.debut.generationRoman || groupData.debut.generation) {
          const genSpan = document.createElement("span");
          genSpan.className = "pokemon-info-home-debut-gen";
          genSpan.textContent =
            groupData.debut.generationRoman || `Gen ${groupData.debut.generation}`;
          valRow.appendChild(genSpan);
        }

        debutCard.appendChild(valRow);
        homeGroup.appendChild(debutCard);
      }

      const obtainCard = document.createElement("div");
      obtainCard.className = "pokemon-info-home-obtainable";

      const obtainLabel = document.createElement("div");
      obtainLabel.className = "pokemon-info-home-label";
      const count = groupData.obtainableGames?.length || 0;
      obtainLabel.textContent = `Available to Catch In (${count} ${count === 1 ? "game" : "games"})`;
      obtainCard.appendChild(obtainLabel);

      if (count > 0) {
        const gamesList = document.createElement("div");
        gamesList.className = "pokemon-info-home-games-list";

        groupData.obtainableGames.forEach((gameTitle) => {
          const tag = document.createElement("span");
          tag.className = "pokemon-info-home-game-tag";
          tag.textContent = typeof gameTitle === "string" ? gameTitle : gameTitle.location;
          gamesList.appendChild(tag);
        });

        obtainCard.appendChild(gamesList);
      } else {
        const empty = document.createElement("div");
        empty.className = "pokemon-info-encounter-note";
        empty.textContent = "Not catchable in any standard game Pokédex (Event / Transfer only).";
        obtainCard.appendChild(empty);
      }

      homeGroup.appendChild(obtainCard);
      encounterEl.appendChild(homeGroup);
      return;
    }

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

    if (groupData.methodNote) {
      const methodEl = document.createElement("div");
      methodEl.className = "pokemon-info-encounter-method-note";
      const icon = document.createElement("span");
      icon.className = "pokemon-info-encounter-method-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = getMethodNoteIcon(groupData.methodNote);
      const text = document.createElement("span");
      text.textContent = groupData.methodNote;
      methodEl.append(icon, text);
      group.appendChild(methodEl);
    }

    if (groupData.locations && groupData.locations.length > 0) {
      const list = createEncounterList(groupData.locations, {
        methodNote: groupData.methodNote,
      });
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
          reverseMethods: step.reverseBreeding ? [`Hold ${step.reverseBreeding.itemName}`] : [],
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
 * Renders the always-visible specimen inventory stepper with a collapsible family quota section.
 *
 * @param {HTMLElement} cardEl - Target container element for the specimen card.
 * @param {Object} data - Modal data containing speciesId, name, familyInfo.
 * @param {HTMLElement|null} sourceCell - Originating dex slot cell element.
 */
function renderSpecimenCard(cardEl, data, sourceCell) {
  if (!cardEl) return;
  const speciesId = data.speciesId;
  const inv = loadSpecimenInventory();
  const caught = isShinyMode ? loadShinyCaughtSlots() : loadCaughtSlots();
  const regionalSlot = sourceCell ? Number(sourceCell.dataset.regional) : null;
  const specimenKey = sourceCell?.dataset?.specimenKey || null;
  const isCaught = specimenKey ? Boolean(caught[specimenKey]) : Boolean(caught[regionalSlot]);

  let currentCount = typeof inv[speciesId] === "number" ? inv[speciesId] : isCaught ? 1 : 0;

  cardEl.hidden = false;
  cardEl.innerHTML = "";

  const container = document.createElement("div");
  container.className = "pokemon-info-specimen-card-inner";

  // Stepper Header / Row
  const stepperRow = document.createElement("div");
  stepperRow.className = "pokemon-info-specimen-stepper-row";

  const labelBlock = document.createElement("div");
  labelBlock.className = "pokemon-info-specimen-label-block";

  const title = document.createElement("span");
  title.className = "pokemon-info-specimen-title";
  title.textContent = "Specimens in PC Box / Bag";

  const subtitle = document.createElement("span");
  subtitle.className = "pokemon-info-specimen-subtitle";
  subtitle.textContent = "Syncs with Living Dex grid & Field Guide";

  labelBlock.append(title, subtitle);

  const stepperControls = document.createElement("div");
  stepperControls.className = "pokemon-info-specimen-stepper-controls";

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.className = "btn-stepper btn-stepper-minus";
  minusBtn.textContent = "−";
  minusBtn.setAttribute("aria-label", `Decrease specimen count for ${data.name}`);

  const countVal = document.createElement("span");
  countVal.className = "pokemon-info-specimen-count";
  countVal.textContent = String(currentCount);

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.className = "btn-stepper btn-stepper-plus";
  plusBtn.textContent = "+";
  plusBtn.setAttribute("aria-label", `Increase specimen count for ${data.name}`);

  stepperControls.append(minusBtn, countVal, plusBtn);
  stepperRow.append(labelBlock, stepperControls);
  container.appendChild(stepperRow);

  // Collapsible Family Quota Section
  let detailsEl = null;
  let quotaBadge = null;
  let quotaSummaryText = null;
  let breakdownContainer = null;

  if (data.familyInfo && Array.isArray(data.familyInfo.familySpecies)) {
    detailsEl = document.createElement("details");
    detailsEl.className = "pokemon-info-family-details";

    const summary = document.createElement("summary");
    summary.className = "pokemon-info-family-summary";

    const summaryLeft = document.createElement("div");
    summaryLeft.className = "pokemon-info-family-summary-left";

    const summaryIcon = document.createElement("span");
    summaryIcon.className = "pokemon-info-family-summary-icon";
    summaryIcon.textContent = "🥚";

    quotaSummaryText = document.createElement("span");
    quotaSummaryText.className = "pokemon-info-family-summary-title";

    summaryLeft.append(summaryIcon, quotaSummaryText);

    quotaBadge = document.createElement("span");
    quotaBadge.className = "pokemon-info-quota-badge";

    summary.append(summaryLeft, quotaBadge);
    detailsEl.appendChild(summary);

    breakdownContainer = document.createElement("div");
    breakdownContainer.className = "pokemon-info-family-breakdown";
    detailsEl.appendChild(breakdownContainer);

    container.appendChild(detailsEl);
  }

  function updateFamilyQuotaDisplay(updatedCount) {
    if (!detailsEl || !data.familyInfo) return;
    const currentInv = { ...loadSpecimenInventory() };
    if (updatedCount > 0) {
      currentInv[speciesId] = updatedCount;
    } else {
      delete currentInv[speciesId];
    }

    const quotaResult = calculateFamilyQuota(
      data.familyInfo.chain,
      data.familyInfo.familySpecies,
      currentInv,
    );

    const isMet = quotaResult.isFulfilled;
    const remaining = quotaResult.baseQuota;
    const totalOwnedInFamily = quotaResult.totalOwned;
    const totalRequired = quotaResult.totalRequired;

    quotaSummaryText.textContent = `Family Quota: ${data.familyInfo.rootName} (${totalOwnedInFamily}/${totalRequired} Owned)`;

    quotaBadge.textContent = isMet ? "Quota Met ✓" : `${remaining} Needed`;
    quotaBadge.classList.toggle("is-met", isMet);

    breakdownContainer.innerHTML = `
      <div class="pokemon-info-family-math">
        <span>Need <strong>${totalRequired}×</strong> specimens across the ${data.familyInfo.rootName} family line:</span>
        <span class="pokemon-info-family-math-sub">(${data.familyInfo.familySpecies.map((m) => m.name).join(" + ")})</span>
        ${
          !isMet
            ? `<span class="pokemon-info-family-math-sub" style="margin-top: 4px; color: var(--text);">Need <strong>${remaining}× ${data.familyInfo.rootName}</strong> (catch/breed) to evolve into remaining missing stages.</span>`
            : `<span class="pokemon-info-family-math-sub" style="margin-top: 4px; color: #16a34a;">You own enough unevolved specimens to complete all remaining evolutions.</span>`
        }
      </div>
    `;
  }

  updateFamilyQuotaDisplay(currentCount);

  async function handleCountChange(delta) {
    const nextCount = Math.max(0, currentCount + delta);
    if (nextCount === currentCount) return;
    currentCount = nextCount;

    const latestInv = loadSpecimenInventory();
    if (currentCount > 0) {
      latestInv[speciesId] = currentCount;
    } else {
      delete latestInv[speciesId];
    }
    saveSpecimenInventory(latestInv);

    const latestCaught = isShinyMode ? loadShinyCaughtSlots() : loadCaughtSlots();
    const targetState = currentCount > 0;

    if (sourceCell) {
      const k = sourceCell.dataset.specimenKey;
      const r = Number(sourceCell.dataset.regional);
      if (k) {
        if (targetState) latestCaught[k] = true;
        else delete latestCaught[k];
      } else if (r) {
        if (targetState) latestCaught[r] = true;
        else delete latestCaught[r];
      }
    } else {
      if (targetState) latestCaught[speciesId] = true;
      else delete latestCaught[speciesId];
    }

    if (isShinyMode) saveShinyCaughtSlots(latestCaught);
    else saveCaughtSlots(latestCaught);

    const matchingCells = document.querySelectorAll(`.cell[data-national='${speciesId}']`);
    matchingCells.forEach((c) => {
      c.classList.toggle("caught", targetState);
      c.setAttribute("aria-pressed", String(targetState));
      updateCellSpecimenBadge(c, currentCount);
    });

    countVal.textContent = String(currentCount);
    updateFamilyQuotaDisplay(currentCount);

    const slotCount = document.querySelectorAll(".cell:not(.is-placeholder)").length;
    updateProgressBar(slotCount);
    updateMissingGuideBadge(slotCount);
    applyHideCaughtFilter();
  }

  minusBtn.addEventListener("click", () => handleCountChange(-1));
  plusBtn.addEventListener("click", () => handleCountChange(1));

  cardEl.appendChild(container);
}

/**
 * Fetch and display info for a Pokémon in the info modal.
 * Uses local database to avoid redundant API calls and parse operations.
 *
 * @param {number} speciesId - National Pokédex species ID.
 * @param {number} formId - Pokémon form ID or sprite ID.
 * @param {string} name - Species/form display name.
 * @param {string} [gender=""] - Gender variant ('female' or '').
 * @param {string} [formName=""] - Explicit form name if available.
 * @param {number|string} [spriteId=""] - Explicit sprite ID if different from formId.
 * @param {HTMLElement|null} [sourceCell=null] - Originating dex slot cell element.
 * @returns {Promise<void>}
 */
export async function openPokemonInfoModal(
  speciesId,
  formId,
  name,
  gender = "",
  formName = "",
  spriteId = "",
  sourceCell = null,
) {
  const modal = document.getElementById("modalPokemonInfo");
  if (!modal) return;

  const displayName = formName || name;
  const titleEl = document.getElementById("pokemonInfoTitle");
  const numberEl = document.getElementById("pokemonInfoNumber");
  const spriteEl = document.getElementById("pokemonInfoSprite");
  const typesEl = document.getElementById("pokemonInfoTypes");
  const flavorEl = document.getElementById("pokemonInfoFlavor");
  const specimenCardEl = document.getElementById("pokemonInfoSpecimenCard");
  const encounterEl = document.getElementById("pokemonInfoEncounter");
  const encounterLabelEl = document.getElementById("pokemonInfoEncounterLabel");
  const evoEl = document.getElementById("pokemonInfoEvo");
  const bodyEl = document.getElementById("pokemonInfoBody");
  const loadingEl = document.getElementById("pokemonInfoLoading");
  const errorEl = document.getElementById("pokemonInfoError");

  const spriteStyle = loadSettings().spriteStyle || "pokesprites";
  const targetSpriteId = gender === "female" ? speciesId : spriteId || formId;
  const primarySpriteUrl = spriteUrlForSpecies(targetSpriteId, spriteStyle, isShinyMode, gender);
  const fallbackSpriteUrl = spriteUrlForSpecies(speciesId, spriteStyle, isShinyMode);

  stopCurrentAudio();
  const cryBtn = document.getElementById("pokemonInfoCryBtn");
  if (cryBtn) {
    cryBtn.onclick = () => {
      playPokemonCry(speciesId, displayName);
    };
    cryBtn.setAttribute("aria-label", `Play cry for ${displayName}`);
  }

  // Immediate placeholder state
  titleEl.textContent = displayName;
  const showCoords = !!loadSettings().showBoxCoordinates;
  const coordSuffix =
    showCoords && sourceCell?.dataset?.boxCoord ? ` · ${sourceCell.dataset.boxCoord}` : "";
  numberEl.textContent = `#${speciesId}${coordSuffix}`;
  spriteEl.decoding = "async";
  spriteEl.crossOrigin = "anonymous";
  spriteEl.style.opacity = "";
  spriteEl.dataset.fallback = fallbackSpriteUrl;
  spriteEl.onerror = function onModalSpriteError() {
    if (this.dataset.fallback && this.src !== this.dataset.fallback) {
      this.src = this.dataset.fallback;
    } else {
      this.style.opacity = "0.2";
    }
  };
  spriteEl.src = primarySpriteUrl;
  spriteEl.alt = displayName;
  typesEl.innerHTML = "";
  flavorEl.textContent = "";
  if (specimenCardEl) {
    specimenCardEl.innerHTML = "";
    specimenCardEl.hidden = true;
  }
  encounterEl.innerHTML = "";
  evoEl.innerHTML = "";
  const scrollEl = document.getElementById("pokemonInfoScroll");
  if (scrollEl) scrollEl.scrollTop = 0;
  if (evoEl) evoEl.scrollTop = 0;
  bodyEl.scrollTop = 0;
  bodyEl.hidden = true;
  errorEl.hidden = true;
  loadingEl.hidden = false;

  updateNavigationButtons(sourceCell, speciesId, formId, gender);

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

    if (specimenCardEl) {
      renderSpecimenCard(specimenCardEl, data, sourceCell);
    }

    if (data.showEncounters) {
      renderEncounterDetails(encounterEl, data.encounterGroups);
    }

    renderEvolutionDetails(evoEl, data.evolutionPaths, spriteStyle);

    loadingEl.hidden = true;
    bodyEl.hidden = false;
  } catch (err) {
    console.error("Error loading pokemon info modal", err);
    loadingEl.hidden = true;
    errorEl.textContent = "Could not load Pokémon info. Check your connection and try again.";
    errorEl.hidden = false;
  }
}
