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

import {
    renderDexSectionBoxes,
    populateDexSlots,
    registerBoxControls,
    applySpriteStyleToCells,
    applyNamesToCells,
} from './ui/dom-render.js';

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