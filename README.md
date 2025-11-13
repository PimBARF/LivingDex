# LivingDex.app – Living Pokédex Tracker

Track a full “Living Dex” across multiple Pokémon games—fast, offline‑friendly, and privacy‑respecting. This project is a static, single‑page web app with no frameworks and no build step: just open `index.html` in your browser.

• Live site: https://livingdex.app  
• License: MIT


## Features

- Multiple dexes in one UI (Home, Sword/Shield + DLC, Legends: Arceus, Scarlet/Violet, Legends: Z‑A)
- Composite dex segments (base + optional DLC/forms) with simple toggles per game
- Search by name or number (supports `eevee`, `133`, and `#42`)
- “Show uncaught only” filter for quick clean‑up runs
- Per‑box bulk actions (mark all caught / clear box), 30 slots per box like in‑game storage
- Progress bar with live counts; page title reflects progress
- Dark/light theme toggle (remembered across visits)
- Share progress with a compact URL hash you can paste anywhere
- Responsive layout, accessible modals (focus trap, ARIA labels), and keyboard‑friendly controls
- Smart caching of species names (localStorage; 180‑day TTL) and sprites via PokeAPI’s CDN
- No external dependencies, no trackers, no backend—your data stays on your device


## Quick start

1) Download or clone this repo.  
2) Open `index.html` in a modern browser.

That’s it—no build step, package manager, or server required.

Optional local serving (any static server works), for example:

```powershell
# Python (if installed)
python -m http.server 8080

# Then open http://localhost:8080
```


## Using the app

- Pick the game from the dropdown in the header. Some games expose optional “segments” (DLC/forms) you can toggle on/off.
- Click a cell to mark that Pokémon as caught. Use per‑box actions for bulk operations.
- Use search to filter by name or number. Toggle “show uncaught only” to focus on what’s left.
- Toggle the theme with the moon icon; the preference is saved.

Share your progress:

- Use the share button to copy a link containing `#s=...`. Anyone with the link sees your current caught state.  
- Clearing the dex removes the shared state from the URL.


## How it works

This app is built with vanilla JavaScript, HTML, and CSS. There’s no build step; all logic lives in `app.js` and renders the UI dynamically.

- Species ordering comes from PokeAPI’s Pokédex endpoints per game/segment and is cached per‑dex in `localStorage`.
- Regional forms are handled via mappings so the correct artwork and labels appear in regional dexes.
- Caught state is stored per‑dex in `localStorage` and synchronized with the UI.
- Species names are fetched on demand (with concurrency limits) and cached for 180 days with a hash to invalidate when the dex list changes.
- Sprites/artwork are loaded from PokeAPI’s GitHub CDN.


## Configuration and data flow

- All dex configuration lives in `app.js` under the `DEXES` object.
- The active dex is selected via the URL query string: `?dex=KEY` (defaults to `home`).
- Composite dexes define one base segment (always on) plus optional segments (e.g., DLC or regional forms); toggles are persisted.

Current keys (examples):

- `home` – Pokémon Home (National Pokédex subset)
- `swsh` – Sword / Shield (Galar, Isle of Armor, Crown Tundra, plus forms)
- `pla` – Legends: Arceus (Hisui)
- `sv` – Scarlet / Violet (Paldea)
- `za` – Pokémon Legends: Z‑A (Lumiose)

You can jump straight to a dex, e.g.: `index.html?dex=sv`.


## Adding a new dex

All code lives in `app.js`. To add another game/region:

1) Find the PokeAPI Pokédex ID at https://pokeapi.co/api/v2/pokedex/ (e.g., `1` = National, `34` = Legends: Z‑A).  
2) Append an entry to `DEXES` with a unique key:

```js
scarlet: {
	title: 'Pokémon Scarlet/Violet',
	pokedex: 31,           // PokeAPI Pokédex ID
	storagePrefix: 'sv',   // used for localStorage namespacing
	segments: [
		{ key: 'base', title: 'Paldea Pokédex', pokedex: 31, kind: 'base', optional: false },
		{ key: 'forms', title: 'Regional Forms', kind: 'forms', optional: true, manualIds: [] }
	]
}
```

3) Open with `?dex=scarlet` and the species list is fetched and cached automatically.


## Storage and caching

All data is stored locally in your browser’s `localStorage` and namespaced per‑dex:

- Caught map: `${storagePrefix}-caught-v1`
- Dex cache: `${storagePrefix}-pokedex-v1` (and per‑segment caches)
- Segment toggles: `${storagePrefix}-segments-v1`
- Species names: `${storagePrefix}-species-names-v1` with metadata `${storagePrefix}-species-names-meta-v1` (180‑day TTL)
- Theme preference: `theme-v1`

Share links encode your caught state into the URL `#s=...` using a compact bit‑packed format.


## Accessibility

- ARIA labels and roles on interactive elements
- Focus‑trapped, keyboard‑navigable modals (Escape to close, tab wrapping)
- “Reduced motion” respected for certain UI transitions


## Project structure

```
app.js       # All application logic
index.html   # App shell and UI
styles.css   # Theme tokens and layout
CNAME        # Custom domain for GitHub Pages (livingdex.app)
LICENSE      # MIT license
NOTICE       # Notices (if any)
```


## Development tips

- Use your browser’s DevTools—there’s no build system to get in the way.
- Species names hydrate progressively; it’s normal for labels to normalize after a moment on first run.
- If you change dex definitions or suspect stale caches, clear the site’s `localStorage` for the relevant `storagePrefix` keys.


## Data sources and attribution

- Data and species names: https://pokeapi.co/
- Official artwork sprites: https://github.com/PokeAPI/sprites


## Contributing

Issues and pull requests are welcome. Keep in mind the project constraints:

- No external dependencies or build tools
- Single JS file (`app.js`) and static assets only
- Follow the existing coding and UI patterns (direct DOM updates, cache keys, accessibility)

## Future enhancements (ideas / wishlist)

These are intentionally low‑risk, incremental improvements that would still respect the project’s “no build tooling” philosophy:

- Offline manifest / PWA support (optional add‑to‑home, caching sprites)
- Export/import JSON alongside share hash for backups
- Keyboard shortcuts (e.g. arrows to move focus; space to toggle caught)
- Optional “show forms inline” expansion for species with multiple regional forms
- Small stats sidebar (percentage per segment, remaining count)
- Localized names (behind a toggle) using existing PokeAPI language data
- Visual indicator for newly released DLC species when segments are enabled
- Print-friendly summary view (caught list only)
- Optional high‑contrast color mode for accessibility


## License

MIT © 2025 Pim Jong. See [`LICENSE`](./LICENSE) for details.

