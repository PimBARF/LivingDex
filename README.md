# LivingDex.app ✨

A clean, modern Pokédex tracker designed for organizing Living Dexes across every Pokémon game and region.

It’s a lightweight static web app: no login, no backend, and no build step. Just open the site in a browser and start tracking.

---

## ✨ What it does

- **PC Box Organization**: Displays Pokémon in 30-slot boxes matching in-game storage layout.
- **Box Completion & Ergonomics**:
  - Live caught counters per box (`X/30`).
  - Celebratory completion styling when all 30 slots are caught.
  - One-tap bulk toggling with `✓ All` / `✗ All`.
  - Smooth collapsible boxes (`▲` / `▼`) with optional persistent memory and smart auto-collapsing.
- **Custom In-Game Box Labels**: Tap any box title to rename it to match your in-game boxes (e.g. _“Box 1: Starters”_), with a 1-click reset in Settings.
- **Detailed Pokémon Info & Cries**:
  - Tap the info icon on any Pokémon to view types, Pokédex flavor text, evolution triggers, and in-game encounter locations.
  - Play official in-game Pokémon audio cries directly inside the modal.
- **Shiny Tracking Mode**: 1-click toggle (`✨` or press `S`) to track Shiny Living Dexes independently.
- **Filters & Search**:
  - Instant search by Pokémon name or Pokédex number (`/`).
  - 3-way status filter: `[ All │ Uncaught │ Caught ]` (press `H`).
  - 18 Pokémon type filter chips for single and dual-type filtering.
- **Keyboard Shortcuts**: Full power-user navigation (`/`, `Space`, `S`, `H`, `[`, `]`, `?`).
- **Data Privacy & Backups**:
  - 100% offline-ready Progressive Web App (PWA).
  - All data is stored privately in your browser’s `localStorage`.
  - Export and import your progress anytime as downloadable JSON backups with granular import review.
- **Multi-Language Support**: Species names localized in English, Japanese, French, Spanish, German, Italian, Korean, and Simplified Chinese.

---

## 🚀 Quick start

1. Download or clone this repo:
   ```bash
   git clone https://github.com/PimBARF/LivingDex.git
   ```
2. Open `index.html` directly in your browser.

Or run a lightweight local server:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

---

## ⌨️ Keyboard Shortcuts

| Key               | Action                                              |
| :---------------- | :-------------------------------------------------- |
| `/`               | Focus search bar                                    |
| `Space` / `Enter` | Toggle caught status on focused Pokémon             |
| `S`               | Toggle Shiny tracking mode                          |
| `H`               | Cycle status filter (_All_ → _Uncaught_ → _Caught_) |
| `[` / `]`         | Jump to previous / next storage box                 |
| `?`               | Open keyboard shortcuts cheat-sheet                 |
| `Escape`          | Close active modal or cancel box renaming           |

---

## 📁 Project structure

- `index.html` — App shell and UI structure
- `styles.css` — Modern responsive styles, theme tokens, and animations
- `manifest.json` & `sw.js` — PWA service worker with multi-tier caching
- `data/` — Pre-compiled local datasets (species, master evolutions, flavor text, game dexes, game evolutions, and encounters)
- `js/` — Modular ES application logic:
  - `config.js` — Game, segment, and dex definitions
  - `db.js` — Dataset queries and data access
  - `state.js` — State management and UI synchronization
  - `storage.js` — LocalStorage helpers, settings, and backup serialization
  - `pwa.js` — Service worker lifecycle and cache controls
  - `ui/theme.js` — Light/dark theme and reduced motion handlers
  - `ui/controls.js` — Header controls, search, and status filtering
  - `ui/dom-render.js` — Dex grid, PC boxes, collapse animations, and inline renaming
  - `ui/modals.js` — Settings, filters, shortcuts, and backup export/import
  - `ui/pokemon-info.js` — Pokémon info modal, evolution trees, encounters, and audio cries
  - `main.js` — Startup initialization

---

## ☕ Support

If you enjoy using LivingDex and want to help support development and hosting:

- [Support on Ko-fi](https://ko-fi.com/pimbarf)

---

## 📄 License

MIT. See [LICENSE](./LICENSE) for details.
