import {
    ACTIVE_GAME,
    ACTIVE_GAME_ID,
    GAMES,
    BOX_CAPACITY,
    getOrderedGameEntries,
    prefersReducedMotion,
    spriteUrlForSpecies,
} from './config.js';

import {
    loadCaughtSlots,
    saveCaughtSlots,
    loadEnabledSegments,
    saveEnabledSegments,
    loadSettings,
    saveSettings,
    clearSpeciesCache,
    clearAllSavedData,
} from './storage.js';

import {
    buildActiveDexSections,
    loadSpeciesNames,
} from './api.js';

import {
    applyTheme,
    applyReducedMotionPreference,
    resolveReducedMotionPreference,
    isMotionReduced,
    syncThemeSettingsRadios,
} from './ui/theme.js';

import {
  attachModalHandlers,
  showSharedLinkWarningModal,
  registerResetControls,
  registerSettingsControls,
} from './ui/modals.js';

import {
  registerHeaderControls,
  registerScrollToTopButton,
  applyHideCaughtFilter,
  applySearchFilter,
} from './ui/controls.js';

import { openPokemonInfoModal } from './ui/pokemon-info.js';

/**
 * Apply persisted view preferences that affect the rendered dex grid.
 * Keeps the hide-caught toggle and sprite style in sync with storage, and
 * refreshes localized names when the selected language changes.
 */
export async function applyPersistedViewSettings({ speciesOrder = [], previousLanguage } = {}) {
  const settings = loadSettings();
  const hideToggle = document.getElementById('toggleUncaught');

  if (hideToggle) {
    hideToggle.checked = !!settings.hideCaughtDefault;
    hideToggle.dispatchEvent(new Event('change'));
  } else {
    applyHideCaughtFilter();
  }

  applySpriteStyleToCells();

  if (speciesOrder.length && previousLanguage !== undefined && previousLanguage !== settings.language) {
    await loadSpeciesNames(speciesOrder);
  }
}

/**
 * Rebuild the dex grid for the current game/segment selection.
 * Centralizes the app render flow so it can be reused in multiple actions.
 */
export function rebuildDexView({ sections, slotCount }) {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = '';
  if (!sections.length) {
    app.innerHTML = `
      <section class="box app-empty-state" role="status" aria-live="polite">
        <h2>Pokédex data unavailable</h2>
        <p>The dex could not be loaded yet. Please check your connection and try again.</p>
      </section>
    `;
    updateProgressBar(0);
    applyHideCaughtFilter();
    return;
  }

  let startGlobal = 1;
  for (const sec of sections) {
    renderDexSectionBoxes(app, sec.key, sec.title, sec.entries.length, startGlobal);
    startGlobal += sec.entries.length;
  }

  populateDexSlots(sections, slotCount);
  registerBoxControls(slotCount);
  updateProgressBar(slotCount);
  applyHideCaughtFilter();
}

/**
 * Display a toast notification with automatic dismissal.
 * @param {string} message - The message to display
 * @param {string} type - The toast type: 'success', 'warning', or 'danger'
 */
export function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

/**
 * Count how many slots in the living dex have been caught.
 */
export function countCaughtSlots(slotCount) {
  const caught = loadCaughtSlots();
  let total = 0;
  for (let slot = 1; slot <= slotCount; slot += 1) {
    if (caught[slot]) total += 1;
  }
  return total;
}

/**
 * Update progress bar text, width, and page title to reflect current caught total.
 */
export function updateProgressBar(slotCount) {
  const safeSlotCount = Number.isFinite(slotCount) && slotCount > 0 ? slotCount : 0;
  const caught = countCaughtSlots(safeSlotCount);
  const percentage = safeSlotCount > 0 ? Math.round((caught * 100) / safeSlotCount) : 0;
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('progressText');
  if (fill) fill.style.width = `${percentage}%`;
  if (label) label.textContent = `${caught}/${safeSlotCount} caught (${percentage}%)`;
  document.title = `${ACTIVE_GAME.title} — ${caught}/${safeSlotCount}`;
}

/**
 * Sync caught state to storage, UI, and filters.
 * Ensures consistency across all representations.
 */
export function syncCaughtState(caught, slotCount) {
  if (!caught) return;
  saveCaughtSlots(caught);
  document.querySelectorAll('.cell:not(.is-placeholder)').forEach(cell => {
    const slot = Number(cell.dataset.regional);
    const isCaught = !!caught[slot];
    cell.classList.toggle('caught', isCaught);
    cell.setAttribute('aria-pressed', String(isCaught));
  });
  updateProgressBar(slotCount);
  applyHideCaughtFilter();
}

// =============================================================================
// SHARING & ENCODING
// =============================================================================

const SHARE_PAYLOAD_VERSION = 2;

function getShareSegments() {
  return Array.from(loadEnabledSegments()).sort();
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(encoded) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function shareContextMatches(payload, slotCount, segments) {
  if (!payload || payload.version !== SHARE_PAYLOAD_VERSION) return false;
  if (payload.gameId !== ACTIVE_GAME_ID || payload.slotCount !== slotCount) return false;
  const expectedSegments = [...segments].sort();
  const payloadSegments = Array.isArray(payload.segments) ? [...payload.segments].sort() : [];
  return expectedSegments.length === payloadSegments.length
    && expectedSegments.every((segment, index) => segment === payloadSegments[index]);
}

export function encodeCaughtState(caught, slotCount) {
  try {
    // 1) Bit-pack caught slots into bytes
    const bytes = new Uint8Array(Math.ceil(slotCount / 8));
    for (let slot = 1; slot <= slotCount; slot += 1) {
      if (caught[slot]) {
        const i = slot - 1;
        bytes[i >> 3] |= 1 << (i & 7);
      }
    }

    const payload = JSON.stringify({
      version: SHARE_PAYLOAD_VERSION,
      gameId: ACTIVE_GAME_ID,
      segments: getShareSegments(),
      slotCount,
      bits: bytesToBase64Url(bytes),
    });
    const compressed = window.pako.deflate(new TextEncoder().encode(payload));
    return '#s=' + bytesToBase64Url(compressed);
  } catch (err) {
    console.error('encodeCaughtState error:', err);
    return '';
  }
}


export function decodeCaughtState(hash, slotCount, segments = getShareSegments()) {
  try {
    const match = /#s=([^&]+)/.exec(hash);
    if (!match) return null;

    const compressed = base64UrlToBytes(match[1]);
    const payload = JSON.parse(new TextDecoder().decode(window.pako.inflate(compressed)));
    if (!shareContextMatches(payload, slotCount, segments)) return null;

    const bytes = base64UrlToBytes(payload.bits);
    if (bytes.length !== Math.ceil(slotCount / 8)) return null;

    const caught = {};
    for (let slot = 1; slot <= slotCount; slot += 1) {
      const i = slot - 1;
      caught[slot] = !!(bytes[i >> 3] & (1 << (i & 7)));
    }
    return caught;
  } catch (err) {
    console.error('decodeCaughtState error:', err);
    return null;
  }
}


/**
 * Update species name display on all cells.
 * Applies names from window.__livingDexNames to cell labels and tooltips.
 */
export function applyNamesToCells() {
  document.querySelectorAll('.cell:not(.is-placeholder)').forEach(cell => {
    const national = Number(cell.dataset.national);
    const regional = Number(cell.dataset.regional);
    const name = window.__livingDexNames?.[national] || cell.dataset.name || `#${national}`;
    cell.dataset.name = String(name).toLowerCase();
    // Keep existing title format using the number shown in the badge
    const indexText = cell.querySelector('.index')?.textContent || String(regional);
    cell.title = `#${indexText} — ${name} (${national})`;
    const label = cell.querySelector('.label');
    if (label) label.textContent = name;
  });
}

// =============================================================================
// DOM RENDERING & BOX MANAGEMENT
// =============================================================================

/**
 * Create shell sections that mirror in-game storage boxes.
 * Each box contains up to BOX_CAPACITY slots.
 */
export function renderDexSectionBoxes(container, sectionKey, sectionTitle, slotsInSection, startGlobalSlot) {
  // Heading for section
  const heading = document.createElement('h2');
  heading.className = 'section-title';
  heading.textContent = sectionTitle;
  container.appendChild(heading);

  const boxCount = Math.ceil(slotsInSection / BOX_CAPACITY);
  for (let boxIndex = 0; boxIndex < boxCount; boxIndex += 1) {
    const localStart = boxIndex * BOX_CAPACITY + 1;
    const localEnd = Math.min((boxIndex + 1) * BOX_CAPACITY, slotsInSection);
    const globalStart = startGlobalSlot + boxIndex * BOX_CAPACITY;
    const globalEnd = Math.min(startGlobalSlot + localEnd - 1, startGlobalSlot + slotsInSection - 1);
    const section = document.createElement('section');
    section.className = 'box';
    section.dataset.section = sectionKey;
    section.innerHTML = `
      <h2>
        <span>${sectionTitle} — #${String(localStart).padStart(3, '0')}–${String(localEnd).padStart(3, '0')}</span>
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
 * Generate an interactive cell representing a single dex slot.
 * Includes sprite, name label, and slot index.
 * @param {number} slotIndex - Global slot index for storage
 * @param {number} speciesId - Species ID for name lookup
 * @param {number} formId - Form ID for sprite (may differ from speciesId for regional forms)
 * @param {string} name - Display name
 * @param {string} displayIndex - Formatted index to show in cell
 */
export function createDexSlot(slotIndex, speciesId, formId, name, displayIndex) {
  const button = document.createElement('button');
  button.className = 'cell';
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  button.dataset.regional = slotIndex;
  button.dataset.national = speciesId;
  button.dataset.form = formId;
  button.dataset.name = name.toLowerCase();
  button.title = `#${displayIndex} — ${name} (${speciesId})`;
  const spriteStyle = loadSettings().spriteStyle || 'pokesprites';
  button.innerHTML = `
    <div class="index">${displayIndex}</div>
    <img class="sprite" src="${spriteUrlForSpecies(formId, spriteStyle)}" alt="${name}" loading="lazy" onerror="this.style.opacity=.2"/>
    <div class="label">${name}</div>
    <span class="cell-info-btn" role="button" aria-label="View info for ${name}" tabindex="0">i</span>
  `;
  return button;
}

/**
 * Refresh the `src` of every rendered sprite image to match the currently
 * selected sprite style setting, without re-building the whole DOM.
 */
export function applySpriteStyleToCells() {
  const spriteStyle = loadSettings().spriteStyle || 'pokesprites';
  document.querySelectorAll('.cell:not(.is-placeholder) img.sprite').forEach(img => {
    const cell = img.closest('.cell');
    const formId = cell?.dataset.form;
    if (!formId) return;
    img.style.opacity = '';
    img.src = spriteUrlForSpecies(formId, spriteStyle);
  });
}

/**
 * Populate all boxes with cells following the configured living dex order.
 * Applies caught state from storage and sets up click handlers.
 */
export function populateDexSlots(sections, slotCount) {
  const caught = loadCaughtSlots();
  let globalSlotIndex = 1; // continuous global slot numbering for storage

  sections.forEach(section => {
    const { key, entries } = section;
    // Select all grids for this section (in order)
    const sectionBoxes = Array.from(document.querySelectorAll(`.box[data-section='${key}'] .grid`));
    let localIndex = 0;
    let boxCursor = 0;
    let slotsPlacedInCurrentBox = 0;

    entries.forEach(entry => {
      const { speciesId, formId } = entry;
      const speciesName = window.__livingDexNames?.[speciesId] || `#${speciesId}`;
      const displayIndex = String(localIndex + 1).padStart(3, '0');
      const cell = createDexSlot(globalSlotIndex, speciesId, formId, speciesName, displayIndex);

      if (caught[globalSlotIndex]) {
        cell.classList.add('caught');
        cell.setAttribute('aria-pressed', 'true');
      }

      cell.onclick = () => {
        const nextCaught = loadCaughtSlots();
        const regionalSlot = Number(cell.dataset.regional);
        const isCaught = !cell.classList.contains('caught');
        cell.classList.toggle('caught', isCaught);
        cell.setAttribute('aria-pressed', String(isCaught));
        nextCaught[regionalSlot] = isCaught;
        saveCaughtSlots(nextCaught);
        updateProgressBar(slotCount);
        applyHideCaughtFilter();
      };

      // Info button: open info modal without toggling caught state
      const infoBtn = cell.querySelector('.cell-info-btn');
      if (infoBtn) {
        const handleInfo = (event) => {
          event.stopPropagation();
          const latestName = window.__livingDexNames?.[speciesId] || speciesName;
          openPokemonInfoModal(speciesId, formId, latestName);
        };
        infoBtn.addEventListener('click', handleInfo);
        infoBtn.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
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
    while (slotsPlacedInCurrentBox > 0 && slotsPlacedInCurrentBox < BOX_CAPACITY) {
      const placeholder = document.createElement('div');
      placeholder.className = 'cell is-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.style.cursor = 'default';
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
 */
export function registerBoxControls(slotCount) {
  document.querySelectorAll('.box').forEach(box => {
    const grid = box.querySelector('.grid');
    const toggleBtn = box.querySelector('.box-toggle');
    if (!toggleBtn) return;

    function interactiveCells() {
      return Array.from(grid.querySelectorAll('.cell:not(.is-placeholder)'));
    }

    function updateToggleBtnLabel() {
      const caught = loadCaughtSlots();
      const cells = interactiveCells();
      const allCaught = cells.every(cell => caught[Number(cell.dataset.regional)]);
      toggleBtn.textContent = allCaught ? 'Unmark all' : 'Mark all';
      toggleBtn.setAttribute('aria-label', `${allCaught ? 'Mark all uncaught' : 'Mark all caught'} in this box`);
    }

    updateToggleBtnLabel();

    toggleBtn.onclick = () => {
      const caught = loadCaughtSlots();
      const cells = interactiveCells();
      const allCaught = cells.every(cell => caught[Number(cell.dataset.regional)]);
      cells.forEach(cell => {
        cell.classList.toggle('caught', !allCaught);
        cell.setAttribute('aria-pressed', String(!allCaught));
        caught[Number(cell.dataset.regional)] = !allCaught;
      });
      saveCaughtSlots(caught);
      updateProgressBar(slotCount);
      applyHideCaughtFilter();
      updateToggleBtnLabel();
    };
  });
}

// =============================================================================
// RESET & MODAL DIALOGS
// =============================================================================

/**
 * Clear all caught slots and reset progress to empty state.
 * Also clears any shared hash state from the URL.
 */
export function resetDexProgress(slotCount) {
  const empty = {};
  saveCaughtSlots(empty);

  document.querySelectorAll('.cell').forEach(cell => {
    cell.classList.remove('caught');
    cell.setAttribute('aria-pressed', 'false');
  });

  // Clear shared hash state from URL
  if (location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
  }

  updateProgressBar(slotCount);
  applyHideCaughtFilter();
}

// =============================================================================
// PAGE INITIALIZATION & BOOTSTRAP
// =============================================================================

/**
 * Populate the game info section with title and segment toggles.
 */
export function renderGameInfo() {
  const titleEl = document.getElementById('gameTitle');
  const togglesEl = document.getElementById('segmentToggles');
  
  if (titleEl) {
    titleEl.textContent = ACTIVE_GAME.title;
  }
  
  if (!togglesEl) return;
  
  togglesEl.innerHTML = '';
  
  const enabled = loadEnabledSegments();
  
  // Create checkboxes for optional segments
  ACTIVE_GAME.dexes.filter(s => s.optional).forEach(seg => {
    const id = `gameinfo-seg-${seg.id}`;
    const wrapper = document.createElement('label');
    wrapper.className = 'segment-toggle';
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.name = id;
    input.checked = enabled.has(seg.id);
    
    const text = document.createElement('span');
    // Always show the configured title for the segment, including forms
    text.textContent = seg.title;
    
    wrapper.appendChild(input);
    wrapper.appendChild(text);
    togglesEl.appendChild(wrapper);
    
    // Add event listener for live updates
    input.addEventListener('change', async () => {
      const currentEnabled = loadEnabledSegments();

      if (input.checked) {
        currentEnabled.add(seg.id);
      } else {
        currentEnabled.delete(seg.id);
      }

      saveEnabledSegments(currentEnabled);

      const { sections, warnings } = await buildActiveDexSections();
      const combinedSpeciesIds = sections.flatMap(s => s.entries.map(e => e.speciesId));
      const newSlotCount = combinedSpeciesIds.length;

      rebuildDexView({ sections, slotCount: newSlotCount });
      if (warnings.length) {
        console.warn('Pokédex sections loaded with warnings:', warnings);
        showToast('Some Pokédex data could not be loaded.', 'warning');
      }

      const nameResult = await loadSpeciesNames(combinedSpeciesIds);
      if (nameResult.failedIds.length) {
        showToast('Some Pokémon names could not be loaded.', 'warning');
      }
    });
  });
}

/**
 * Populate the dex selector dropdown with available games.
 */
export function renderGameSelector() {
  const selector = document.getElementById('dexSelector');
  if (!selector) return;

  const groupedEntries = new Map();
  for (const [key, config] of getOrderedGameEntries()) {
    const groupLabel = config.group === 'special'
      ? 'Special / Other'
      : config.group?.startsWith('gen')
        ? `Generation ${config.group.replace('gen', '')}`
        : 'Other';
    if (!groupedEntries.has(groupLabel)) groupedEntries.set(groupLabel, []);
    groupedEntries.get(groupLabel).push({ key, title: config.title });
  }

  selector.innerHTML = '';
  for (const [groupLabel, entries] of groupedEntries) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = groupLabel;
    entries.forEach(({ key, title }) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = title;
      if (key === ACTIVE_GAME_ID) option.selected = true;
      optgroup.appendChild(option);
    });
    selector.appendChild(optgroup);
  }

  // Handle dex switching
  selector.addEventListener('change', (e) => {
    const newGame = e.target.value;
    if (newGame && newGame !== ACTIVE_GAME_ID) {
      const url = new URL(location.href);
      url.searchParams.set('game', newGame);
      url.hash = '';
      location.href = url.toString();
    }
  });
}

/**
 * Set page titles from active dex config.
 */
export function setGameTitles() {
  const docTitle = document.getElementById('docTitle');
  if (docTitle) docTitle.textContent = ACTIVE_GAME.title;
}