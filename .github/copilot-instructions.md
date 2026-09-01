# Copilot Instructions for LivingDex.app

## Project Overview

**LivingDex.app** is a fast, modern, privacy-first, offline-capable Living Pokédex tracker for all main-series Pokémon games (Generation 1 through Gen 9 / HOME / Legends / DLC expansions / regional forms / shiny checklists).

### Core Philosophy
- **Zero external frameworks or bundlers:** Pure vanilla JavaScript (ES modules), HTML5, and CSS3. No React, Vue, TypeScript, Tailwind, Vite, Webpack, or npm dependencies.
- **Privacy-first & client-side only:** No backend, database, accounts, or telemetry. All user progress is stored locally in `localStorage` and encoded in shareable URL hashes.
- **Offline-first PWA:** Service Worker (`sw.js`) with multi-tier caching (App Shell, local pre-compiled JSON datasets, and sprite caches).
- **Fast & lightweight:** Pre-compiled local JSON datasets in `data/` eliminate runtime external API dependencies.

---

## Repository Structure & Architecture

```
.
├── index.html                 # App shell, semantic layout, dialog modals, JSON-LD metadata
├── styles.css                 # Theme tokens (light/dark/auto), responsive grid, box layouts, animations
├── manifest.json              # PWA Web App Manifest
├── sw.js                      # Service Worker (multi-tier caching: Shell, Data, Sprites)
├── sitemap.xml & llms.txt     # SEO & AI search discoverability
├── assets/                    # Favicon, PWA icons (192/512), and self-hosted Inter variable fonts
├── data/                      # Pre-compiled static JSON datasets (zero runtime API calls for dex data)
│   ├── species.json           # Master species database (IDs, names, types, forms, gender diffs, sprite keys)
│   ├── evolutions.json        # Evolution chain hierarchies and trigger requirements
│   ├── flavor/<lang>.json     # Pokédex flavor text by language (en, de, es, fr, it, ja, ko, zh, etc.)
│   ├── names/<lang>.json      # Localized Pokémon species names by language
│   ├── games/
│   │   ├── dex/<gameId>.json  # Game-specific Pokédex rosters, orderings, and segment definitions
│   │   └── encounters/<id>.json # Wild encounter locations, methods, rates, and version exclusives
│   └── schema/*.schema.json   # JSON Schemas validating datasets
└── js/                        # Modular ES6+ JavaScript
    ├── main.js                # App bootstrap, coordinator of initialization, hash routing, global events
    ├── config.js              # Game configurations, segment definitions, sprite URLs, storage keys
    ├── db.js                  # In-memory cached dataset accessors, species/encounter/evolution queries
    ├── state.js               # Reactive caught state, shiny mode toggle, progress calculations, sync
    ├── storage.js             # LocalStorage CRUD, schema versioning, bit-packed base64url share encoding
    ├── pwa.js                 # Service Worker lifecycle registration and sprite offline cache manager
    └── ui/                    # Modular UI renderers and event controllers
        ├── dom-render.js      # Box and cell grid DOM rendering, slot population, sprite assignment
        ├── controls.js        # Search input, hide-caught toggle, sort controls, scroll-to-top, share
        ├── modals.js          # Settings modal, Reset modal, Share modal, dialog focus traps, toasts
        ├── pokemon-info.js    # Pokémon detail dialog/drawer (stats, encounters, evolutions, flavor text)
        └── theme.js           # Light/dark/auto theme engine (`data-theme`) and reduced motion preferences
```

---

## Data Flow & State Architecture

1. **Initialization (`js/main.js`):**
   - Reads user settings from `localStorage` via `js/storage.js` and applies theme (`js/ui/theme.js`).
   - Determines active game from URL query parameter (`?game=<id>`, defaults to `home`).
   - Retrieves enabled segments for the game via `js/storage.js` (or default configuration from `js/config.js`).
   - Compiles active Pokédex sections via `js/db.js` (`buildActiveDexSections()`), querying local datasets in `data/`.
   - Renders the box grid via `js/state.js` -> `js/ui/dom-render.js`.
   - Asynchronously loads localized Pokémon names (`loadSpeciesNames()`) and updates rendered cells.
   - Evaluates URL hash (`#s=...`) for shared caught checklist state.

2. **Tracking & State Mutations (`js/state.js` & `js/storage.js`):**
   - Caught status is tracked per living dex slot (1-indexed).
   - Normal mode: Stored in localStorage under `${storagePrefix}-caught-v1`.
   - Shiny mode: Stored in localStorage under `${storagePrefix}-shiny-caught-v1`.
   - When a slot is toggled, `saveCaughtSlots()` / `saveShinyCaughtSlots()` persists the state and `updateProgressBar()` recalculates progress percentage.

3. **Share Links (Bit-Packing):**
   - Caught states are encoded into bit-packed byte arrays and serialized into base64url hashes (`#s=<base64url>`).
   - Includes segment header checksums to verify compatibility when sharing across different segment configurations.

4. **Offline Caching & PWA (`sw.js` & `js/pwa.js`):**
   - `SHELL_CACHE`: Core app shell files (`index.html`, `styles.css`, `js/**/*.js`, fonts, icons).
   - `DATA_CACHE`: Pre-cached static JSON datasets (`data/**/*.json`).
   - `SPRITE_CACHE`: Dynamic cache for sprite images fetched from external CDNs, with support for batch pre-downloading via the settings dialog.

---

## Key Conventions & Coding Standards

### 1. Zero External Dependencies
- **Do not introduce npm packages, bundlers, transpilers, or UI frameworks.**
- Use modern standard Web APIs: `fetch()`, `<dialog>`, `CSS Grid/Flexbox`, `localStorage`, `matchMedia`, `history.pushState` / `URLSearchParams`.

### 2. Native ES Modules
- All JS files are ES modules loaded via `<script type="module" src="js/main.js">`.
- Always use explicit `.js` extensions in relative imports:
  ```javascript
  import { ACTIVE_GAME } from "./config.js";
  import { showToast } from "./ui/modals.js";
  ```

### 3. DOM & UI Guidelines
- Keep UI logic cleanly separated inside `js/ui/`.
- Use template literals and direct DOM manipulation with `DocumentFragment` where batching creates performance wins.
- Leverage Event Delegation on container elements (`.boxes-container`, `.modal-container`) rather than binding listeners to hundreds of individual cells.
- Use `loading="lazy"` on sprite `<img>` elements.
- Never use inline `onclick` or inline style attributes for interactive state; use CSS classes and event listeners.

### 4. Accessibility (a11y)
- Use semantic HTML landmarks (`<header>`, `<main>`, `<section>`, `<nav>`, `<dialog>`).
- Interactive modal dialogs must manage focus (trap focus inside dialog when open, restore focus to trigger button on close).
- Ensure all interactive elements have accessible names via `aria-label`, `aria-labelledby`, or visible text.
- Respect user motion preferences: inspect `prefers-reduced-motion` and toggle animations using `.reduced-motion` / CSS variables.

### 5. Styling & Themes
- All design tokens, colors, spacings, and surfaces are defined as CSS Custom Properties in `styles.css` under `:root` and `[data-theme="dark"]`.
- Theme is switched by updating `document.documentElement.dataset.theme = 'light' | 'dark'`.
- Responsive breakpoints: Desktop multi-column grid (`minmax(280px, 1fr)`), tablet (2 columns), and mobile single-column box layout.

### 6. Datasets & Schemas
- Master data resides in `data/*.json` and must adhere to the JSON Schemas in `data/schema/*.schema.json`.
- When adding or modifying game dexes:
  - Add game configuration to `GAMES` in `js/config.js`.
  - Add game roster JSON in `data/games/dex/<gameId>.json`.
  - Add wild encounters in `data/games/encounters/<gameId>.json`.

---

## Developer Workflow

- **Run locally:** No build step required. Run any static HTTP server from the root directory:
  ```bash
  python3 -m http.server 8080
  # or
  npx serve .
  ```
  Open `http://localhost:8080` in any modern web browser.
- **Testing & Validation:**
  - Check browser DevTools console for warnings or unhandled exceptions.
  - Verify PWA service worker lifecycle in DevTools Application tab.
  - Test with various `localStorage` states and URL parameters (`?game=sv`, `?game=swsh`, etc.).
  - Verify dark/light theme switching and screen reader accessibility.