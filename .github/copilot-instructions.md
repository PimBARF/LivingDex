# Copilot Instructions – LivingDex

Concise, project-specific guidance for AI coding agents. Focus: vanilla JS SPA, no build tools, no dependencies, small, static footprint.

## Core Architecture
- Single page: `index.html` + `app.js` + `styles.css`; everything dynamic is in `app.js` (DOM creation, events, caching, sharing).
- Dex configuration lives in the `DEXES` object; some dexes are composite (base segment + optional segments toggled & persisted).
- Active dex selected via `?dex=KEY` (default may change; read `app.js`—don’t hardcode). Config derived and stored in a `CONFIG` constant.
- Species lists fetched from PokeAPI Pokédex endpoints; cached per dex/segment in `localStorage`.
- UI boxes: 30 slots per box (mirrors in‑game storage). Bulk actions: mark all caught / clear box.

## State & Caching Patterns
- Caught map key: `${storagePrefix}-caught-v1` (bit-like boolean map per species index).
- Species list caches: `${storagePrefix}-pokedex-v1` (segments have their own keys).
- Name cache: `${storagePrefix}-species-names-v1` + meta `${storagePrefix}-species-names-meta-v1` (stores TTL + hash of species IDs; expires after ~180 days or mismatch).
- Segment toggles: `${storagePrefix}-segments-v1`; theme: `theme-v1`.
- Sharing: Caught state serialized into `#s=...` via bit‑packing (read the encoding IIFE for reference before modifying).

## Data Fetch & Concurrency
- Name hydration uses a helper `mapWithConcurrency(fn, items, limit)` (default 10; constant `NAME_FETCH_CONCURRENCY`). Maintain this pattern—avoid unbounded parallel fetches.
- Sprite/official artwork served from PokeAPI’s GitHub CDN; no runtime transformation.

## UI & Interaction Conventions
- Direct DOM manipulation (create elements, set `textContent`, add classes). Do NOT introduce frameworks or virtual DOM abstractions.
- Theme toggle sets `document.documentElement.dataset.theme = 'dark' | 'light'`; CSS variables in `:root` and `[data-theme="dark"]` override tokens (`--bg`, `--text`, `--card`, `--border`, `--accent`, `--accent-2`).
- Search accepts name, number, or `#number` (normalize input before matching). "Show uncaught only" implemented via a CSS class on caught cells—prefer class toggles over inline styles.
- Accessible modals: focus trap, Escape closes, backdrop click closes; replicate existing ARIA patterns.
- Toast notifications: danger/warn/success; reuse existing container & CSS classes—do not create new styling systems.

## Adding / Modifying a Dex
Minimal example (append inside `DEXES`):
```js
za: { title: 'Pokémon Legends: Z-A', pokedex: 34, storagePrefix: 'za' }
```
Composite form (base + optional segment):
```js
swsh: {
  title: 'Sword/Shield', storagePrefix: 'swsh', composite: true,
  segments: [
    { key: 'base', title: 'Galar', pokedex: 27, kind: 'base', optional: false },
    { key: 'forms', title: 'Forms', kind: 'forms', optional: true, manualIds: [] }
  ]
}
```
After adding: navigate with `?dex=swsh`; first load fetches + caches species.

## Safe Change Guidelines
- Keep everything in `app.js`; new helpers fine, but avoid splitting files.
- Preserve cache key version suffixes (`-v1`) unless performing a deliberate breaking change (then update all dependent logic & share encoder tests).
- Before editing share encoding, run existing console assertions—maintain bit length invariants and correct decode symmetry.
- Avoid adding dependencies or build tooling; PRs introducing them should be rejected.

## Common Tasks
- Clear stale caches: manually `localStorage.removeItem(<key>)` in DevTools.
- Add a UI control: edit `index.html`, wire listener in `app.js`, style via existing tokens in `styles.css`.
- Extend search behavior: adjust normalization logic; keep performance O(n) over in‑memory species list.

## Accessibility & Performance
- Maintain ARIA roles/labels on interactive elements; preserve focus trap logic when modifying modals.
- Be cautious of layout thrashing—batch DOM writes (create fragments, then append) as current code does.

## Non-Goals
- No server/API beyond PokeAPI. No analytics, no tracking.
- No internationalization yet (future idea—don’t preemptively scaffold).

## Review Checklist for Changes
1. No new dependencies or build steps.
2. Cache keys + TTL logic remain consistent.
3. Share hash still round-trips encode/decode.
4. Accessibility (focus, ARIA) unaffected.
5. Performance: no excessive parallel fetches.

Feedback welcome—clarify anything unclear or suggest missing high‑leverage patterns.
