/**
 * Configuration object for different Pokémon games and their Pokédexes.
 * title: Display name of the game
 * storagePrefix: Prefix for (local)Storage keys
 * dexes: Array of Pokédexes within the game
 *   id: Unique identifier for the Pokédex
 *   title: Display name of the Pokédex
 *   pokedexId: ID used to fetch data from PokéAPI
 *   type: Type of Pokédex (e.g., 'base', 'dlc', 'forms')
 *   optional: Whether the Pokédex is optional to include
 */

const GAMES = {
    // Pokémon Home, only includes National Dex
    home: {
        title: 'Pokémon Home',
        storagePrefix: 'home',
        dexes: [
            { id: 'national', title: 'National Pokédex', pokedexId: 1, type: 'base', optional: false }
        ]
    },
    
    // Pokémon Sword and Shield, includes Galar Dex and Isle of Armor/DLC
    swsh: {
        title: 'Pokémon Sword & Shield',
        storagePrefix: 'swsh',
        dexes: [
            { id: 'galar', title: 'Galar Pokédex', pokedexId: 27, type: 'base', optional: false },
            { id: 'armor', title: 'Isle of Armor', pokedexId: 28, type: 'dlc', optional: true },
            { id: 'tundra', title: 'Crown Tundra', pokedexId: 29, type: 'dlc', optional: true }
        ]
    }
};

// Determine active game from URL parameter (?game=za) or default to Pokémon Home
const ACTIVE_GAME_ID = new URLSearchParams(location.search).get('game') || 'home';
const ACTIVE_GAME = GAMES[ACTIVE_GAME_ID] || GAMES['home'];

