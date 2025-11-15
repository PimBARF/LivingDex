import {
    ACTIVE_GAME,
    ACTIVE_GAME_ID,
    GAMES,
    BOX_CAPACITY,
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
} from './storage.js';

import {
    computeActiveSections,
    hydrateSpeciesNames,
} from './api.js';

// Track system color scheme for "auto" theme mode
const SYSTEM_THEME_MQL = window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

function resolveTheme(mode) {
  if (mode === 'auto') {
    return SYSTEM_THEME_MQL && SYSTEM_THEME_MQL.matches ? 'dark' : 'light';
  }
  // Fallback to light/dark if anything unexpected is stored
  return mode === 'dark' ? 'dark' : 'light';
}

/**
 * Apply theme to the document and persist preference.
 * Supports 'light', 'dark', and 'auto' (system preference).
 * - 'mode' is the user choice (stored as-is, including 'auto')
 * - resolved theme ('light' or 'dark') is applied to the DOM
 */
export function applyTheme(mode) {
  const settings = loadSettings();
  const storedMode = mode || settings.theme || 'light';
  const resolved = resolveTheme(storedMode);

  // Store the *selected* mode (can be 'auto')
  saveSettings({ ...settings, theme: storedMode });

  // Apply the effective theme to the document
  document.documentElement.dataset.theme = resolved;

  // Update small header toggle icon
  const button = document.getElementById('themeToggle');
  if (button) {
    // Icon reflects the *current* visible theme:
    // - show moon when light (click to go dark)
    // - show sun when dark (click to go light)
    button.textContent = resolved === 'light' ? '🌙' : '☀️';
  }

  // Keep settings modal radios in sync if it's open
  syncThemeSettingsRadios(storedMode);
}

/**
 * Keep the theme radios in the Settings modal in sync with the stored theme.
 * @param {string} mode - 'light' | 'dark' | 'auto'
 */
function syncThemeSettingsRadios(mode) {
  const settings = loadSettings();
  const value = mode || settings.theme || 'light';
  const radios = document.querySelectorAll('input[name="settingsTheme"]');
  if (!radios.length) return;

  radios.forEach(radio => {
    radio.checked = (radio.value === value);
  });
}

// When the OS theme changes, re-resolve if we're in 'auto'
if (SYSTEM_THEME_MQL) {
  SYSTEM_THEME_MQL.addEventListener('change', () => {
    const settings = loadSettings();
    if (settings.theme === 'auto') {
      applyTheme('auto');
    }
  });
}

/**
 * Toggle visibility of caught slots based on filter checkbox state.
 */
export function applyUncaughtFilter() {
  const toggle = document.getElementById('toggleUncaught');
  const enabled = toggle?.checked;
  document.body.classList.toggle('hide-caught', !!enabled);
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
  const caught = countCaughtSlots(slotCount);
  const percentage = Math.round((caught * 100) / slotCount);
  const fill = document.getElementById('progressFill');
  const label = document.getElementById('progressText');
  if (fill) fill.style.width = `${percentage}%`;
  if (label) label.textContent = `${caught}/${slotCount} caught (${percentage}%)`;
  document.title = `${ACTIVE_GAME.title} — ${caught}/${slotCount}`;
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
  applyUncaughtFilter();
}

// =============================================================================
// SHARING & ENCODING
// =============================================================================

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

    // 2) Compress with pako.deflate
    const compressed = window.pako.deflate(bytes);

    // 3) Convert compressed bytes to binary string for Base64
    let binary = '';
    for (let i = 0; i < compressed.length; i += 1) {
      binary += String.fromCharCode(compressed[i]);
    }

    // 4) Base64 URL-safe + #s= prefix (compressed)
    const base64url = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

    return '#s=' + base64url;
  } catch (err) {
    console.error('encodeCaughtState error:', err);
    return '';
  }
}


export function decodeCaughtState(hash, slotCount) {
  try {
    const match = /#s=([^&]+)/.exec(hash);
    if (!match) return null;

    const encoded = match[1];
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

    // 1) Base64 decode to compressed bytes
    const binary = atob(padded);
    const compressed = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      compressed[i] = binary.charCodeAt(i);
    }

    // 2) Inflate with pako.inflate
    const bytes = window.pako.inflate(compressed);

    // 3) Rebuild caught map from bytes
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
export function renderLivingDexBoxesForSection(container, sectionKey, sectionTitle, slotsInSection, startGlobalSlot) {
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
          <button class="btn box-toggle" data-range="${globalStart}-${globalEnd}"></button>
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
  button.setAttribute('aria-pressed', 'false');
  button.dataset.regional = slotIndex;
  button.dataset.national = speciesId;
  button.dataset.form = formId;
  button.dataset.name = name.toLowerCase();
  button.title = `#${displayIndex} — ${name} (${speciesId})`;
  button.innerHTML = `
    <div class="index">${displayIndex}</div>
    <img class="sprite" src="${spriteUrlForSpecies(formId)}" alt="${name}" loading="lazy" onerror="this.style.opacity=.2"/>
    <div class="label">${name}</div>
  `;
  return button;
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
        applyUncaughtFilter();
      };

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
export function registerBoxActions(slotCount) {
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
      applyUncaughtFilter();
      updateToggleBtnLabel();
    };
  });
}

// =============================================================================
// HEADER CONTROLS & USER INTERACTIONS
// =============================================================================

/**
 * Apply search filter to cells based on query.
 * Supports searching by number (#42, 42) or by name.
 * Highlights matches and dims non-matches.
 */
export function applySearchFilter(query) {
  const trimmed = query.trim().toLowerCase();
  const cells = [...document.querySelectorAll('.cell:not(.is-placeholder)')];
  cells.forEach(cell => cell.classList.remove('highlight', 'dimmed'));
  
  if (!trimmed) return;
  
  let matches = [];
  
  // Match by number (regional or national ID)
  if (/^#?\d+$/.test(trimmed)) {
    const number = Number(trimmed.replace('#', ''));
    matches = cells.filter(cell => {
      const regional = Number(cell.dataset.regional) || NaN;
      const national = Number(cell.dataset.national) || NaN;
      const label = (cell.querySelector('.label')?.textContent || '').trim();
      return regional === number || national === number || label === `#${number}` || label === String(number);
    });
  } else {
    // Match by name
    matches = cells.filter(cell => {
      const name = cell.dataset.name || cell.querySelector('.label')?.textContent || '';
      return name.toLowerCase().includes(trimmed);
    });
  }
  
  if (matches.length) {
    const matchedCells = new Set(matches);
    cells.forEach(cell => {
      if (!matchedCells.has(cell)) cell.classList.add('dimmed');
    });
    matches.forEach(cell => cell.classList.add('highlight'));
    matches[0].scrollIntoView({ 
      behavior: prefersReducedMotion ? 'auto' : 'smooth', 
      block: 'center' 
    });
  }
}

/**
 * Register all header control event listeners.
 * Includes: search, filter, theme toggle, and share button.
 */
export function registerHeaderControls(slotCount) {
  const searchInput = document.getElementById('search');
  const uncaughtToggle = document.getElementById('toggleUncaught');
  const themeToggle = document.getElementById('themeToggle');
  const shareButton = document.getElementById('shareDex');
  const hideCaughtBtn = document.getElementById('hideCaughtBtn');

  const updateHideCaughtUi = () => {
    if (!hideCaughtBtn || !uncaughtToggle) return;
    const checked = !!uncaughtToggle.checked;
    hideCaughtBtn.textContent = checked ? 'Show caught' : 'Hide caught';
    hideCaughtBtn.setAttribute('aria-pressed', String(checked));
  };

  // Search input
  searchInput?.addEventListener('input', event => applySearchFilter(event.target.value));
  
  // Uncaught filter toggle
  uncaughtToggle?.addEventListener('change', () => {
    applyUncaughtFilter();
    updateHideCaughtUi();
  });

  // Hide caught button
  hideCaughtBtn?.addEventListener('click', () => {
    if (!uncaughtToggle) return;
    uncaughtToggle.checked = !uncaughtToggle.checked;
    applyUncaughtFilter();
    updateHideCaughtUi();
  });
  
  // Theme toggle
  themeToggle?.addEventListener('click', () => {
    const settings = loadSettings();
    const currentMode = settings.theme || 'light';
    // Toggle between light and dark (if 'auto', switch to light or dark based on current resolved theme)
    let nextMode;
    if (currentMode === 'auto') {
      const resolved = document.documentElement.getAttribute('data-theme') || 'light';
      nextMode = resolved === 'dark' ? 'light' : 'dark';
    } else {
      nextMode = currentMode === 'dark' ? 'light' : 'dark';
    }
    applyTheme(nextMode);
  });
  
  // Share button
  shareButton?.addEventListener('click', async () => {
    const url = location.origin + location.pathname + location.search + encodeCaughtState(loadCaughtSlots(), slotCount);
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard!', 'success');
    } catch {
      prompt('Copy this link:', url);
      showToast('Manual copy required.', 'warning');
    }
  });

  // Initialize hide caught UI state
  updateHideCaughtUi();

  // Mobile: collapse the search bar after scrolling down a bit
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
  const COLLAPSE_Y = 120; // px scrolled to collapse
  const EXPAND_Y = 60;    // px to expand again (hysteresis)
  const updateSearchCollapse = () => {
    if (!isMobile()) {
      document.body.classList.remove('search-collapsed');
      return;
    }
    if (window.scrollY > COLLAPSE_Y) {
      document.body.classList.add('search-collapsed');
    } else if (window.scrollY < EXPAND_Y) {
      document.body.classList.remove('search-collapsed');
    }
  };

  // Expand when focusing the search input
  searchInput?.addEventListener('focus', () => {
    document.body.classList.remove('search-collapsed');
  });

  window.addEventListener('scroll', updateSearchCollapse, { passive: true });
  window.addEventListener('resize', updateSearchCollapse);
  // Run once on init in case the page loads scrolled
  updateSearchCollapse();
}

/**
 * Register scroll-to-top button behavior.
 * Shows the button after scrolling down a bit and scrolls back smoothly.
 */
export function registerScrollToTopControls() {
  const button = document.getElementById('scrollTop');
  if (!button) return;

  const threshold = 320; // px

  function onScroll() {
    if (window.scrollY > threshold) {
      button.classList.add('is-visible');
    } else {
      button.classList.remove('is-visible');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  button.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  });
}

// =============================================================================
// RESET & MODAL DIALOGS
// =============================================================================

/**
 * Clear all caught slots and reset progress to empty state.
 * Also clears any shared hash state from the URL.
 */
export function resetProgress(slotCount) {
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
  applyUncaughtFilter();
}

/**
 * Show the shared link warning modal and run a callback on confirm.
 * On either confirm or cancel, the URL hash is cleared to avoid re-prompting.
 */
export function showSharedLinkWarningModal(onConfirm) {
  const modal = document.getElementById('modalSharedLink');
  const confirmBtn = document.getElementById('confirmSharedLink');
  const cancelBtn = document.getElementById('cancelSharedLink');
  const backdrop = modal?.querySelector('[data-close]');
  let lastFocus = null;

  if (!modal) {
    // Fallback: if modal missing, just proceed
    try { onConfirm?.(); } catch {}
    return;
  }

  function clearHash() {
    if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function closeModal() {
    modal.hidden = true;
    modal._cleanup?.();
    lastFocus?.focus();
  }

  function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    confirmBtn?.focus();

    function onKeydown(e) {
      if (e.key === 'Escape') { clearHash(); closeModal(); }
      if (e.key === 'Tab') {
        const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    }
    modal.addEventListener('keydown', onKeydown, { once: false });
    modal._cleanup = () => modal.removeEventListener('keydown', onKeydown);
  }

  confirmBtn?.addEventListener('click', () => {
    try { onConfirm?.(); } catch {}
    clearHash();
    closeModal();
  }, { once: true });

  cancelBtn?.addEventListener('click', () => { clearHash(); closeModal(); }, { once: true });
  backdrop?.addEventListener('click', () => { clearHash(); closeModal(); }, { once: true });

  openModal();
}

/**
 * Register reset confirmation modal with focus trap and keyboard navigation.
 * Supports: click confirm/cancel, Escape key, Tab focus wrapping.
 */
export function registerResetControls(slotCount) {
  const openBtn = document.getElementById('resetDex');
  const modal = document.getElementById('modalReset');
  const confirmBtn = document.getElementById('confirmReset');
  const cancelBtn = document.getElementById('cancelReset');
  const backdrop = modal?.querySelector('[data-close]');
  let lastFocus = null;

  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    confirmBtn?.focus();

    // Focus trap for Tab key
    function onKeydown(e) {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab') {
        const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { 
          last.focus(); 
          e.preventDefault(); 
        } else if (!e.shiftKey && document.activeElement === last) { 
          first.focus(); 
          e.preventDefault(); 
        }
      }
    }
    modal.addEventListener('keydown', onKeydown, { once: false });
    modal._cleanup = () => modal.removeEventListener('keydown', onKeydown);
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal._cleanup?.();
    lastFocus?.focus();
  }

  openBtn?.addEventListener('click', openModal);
  confirmBtn?.addEventListener('click', () => { 
    resetProgress(slotCount); 
    closeModal(); 
  });
  cancelBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
}

// =============================================================================
// PAGE INITIALIZATION & BOOTSTRAP
// =============================================================================

/**
 * Populate the game info section with title and segment toggles.
 */
export function populateGameInfo() {
  const titleEl = document.getElementById('gameTitle');
  const togglesEl = document.getElementById('segmentToggles');
  
  if (titleEl) {
    titleEl.textContent = ACTIVE_GAME.title;
  }
  
  if (!togglesEl) return;
  
  togglesEl.innerHTML = '';
  
  const enabled = loadEnabledSegments() || new Set(ACTIVE_GAME.dexes.filter(s => !s.optional).map(s => s.id));
  
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
      const currentEnabled = loadEnabledSegments() || new Set(ACTIVE_GAME.dexes.filter(s => !s.optional).map(s => s.id));
      
      if (input.checked) {
        currentEnabled.add(seg.id);
      } else {
        currentEnabled.delete(seg.id);
      }
      
      saveEnabledSegments(currentEnabled);
      
      // Rebuild UI with new sections
      const app = document.getElementById('app');
      if (app) {
        const sections = await computeActiveSections();
        const combinedSpeciesIds = sections.flatMap(s => s.entries.map(e => e.speciesId));
        const newSpeciesOrder = combinedSpeciesIds;
        const newSlotCount = combinedSpeciesIds.length;
        app.innerHTML = '';
        let startGlobal = 1;
        for (const sec of sections) {
          renderLivingDexBoxesForSection(app, sec.key, sec.title, sec.entries.length, startGlobal);
          startGlobal += sec.entries.length;
        }
        populateDexSlots(sections, newSlotCount);
        registerBoxActions(newSlotCount);
        await hydrateSpeciesNames(newSpeciesOrder);
        updateProgressBar(newSlotCount);
        applyUncaughtFilter();
      }
    });
  });
}

/**
 * Settings modal for enabling/disabling optional segments (DLC, forms) per game.
 */
export function registerSettingsControls() {
  const openBtn = document.getElementById('settingsBtn');
  const modal = document.getElementById('modalSettings');
  const backdrop = modal?.querySelector('[data-close]');
  const closeBtn = document.getElementById('closeSettings');
  let lastFocus = null;

  function attachThemeSettingsHandlers() {
    const radios = modal.querySelectorAll('input[name="settingsTheme"]');
    if (!radios.length) return;

    // Initialize checked state from stored theme
    const settings = loadSettings();
    syncThemeSettingsRadios(settings.theme);

    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          const value = e.target.value; // 'light' | 'dark' | 'auto'
          applyTheme(value);
        }
      }, { once: false });
    });
  }

  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    closeBtn?.focus();

    // Theme radios exist now in DOM, wire them up
    attachThemeSettingsHandlers();
    // Also sync in case theme changed via header toggle since last open
    const settings = loadSettings();
    syncThemeSettingsRadios(settings.theme);

    function onKeydown(e) {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab') {
        const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    }
    modal.addEventListener('keydown', onKeydown, { once: false });
    modal._cleanup = () => modal.removeEventListener('keydown', onKeydown);
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal._cleanup?.();
    lastFocus?.focus();
  }

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
}

/**
 * Populate the dex selector dropdown with available games.
 */
export function populateDexSelector() {
  const selector = document.getElementById('dexSelector');
  if (!selector) return;
  
  selector.innerHTML = '';
  Object.entries(GAMES).forEach(([key, config]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = config.title;
    if (key === ACTIVE_GAME_ID) option.selected = true;
    selector.appendChild(option);
  });
  
  // Handle dex switching
  selector.addEventListener('change', (e) => {
    const newGame = e.target.value;
    if (newGame && newGame !== ACTIVE_GAME_ID) {
      // Redirect to new game with URL parameter
      const url = new URL(location.href);
      url.searchParams.set('game', newGame);
      url.hash = ''; // Clear any shared state
      location.href = url.toString();
    }
  });
}

/**
 * Set page titles from active dex config.
 */
export function setTitles() {
  const docTitle = document.getElementById('docTitle');
  if (docTitle) docTitle.textContent = ACTIVE_GAME.title;
}