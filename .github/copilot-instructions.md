# Copilot Instructions for LivingDex.app

## Project Overview

- LivingDex.app is a static, single-page web app for tracking a "Living Pokédex" across multiple Pokémon games.
- No frameworks, build steps, or external dependencies. All logic is in vanilla JS, HTML, and CSS.
- Data is stored in localStorage per dex/game; no backend or user accounts.

## Architecture

- **Key files:**
	- `index.html`: App shell, UI structure, modals, and controls.
	- `styles.css`: Theme tokens, layout, and responsive design.
	- `js/config.js`: Game/dex configuration, segment definitions, and mappings.
	- `js/api.js`: PokeAPI integration, species/form resolution, caching, and concurrency.
	- `js/storage.js`: LocalStorage utilities for caught state, species names, and segment toggles.
	- `js/ui.js`: DOM rendering, event handlers, progress bar, modals, and user interactions.
	- `js/main.js`: App bootstrap and initialization.

- **Data flow:**
	- Dex/game selection and segment toggles drive which species/forms are shown.
	- Species lists and names are fetched from PokeAPI, cached for 180 days.
	- Caught state is bit-packed for shareable URLs and stored per-dex.
	- UI updates are direct DOM manipulations; no virtual DOM or state library.

## Developer Workflows

- **Quick start:** Open `index.html` in a browser. No build or install required.
- **Local dev server (optional):** Use `python -m http.server 8080` and open `http://localhost:8080`.
- **Debugging:** Use browser DevTools. All state is in localStorage (see keys in README). Check the browser console for errors.
- **Validation:** Visual/manual; ensure UI updates and no console errors.
- **Cache invalidation:** Clear relevant localStorage keys if dex definitions change.

## Patterns & Conventions

- No external dependencies: Do not introduce frameworks, bundlers, or package managers.
- Direct DOM updates: Use vanilla JS for all UI changes and event handling.
- Accessibility: Use ARIA labels, roles, and keyboard navigation for modals and controls.
- Caching: Use per-dex cache keys for species names and dex lists; invalidate via hash and TTL.
- Share links: Encode caught state in URL hash (`#s=...`) for easy sharing.

## Integration Points

- PokeAPI: All species, forms, and names are fetched from https://pokeapi.co/.
- Sprites: Loaded from PokeAPI's GitHub CDN.

## Adding/Modifying Dexes

- Update `js/config.js` to add new games, segments, or mappings.
- Use PokeAPI Pokédex IDs for new regions.
- Ensure new segments follow the existing structure (base + optional).

## Example Patterns

- Caught state: Stored as `${storagePrefix}-caught-v1` in localStorage.
- Species names: Hydrated and cached via `js/api.js` and `js/storage.js`.
- UI rendering: See `renderDexSectionBoxes` and `populateDexSlots` in `js/ui.js`.
