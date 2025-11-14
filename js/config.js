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

export const GAMES = {
    // Pokémon Home, only includes National Dex
    home: {
        title: 'Pokémon Home',
        storagePrefix: 'home',
        dexes: [
            { id: 'national', title: 'National Pokédex', pokedexId: 1, type: 'base', optional: false },
            { 
                id: 'forms', 
                title: 'Regional Forms', 
                type: 'forms', 
                optional: true,
                manualIds: [
                    // Alolan Forms
                    10091, 10092, 10100, 10101, 10102, 10103, 10104, 10105, 10106, 10107,
                    10108, 10109, 10110, 10111, 10112, 10113, 10114, 10115,
                    // Galarian Forms
                    10161, 10162, 10163, 10164, 10165, 10166, 10167, 10168, 10169, 10170,
                    10171, 10172, 10173, 10174, 10175, 10176, 10177, 10179, 10180,
                    // Hisuian Forms
                    10229, 10230, 10231, 10232, 10233, 10234, 10235, 10236, 10237, 10238,
                    10239, 10240, 10241, 10242, 10243, 10244, 10247,
                    // Paldean Forms
                    10250, 10253
                ]
            }
        ]
    },
    
    // Pokémon Sun and Moon
    sm: {
        title: 'Pokémon Sun & Moon',
        storagePrefix: 'sm',
        dexes: [
            { id: 'alola', title: 'Alola Pokédex', pokedexId: 16, type: 'base', optional: false }
        ]
    },
    
    // Pokémon Ultra Sun and Ultra Moon
    usum: {
        title: 'Pokémon Ultra Sun & Ultra Moon',
        storagePrefix: 'usum',
        dexes: [
            { id: 'alola', title: 'Alola Pokédex', pokedexId: 21, type: 'base', optional: false }
        ]
    },
    
    // Pokémon Let's Go Pikachu and Eevee
    lgpe: {
        title: "Pokémon Let's Go Pikachu & Eevee",
        storagePrefix: 'lgpe',
        dexes: [
            { id: 'kanto', title: 'Kanto Pokédex', pokedexId: 26, type: 'base', optional: false }
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
    },
    
    // Pokémon Brilliant Diamond and Shining Pearl
    bdsp: {
        title: 'Pokémon Brilliant Diamond & Shining Pearl',
        storagePrefix: 'bdsp',
        dexes: [
            { id: 'sinnoh', title: 'Sinnoh Pokédex', pokedexId: 6, type: 'base', optional: false }
        ]
    },
    
    // Pokémon Legends: Arceus
    pla: {
        title: 'Pokémon Legends: Arceus',
        storagePrefix: 'pla',
        dexes: [
            { id: 'hisui', title: 'Hisui Pokédex', pokedexId: 30, type: 'base', optional: false }
        ]
    },
    
    // Pokémon Scarlet and Violet
    sv: {
        title: 'Pokémon Scarlet & Violet',
        storagePrefix: 'sv',
        dexes: [
            { id: 'paldea', title: 'Paldea Pokédex', pokedexId: 31, type: 'base', optional: false },
            { id: 'kitakami', title: 'The Teal Mask', pokedexId: 32, type: 'dlc', optional: true },
            { id: 'blueberry', title: 'The Indigo Disk', pokedexId: 33, type: 'dlc', optional: true }
        ]
    },
    
    // Pokémon Legends: Z-A
    za: {
        title: 'Pokémon Legends: Z-A',
        storagePrefix: 'za',
        dexes: [
            { id: 'lumiose-city', title: 'Lumiose Pokédex', pokedexId: 34, type: 'base', optional: false }
        ]
    }
};

// Regional form mappings: species ID -> form ID for specific dexes
// Maps species to their regional form variants that should appear in regional dexes
export const REGIONAL_FORM_MAPPINGS = {
  // Alola Pokédex (16) - Sun/Moon - Alolan forms
  16: {
    19: 10091,    // Rattata -> Alolan Rattata
    20: 10092,    // Raticate -> Alolan Raticate
    26: 10100,    // Raichu -> Alolan Raichu
    27: 10101,    // Sandshrew -> Alolan Sandshrew
    28: 10102,    // Sandslash -> Alolan Sandslash
    37: 10103,    // Vulpix -> Alolan Vulpix
    38: 10104,    // Ninetales -> Alolan Ninetales
    50: 10105,    // Diglett -> Alolan Diglett
    51: 10106,    // Dugtrio -> Alolan Dugtrio
    52: 10107,    // Meowth -> Alolan Meowth
    53: 10108,    // Persian -> Alolan Persian
    74: 10109,    // Geodude -> Alolan Geodude
    75: 10110,    // Graveler -> Alolan Graveler
    76: 10111,    // Golem -> Alolan Golem
    88: 10112,    // Grimer -> Alolan Grimer
    89: 10113,    // Muk -> Alolan Muk
    103: 10114,   // Exeggutor -> Alolan Exeggutor
    105: 10115    // Marowak -> Alolan Marowak
  },
  
  // Updated Alola Pokédex (21) - Ultra Sun/Ultra Moon - Alolan forms
  21: {
    19: 10091,    // Rattata -> Alolan Rattata
    20: 10092,    // Raticate -> Alolan Raticate
    26: 10100,    // Raichu -> Alolan Raichu
    27: 10101,    // Sandshrew -> Alolan Sandshrew
    28: 10102,    // Sandslash -> Alolan Sandslash
    37: 10103,    // Vulpix -> Alolan Vulpix
    38: 10104,    // Ninetales -> Alolan Ninetales
    50: 10105,    // Diglett -> Alolan Diglett
    51: 10106,    // Dugtrio -> Alolan Dugtrio
    52: 10107,    // Meowth -> Alolan Meowth
    53: 10108,    // Persian -> Alolan Persian
    74: 10109,    // Geodude -> Alolan Geodude
    75: 10110,    // Graveler -> Alolan Graveler
    76: 10111,    // Golem -> Alolan Golem
    88: 10112,    // Grimer -> Alolan Grimer
    89: 10113,    // Muk -> Alolan Muk
    103: 10114,   // Exeggutor -> Alolan Exeggutor
    105: 10115    // Marowak -> Alolan Marowak
  },
  
  // Let's Go Kanto Pokédex (26) - Alolan forms
  26: {
    19: 10091,    // Rattata -> Alolan Rattata
    20: 10092,    // Raticate -> Alolan Raticate
    26: 10100,    // Raichu -> Alolan Raichu
    27: 10101,    // Sandshrew -> Alolan Sandshrew
    28: 10102,    // Sandslash -> Alolan Sandslash
    37: 10103,    // Vulpix -> Alolan Vulpix
    38: 10104,    // Ninetales -> Alolan Ninetales
    50: 10105,    // Diglett -> Alolan Diglett
    51: 10106,    // Dugtrio -> Alolan Dugtrio
    52: 10107,    // Meowth -> Alolan Meowth
    53: 10108,    // Persian -> Alolan Persian
    74: 10109,    // Geodude -> Alolan Geodude
    75: 10110,    // Graveler -> Alolan Graveler
    76: 10111,    // Golem -> Alolan Golem
    88: 10112,    // Grimer -> Alolan Grimer
    89: 10113,    // Muk -> Alolan Muk
    103: 10114,   // Exeggutor -> Alolan Exeggutor
    105: 10115    // Marowak -> Alolan Marowak
  },
  
  // Galar Pokédex (27) - Galarian forms
  27: {
    52: 10161,    // Meowth -> Galarian Meowth
    77: 10162,    // Ponyta -> Galarian Ponyta
    78: 10163,    // Rapidash -> Galarian Rapidash
    79: 10164,   // Slowpoke -> Galarian Slowpoke
    80: 10165,   // Slowbro -> Galarian Slowbro
    83: 10166,    // Farfetch'd -> Galarian Farfetch'd
    110: 10167,   // Weezing -> Galarian Weezing
    122: 10168,   // Mr. Mime -> Galarian Mr. Mime
    144: 10169,   // Articuno -> Galarian Articuno
    145: 10170,   // Zapdos -> Galarian Zapdos
    146: 10171,   // Moltres -> Galarian Moltres
    199: 10172,   // Slowking -> Galarian Slowking
    222: 10173,   // Corsola -> Galarian Corsola
    263: 10174,   // Zigzagoon -> Galarian Zigzagoon
    264: 10175,   // Linoone -> Galarian Linoone
    554: 10176,   // Darumaka -> Galarian Darumaka
    555: 10177,   // Darmanitan -> Galarian Darmanitan
    562: 10179,   // Yamask -> Galarian Yamask
    618: 10180    // Stunfisk -> Galarian Stunfisk
  },
  
  // Isle of Armor (28) - Galarian forms that appear in DLC
  28: {
    52: 10161,    // Meowth -> Galarian Meowth
    77: 10162,    // Ponyta -> Galarian Ponyta
    78: 10163,    // Rapidash -> Galarian Rapidash
    79: 10164,   // Slowpoke -> Galarian Slowpoke
    80: 10165,   // Slowbro -> Galarian Slowbro
    83: 10166,    // Farfetch'd -> Galarian Farfetch'd
    110: 10167,   // Weezing -> Galarian Weezing
    122: 10168,   // Mr. Mime -> Galarian Mr. Mime
    144: 10169,   // Articuno -> Galarian Articuno
    145: 10170,   // Zapdos -> Galarian Zapdos
    146: 10171,   // Moltres -> Galarian Moltres
    199: 10172,   // Slowking -> Galarian Slowking
    222: 10173,   // Corsola -> Galarian Corsola
    263: 10174,   // Zigzagoon -> Galarian Zigzagoon
    264: 10175,   // Linoone -> Galarian Linoone
    554: 10176,   // Darumaka -> Galarian Darumaka
    555: 10177,   // Darmanitan -> Galarian Darmanitan
    562: 10179,   // Yamask -> Galarian Yamask
    618: 10180    // Stunfisk -> Galarian Stunfisk
  },
  
  // Crown Tundra (29) - More Galarian forms
  29: {
    52: 10161,    // Meowth -> Galarian Meowth
    77: 10162,    // Ponyta -> Galarian Ponyta
    78: 10163,    // Rapidash -> Galarian Rapidash
    79: 10164,   // Slowpoke -> Galarian Slowpoke
    80: 10165,   // Slowbro -> Galarian Slowbro
    83: 10166,    // Farfetch'd -> Galarian Farfetch'd
    110: 10167,   // Weezing -> Galarian Weezing
    122: 10168,   // Mr. Mime -> Galarian Mr. Mime
    144: 10169,   // Articuno -> Galarian Articuno
    145: 10170,   // Zapdos -> Galarian Zapdos
    146: 10171,   // Moltres -> Galarian Moltres
    199: 10172,   // Slowking -> Galarian Slowking
    222: 10173,   // Corsola -> Galarian Corsola
    263: 10174,   // Zigzagoon -> Galarian Zigzagoon
    264: 10175,   // Linoone -> Galarian Linoone
    554: 10176,   // Darumaka -> Galarian Darumaka
    555: 10177,   // Darmanitan -> Galarian Darmanitan
    562: 10179,   // Yamask -> Galarian Yamask
    618: 10180    // Stunfisk -> Galarian Stunfisk
  },
  
  // Alola Pokédex (16/original-alola) - Alolan forms
  16: {
    19: 10091,    // Rattata -> Alolan Rattata
    20: 10092,    // Raticate -> Alolan Raticate
    26: 10100,    // Raichu -> Alolan Raichu
    27: 10101,    // Sandshrew -> Alolan Sandshrew
    28: 10102,    // Sandslash -> Alolan Sandslash
    37: 10103,    // Vulpix -> Alolan Vulpix
    38: 10104,    // Ninetales -> Alolan Ninetales
    50: 10105,    // Diglett -> Alolan Diglett
    51: 10106,    // Dugtrio -> Alolan Dugtrio
    52: 10107,    // Meowth -> Alolan Meowth
    53: 10108,    // Persian -> Alolan Persian
    74: 10109,    // Geodude -> Alolan Geodude
    75: 10110,    // Graveler -> Alolan Graveler
    76: 10111,    // Golem -> Alolan Golem
    88: 10112,    // Grimer -> Alolan Grimer
    89: 10113,    // Muk -> Alolan Muk
    103: 10114,   // Exeggutor -> Alolan Exeggutor
    105: 10115    // Marowak -> Alolan Marowak
  },
  
  // Hisui Pokédex (30/Legends Arceus) - Hisuian forms
  30: {
    58: 10229,    // Growlithe -> Hisuian Growlithe
    59: 10230,    // Arcanine -> Hisuian Arcanine
    100: 10231,   // Voltorb -> Hisuian Voltorb
    101: 10232,   // Electrode -> Hisuian Electrode
    157: 10233,   // Typhlosion -> Hisuian Typhlosion
    211: 10234,   // Qwilfish -> Hisuian Qwilfish
    215: 10235,   // Sneasel -> Hisuian Sneasel
    503: 10236,   // Samurott -> Hisuian Samurott
    549: 10237,   // Lilligant -> Hisuian Lilligant
    550: 10247,   // Basculin -> Hisuian Basculin (White-Striped)
    570: 10238,   // Zorua -> Hisuian Zorua
    571: 10239,   // Zoroark -> Hisuian Zoroark
    628: 10240,   // Braviary -> Hisuian Braviary
    705: 10241,   // Sliggoo -> Hisuian Sliggoo
    706: 10242,   // Goodra -> Hisuian Goodra
    713: 10243,   // Avalugg -> Hisuian Avalugg
    724: 10244    // Decidueye -> Hisuian Decidueye
  },
  
  // Paldea Pokédex (31/Scarlet & Violet) - Paldean forms
  31: {
    128: 10250,   // Tauros -> Paldean Tauros (Combat Breed)
    194: 10253    // Wooper -> Paldean Wooper
  },
  
  // Kitakami Pokédex (32/The Teal Mask) - Paldean forms
  32: {
    128: 10250,   // Tauros -> Paldean Tauros (Combat Breed)
    194: 10253    // Wooper -> Paldean Wooper
  },
  
  // Blueberry Pokédex (33/The Indigo Disk) - Paldean forms
  33: {
    128: 10250,   // Tauros -> Paldean Tauros (Combat Breed)
    194: 10253    // Wooper -> Paldean Wooper
  }
};

// Determine active game from URL parameter (?game=za) or default to Pokémon Home
export const ACTIVE_GAME_ID = new URLSearchParams(location.search).get('game') || 'home';
export const ACTIVE_GAME = GAMES[ACTIVE_GAME_ID] || GAMES['home'];
export const BOX_CAPACITY = 30;

export const CAUGHT_STORAGE_KEY = `${ACTIVE_GAME.storagePrefix}-caught-v1`;
export const SEGMENTS_STORAGE_KEY = `${ACTIVE_GAME.storagePrefix}-segments-v1`;

export const THEME_STORAGE_KEY = 'theme-v1';

export const SPECIES_CACHE_KEY = `${ACTIVE_GAME.storagePrefix}-species-names-v1`;
export const SPECIES_CACHE_META_KEY = `${ACTIVE_GAME.storagePrefix}-species-names-meta-v1`;
export const SPECIES_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180 days

// API and UI constants
export const NAME_FETCH_CONCURRENCY = 5;
export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Utility functions for sprite URLs and species name formatting
export const spriteUrlForSpecies = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
export const normaliseSpeciesName = name => name.replace(/-/g, ' ').replace(/\b\w/g, value => value.toUpperCase());