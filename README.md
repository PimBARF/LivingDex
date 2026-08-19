# LivingDex.app ✨

A simple Pokédex tracker for keeping tabs on every catch, across every game and region.

It’s a lightweight static web app: no login, no backend, and no build step. Just open the site in a browser and start tracking.

## What it does

- Pick a game or region
- Toggle optional dex segments like DLC or form groups
- Mark Pokémon as caught or uncaught
- Search by name or number
- Hide already-caught entries when you want to focus on what’s left
- See live progress while you play
- Share your progress with a link
- Keep everything saved in your browser

## Quick start

1. Download or clone this repo.
2. Open `index.html` in a browser.

Or run a tiny local server:

```bash
python -m http.server 8080
```

Then open http://localhost:8080 in your browser.

## Features

- Tracks many mainline games and dexes
- Supports optional DLC and regional forms
- Works with search and filtering
- Includes dark mode and light mode
- Uses local browser storage, so your progress stays on your device
- Pulls Pokémon data from PokeAPI and caches it locally

## Project structure

- `index.html` — app shell and UI
- `styles.css` — layout and styling
- `js/` — app logic
  - `config.js` — game and dex definitions
  - `api.js` — PokeAPI requests and caching
  - `storage.js` — browser storage helpers
  - `ui.js` — rendering and user interactions
  - `main.js` — app startup

## Support

If you use this project and want to help keep it free and running, you can donate on Ko-fi:

- https://ko-fi.com/pimbarf

## Notes

- No dependencies or build tools are required.
- Progress is stored in your browser, not on a server.
- If you want to clear saved progress, clear the site data for this app in your browser settings.

## License

MIT. See [LICENSE](./LICENSE) for details.

