# LivingDex Update History & Changelog 📜

All notable changes, feature releases, service worker updates, and architectural evolutions for **LivingDex** and its data pipeline (**LivingDex-Scraper**) are documented in this file.

The project adheres to semantic versioning patterns and tracks client-side service worker cache updates (`livingdex-shell-v*` and `livingdex-data-v*`).

---

## 📑 Quick Navigation & Release Timeline

| Version                                                                           | Release Date          | SW Cache Version | Major Highlights                                                                                               |
| :-------------------------------------------------------------------------------- | :-------------------- | :--------------- | :------------------------------------------------------------------------------------------------------------- |
| **[v1.10.1](#v1101---2026-09-12)**                                                | Sep 12, 2026          | `v1.10.1`        | Game-specific layout presets (Alola Islands, Kalos/Galar/Paldea Unified, Hisui Areas), dynamic preset resolver |
| **[v1.9.19](#v1919---2026-09-12)**                                                | Sep 12, 2026          | `v1.9.19`        | Active game version selector in Dex Options modal                                                              |
| **[v1.9.18](#v1918---2026-09-12)**                                                | Sep 12, 2026          | `v1.9.18`        | Centralized Dex Options redesign with interactive preset detail cards                                          |
| **[v1.9.10](#v1910---2026-09-12)**                                                | Sep 12, 2026          | `v1.9.10`        | Floating Box Coordinates HUD tooltip with cursor tracking                                                      |
| **[v1.9.7](#v197---2026-09-12)**                                                  | Sep 12, 2026          | `v1.9.7`         | Pokémon HOME Types (18 Boxes) & Alphabetical (A-Z) box layout presets                                          |
| **[v1.8.2](#v182---2026-09-12)**                                                  | Sep 12, 2026          | `v1.8.2`         | Storage normalization for legacy keys and custom caught state sync                                             |
| **[v1.8.0](#v180---2026-09-12)**                                                  | Sep 12, 2026          | `v1.8.0`         | Initial Pokémon HOME 6-Preset Box Sorting Engine                                                               |
| **[v1.7.11](#v1711---2026-09-12)**                                                | Sep 12, 2026          | `v1.7.11`        | Multi-criteria filter engine (Evolution Stages, Categories, Generations, Forms)                                |
| **[v1.7.7](#v177---2026-09-12)**                                                  | Sep 12, 2026          | `v1.7.7`         | First-time visitor Welcome Guide modal and walkthrough                                                         |
| **[v1.7.6](#v176---2026-09-12)**                                                  | Sep 12, 2026          | `v1.7.6`         | Exclusive encounter method detection (Raids, Roaming, Gifts, Outbreaks)                                        |
| **[v1.6.5](#v165---2026-09-07)**                                                  | Sep 07, 2026          | `v1.6.5`         | Missing Guide evolution family tracking, sacrifice quotas & tabbed Settings                                    |
| **[v1.6.0](#v160---2026-09-07)**                                                  | Sep 07, 2026          | `v1.6.0`         | Missing Pokémon & Evolution Checklist Guide (`M` key)                                                          |
| **[v1.5.24](#v1524---2026-09-04)**                                                | Sep 04, 2026          | `v1.5.24`        | Mobile touch drag selection & real-time Drag HUD painter                                                       |
| **[v1.5.19](#v1519---2026-09-04)**                                                | Sep 04, 2026          | `v1.5.19`        | Pokémon Info modal next/previous navigation & audio cries                                                      |
| **[v1.5.15](#v1515---2026-09-04)**                                                | Sep 04, 2026          | `v1.5.15`        | Mobile search engine UX improvements and virtual keyboard controls                                             |
| **[v1.5.9](#v159---2026-09-01)**                                                  | Sep 01, 2026          | `v1.5.9`         | Pokémon Legends: Z-A Hyperspace Pokédex dataset                                                                |
| **[v1.5.4](#v154---2026-09-01)**                                                  | Sep 01, 2026          | `v1.5.4`         | Gender difference & variant-specific sprite rendering pipeline                                                 |
| **[v1.5.1](#v151---2026-09-01)**                                                  | Sep 01, 2026          | `v1.5.1`         | Comprehensive Form Variant system with subtitles & category badges                                             |
| **[v1.4.0](#v140---2026-09-01)**                                                  | Sep 01, 2026          | `v1.4.0`         | Game-specific evolution tree databases (`evolutions.json`)                                                     |
| **[v1.3.0](#v130---2026-09-01)**                                                  | Sep 01, 2026          | `v1.3.0`         | Custom inline box renaming, title persistence & smart auto-collapse                                            |
| **[v1.1.0](#v110---2026-09-01)**                                                  | Sep 01, 2026          | `v1.1.0`         | In-app PWA update notifications and cache synchronizer                                                         |
| **[v1.0.8](#v108---2026-09-01)**                                                  | Sep 01, 2026          | `v1.0.8`         | Per-game slice dataset architecture (`./data/games/*.json`)                                                    |
| **[v1.0.7](#v107---2026-09-01)**                                                  | Sep 01, 2026          | `v1.0.7`         | Native `CompressionStream` URL hash sharing (Pako replacement)                                                 |
| **[v1.0.0](#v100---2026-09-01)**                                                  | Sep 01, 2026          | `v1.0.0`         | Full Service Worker caching & data scraper architecture separation                                             |
| **[Phase 3 (Expansion)](#phase-3-multi-game-expansion--localization---aug-2026)** | Aug 17–31, 2026       | `v1.0.0`         | All mainline games, 8-language localization, Info modal, UI modular split                                      |
| **[Phase 2 (Modular JS)](#phase-2-the-first-modular-js-split---nov-2025)**        | Nov 13–15, 2025       | —                | Modular architecture split (`main.js`, `ui.js`, `api.js`, `storage.js`)                                        |
| **[Phase 1 (Genesis)](#phase-1-project-genesis--prototype---oct-2025)**           | Oct 27 – Nov 10, 2025 | —                | Initial LivingDex tracker release, 30-slot PC boxes, PokeAPI integration                                       |

---

## [v1.10.1] - 2026-09-12

### Added

- **Game-Specific Box Layout Presets**: Added specialized in-game box organization presets matching regional storage conventions:
  - **Alola Islands**: 4 dedicated island boxes (_Melemele_, _Akala_, _Ula'ula_, and _Poni_) with padding to match game storage.
  - **Kalos Unified**: Combines Central, Coastal, and Mountain Kalos regional dexes into a single sequential layout.
  - **Galar & Paldea Unified**: Seamlessly combines base game and expansion pass dexes (Isle of Armor, Crown Tundra, Kitakami, Blueberry Academy).
  - **Hisui Areas**: 5 territory boxes (_Obsidian Fieldlands_, _Crimson Mirelands_, _Cobalt Coastlands_, _Coronet Highlands_, and _Alabaster Icelands_).
- **Dynamic Layout Resolver** (`getAvailableLayoutPresetsForGame`): Dynamically inspects the active game configuration and presents only valid, tailored layout presets in Dex Options.
- **Dedicated Layout Module** (`js/layout.js`): Extracted transformation algorithms into a clean, reusable module for calculating box padding, sequential ordering, and sub-dex merging.

### Changed

- Refactored `js/db.js` and `js/storage.js` to persist and manage layout presets per game independently.
- Updated Service Worker cache version to `v1.10.1`.

---

## [v1.9.19] - 2026-09-12

### Added

- **Active Game Version Selector in Dex Options**: Allows selecting specific paired versions (e.g., _Scarlet_ vs. _Violet_, _Sword_ vs. _Shield_, _Sun_ vs. _Moon_) directly inside the Dex Options modal.

### Changed

- Service Worker cache updated to `v1.9.19`.

---

## [v1.9.18] - 2026-09-12

### Added

- **Interactive Layout Preset Explanations**: Dynamic detail cards in Dex Options describing slot arrangements, box count estimates, and structural differences for each selected preset.
- Polished box customization descriptions and visual hierarchy in modal dialogs.

### Changed

- Service Worker cache updated to `v1.9.18`.

---

## [v1.9.10] - 2026-09-12

### Added

- **Floating Box Coordinates HUD Tooltip**: Real-time cursor-following coordinate HUD indicating the exact box number, row, column, and slot number (e.g. `Box 1 · Row 2, Col 3 · Slot 9`).
- **Settings Toggle**: Added a user setting (`Show Box Coordinates HUD`) with instant persistence and live toggle capability.

### Fixed

- Dark theme styling consistency in the box layout preset selector.
- Removed deprecated header layout preset dropdown in favor of the centralized Dex Options modal.

### Changed

- Service Worker cache updated to `v1.9.10`.

---

## [v1.9.7] - 2026-09-12

### Added

- **Primary Types Layout Preset (18 Boxes)**: Arranges Pokémon into 18 dedicated storage boxes grouped by their primary elemental type (Normal, Fire, Water, Grass, etc.).
- **Alphabetical Layout Preset (A-Z)**: Sorts all active Pokémon alphabetically by localized species name with continuous 30-slot box layout.

### Changed

- Service Worker cache updated to `v1.9.7`.

---

## [v1.8.2] - 2026-09-12

### Changed

- **Storage Migration & Key Normalization**: Enhanced caught slot persistence in `storage.js` with automatic normalization for legacy storage keys across previous versions.
- Updated Service Worker cache version to `v1.8.2`.

---

## [v1.8.0] - 2026-09-12

### Added

- **Pokémon HOME Box Layout Presets Engine**:
  - _Standard Dex (Forms at End)_: Numerical National Pokédex followed by regional forms and cosmetic variants.
  - _Generational Clean (Padded Region Boxes)_: Starts each generation at the beginning of a fresh 30-slot PC box with trailing padding slots.
  - _All Forms Inline_: Places regional and alternate forms immediately adjacent to their base species in numerical order.
  - _Evolution Lines (Cross-Gen Families)_: Groups cross-generational evolution lines together (e.g., Pichu $\to$ Pikachu $\to$ Raichu, Togepi line).

### Changed

- Service Worker cache updated to `v1.8.0`.

---

## [v1.7.11] - 2026-09-12

### Added

- **Advanced Multi-Criteria Filter Engine**:
  - **Evolution Stage Filter**: Filter by _Base Form_, _Middle Evolution_, _Final Evolution_, or _Single Stage (No Evolution)_.
  - **Special Categories**: Filter by _Starters_, _Fossils_, _Babies_, _Legendaries_, _Mythicals_, _Ultra Beasts_, and _Paradox Pokémon_.
  - **Generations**: Filter Pokémon across Generation 1 through Generation 9.
  - **Form Classifications**: Filter by _Base Species_, _Regional Variants_, _Mega Evolutions_, _Gigantamax Forms_, and _Totem Forms_.
- **Evolution Stage Caching**: Pre-calculated evolutionary stage graph for instantaneous sub-millisecond filtering.
- **Active Filter Badges**: Real-time counter badge and live matching indicators showing matching slot counts.

### Changed

- Service Worker cache updated to `v1.7.11`.

---

## [v1.7.7] - 2026-09-12

### Added

- **First-Time Visitor Welcome Guide (`modalWelcomeGuide`)**: Interactive onboarding modal introducing new users to LivingDex features (30-slot box organization, batch drag selection, Dex Options presets, and offline PWA support).
- First-time visit detection with automatic dismissal tracking in `localStorage`.

### Changed

- Service Worker cache updated to `v1.7.7`.

---

## [v1.7.6] - 2026-09-12

### Added

- **Exclusive Encounter Method Detection**: Automatically identifies and highlights rare capture methods from dataset location strings (e.g., _Roaming_, _In-game Gift_, _Fossil Revival_, _In-game Trade_, _Tera Raid_, _Mass Outbreak_).
- **Location Name & Tag Parsing** (`parseLocationEntry`): Cleaner visual layout in Pokémon Info encounter summaries with pill badges for specific encounter conditions.

### Changed

- Refined responsive mobile breakpoint to `768px`.
- Service Worker cache updated to `v1.7.6`.

---

## [v1.6.5] - 2026-09-07

### Added

- **Evolution Family Checklist & Sacrifice Quotas**: Added evolution lineage tracking inside the Missing Guide modal, calculating required specimen counts to complete full evolutionary families (e.g., catching 3 Oddish to evolve Gloom, Vileplume, and Bellossom).
- **Evolution Items Shopping List**: Summary checklist of all required Evolution Stones and special items needed to evolve remaining missing species.
- **Game Version Filtering in Missing Guide**: Toggle between paired versions to display only Pokémon obtainable in the selected game cartridge.
- **Settings Tabbed Navigation**: Redesigned Settings modal with organized tabs for _General_, _Display & HUD_, _Box Management_, and _Backup & Data_.
- **Proactive Update Check Button**: Added a manual "Check for Updates" button in Settings that queries the service worker lifecycle.

### Changed

- Service Worker cache updated from `v1.6.0` $\to$ `v1.6.5`.

---

## [v1.6.0] - 2026-09-07

### Added

- **Missing Pokémon Guide Modal (`M` key)**:
  - Instant overview of all remaining uncaught Pokémon for the active game.
  - Encounter location summaries and direct quick-catch action buttons.
  - Header badge displaying live uncaught count.
- Integrated missing guide module (`js/ui/missing-guide.js`) into the application shell.

### Changed

- Service Worker cache updated to `v1.6.0`.

---

## [v1.5.24] - 2026-09-04

### Added

- **Mobile Touch Drag Selection & Floating Drag HUD**:
  - Touch-drag painting on mobile and tablet devices: press, hold, and drag across Pokémon slots to batch mark them caught or uncaught.
  - Floating live Drag HUD displaying real-time painted slot counts and target action (`+ Marking Caught` / `- Marking Uncaught`).
- **Dynamic Mobile Header Height Adjustment**: Eliminates layout shifts during scrolling and responsive viewport resizing.

### Changed

- Service Worker cache updated to `v1.5.24`.

---

## [v1.5.19] - 2026-09-04

### Added

- **Pokémon Info Modal Navigation**: Added previous (`←`) and next (`→`) navigation arrows to browse Pokémon info without closing the modal.
- **Audio Cries Integration**: Embedded Pokémon cries player with direct audio playback.

### Changed

- Service Worker cache updated to `v1.5.19`.

---

## [v1.5.15] - 2026-09-04

### Fixed

- **Mobile Search Bug Fixes**:
  - Resolved an issue on iOS and Android where typing in the search bar moved the cursor to the beginning of the text input.
  - Added dedicated clear button (`×`) to search input that dismisses the virtual keyboard on tap.
  - Prevented search bar scroll jump and CSS overflow anchoring bugs.

### Changed

- Service Worker cache updated to `v1.5.15`.

---

## [v1.5.9] - 2026-09-01

### Added

- **Pokémon Legends: Z-A Hyperspace Pokédex**: Added dataset, configuration, and box structure for the Hyperspace Dex from Pokémon Legends: Z-A.
- **Segments Guide & Discovery Tips Modal**: Visual guide explaining optional segments, DLC expansions, and form variants.

### Changed

- Service Worker cache updated to `v1.5.9`.

---

## [v1.5.4] - 2026-09-01

### Added

- **Gender & Form-Specific Sprite Engine**:
  - Enhanced `resolveMemberSpriteId` to resolve gender differences (e.g., Hippowdon, Meowstic, Indeedee) and specific cosmetic forms across box grids, info modals, and evolution flowcharts.
  - Added sprite ID resolution to `populateDexSlots` and `applySpriteStyleToCells`.

### Changed

- Service Worker cache updated to `v1.5.4`.

---

## [v1.5.1] - 2026-09-01

### Added

- **Form Variant Architecture & Subtitles**:
  - Detailed form variant display with subtitle badges (e.g., _Alolan Form_, _Galarian Form_, _Paldean Form_, _Hisuian Form_, _Origin Forme_, _Gigantamax_).
  - Categorized forms dataset covering Unown, Vivillon, Alcremie, Furfrou, Minior, and Flabébé variants.

### Changed

- Service Worker cache updated to `v1.5.1`.

---

## [v1.4.0] - 2026-09-01

### Added

- **Game-Specific Evolution Database (`data/evolutions.json`)**: Replaced generic evolution data with game-specific evolution triggers, required items, level conditions, and trade requirements tailored to each generation.

### Changed

- Service Worker cache updated to `v1.4.0`.

---

## [v1.3.0] - 2026-09-01

### Added

- **Custom In-Game Box Labels**:
  - Tap any box header to rename it inline (e.g., _"Box 1: Starters"_, _"Box 12: Legendaries"_).
  - Saved persistently to browser storage with 1-click reset in Settings.
- **Persistent Box Collapse States**:
  - Smooth collapsible boxes (`▲` / `▼`) with persistent open/closed memory.
  - Optional **Smart Auto-Collapse**: Automatically collapses completed boxes ($30/30$ caught) upon reaching $100\%$.

### Changed

- Service Worker cache updated to `v1.3.0`.

---

## [v1.1.0] - 2026-09-01

### Added

- **In-App PWA Update Notification Banner**:
  - Detects new service worker waiting workers and renders a non-intrusive bottom banner.
  - "Update Now" button triggers `SKIP_WAITING` and seamless reload without data loss.

### Changed

- Service Worker cache updated to `v1.1.0`.

---

## [v1.0.8] - 2026-09-01

### Added

- **Per-Game Dataset Architecture (`./data/games/*.json`)**:
  - Split monolithic dataset into individual JSON files per game (`home.json`, `sv.json`, `swsh.json`, `rby.json`, `gsc.json`, `rse.json`, `frlg.json`, `dppt.json`, `hgss.json`, `bw.json`, `b2w2.json`, `xy.json`, `oras.json`, `sm.json`, `usum.json`, `lgpe.json`, `bdsp.json`, `pla.json`, `za.json`).
  - Reduced initial memory footprint and enabled instant game switching.

### Changed

- Service Worker cache updated to `v1.0.8`.

---

## [v1.0.7] - 2026-09-01

### Added

- **Native `CompressionStream` Sharing**:
  - Replaced bundled Pako library with native browser `CompressionStream` (Deflate-Raw / Gzip) for ultra-compact URL sharing hashes.
  - Decreased bundle size and improved decompression speeds.

### Changed

- Service Worker cache updated to `v1.0.7`.

---

## [v1.0.6] - 2026-09-01

### Changed

- **Typography Optimization**: Migrated all local font assets to modern WOFF2 format (`Inter-VariableFont`), reducing font file sizes by $>60\%$.
- Service Worker cache updated to `v1.0.6`.

---

## [v1.0.0] - 2026-09-01

### Added

- **Full Progressive Web App (PWA) Offline Engine**:
  - Multi-tier service worker caching:
    - `SHELL_CACHE` (`livingdex-shell-v*`): App HTML, CSS, JS, fonts, and icons.
    - `DATA_CACHE` (`livingdex-data-v*`): Static JSON datasets and evolution graphs (Stale-While-Revalidate).
    - `SPRITE_CACHE` (`livingdex-sprites-v1`): Sprites and artwork with Cache-First offline fallback.
  - Offline installability on mobile (iOS Safari, Android Chrome) and desktop.
- **Scraper Pipeline Separation (`LivingDex-Scraper`)**:
  - Extracted data generation tools into a separate modular CLI repo with bounded concurrency worker pool (`pool.mjs`), HTTP retry engine (`http.mjs`), cache layer (`cache.mjs`), and scrapers for Serebii, Bulbapedia, and PokeAPI.

### Changed

- Initial service worker caching release (`v1.0.0`).

---

## Phase 3: Multi-Game Expansion & Localization - Aug 2026

### Added

- **Support for All Mainline Pokémon Games**: Added Pokédex definitions and box configurations across Generation 1 through Generation 9 (RBY, GSC, RSE, FRLG, DPPt, HGSS, BW, B2W2, XY, ORAS, SM, USUM, LGPE, SwSh, BDSP, PLA, SV, and HOME).
- **8-Language Localization**: Full localized species names in English, Japanese, French, Spanish, German, Italian, Korean, and Simplified Chinese.
- **Shiny Living Dex Mode (`✨` or `S` key)**: Independent tracking state for Shiny Pokémon collections.
- **Pokémon Info Modal**: Detailed slide-out modal displaying official artwork, elemental types, flavor text, evolution flowchart, encounter locations, and audio cries.
- **Backup Export & Import**: Downloadable JSON backups with interactive review modal before applying changes.
- **Keyboard Power-User Navigation**: Shortcuts for search (`/`), toggle caught (`Space`/`Enter`), shiny mode (`S`), missing guide (`M`), status cycling (`H`), box navigation (`[`/`]`), and help (`?`).

### Changed

- **UI Modular Split**: Decomposed `ui.js` into focused modules: `modals.js`, `theme.js`, `controls.js`, `pokemon-info.js`, and `dom-render.js`.
- Added glassmorphism styling, sticky progress bar below the header, and safe-area insets for mobile devices.

---

## Phase 2: The First Modular JS Split - Nov 2025

### Added

- **Pako Compressed URL Hash Sharing**: Compressed living dex export states in shareable URL links.
- **Collapsible Mobile Header**: Header automatically collapses during downward scrolling to maximize box grid visibility.
- **Hide Caught Filter Mode**: Quick toggle to hide caught Pokémon and display only uncaught slots.
- **System Theme Support**: Automatic detection of OS dark/light mode preference (`auto`).

### Changed

- **Monolith Decomposition**: Split original single-file `app.js` (1,200 lines) into ES modules (`main.js`, `api.js`, `ui.js`, `storage.js`, and `config.js`).
- Migrated URL parameter from `?dex` to `?game`.

---

## Phase 1: Project Genesis & Prototype - Oct 2025

### Added

- **Initial LivingDex.app Release**:
  - Vanilla HTML5/CSS3/JavaScript client-side application with zero dependencies and no build tools.
  - 30-slot PC Box organization matching in-game storage layout (`#001-030`).
  - PokeAPI integration for sprites and species data with localStorage caching.
  - Multi-dex support (National Dex and Pokémon Legends: Z-A).
  - Search, box completion counters (`X/30`), and bulk catch/clear toggles.
  - Dark and Light theme engine.
  - Open source MIT License and attribution notices.
