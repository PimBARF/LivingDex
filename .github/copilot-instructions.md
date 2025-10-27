# Copilot Instructions for Pokedex Tracker

## Project Overview
This is a client-side web app for tracking a "Living Dex" across multiple Pokémon games. The app is a single-page application built with vanilla JavaScript, HTML, and CSS. It does not use any frameworks or build tools.

## Architecture & Data Flow
- **Main entry:** All logic is in `app.js`, loaded by `index.html`.
- **Multi-Dex System:** The app supports multiple Pokédexes (e.g., `za` for Legends: Z-A, `national` for National Dex). Configuration is in the `DEXES` object at the top of `app.js`. Each dex defines `title`, `order` (species array), `slotCount`, and `storagePrefix`.
- **Dex Selection:** URL param `?dex=za` selects the active dex (defaults to `za`). The `CONFIG` constant holds the current dex config.
- **UI Structure:** The app dynamically renders boxes (30 slots each) and cells representing Pokémon slots. The DOM is manipulated directly via JS.
- **State Management:** Caught Pokémon are tracked in localStorage with per-dex keys (e.g., `za-caught-v1`, `national-caught-v1`). Theme preference is global (`theme-v1`).
- **Species Data:** The order and count of tracked Pokémon come from `CONFIG.order` and `CONFIG.slotCount`, derived from the `DEXES` object.
- **Sprites & Names:** Sprites are loaded from PokeAPI's GitHub CDN. Names are fetched from PokeAPI with intelligent caching (per-dex cache keys, 180-day TTL, cache invalidation on dex list changes).
- **Sharing:** Caught state can be encoded/decoded into a URL hash (`#s=...`) for sharing progress via bitpacked binary.

## Developer Workflows
- **No build step:** All files are static. Open `index.html` in a browser to run.
- **Debugging:** Use browser DevTools. Console assertions in `app.js` provide regression checks for share encoding.
- **Testing:** No formal test suite; manual regression via the self-check IIFE in `app.js`.
- **Styling:** Theme tokens and responsive layout are in `styles.css`. Theme toggling is handled via a data attribute on `<html>`.
  - CSS variables in `:root` define light theme (default)
  - `[data-theme="dark"]` selector overrides for dark mode
  - Key tokens: `--bg`, `--text`, `--card`, `--border`, `--accent` (yellow brand), `--accent-2` (blue interactive)
  - Theme applied via `document.documentElement.dataset.theme = 'dark'|'light'`

## Project-Specific Patterns
- **DOM Manipulation:** All UI updates are direct DOM changes, not via frameworks.
- **Concurrency:** Species name hydration uses `mapWithConcurrency()` helper (default 10 concurrent requests, configurable via `NAME_FETCH_CONCURRENCY`).
- **Smart Caching:** Species names are cached per-dex with TTL + hash-based invalidation. Cache is rebuilt only when stale (180 days old) or when the species list changes.
- **Accessibility:** ARIA attributes (`aria-pressed`, `aria-live`, `aria-label`), keyboard navigation, and focus trapping in modals.
- **Box Controls:** Each box (30 slots) has "Mark all caught" and "Clear box" buttons for bulk operations.
- **Search & Filter:** Search by name/number (supports `#42`, `42`, or `eevee`). "Show uncaught only" toggle hides caught cells via CSS class.
- **Modal Dialogs:** Reset confirmation modal with focus trap, keyboard nav, and backdrop click handling.
- **Toast Notifications:** Success/warning/danger toasts for user feedback (e.g., link copied, errors).

## Integration Points
- **External APIs:**
  - PokeAPI for species names and sprites
  - Browser localStorage for persistence
  - Clipboard API for sharing links

## Conventions
- **No external dependencies** (no npm, no package.json)
- **All logic in a single JS file** (`app.js`)
- **Static assets only**
- **No backend/server code**

## Key Files
- `app.js`: All application logic
- `index.html`: App shell and UI structure
- `styles.css`: Theme and layout

## Example: Adding a Feature
To add a new filter or UI control:
- Update `index.html` to add the control
- Add event listeners and logic in `app.js`
- Style in `styles.css` if needed

### Adding a New Dex
1. Add entry to `DEXES` object in `app.js` with unique key:
   ```js
   scarlet: {
     title: 'Pokémon Scarlet/Violet',
     order: [1, 2, 3, ...],  // array of National Dex IDs
     slotCount: 400,
     storagePrefix: 'scarlet'
   }
   ```
2. Users navigate via `?dex=scarlet` URL param
3. Storage/cache keys auto-namespace per `storagePrefix`

---
If any section is unclear or missing, please ask for clarification or provide feedback to improve these instructions.
