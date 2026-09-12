# LivingDex Frontend PWA - Agent Rules 📜

These rules apply when developing and modifying the **LivingDex** frontend Progressive Web App.

---

## 1. Service Worker & Cache Lifecycle (`sw.js`)

Whenever any changes are made to the frontend application:

- **Bump `CACHE_VERSION`**: Update `const CACHE_VERSION = "vX.Y.Z";` at the top of `sw.js` (matching the version in `CHANGELOG.md`).
  - This is critical so the service worker activates the new cache tier and triggers the in-app update banner for users.
- **Update `SHELL_ASSETS`**: If any new files (JS modules, CSS, icons, fonts, etc.) are added or removed, ensure the `SHELL_ASSETS` array in `sw.js` is kept in sync.
- **Offline Integrity**: Ensure all newly introduced assets or fetch calls have offline fallback strategies or are properly handled by the caching tiers (`SHELL_CACHE`, `DATA_CACHE`, `SPRITE_CACHE`).

---

## 2. Changelog Maintenance (`CHANGELOG.md`)

For every new feature, bug fix, refactor, or dataset update in LivingDex:

- **Update `CHANGELOG.md`**:
  - Add or update the version entry under `## [vX.Y.Z] - YYYY-MM-DD`.
  - Update the top `## 📑 Release Timeline` summary table with the version anchor link, release date, and key highlights.
  - Categorize changes using standard sections: `### Added`, `### Changed`, `### Fixed`, `### Removed`.

---

## 3. Architecture & Code Conventions

- **Zero-Build Vanilla JS**:
  - Keep the app 100% buildless. It must run directly by opening `index.html` or via any static file server (`python -m http.server 8080`).
  - No build tools (Vite, Webpack, Babel) or runtime framework dependencies.
  - All ES module imports must use explicit relative paths and file extensions (e.g., `import { state } from './state.js';`).
- **State & Storage Backward Compatibility**:
  - Never introduce breaking changes to `localStorage` or `IndexedDB` schemas without providing defensive fallbacks and automatic migrations in `js/storage.js` and `js/db.js`.
  - Any new user settings or state flags must include sensible default values.
- **Sprite Fallbacks & Image Resilience**:
  - Dynamic sprite images (`<img>`) must handle load errors gracefully (e.g., `onerror` fallback to standard species sprite if variant, gender, or shiny asset is absent).
- **Modals, Focus & Keyboard Shortcuts**:
  - Maintain focus traps and `Escape` key handlers on all modals.
  - Avoid shortcut collisions with global hotkeys (`/`, `Space`, `S`, `M`, `H`, `[`, `]`, `?`).
- **CSS Design System & Theme Support**:
  - Use custom CSS variables defined in `styles.css` (`--bg-primary`, `--card-bg`, `--accent`, etc.) to ensure seamless dark and light theme rendering.
