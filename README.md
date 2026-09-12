# LivingDex.app ✨

A clean, modern Pokédex tracker designed for organizing Living Dexes across every Pokémon game and region.

It’s a lightweight static web app: no login, no backend, and no build step. Just open the site in a browser and start tracking.

---

## ✨ What it does

- **PC Box Organization**: Displays Pokémon in 30-slot boxes matching in-game storage layout with official `#001-030` box numbering.
- **Box Completion & Ergonomics**:
  - Live caught counters per box (`X/30`).
  - Celebratory completion styling when all 30 slots are caught.
  - One-tap bulk toggling with `✓ All` / `✗ All`.
  - Shift-click range selection and smooth mobile touch-drag painting.
  - Smooth collapsible boxes (`▲` / `▼`) with optional persistent memory and smart auto-collapsing.
- **Floating Box Coordinates HUD**:
  - Real-time cursor-following tooltip indicating box number, row, column, and slot coordinates (e.g., `Box 1 · Row 2, Col 3 · Slot 9`).
  - Toggled anytime in **Settings** (`Show Box Coordinates`).
- **⚙️ Dex Options & HOME Box Layout Presets**:
  - Centralized **Dex Options** modal with Shiny Mode, link sharing, and box organization.
  - **6 HOME Box Sorting Presets** with dynamic detail cards:
    - _Standard Dex (Forms at End)_
    - _Generational Clean (Padded Region Boxes)_
    - _All Forms Inline_
    - _Evolution Lines (Cross-Gen Families)_
    - _Primary Types (18 Boxes)_
    - _Alphabetical (A-Z)_
  - Re-order sections via drag-and-drop (`⋮⋮`) or Move Up/Down buttons (`▲` / `▼`) to match your custom box order.
  - Quick presets for game dexes: _Base Game_, _Base + DLC_, _All Forms_, and _Master (100%)_.
- **Missing Pokémon & Evolution Guide (`M` key)**:
  - Missing Pokémon tracker with encounter locations, raid availability, and version filters.
  - Evolution Family checklist tracking complete evolutionary lineages.
  - Evolution Items shopping list summarizing required evolution stones and items.
- **Custom In-Game Box Labels**: Tap any box title to rename it to match your in-game boxes (e.g. _“Box 1: Starters”_), with a 1-click reset in Settings.
- **Detailed Pokémon Info & Audio Cries**:
  - Tap the info icon on any Pokémon to view types, Pokédex flavor text, evolution triggers, and in-game encounter locations.
  - Play official in-game Pokémon audio cries directly inside the modal.
- **Shiny Tracking Mode**: 1-click toggle (`✨` or press `S`) to track Shiny Living Dexes independently.
- **Filters & Search**:
  - Instant search by Pokémon name or Pokédex number (`/`).
  - 3-way status filter: `[ All │ Uncaught │ Caught ]` (press `H`).
  - 18 Pokémon type filter chips for single and dual-type filtering.
- **Keyboard Shortcuts**: Full power-user navigation (`/`, `Space`, `S`, `M`, `H`, `[`, `]`, `?`).
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
| `M`               | Open Missing Pokémon & Evolution Tracker            |
| `H`               | Cycle status filter (_All_ → _Uncaught_ → _Caught_) |
| `[` / `]`         | Jump to previous / next storage box                 |
| `?`               | Open keyboard shortcuts cheat-sheet                 |
| `Escape`          | Close active modal or cancel box renaming           |

---

## 📁 Project structure

- `index.html` — App shell, semantic dialog modals, and UI structure
- `styles.css` — Modern responsive styles, theme tokens, and animations
- `manifest.json` & `sw.js` — PWA service worker with multi-tier caching
- `data/` — Pre-compiled local datasets (species, master evolutions, flavor text, game dexes, game evolutions, and encounters)
- `js/` — Modular ES application logic:
  - `config.js` — Game, segment, and dex definitions
  - `db.js` — Dataset queries, dynamic section loader, and layout presets
  - `state.js` — State management and UI synchronization
  - `storage.js` — LocalStorage helpers, settings, and backup serialization
  - `pwa.js` — Service worker lifecycle registration and cache controls
  - `ui/theme.js` — Light/dark theme and reduced motion handlers
  - `ui/controls.js` — Header controls, search, and status filtering
  - `ui/dom-render.js` — Dex grid, PC boxes, collapse animations, and inline renaming
  - `ui/modals.js` — Dex Options, Settings, Shortcuts, and Backup Export/Import
  - `ui/box-coords.js` — Floating Box Coordinates HUD cursor tooltip
  - `ui/missing-guide.js` — Missing Pokémon tracker, evolution family quotas, and items checklist
  - `ui/welcome-guide.js` — Interactive first-time welcome walkthrough
  - `ui/pokemon-info.js` — Pokémon info modal, evolution trees, encounters, and audio cries
  - `main.js` — Startup initialization

---

## ☕ Support

If you enjoy using LivingDex and want to help support development and hosting:

- [Support on Ko-fi](https://ko-fi.com/pimbarf)

---

## 📄 License

MIT. See [LICENSE](./LICENSE) for details.
