# Copilot Instructions for LivingDex.app

## Project overview

LivingDex is a static, privacy-first Pokémon Living Dex tracker. It is a browser-only PWA built with vanilla JavaScript, HTML, and CSS; there is no backend and no build pipeline. The app pulls from local JSON datasets and stores per-user progress in browser storage.

Key goals:

- Keep the app fast, offline-capable, and dependency-free.
- Store tracker state locally in the browser instead of a remote database.
- Support layered Pokédex segments, game variants, HOME layouts, and shareable state links.
- Keep the code modular and easy to reason about without framework tooling.

## Repository shape

```text
.
├── index.html
├── styles.css
├── sw.js
├── manifest.json
├── CHANGELOG.md
├── README.md
├── assets/
├── data/
│   ├── species.json
│   ├── evolutions.json
│   ├── names/
│   ├── flavor/
│   ├── games/
│   └── schema/
├── js/
│   ├── main.js
│   ├── config.js
│   ├── db.js
│   ├── layout.js
│   ├── state.js
│   ├── storage.js
│   ├── pwa.js
│   └── ui/
├── sitemap.xml
├── llms.txt
├── LICENSE
└── .github/
```

## Live project conventions

### 1. Zero-build frontend

- Do not add a bundler, framework, or npm dependency to the frontend.
- Keep this repo as plain ES modules loaded directly by the browser.
- Use explicit relative imports with `.js` extensions, for example:
  ```js
  import { loadSettings } from "./storage.js";
  import { renderGameSelector } from "./ui/controls.js";
  ```
- Prefer native browser APIs such as `fetch`, `URLSearchParams`, `localStorage`, `matchMedia`, and DOM APIs.

### 2. App lifecycle and startup flow

The main startup sequence is centered in `js/main.js` and works like this:

1. Set titles and render header/game controls.
2. Load persisted settings and apply theme/reduced-motion preferences.
3. Register UI listeners and modal handlers.
4. Build the active dex sections from the selected game and enabled segments.
5. Rebuild the dex view and load localized species names.
6. Apply saved view settings such as hidden-caught behavior and sprite style.
7. Update the progress bar and evaluate any shared state hash.

This means any new feature should fit into this lifecycle rather than bypassing it.

### 3. Data model and storage

- The app is data-driven from `data/*.json` plus game-specific data under `data/games/`.
- User progress is stored locally in browser storage through `js/storage.js`.
- Shared checklist state is encoded into URL hash state; any change to hash format should be treated as a compatibility concern.
- Keep schema changes backward-compatible unless the change is intentionally breaking and documented.

### 4. UI and accessibility rules

- Keep UI logic separated into `js/ui/` modules.
- Use event delegation where practical rather than many one-off listeners.
- Accessible modal behavior is expected: focus management, dialog semantics, keyboard close behavior, and sensible labels.
- Keep theme tokens in `styles.css`; do not hard-code colors in ad hoc places.
- Respect reduced-motion preferences; avoid adding motion-heavy interactions that ignore user settings.

### 5. Offline and PWA rules

- The service worker lives in `sw.js` and is the source of cache versioning.
- When any frontend code, CSS, HTML, asset, or dataset changes, update the service worker cache version and keep `SHELL_ASSETS` aligned with the actual app shell.
- If a new file is added or removed from the shell, update the service worker asset list.
- Do not rely on external runtime APIs for core data. The app expects local datasets to be available in the browser.

## Required workflow and release expectations

### Local development

Use a static file server from the project root:

```bash
cd LivingDex
python3 -m http.server 8080
```

Then open `http://localhost:8080` in a browser.

### Changelog and versioning

- Follow the repository semantic versioning rules in the workspace AGENTS.
- Update `CHANGELOG.md` for meaningful app changes.
- When shipping a frontend change, coordinate the service-worker cache version with the version listed in the changelog.

### Safe coding practices

- Prefer small, targeted module changes over broad rewrites.
- Preserve existing storage compatibility and theme logic.
- If the change affects game/dex configuration, verify both the UI behavior and dataset ordering.
- Do not introduce framework patterns or build tooling where the app is intentionally static.

## Files to check first for implementation details

- `js/main.js` for startup and initialization flow
- `js/config.js` for game and segment definitions
- `js/db.js` for dataset loading and section building
- `js/state.js` for progress and dex state updates
- `js/storage.js` for persisted settings and share-state behavior
- `js/ui/modals.js` for feature controls and settings UX
- `sw.js` for cache versioning and offline assets
- `README.md` for product features and expected UX
- `AGENTS.md` for repo-wide rules and release expectations

## What to avoid

- Do not add build steps or framework dependencies.
- Do not bypass `localStorage` conventions or silently break user data compatibility.
- Do not leave service worker cache metadata stale.
- Do not add UI logic in ad hoc script blocks outside the modular structure.
- Do not remove or rename modules without updating imports and related behavior.
