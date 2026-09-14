# LivingDex Changelog & Update History 📜

All notable changes, new features, improvements, and bug fixes for **LivingDex** and its accompanying data pipeline are documented in this file.

---

## 📑 Release Timeline

| Version                                                               | Release Date          | Major Highlights                                                                                                 |
| :-------------------------------------------------------------------- | :-------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **[v1.19.4](#v1194---2026-09-14)**                                    | Sep 14, 2026          | Automated Playwright cross-generation testing & Chrome DevTools MCP verification rules                           |
| **[v1.19.3](#v1193---2026-09-14)**                                    | Sep 14, 2026          | Semantic encounter notes, concise metadata pills & readable form labels                                          |
| **[v1.19.2](#v1192---2026-09-14)**                                    | Sep 14, 2026          | Clean Base vs DLC encounter separation, normalized raid labels & corrected expansion pass clustering             |
| **[v1.19.1](#v1191---2026-09-14)**                                    | Sep 14, 2026          | Regenerated data synchronization with corrected form sprites and game encounter records                          |
| **[v1.19.0](#v1190---2026-09-13)**                                    | Sep 13, 2026          | Special encounter conditions (Day/Night, Weather, Swarms, Seasons, Methods) and level badges in Field Guide      |
| **[v1.18.6](#v1186---2026-09-13)**                                    | Sep 13, 2026          | Increase mobile long-press hold duration to 500ms to prevent accidental multi-select gestures                    |
| **[v1.18.5](#v1185---2026-09-13)**                                    | Sep 13, 2026          | Fix Field Guide count badge color and contrast in Light mode by correcting design token references               |
| **[v1.18.4](#v1184---2026-09-13)**                                    | Sep 13, 2026          | Fix starter and gift Pokémon acquisition method pills and wild encounter badge fallback in Field Guide           |
| **[v1.18.3](#v1183---2026-09-13)**                                    | Sep 13, 2026          | Rename Missing Pokémon Guide to Field Guide across toolbar, modal headers, shortcuts, and welcome walkthroughs   |
| **[v1.18.2](#v1182---2026-09-13)**                                    | Sep 13, 2026          | Fix Missing Pokémon Guide undo toast appearance, color contrast, button sizing, positioning, and animation       |
| **[v1.18.1](#v1181---2026-09-13)**                                    | Sep 13, 2026          | Fix starter, gift, and fossil encounter duplications and normalize PokéAPI encounter method tagging              |
| **[v1.18.0](#v1180---2026-09-13)**                                    | Sep 13, 2026          | Catching Order & Smart Route Progression sort in Missing Guide with encounter rate weighting and route badges    |
| **[v1.17.0](#v1170---2026-09-13)**                                    | Sep 13, 2026          | Configurable 20-slot PC box capacity for Gen 1 & 2 (Game Boy authentic) with settings toggle and 5x4 grid layout |
| **[v1.16.3](#v1163---2026-09-13)**                                    | Sep 13, 2026          | Fix "Last used" default Pokédex startup resolution and persistence across sessions                               |
| **[v1.16.2](#v1162---2026-09-13)**                                    | Sep 13, 2026          | Exclusive time/condition notices, multi-cartridge dual-slot consolidation & clean UI de-cluttering               |
| **[v1.16.1](#v1161---2026-09-13)**                                    | Sep 13, 2026          | Fix variable reference and search matching in Missing Guide card rendering                                       |
| **[v1.16.0](#v1160---2026-09-13)**                                    | Sep 13, 2026          | Encounter rate probabilities, time-of-day condition chips, rarity badges, and level range indicators             |
| **[v1.15.0](#v1150---2026-09-13)**                                    | Sep 13, 2026          | Keep Screen Awake setting via Screen Wake Lock API to prevent mobile display timeout                             |
| **[v1.14.0](#v1140---2026-09-13)**                                    | Sep 13, 2026          | Starter & Gift Pokémon identification, Missing Guide starter/gift filters & badges, Gift Multi-Filter category   |
| **[v1.13.2](#v1132---2026-09-13)**                                    | Sep 13, 2026          | Tab-specific Missing Guide controls and working Family Quotas sorting                                            |
| **[v1.13.1](#v1131---2026-09-13)**                                    | Sep 13, 2026          | Offline encounter data caching fixes for Missing Guide and Pokémon Information modal                             |
| **[v1.13.0](#v1130---2026-09-13)**                                    | Sep 13, 2026          | Regional Dex default sorting with explicit National Dex sorting in Missing Guide                                 |
| **[v1.12.0](#v1120---2026-09-13)**                                    | Sep 13, 2026          | Missing Guide usability, canonical caught-state fixes, lazy tab loading, compact view, and undo actions          |
| **[v1.11.1](#v1111---2026-09-13)**                                    | Sep 13, 2026          | Separate box sections in National Dex order & out-of-dex gender/form variant filtering across game datasets      |
| **[v1.11.0](#v1110---2026-09-13)**                                    | Sep 13, 2026          | Regional Origin box layout preset for post-Gen 1 games (GSC through SV) in canonical National Dex numbering      |
| **[v1.10.1](#v1101---2026-09-12)**                                    | Sep 12, 2026          | Game-specific layout presets (Alola Islands, Kalos/Galar/Paldea Unified, Hisui Areas), dynamic preset resolver   |
| **[v1.9.19](#v1919---2026-09-12)**                                    | Sep 12, 2026          | Active game version selector in Dex Options modal                                                                |
| **[v1.9.18](#v1918---2026-09-12)**                                    | Sep 12, 2026          | Centralized Dex Options redesign with interactive preset detail cards                                            |
| **[v1.9.10](#v1910---2026-09-12)**                                    | Sep 12, 2026          | Floating Box Coordinates HUD tooltip with live cursor tracking                                                   |
| **[v1.9.7](#v197---2026-09-12)**                                      | Sep 12, 2026          | Pokémon HOME Types (18 Boxes) & Alphabetical (A-Z) box layout presets                                            |
| **[v1.8.2](#v182---2026-09-12)**                                      | Sep 12, 2026          | Storage normalization for legacy keys and custom caught state sync                                               |
| **[v1.8.0](#v180---2026-09-12)**                                      | Sep 12, 2026          | Pokémon HOME 6-Preset Box Sorting Engine                                                                         |
| **[v1.7.11](#v1711---2026-09-12)**                                    | Sep 12, 2026          | Multi-criteria filter engine (Evolution Stages, Categories, Generations, Forms)                                  |
| **[v1.7.7](#v177---2026-09-12)**                                      | Sep 12, 2026          | First-time visitor Welcome Guide modal and interactive walkthrough                                               |
| **[v1.7.6](#v176---2026-09-12)**                                      | Sep 12, 2026          | Exclusive encounter method detection (Raids, Roaming, Gifts, Outbreaks)                                          |
| **[v1.6.5](#v165---2026-09-07)**                                      | Sep 07, 2026          | Missing Guide evolution family tracking, sacrifice quotas & tabbed Settings                                      |
| **[v1.6.0](#v160---2026-09-07)**                                      | Sep 07, 2026          | Missing Pokémon & Evolution Checklist Guide (`M` key)                                                            |
| **[v1.5.24](#v1524---2026-09-04)**                                    | Sep 04, 2026          | Mobile touch drag selection & real-time Drag HUD painter                                                         |
| **[v1.5.19](#v1519---2026-09-04)**                                    | Sep 04, 2026          | Pokémon Info modal next/previous navigation & audio cries                                                        |
| **[v1.5.15](#v1515---2026-09-04)**                                    | Sep 04, 2026          | Mobile search UX improvements, keyboard dismissal, and clear button                                              |
| **[v1.5.9](#v159---2026-09-01)**                                      | Sep 01, 2026          | Pokémon Legends: Z-A Hyperspace Pokédex dataset                                                                  |
| **[v1.5.4](#v154---2026-09-01)**                                      | Sep 01, 2026          | Gender difference & variant-specific sprite rendering pipeline                                                   |
| **[v1.5.1](#v151---2026-09-01)**                                      | Sep 01, 2026          | Comprehensive Form Variant system with subtitles & category badges                                               |
| **[v1.4.0](#v140---2026-09-01)**                                      | Sep 01, 2026          | Game-specific evolution tree databases (`evolutions.json`)                                                       |
| **[v1.3.0](#v130---2026-09-01)**                                      | Sep 01, 2026          | Custom inline box renaming, title persistence & smart auto-collapse                                              |
| **[v1.1.0](#v110---2026-09-01)**                                      | Sep 01, 2026          | In-app update notification banner                                                                                |
| **[v1.0.8](#v108---2026-09-01)**                                      | Sep 01, 2026          | Per-game slice dataset architecture (`./data/games/*.json`)                                                      |
| **[v1.0.7](#v107---2026-09-01)**                                      | Sep 01, 2026          | Native `CompressionStream` URL hash sharing (Pako replacement)                                                   |
| **[v1.0.0](#v100---2026-09-01)**                                      | Sep 01, 2026          | Full offline PWA support & standalone data scraper architecture                                                  |
| **[Expansion Phase](#multi-game-expansion--localization---aug-2026)** | Aug 17–31, 2026       | All mainline games, 8-language localization, Info modal, UI modular split                                        |
| **[Modular JS Split](#modular-js-split---nov-2025)**                  | Nov 13–15, 2025       | ES module decomposition (`main.js`, `ui.js`, `api.js`, `storage.js`)                                             |
| **[Genesis & Prototype](#initial-release---oct-2025)**                 | Oct 27 – Nov 10, 2025 | Initial LivingDex tracker release, 30-slot PC boxes, PokeAPI integration                                         |

---

## [v1.19.4] - 2026-09-14

### Added

- **Automated Cross-Gen Testing & Verification Standards (`AGENTS.md`)**:
  - Add Playwright automated smoke test rules sampling across all 9 Pokémon generations.
  - Integrate Chrome DevTools MCP guidelines for visual, responsive layout, and accessibility auditing.
  - Formalize standardized release checklist and GitHub MCP workflows.

---

## [v1.19.3] - 2026-09-14

### Changed

- **Encounter Detail Presentation**:
  - Keep concise encounter metadata as pills while rendering long explanatory parenthetical notes as readable secondary text.
  - Suppress redundant row-level raid labels when the encounter group already identifies raid battles.
  - Refresh the frontend encounter cache after regenerating corrected SV records.

## [v1.19.2] - 2026-09-14

### Fixed

- **Base Game vs Expansion Pass Encounter Separation (`data/games/encounters/swsh.json`, `data/games/encounters/sv.json`)**:
  - Synced regenerated encounter datasets with distinct Base Game and Expansion Pass version keys.
  - Eliminated noisy non-wild transfer strings (e.g., _"Transfer from Pokémon HOME or Trade with players with The Hidden Treasure of Area Zero"_) from wild encounter tables.
  - Corrected DLC-exclusive species (e.g., Bulbasaur, Zorua, Kubfu, Calyrex, Ogerpon, Terapagos) so that DLC locations (such as _Master Dojo_, _Dreaded Den_, _Area Zero Underdepths_) only appear in expansion pass groups and do not pollute base game displays.
- **Raid Den Text Normalization**:
  - Standardized all Serebii raid den locations into individual `(Max Raid Battle)` and `(Gigantamax Raid Battle)` tags with canonical `Tera Raid Battles (X★)` formatting.

---

## [v1.19.1] - 2026-09-14

### Fixed

- **Regenerated frontend datasets**:
  - Synchronized the frontend data projection with the fresh scraper output.
  - Corrected female sprite identifiers for Frillish, Jellicent, and Pyroar across species, form catalogs, and affected game dexes.
  - Updated encounter availability and location data for RBY, RSE, Sword/Shield, Scarlet/Violet, and Legends: Z-A.
  - Bumped Service Worker `CACHE_VERSION` to `v1.19.1` so installed PWAs refresh cached datasets.

---

## [v1.19.0] - 2026-09-13

### Added

- **Special Encounter Conditions & Time-of-Day Badges in Field Guide (`missing-guide.js`, `pokemon-info.js`, `styles.css`)**:
  - Implemented special encounter condition chips and level range indicators for Pokémon locations in the Field Guide card list and Recommended Spot / Earliest Encounter pills.
  - Added support for comprehensive condition types with dedicated emoji badges:
    - **Time of Day**: Morning (🌅), Day (☀️), Night (🌙).
    - **Weather**: Rain/Raining (🌧️), Thunderstorm (⛈️), Snow/Snowing (🌨️), Snowstorm/Blizzard (❄️), Sandstorm (🏜️), Fog/Heavy Fog (🌫️), Overcast (☁️), Intense Sun (☀️).
    - **Seasons & Specials**: Spring (🌸), Summer (☀️), Autumn/Fall (🍂), Winter (❄️), Swarms (🦗), Poké Radar (📡), Dual-slot (🎮), Sound/Radio (📻).
    - **Encounter Methods**: Trees/Headbutt (🌳), Surfing (🌊), Fishing/Rods (🎣), Diving (🤿), Rock Smash (🪨), Bug Catching Contest (🏆).
  - Enhanced search filtering in the Field Guide to match condition names (e.g. searching for `"night"`, `"morning"`, `"swarm"`, or `"rain"` finds all Pokémon encounterable under those conditions).
  - Synchronized location parsing and formatting helpers between the Pokémon Information modal and Field Guide modal.
  - Bumped Service Worker `CACHE_VERSION` to `v1.19.0` in `LivingDex/sw.js`.

---

## [v1.18.6] - 2026-09-13

### Changed

- **Mobile Touch Multi-Select Long-Press Duration**:
  - Increased `LONG_PRESS_DELAY` from 320ms to 500ms in `js/ui/dom-render.js` to ensure a more deliberate hold is required before activating drag selection on mobile devices, preventing accidental multi-selections while scrolling or tapping.
  - Adjusted the `.cell.is-press-holding` CSS transform transition timing to 0.5s in `styles.css` for smooth visual feedback matching the increased hold delay.
  - Bumped Service Worker `CACHE_VERSION` to `v1.18.6` in `LivingDex/sw.js`.

---

## [v1.18.5] - 2026-09-13

### Fixed

- **Field Guide Button Badge & Modal Color Contrast in Light Mode**:
  - Replaced undefined CSS variable `var(--accent-1)` with the design token `var(--accent-2)` across `.missing-count-badge`, `.missing-filter-count-badge`, filter chips, active toggle buttons, stepper buttons, and modal progress badges.
  - Added `--accent-1` as an alias to `--accent-2` in both `:root` and `[data-theme="dark"]` design tokens to guarantee backward compatibility and prevent badge background transparency.
  - Fixed invisible badge count text on the Field Guide toolbar button in Light mode, restoring crisp white text against the solid blue brand action background.
  - Bumped Service Worker `CACHE_VERSION` to `v1.18.5` in `LivingDex/sw.js`.

---

## [v1.18.4] - 2026-09-13

### Fixed

- **Field Guide Starter & Gift Pokémon Method Badges**:
  - Decoupled starter and gift acquisition method categorization from evolution chain existence checks in `computeMissingPokemon` (`db.js`), allowing base-stage Pokémon that evolve (such as starters, Eevee, fossils, and baby gift Pokémon) to be properly identified as `starter` or `gift` instead of falling through to `wild`.
  - Refined `hasWildLocations` to accurately distinguish true wild encounter locations from guaranteed gifts, fossils, and starter selections.
  - Enhanced starter and gift method pill rendering and location tag matching in `missing-guide.js` to support broader tag patterns (`Gift from...`, `Gift Egg`, `Fossil`) and display clean, non-redundant labels.
  - Bumped Service Worker `CACHE_VERSION` to `v1.18.4` in `LivingDex/sw.js`.

---

## [v1.18.3] - 2026-09-13

### Changed

- **Field Guide Rebranding**:
  - Renamed the **Missing Pokémon Guide** to **Field Guide** throughout the entire application.
  - Updated main toolbar button label and hover tooltip (`Field Guide & Family Quotas (M)`).
  - Updated modal header title (`Field Guide`), tab list accessibility labels, search input accessibility descriptions, and modal close buttons.
  - Updated Keyboard Shortcuts guide modal entry (`Open Field Guide & Family Quotas`).
  - Updated Dex Options game version filtering hint text (`Tailor encounters & Field Guide to your cartridge`).
  - Updated Step 3 and Step 5 interactive slides in the Welcome Walkthrough guide.

---

## [v1.18.2] - 2026-09-13

### Fixed

- **Missing Pokémon Guide "Mark Caught" Toast**:
  - Fixed toast styling and text contrast by replacing unstyled button rules with a themed `.missing-undo-btn` featuring proper interactive hover/active states.
  - Positioned the undo toast cleanly with bottom-center alignment, elevated shadow, `z-index: 50`, and smooth entry (`.show`) and exit (`.hide`) transition animations.
  - Displayed Pokémon name in toast feedback (`Marked <Name> caught`) and ensured modal cleanup on close.
  - Bumped Service Worker `CACHE_VERSION` to `v1.18.2` for instant client cache refresh.

---

## [v1.18.1] - 2026-09-13

### Fixed

- **Encounter Rate & Location Deduplication**:
  - Resolved duplicate encounter rate and location entries across all 19 game Pokédexes (e.g., GSC starters, Pichu/Cleffa/Togepi gift eggs, fossils, and in-game gift encounters).
  - Merged PokéAPI gift/egg encounter metadata (`100%`, `Lv. 5`) into canonical `(Starter)`, `(Gift Egg)`, `(Gift)`, and `(Fossil)` tags without duplicating plain text strings.
  - Bumped Service Worker `CACHE_VERSION` to `v1.18.1` to ensure instant cache refresh for all updated game encounter datasets.

---

## [v1.18.0] - 2026-09-13

### Added

- **Catching Order & Smart Route Progression Sort in Missing Pokémon Guide (`routes.js`, `db.js`, `missing-guide.js`, `styles.css`)**:
  - Introduced canonical linear story route progression datasets for all 18 supported Pokémon game groups (`rby`, `frlg`, `lgpe`, `gsc`, `hgss`, `rse`, `oras`, `dppt`, `bdsp`, `bw`, `b2w2`, `xy`, `sm`, `usum`, `swsh`, `pla`, `sv`, `za`).
  - Added two new sorting modes in the Missing Guide sort dropdown:
    - **Catching Order (Recommended Routes)**: Smart progression scoring that balances earliest geographic availability with encounter rate probabilities, applying rarity penalties to avoid tedious 1% ultra-rare early grinding when common (20%+) encounters exist shortly ahead.
    - **Catching Order (Earliest Route first)**: Pure chronological order strictly by the first geographic appearance along the player's journey.
  - Added **Evolution Progression Inheritance**: Species available only via evolution (or whose base form is caught earlier) inherit their pre-evolution's route position with an evolution-tier offset, placing evolutionary lines in logical sequence.
  - Added **Recommended Spot & Encounter Rate Pills**: Rendered dedicated route pills (`📍 Recommended: [Route]`) on missing cards featuring color-coded encounter reliability badges (🟢 `Common`, 🟡 `Uncommon`, 🟠 `Rare`, 🔵 `Gift / Static 100%`) and subtle hint tags indicating earlier low-rate alternatives when applicable.
  - Extended route sorting support to the **Evolution Family Quotas** tab, ordering incomplete families by their base species' route progression.

---

## [v1.17.0] - 2026-09-13

### Added

- **Authentic 20-Slot PC Box Capacity for Gen 1 & 2 (`config.js`, `storage.js`, `dom-render.js`, `modals.js`, `styles.css`)**:
  - Configured authentic 20-slot PC box storage capacity for Pokémon Red/Blue/Yellow (`rby`) and Pokémon Gold/Silver/Crystal (`gsc`), matching Game Boy cartridge storage mechanics.
  - Added **Gen 1 & 2 Box Size** setting under Settings > Boxes & Grid allowing users to seamlessly toggle between **20 slots (Cartridge authentic)** and **30 slots (Pokémon HOME standard)**.
  - Dynamically updated box titles and range numbering:
    - Gen 1 (RBY): 8 boxes (`#001-020`, `#021-040`, ..., `#141-151`) at 20 slots, or 6 boxes (`#001-030`, ..., `#151`) at 30 slots.
    - Gen 2 (GSC): 13 boxes (`#001-020`, ..., `#241-251`) at 20 slots, or 9 boxes (`#001-030`, ..., `#241-251`) at 30 slots.
  - Added adaptive $5 \times 4$ CSS grid styling on desktop (`repeat(5, minmax(0, 1fr))`) and $2 \times 10$ on mobile (`repeat(2, minmax(0, 1fr))`) for 20-slot boxes.
  - Updated Box Coordinates HUD and tooltips to compute 5-column rows (1–4) and columns (1–5) for 20-slot boxes.
  - Updated box progress badges and auto-collapse behavior to respect the active box capacity.

## [v1.16.3] - 2026-09-13

### Fixed

- **"Last Used" Default Pokédex Startup Resolution (`config.js`, `storage.js`, `main.js`)**:
  - Added persistence for the last viewed/selected Pokédex via `lastUsedGameId` in application settings.
  - Resolved `lastUsedGameId` during startup initialization when `defaultGameMode` is set to `"last-used"` (the default startup setting) and no explicit `?game=` query parameter is present in the URL.
  - Updated `saveSettings` to safely preserve existing settings keys on partial updates.
  - Automatically recorded active game changes on initial load and when switching games in the dex selector.

## [v1.16.2] - 2026-09-13

### Added

- **Exclusive Condition Notices (`db.js`)**: Extended `detectExclusiveEncounterMethod` to identify when 100% of a Pokémon's encounters in a game group share a single condition (e.g. `🌙 Encountered only at Night` for Hoothoot in Gold/Silver, `🌅 Encountered only in the Morning`, `☀️ Encountered only during the Day`, `🦗 Encountered only during Swarms`, `📡 Encountered only via Poké Radar`, `🎮 Encountered only via GBA Dual-Slot insertion`).
- **Contextual Notice Icons**: Added dedicated contextual icons for encounter notice banners (`🌙`, `🌅`, `☀️`, `🦗`, `📡`, `🎮`, `🎣`, `🌊`, `🤿`, `🪨`, `🌳`, `🦴`, `🥚`, `🎁`, `⭐`, `⚔️`).
- **Redundant Tag Filtering**: Automatically suppressed repetitive per-item condition tags when an exclusive top-level notice is present, keeping location lists clean and readable.

### Changed

- **Multi-Cartridge Dual-Slot Consolidation**: Consolidated multi-cartridge GBA insertion condition variants sharing identical percentages (e.g. Chansey on Route 209/210 in DPPt) into clean, compact single-line titles/chips (e.g. `Route 209 (Dual-slot: Ruby, Sapphire, Emerald, FireRed) [4%]`), eliminating multi-line wrapping and clutter on mobile displays.

## [v1.16.1] - 2026-09-13

### Fixed

- **Missing Guide Card Rendering**: Fixed a `ReferenceError` (`isHomeMode`) during missing Pokémon card DOM construction, restoring full card list rendering in the **Missing Pokémon** tab.
- **Search Filter Resilience**: Safely handled structured location objects when executing string query matching in `getFilteredMissingList`.

## [v1.16.0] - 2026-09-13

### Added

- **Encounter Rate Probabilities**: Displayed encounter chance percentages (e.g. `20%`, `45%`, `5%`) directly in the Pokémon Information modal alongside location names.
- **Rarity Accenting**: Styled encounter rate badges according to probability rarity:
  - Common / High (≥20%): Emerald green pill badge.
  - Uncommon (10–19%): Royal blue pill badge.
  - Rare (<10%): Warm amber/gold pill badge.
- **Time-of-Day & Special Condition Chips**: When encounter rates vary by time of day, seasons, weather, or game mechanics, compact emoji condition chips (e.g., `🌅 Morning 20%`, `☀️ Day 20%`, `🌙 Night 10%`, `🦗 Swarm 40%`, `📡 Radar 12%`, `🎮 Dual-slot 8%`) are neatly rendered below the location row without cluttering the interface.
- **Level Range Indicators**: Added subtle level badges (e.g., `Lv. 2–4`) for granular encounter insights.
- **Missing Guide Rate Insights**: Surfaced encounter probability rates next to location previews in the Missing Guide checklist, allowing collectors to quickly identify the best catching locations.

## [v1.15.0] - 2026-09-13

### Added

- **Keep Screen Awake (Wake Lock)**: Added a **"Keep screen awake"** toggle switch in the Settings modal under _General > Startup & Preferences_. When enabled, it utilizes the standard Screen Wake Lock API (`navigator.wakeLock`) to prevent mobile screens and tablets from dimming or locking while the Pokédex tracker is open.
- **Smart Lifecycle Management**: The wake lock seamlessly releases when switching tabs or backgrounding the app to preserve battery life, and automatically re-acquires upon returning when enabled.
- **Graceful Fallback**: If the browser or environment does not support the Screen Wake Lock API, the toggle is automatically disabled with an informative indicator message.

## [v1.14.0] - 2026-09-13

### Added

- **Starter Pokémon Tracking**: Canonical starter encounter locations across all 19 games with dedicated styled chips (`(Starter)`) in the Pokémon Information modal. Modern starter trios lacking wild encounter tables (e.g., Gen 8 Grookey/Scorbunny/Sobble and Gen 9 Sprigatito/Fuecoco/Quaxly) now correctly display their starting location instead of _"No encounters in this generation"_.
- **In-Game Gift & Fossil Tags**: In-game gifts, gift eggs, and fossil revivals across all games are now cleanly identified with distinct badge styling (`(Gift)`, `(Gift Egg)`, `(Fossil)`).
- **Missing Pokémon Guide Integration**:
  - Added **`🌟 Starter Choice`** and **`🎁 In-Game Gift / Fossil`** acquisition method filter options to the Missing Pokémon Guide.
  - Rendered dedicated method badges (e.g., `🌟 Starter: Cabo Poco`, `🎁 Gift: Silph Co.`, `🦖 Fossil: Mining Museum`) in card views.
  - Added Starter and Gift priority levels in Acquisition Method sorting.
- **Gift Pokémon Category Filter**: Added a new **"🎁 Gift Pokémon"** category preset and button in the Multi-Filter modal alongside Starters, Fossils, Babies, and Legendaries.

## [v1.13.2] - 2026-09-13

### Changed

- **Missing Guide Tab Controls**: Hid compact/card switching and search/filter controls where they do not apply, especially in Items & Tasks.
- **Family Quotas Sorting**: Added working Regional, National, family-name, completion, and specimen-needed sorting options.

## [v1.13.1] - 2026-09-13

### Fixed

- **Offline Encounter Data**: Added all game encounter datasets to the service worker data cache so the Missing Guide and Pokémon Information modal retain wild locations and encounter details when the network is unavailable.

## [v1.13.0] - 2026-09-13

### Added

- **Missing Guide Dex Sorting**: The guide now defaults to Regional Pokédex order and offers explicit Regional and National Dex ascending/descending sort options. Pokémon cards display the number associated with the active Dex sort.

## [v1.12.0] - 2026-09-13

### Added

- **Missing Guide Usability Improvements**: Added result summaries, removable active-filter chips, persisted tab and view preferences, compact list mode, family progress bars, lazy family/item tab loading, and undo feedback after marking a Pokémon caught.

### Changed

- **Guide Performance**: Reused the computed missing Pokémon dataset for the Items & Tasks summary and deferred family/item calculations until their tabs are opened.
- **Guide Accessibility**: Added tab/panel relationships, roving tab focus, live result feedback, grouped family member controls, reduced-motion support, and mobile overflow refinements.

### Fixed

- **Canonical Caught-State Updates**: Missing Guide actions and inventory quantity changes now use canonical specimen keys, preserving correct state for alternate forms, gender variants, custom layouts, and shiny tracking.

## [v1.11.1] - 2026-09-13

### Changed

- **National Pokédex Order Section Partitioning**: Refactored `transformToNational` in `js/layout.js` to sort the primary/base Pokédex into strict National Pokédex order (`#001`–`#1025`) while keeping active auxiliary sections (Regional Forms, Alternate & Battle Forms, Gender Variants, Vivillon, etc.) in their own **separate box sections** at the bottom, maintaining clear demarcation from the "All Forms Inline" preset.
- **Game-Specific Form & Gender Filtering**: Updated `LivingDex-Scraper` pipeline to automatically filter optional form and gender variant entries against the game's actual base/DLC Pokédex roster.
  - Eliminated out-of-dex gender differences (e.g. Venusaur Female in Sun/Moon, Meganium/Torchic Female in Black/White, Gen 1–4 gender variants in Legends Arceus) across all 19 game datasets.
  - Omitted empty auxiliary sections for games that do not feature the base species (e.g. Flabébé in Sun/Moon).

### Fixed

- **Specimen Key Deduplication across Inline & Sorted Presets**: Added unique specimen key tracking (`seenKeys = new Set()`) using `getSpecimenKey(entry)` in `transformToInline`, `transformToEvolutionary`, and `transformToAlphabetical` (`js/layout.js`). Prevents duplicate identical cards (such as 2x Alolan Sandshrew / Sandslash / Vulpix / Ninetales in Sun/Moon) from appearing side-by-side when regional forms are present in both the base regional Pokédex and the active Regional Forms section.

## [v1.11.0] - 2026-09-13

### Added

- **Regional Origin Box Layout Preset** (`regional-origin`): Added a dedicated layout preset for all post-Gen 1 games (`gsc`, `rse`, `dppt`, `hgss`, `bw`, `b2w2`, `xy`, `oras`, `sm`, `usum`, `swsh`, `bdsp`, `pla`, `sv`, `za`).
  - Filters out legacy species to display strictly the new Pokémon species native to that game's region.
  - Automatically indexes every entry with its canonical National Pokédex number (e.g. `#152`–`#251` for Johto, `#252`–`#386` for Hoenn, `#906`–`#1025` for Paldea).
  - Starts cleanly at Box 1, Slot 1 for compact, contiguous cartridge-based Origin Living Dexes.
  - Appropriately omitted for Kanto games (`rby`, `frlg`, `lgpe`) and Pokémon HOME where generation ranges are already naturally covered.

---

## [v1.10.1] - 2026-09-12

### Added

- **Game-Specific Box Layout Presets**: Added specialized in-game box organization presets matching regional storage conventions:
  - **Alola Islands**: 4 dedicated island boxes (_Melemele_, _Akala_, _Ula'ula_, and _Poni_) with padding to match in-game box storage.
  - **Kalos Unified**: Combines Central, Coastal, and Mountain Kalos regional dexes into a single sequential layout.
  - **Galar & Paldea Unified**: Seamlessly combines base game and expansion pass dexes (Isle of Armor, Crown Tundra, Kitakami, Blueberry Academy).
  - **Hisui Areas**: 5 territory boxes (_Obsidian Fieldlands_, _Crimson Mirelands_, _Cobalt Coastlands_, _Coronet Highlands_, and _Alabaster Icelands_).
- **Dynamic Layout Resolver** (`getAvailableLayoutPresetsForGame`): Dynamically inspects the active game configuration and presents only valid, tailored layout presets in Dex Options.
- **Dedicated Layout Module** (`js/layout.js`): Extracted transformation algorithms into a clean, reusable module for calculating box padding, sequential ordering, and sub-dex merging.

### Changed

- Refactored `js/db.js` and `js/storage.js` to persist and manage layout presets per game independently.

---

## [v1.9.19] - 2026-09-12

### Added

- **Active Game Version Selector in Dex Options**: Allows selecting specific paired versions (e.g., _Scarlet_ vs. _Violet_, _Sword_ vs. _Shield_, _Sun_ vs. _Moon_) directly inside the Dex Options modal.

---

## [v1.9.18] - 2026-09-12

### Added

- **Interactive Layout Preset Explanations**: Dynamic detail cards in Dex Options describing slot arrangements, box count estimates, and structural differences for each selected preset.
- Polished box customization descriptions and visual hierarchy in modal dialogs.

---

## [v1.9.10] - 2026-09-12

### Added

- **Floating Box Coordinates HUD Tooltip**: Real-time cursor-following coordinate HUD indicating the exact box number, row, column, and slot number (e.g. `Box 1 · Row 2, Col 3 · Slot 9`).
- **Settings Toggle**: Added a user setting (`Show Box Coordinates HUD`) with instant persistence and live toggle capability.

### Fixed

- Dark theme styling consistency in the box layout preset selector.
- Removed deprecated header layout preset dropdown in favor of the centralized Dex Options modal.

---

## [v1.9.7] - 2026-09-12

### Added

- **Primary Types Layout Preset (18 Boxes)**: Arranges Pokémon into 18 dedicated storage boxes grouped by their primary elemental type (Normal, Fire, Water, Grass, etc.).
- **Alphabetical Layout Preset (A-Z)**: Sorts all active Pokémon alphabetically by localized species name with continuous 30-slot box layout.

---

## [v1.8.2] - 2026-09-12

### Changed

- **Storage Migration & Key Normalization**: Enhanced caught slot persistence in `storage.js` with automatic normalization for legacy storage keys across previous versions.

---

## [v1.8.0] - 2026-09-12

### Added

- **Pokémon HOME Box Layout Presets Engine**:
  - _Standard Dex (Forms at End)_: Numerical National Pokédex followed by regional forms and cosmetic variants.
  - _Generational Clean (Padded Region Boxes)_: Starts each generation at the beginning of a fresh 30-slot PC box with trailing padding slots.
  - _All Forms Inline_: Places regional and alternate forms immediately adjacent to their base species in numerical order.
  - _Evolution Lines (Cross-Gen Families)_: Groups cross-generational evolution lines together (e.g., Pichu $\to$ Pikachu $\to$ Raichu, Togepi line).

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

---

## [v1.7.7] - 2026-09-12

### Added

- **First-Time Visitor Welcome Guide (`modalWelcomeGuide`)**: Interactive onboarding modal introducing new users to LivingDex features (30-slot box organization, batch drag selection, Dex Options presets, and offline PWA support).
- First-time visit detection with automatic dismissal tracking in browser storage.

---

## [v1.7.6] - 2026-09-12

### Added

- **Exclusive Encounter Method Detection**: Automatically identifies and highlights rare capture methods from dataset location strings (e.g., _Roaming_, _In-game Gift_, _Fossil Revival_, _In-game Trade_, _Tera Raid_, _Mass Outbreak_).
- **Location Name & Tag Parsing** (`parseLocationEntry`): Cleaner visual layout in Pokémon Info encounter summaries with pill badges for specific encounter conditions.

### Changed

- Refined responsive mobile breakpoint to `768px`.

---

## [v1.6.5] - 2026-09-07

### Added

- **Evolution Family Checklist & Sacrifice Quotas**: Added evolution lineage tracking inside the Missing Guide modal, calculating required specimen counts to complete full evolutionary families (e.g., catching 3 Oddish to evolve Gloom, Vileplume, and Bellossom).
- **Evolution Items Shopping List**: Summary checklist of all required Evolution Stones and special items needed to evolve remaining missing species.
- **Game Version Filtering in Missing Guide**: Toggle between paired versions to display only Pokémon obtainable in the selected game cartridge.
- **Settings Tabbed Navigation**: Redesigned Settings modal with organized tabs for _General_, _Display & HUD_, _Box Management_, and _Backup & Data_.
- **Proactive Update Check Button**: Added a manual "Check for Updates" button in Settings to check for new releases on demand.

---

## [v1.6.0] - 2026-09-07

### Added

- **Missing Pokémon Guide Modal (`M` key)**:
  - Instant overview of all remaining uncaught Pokémon for the active game.
  - Encounter location summaries and direct quick-catch action buttons.
  - Header badge displaying live uncaught count.
- Integrated missing guide module (`js/ui/missing-guide.js`) into the application shell.

---

## [v1.5.24] - 2026-09-04

### Added

- **Mobile Touch Drag Selection & Floating Drag HUD**:
  - Touch-drag painting on mobile and tablet devices: press, hold, and drag across Pokémon slots to batch mark them caught or uncaught.
  - Floating live Drag HUD displaying real-time painted slot counts and target action (`+ Marking Caught` / `- Marking Uncaught`).
- **Dynamic Mobile Header Height Adjustment**: Eliminates layout shifts during scrolling and responsive viewport resizing.

---

## [v1.5.19] - 2026-09-04

### Added

- **Pokémon Info Modal Navigation**: Added previous (`←`) and next (`→`) navigation arrows to browse Pokémon info without closing the modal.
- **Audio Cries Integration**: Embedded Pokémon cries player with direct audio playback.

---

## [v1.5.15] - 2026-09-04

### Fixed

- **Mobile Search Bug Fixes**:
  - Resolved an issue on iOS and Android where typing in the search bar moved the cursor to the beginning of the text input.
  - Added dedicated clear button (`×`) to search input that dismisses the virtual keyboard on tap.
  - Prevented search bar scroll jump and CSS overflow anchoring bugs.

---

## [v1.5.9] - 2026-09-01

### Added

- **Pokémon Legends: Z-A Hyperspace Pokédex**: Added dataset, configuration, and box structure for the Hyperspace Dex from Pokémon Legends: Z-A.
- **Segments Guide & Discovery Tips Modal**: Visual guide explaining optional segments, DLC expansions, and form variants.

---

## [v1.5.4] - 2026-09-01

### Added

- **Gender & Form-Specific Sprite Engine**:
  - Enhanced `resolveMemberSpriteId` to resolve gender differences (e.g., Hippowdon, Meowstic, Indeedee) and specific cosmetic forms across box grids, info modals, and evolution flowcharts.
  - Added sprite ID resolution to `populateDexSlots` and `applySpriteStyleToCells`.

---

## [v1.5.1] - 2026-09-01

### Added

- **Form Variant Architecture & Subtitles**:
  - Detailed form variant display with subtitle badges (e.g., _Alolan Form_, _Galarian Form_, _Paldean Form_, _Hisuian Form_, _Origin Forme_, _Gigantamax_).
  - Categorized forms dataset covering Unown, Vivillon, Alcremie, Furfrou, Minior, and Flabébé variants.

---

## [v1.4.0] - 2026-09-01

### Added

- **Game-Specific Evolution Database (`data/evolutions.json`)**: Replaced generic evolution data with game-specific evolution triggers, required items, level conditions, and trade requirements tailored to each generation.

---

## [v1.3.0] - 2026-09-01

### Added

- **Custom In-Game Box Labels**:
  - Tap any box header to rename it inline (e.g., _"Box 1: Starters"_, _"Box 12: Legendaries"_).
  - Saved persistently to browser storage with 1-click reset in Settings.
- **Persistent Box Collapse States**:
  - Smooth collapsible boxes (`▲` / `▼`) with persistent open/closed memory.
  - Optional **Smart Auto-Collapse**: Automatically collapses completed boxes ($30/30$ caught) upon reaching $100\%$.

---

## [v1.1.0] - 2026-09-01

### Added

- **In-App Update Notification Banner**:
  - Detects background updates and displays a clean, non-intrusive bottom banner.
  - "Update Now" button triggers an instant refresh without losing local progress.

---

## [v1.0.8] - 2026-09-01

### Added

- **Per-Game Dataset Architecture (`./data/games/*.json`)**:
  - Split monolithic dataset into individual JSON files per game (`home.json`, `sv.json`, `swsh.json`, `rby.json`, `gsc.json`, `rse.json`, `frlg.json`, `dppt.json`, `hgss.json`, `bw.json`, `b2w2.json`, `xy.json`, `oras.json`, `sm.json`, `usum.json`, `lgpe.json`, `bdsp.json`, `pla.json`, `za.json`).
  - Reduced initial memory footprint and enabled instant game switching.

---

## [v1.0.7] - 2026-09-01

### Added

- **Native `CompressionStream` Sharing**:
  - Replaced bundled external compression library with native browser `CompressionStream` (Deflate-Raw / Gzip) for ultra-compact URL sharing hashes.
  - Decreased download payload and improved compression/decompression speed.

---

## [v1.0.6] - 2026-09-01

### Changed

- **Typography Optimization**: Migrated all local font assets to modern WOFF2 format (`Inter-VariableFont`), reducing font file sizes by $>60\%$.

---

## [v1.0.0] - 2026-09-01

### Added

- **Full Progressive Web App (PWA) Offline Engine**:
  - Complete offline caching strategy for app shell assets, datasets, and Pokémon sprites.
  - Full PWA installability on iOS Safari, Android Chrome, and desktop browsers.
- **Scraper Pipeline Extraction (`LivingDex-Scraper`)**:
  - Extracted data generation tools into a separate modular CLI toolset with bounded concurrency worker pool, HTTP retry engine, and scrapers for Serebii, Bulbapedia, and PokeAPI.

---

## Multi-Game Expansion & Localization - Aug 2026

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

## Modular JS Split - Nov 2025

### Added

- **Compressed URL Hash Sharing**: Living dex export states encoded in shareable URL links.
- **Collapsible Mobile Header**: Header automatically collapses during downward scrolling to maximize box grid visibility.
- **Hide Caught Filter Mode**: Quick toggle to hide caught Pokémon and display only uncaught slots.
- **System Theme Support**: Automatic detection of OS dark/light mode preference (`auto`).

### Changed

- **Monolith Decomposition**: Split original single-file `app.js` (1,200 lines) into ES modules (`main.js`, `api.js`, `ui.js`, `storage.js`, and `config.js`).
- Migrated URL parameter from `?dex` to `?game`.

---

## Initial Release - Oct 2025

### Added

- **Initial LivingDex.app Release**:
  - Vanilla HTML5/CSS3/JavaScript client-side application with zero dependencies and no build tools.
  - 30-slot PC Box organization matching in-game storage layout (`#001-030`).
  - PokeAPI integration for sprites and species data with browser caching.
  - Multi-dex support (National Dex and Pokémon Legends: Z-A).
  - Search, box completion counters (`X/30`), and bulk catch/clear toggles.
  - Dark and Light theme engine.
  - Open source MIT License and attribution notices.
