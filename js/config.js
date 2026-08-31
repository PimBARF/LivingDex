/**
 * Configuration module for Pokémon games, Pokédex definitions, regional forms,
 * storage keys, and sprite URL utilities.
 *
 * @typedef {Object} PokedexSegment
 * @property {string} id - Unique identifier for the Pokédex segment.
 * @property {string} title - Display name of the Pokédex segment.
 * @property {number} [pokedexId] - ID used to fetch data from PokéAPI.
 * @property {'base'|'dlc'|'forms'} type - Type of Pokédex segment (e.g., 'base', 'dlc', 'forms').
 * @property {boolean} optional - Whether the Pokédex segment is optional to include.
 * @property {boolean} [defaultEnabled] - Whether an optional segment is enabled by default.
 * @property {number} [startEntry] - Starting entry index for partial dexes.
 * @property {number} [endEntry] - Ending entry index for partial dexes.
 * @property {number[]} [manualIds] - Explicit list of Pokémon form/species IDs for manual dexes.
 *
 * @typedef {Object} GameConfig
 * @property {string} title - Display name of the game.
 * @property {string} storagePrefix - Prefix for (local)Storage keys.
 * @property {string} group - Group identifier for sorting (e.g., 'gen1', 'special').
 * @property {number} order - Display ordering index within the group.
 * @property {PokedexSegment[]} dexes - Array of Pokédexes/segments within the game.
 */

const HOME_REGIONAL_FORM_IDS = [
  // Alolan Forms
  10091, 10092, 10100, 10101, 10102, 10103, 10104, 10105, 10106, 10107, 10108,
  10109, 10110, 10111, 10112, 10113, 10114, 10115,
  // Galarian Forms
  10161, 10162, 10163, 10164, 10165, 10166, 10167, 10168, 10169, 10170, 10171,
  10172, 10173, 10174, 10175, 10176, 10177, 10179, 10180,
  // Hisuian Forms
  10229, 10230, 10231, 10232, 10233, 10234, 10235, 10236, 10237, 10238, 10239,
  10240, 10241, 10242, 10243, 10244, 10247,
  // Paldean Forms
  10250, 10253,
];

const ALOLAN_FORM_IDS = [
  10091, 10092, 10100, 10101, 10102, 10103, 10104, 10105, 10106, 10107, 10108,
  10109, 10110, 10111, 10112, 10113, 10114, 10115,
];

const GALARIAN_FORM_IDS = [
  10161, 10162, 10163, 10164, 10165, 10166, 10167, 10168, 10169, 10170, 10171,
  10172, 10173, 10174, 10175, 10176, 10177, 10179, 10180,
];

/**
 * Returns a Set of default enabled Pokédex segment IDs for a given game.
 * Non-optional segments and optional segments with `defaultEnabled: true` are included.
 *
 * @param {GameConfig} [game=ACTIVE_GAME] - The game configuration to extract enabled segment IDs from.
 * @returns {Set<string>} Set of enabled Pokédex segment IDs.
 */
export function getDefaultEnabledSegments(game = ACTIVE_GAME) {
  return new Set(
    game.dexes
      .filter((seg) => !seg.optional || seg.defaultEnabled === true)
      .map((seg) => seg.id),
  );
}

const HISUIAN_FORM_IDS = [
  10229, 10230, 10231, 10232, 10233, 10234, 10235, 10236, 10237, 10238, 10239,
  10240, 10241, 10242, 10243, 10244, 10247,
];

const PALDEAN_FORM_IDS = [10250, 10253];

// IDs verified against PokeAPI (pokemon/[name]-gmax). Order:
// venusaur, charizard, blastoise, butterfree, pikachu, meowth, machamp, gengar,
// kingler, lapras, eevee, snorlax, garbodor, melmetal,
// rillaboom, cinderace, inteleon, corviknight, orbeetle, drednaw, coalossal,
// flapple, appletun, sandaconda, toxtricity-amped, centiskorch, hatterene,
// grimmsnarl, alcremie, copperajah, duraludon, urshifu-single-strike, urshifu-rapid-strike
const GIGANTAMAX_FORM_IDS = [
  10195, 10196, 10197, 10198, 10199, 10200, 10201, 10202, 10203, 10204, 10205,
  10206, 10207, 10208, 10209, 10210, 10211, 10212, 10213, 10214, 10215, 10216,
  10217, 10218, 10219, 10220, 10221, 10222, 10223, 10224, 10225, 10226, 10227,
];

/**
 * Display sort order priority for Pokémon game groups / generations.
 * Lower numerical values appear earlier in navigation and menus.
 * @type {Record<string, number>}
 */
export const GAME_GROUP_ORDER = {
  special: 0,
  gen1: 10,
  gen2: 20,
  gen3: 30,
  gen4: 40,
  gen5: 50,
  gen6: 60,
  gen7: 70,
  gen8: 80,
  gen9: 90,
};

/**
 * Returns game entries sorted primarily by generation/group order and secondarily by game order.
 *
 * @returns {Array<[string, GameConfig]>} Sorted array of `[gameKey, gameConfig]` entries.
 */
export function getOrderedGameEntries() {
  return Object.entries(GAMES).sort(([, left], [, right]) => {
    const leftGroup = GAME_GROUP_ORDER[left.group] ?? 999;
    const rightGroup = GAME_GROUP_ORDER[right.group] ?? 999;
    if (leftGroup !== rightGroup) return leftGroup - rightGroup;
    return (left.order ?? 0) - (right.order ?? 0);
  });
}

/**
 * Master configuration map of all supported Pokémon games and their Pokédex segments.
 * @type {Record<string, GameConfig>}
 */
export const GAMES = {
  // Pokémon Home, only includes National Dex
  home: {
    title: "Pokémon HOME",
    storagePrefix: "home",
    group: "special",
    order: 10,
    dexes: [
      {
        id: "national",
        title: "National Pokédex",
        pokedexId: 1,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Red, Blue, and Yellow
  rby: {
    title: "Red / Blue / Yellow",
    storagePrefix: "rby",
    group: "gen1",
    order: 10,
    dexes: [
      {
        id: "kanto",
        title: "Kanto Pokédex",
        pokedexId: 2,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Gold, Silver, and Crystal
  gsc: {
    title: "Gold / Silver / Crystal",
    storagePrefix: "gsc",
    group: "gen2",
    order: 10,
    dexes: [
      {
        id: "johto",
        title: "Johto Pokédex",
        pokedexId: 3,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Ruby, Sapphire, and Emerald
  rse: {
    title: "Ruby / Sapphire / Emerald",
    storagePrefix: "rse",
    group: "gen3",
    order: 10,
    dexes: [
      {
        id: "hoenn",
        title: "Hoenn Pokédex",
        pokedexId: 4,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon FireRed and LeafGreen
  frlg: {
    title: "FireRed / LeafGreen",
    storagePrefix: "frlg",
    group: "gen3",
    order: 20,
    dexes: [
      {
        id: "kanto",
        title: "Kanto Pokédex",
        pokedexId: 2,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Diamond, Pearl, and Platinum
  dppt: {
    title: "Diamond / Pearl / Platinum",
    storagePrefix: "dppt",
    group: "gen4",
    order: 10,
    dexes: [
      {
        id: "sinnoh",
        title: "Sinnoh Pokédex",
        pokedexId: 5,
        type: "base",
        optional: false,
      },
      {
        id: "sinnoh-extended",
        title: "Extended Sinnoh Pokédex",
        pokedexId: 6,
        type: "base",
        optional: false,
        startEntry: 152,
        endEntry: 210,
      },
    ],
  },

  // Pokémon HeartGold and SoulSilver
  hgss: {
    title: "HeartGold / SoulSilver",
    storagePrefix: "hgss",
    group: "gen4",
    order: 20,
    dexes: [
      {
        id: "johto-updated",
        title: "Updated Johto Pokédex",
        pokedexId: 7,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Black and White
  bw: {
    title: "Black / White",
    storagePrefix: "bw",
    group: "gen5",
    order: 10,
    dexes: [
      {
        id: "unova",
        title: "Unova Pokédex",
        pokedexId: 8,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Black 2 and White 2
  b2w2: {
    title: "Black 2 / White 2",
    storagePrefix: "b2w2",
    group: "gen5",
    order: 20,
    dexes: [
      {
        id: "unova-updated",
        title: "Updated Unova Pokédex",
        pokedexId: 9,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon X and Y
  xy: {
    title: "X / Y",
    storagePrefix: "xy",
    group: "gen6",
    order: 10,
    dexes: [
      {
        id: "kalos-central",
        title: "Kalos Central Pokédex",
        pokedexId: 12,
        type: "base",
        optional: false,
      },
      {
        id: "kalos-coastal",
        title: "Kalos Coastal Pokédex",
        pokedexId: 13,
        type: "base",
        optional: false,
      },
      {
        id: "kalos-mountain",
        title: "Kalos Mountain Pokédex",
        pokedexId: 14,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Omega Ruby and Alpha Sapphire
  oras: {
    title: "Omega Ruby / Alpha Sapphire",
    storagePrefix: "oras",
    group: "gen6",
    order: 20,
    dexes: [
      {
        id: "hoenn-updated",
        title: "Updated Hoenn Pokédex",
        pokedexId: 15,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Sun and Moon
  sm: {
    title: "Sun / Moon",
    storagePrefix: "sm",
    group: "gen7",
    order: 10,
    dexes: [
      {
        id: "alola",
        title: "Alola Pokédex",
        pokedexId: 16,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Ultra Sun and Ultra Moon
  usum: {
    title: "Ultra Sun / Ultra Moon",
    storagePrefix: "usum",
    group: "gen7",
    order: 20,
    dexes: [
      {
        id: "alola",
        title: "Alola Pokédex",
        pokedexId: 21,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Let's Go Pikachu and Eevee
  lgpe: {
    title: "Let's Go Pikachu & Eevee",
    storagePrefix: "lgpe",
    group: "gen7",
    order: 30,
    dexes: [
      {
        id: "kanto",
        title: "Kanto Pokédex",
        pokedexId: 26,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Sword and Shield, includes Galar Dex and Isle of Armor/DLC
  swsh: {
    title: "Sword / Shield",
    storagePrefix: "swsh",
    group: "gen8",
    order: 10,
    dexes: [
      {
        id: "galar",
        title: "Galar Pokédex",
        pokedexId: 27,
        type: "base",
        optional: false,
      },
      {
        id: "gigantamax-forms",
        title: "Gigantamax Forms",
        type: "forms",
        optional: true,
        manualIds: GIGANTAMAX_FORM_IDS,
      },
      {
        id: "armor",
        title: "Isle of Armor",
        pokedexId: 28,
        type: "dlc",
        optional: true,
      },
      {
        id: "tundra",
        title: "Crown Tundra",
        pokedexId: 29,
        type: "dlc",
        optional: true,
      },
    ],
  },

  // Pokémon Brilliant Diamond and Shining Pearl
  bdsp: {
    title: "Brilliant Diamond / Shining Pearl",
    storagePrefix: "bdsp",
    group: "gen8",
    order: 20,
    dexes: [
      {
        id: "sinnoh",
        title: "Sinnoh Pokédex",
        pokedexId: 6,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Legends: Arceus
  pla: {
    title: "Legends: Arceus",
    storagePrefix: "pla",
    group: "special",
    order: 20,
    dexes: [
      {
        id: "hisui",
        title: "Hisui Pokédex",
        pokedexId: 30,
        type: "base",
        optional: false,
      },
    ],
  },

  // Pokémon Scarlet and Violet
  sv: {
    title: "Scarlet / Violet",
    storagePrefix: "sv",
    group: "gen9",
    order: 10,
    dexes: [
      {
        id: "paldea",
        title: "Paldea Pokédex",
        pokedexId: 31,
        type: "base",
        optional: false,
      },
      {
        id: "kitakami",
        title: "The Teal Mask",
        pokedexId: 32,
        type: "dlc",
        optional: true,
      },
      {
        id: "blueberry",
        title: "The Indigo Disk",
        pokedexId: 33,
        type: "dlc",
        optional: true,
      },
    ],
  },

  // Pokémon Legends: Z-A
  za: {
    title: "Legends: Z-A",
    storagePrefix: "za",
    group: "special",
    order: 30,
    dexes: [
      {
        id: "lumiose-city",
        title: "Lumiose Pokédex",
        pokedexId: 34,
        type: "base",
        optional: false,
      },
    ],
  },
};

/**
 * Regional form mappings: maps Pokédex API ID -> (base species ID -> regional form ID).
 * Maps species to their regional form variants that should appear in regional dexes.
 * @type {Record<number, Record<number, number>>}
 */
export const REGIONAL_FORM_MAPPINGS = {
  // Alola Pokédex (16) - Sun/Moon - Alolan forms
  16: {
    19: 10091, // Rattata -> Alolan Rattata
    20: 10092, // Raticate -> Alolan Raticate
    26: 10100, // Raichu -> Alolan Raichu
    27: 10101, // Sandshrew -> Alolan Sandshrew
    28: 10102, // Sandslash -> Alolan Sandslash
    37: 10103, // Vulpix -> Alolan Vulpix
    38: 10104, // Ninetales -> Alolan Ninetales
    50: 10105, // Diglett -> Alolan Diglett
    51: 10106, // Dugtrio -> Alolan Dugtrio
    52: 10107, // Meowth -> Alolan Meowth
    53: 10108, // Persian -> Alolan Persian
    74: 10109, // Geodude -> Alolan Geodude
    75: 10110, // Graveler -> Alolan Graveler
    76: 10111, // Golem -> Alolan Golem
    88: 10112, // Grimer -> Alolan Grimer
    89: 10113, // Muk -> Alolan Muk
    103: 10114, // Exeggutor -> Alolan Exeggutor
    105: 10115, // Marowak -> Alolan Marowak
  },

  // Updated Alola Pokédex (21) - Ultra Sun/Ultra Moon - Alolan forms
  21: {
    19: 10091, // Rattata -> Alolan Rattata
    20: 10092, // Raticate -> Alolan Raticate
    26: 10100, // Raichu -> Alolan Raichu
    27: 10101, // Sandshrew -> Alolan Sandshrew
    28: 10102, // Sandslash -> Alolan Sandslash
    37: 10103, // Vulpix -> Alolan Vulpix
    38: 10104, // Ninetales -> Alolan Ninetales
    50: 10105, // Diglett -> Alolan Diglett
    51: 10106, // Dugtrio -> Alolan Dugtrio
    52: 10107, // Meowth -> Alolan Meowth
    53: 10108, // Persian -> Alolan Persian
    74: 10109, // Geodude -> Alolan Geodude
    75: 10110, // Graveler -> Alolan Graveler
    76: 10111, // Golem -> Alolan Golem
    88: 10112, // Grimer -> Alolan Grimer
    89: 10113, // Muk -> Alolan Muk
    103: 10114, // Exeggutor -> Alolan Exeggutor
    105: 10115, // Marowak -> Alolan Marowak
  },

  // Let's Go Kanto Pokédex (26) - Alolan forms
  26: {
    19: 10091, // Rattata -> Alolan Rattata
    20: 10092, // Raticate -> Alolan Raticate
    26: 10100, // Raichu -> Alolan Raichu
    27: 10101, // Sandshrew -> Alolan Sandshrew
    28: 10102, // Sandslash -> Alolan Sandslash
    37: 10103, // Vulpix -> Alolan Vulpix
    38: 10104, // Ninetales -> Alolan Ninetales
    50: 10105, // Diglett -> Alolan Diglett
    51: 10106, // Dugtrio -> Alolan Dugtrio
    52: 10107, // Meowth -> Alolan Meowth
    53: 10108, // Persian -> Alolan Persian
    74: 10109, // Geodude -> Alolan Geodude
    75: 10110, // Graveler -> Alolan Graveler
    76: 10111, // Golem -> Alolan Golem
    88: 10112, // Grimer -> Alolan Grimer
    89: 10113, // Muk -> Alolan Muk
    103: 10114, // Exeggutor -> Alolan Exeggutor
    105: 10115, // Marowak -> Alolan Marowak
  },

  // Galar Pokédex (27) - Galarian forms
  27: {
    52: 10161, // Meowth -> Galarian Meowth
    77: 10162, // Ponyta -> Galarian Ponyta
    78: 10163, // Rapidash -> Galarian Rapidash
    79: 10164, // Slowpoke -> Galarian Slowpoke
    80: 10165, // Slowbro -> Galarian Slowbro
    83: 10166, // Farfetch'd -> Galarian Farfetch'd
    110: 10167, // Weezing -> Galarian Weezing
    122: 10168, // Mr. Mime -> Galarian Mr. Mime
    144: 10169, // Articuno -> Galarian Articuno
    145: 10170, // Zapdos -> Galarian Zapdos
    146: 10171, // Moltres -> Galarian Moltres
    199: 10172, // Slowking -> Galarian Slowking
    222: 10173, // Corsola -> Galarian Corsola
    263: 10174, // Zigzagoon -> Galarian Zigzagoon
    264: 10175, // Linoone -> Galarian Linoone
    554: 10176, // Darumaka -> Galarian Darumaka
    555: 10177, // Darmanitan -> Galarian Darmanitan
    562: 10179, // Yamask -> Galarian Yamask
    618: 10180, // Stunfisk -> Galarian Stunfisk
  },

  // Isle of Armor (28) - Galarian forms that appear in DLC
  28: {
    52: 10161, // Meowth -> Galarian Meowth
    77: 10162, // Ponyta -> Galarian Ponyta
    78: 10163, // Rapidash -> Galarian Rapidash
    79: 10164, // Slowpoke -> Galarian Slowpoke
    80: 10165, // Slowbro -> Galarian Slowbro
    83: 10166, // Farfetch'd -> Galarian Farfetch'd
    110: 10167, // Weezing -> Galarian Weezing
    122: 10168, // Mr. Mime -> Galarian Mr. Mime
    144: 10169, // Articuno -> Galarian Articuno
    145: 10170, // Zapdos -> Galarian Zapdos
    146: 10171, // Moltres -> Galarian Moltres
    199: 10172, // Slowking -> Galarian Slowking
    222: 10173, // Corsola -> Galarian Corsola
    263: 10174, // Zigzagoon -> Galarian Zigzagoon
    264: 10175, // Linoone -> Galarian Linoone
    554: 10176, // Darumaka -> Galarian Darumaka
    555: 10177, // Darmanitan -> Galarian Darmanitan
    562: 10179, // Yamask -> Galarian Yamask
    618: 10180, // Stunfisk -> Galarian Stunfisk
  },

  // Crown Tundra (29) - More Galarian forms
  29: {
    52: 10161, // Meowth -> Galarian Meowth
    77: 10162, // Ponyta -> Galarian Ponyta
    78: 10163, // Rapidash -> Galarian Rapidash
    79: 10164, // Slowpoke -> Galarian Slowpoke
    80: 10165, // Slowbro -> Galarian Slowbro
    83: 10166, // Farfetch'd -> Galarian Farfetch'd
    110: 10167, // Weezing -> Galarian Weezing
    122: 10168, // Mr. Mime -> Galarian Mr. Mime
    144: 10169, // Articuno -> Galarian Articuno
    145: 10170, // Zapdos -> Galarian Zapdos
    146: 10171, // Moltres -> Galarian Moltres
    199: 10172, // Slowking -> Galarian Slowking
    222: 10173, // Corsola -> Galarian Corsola
    263: 10174, // Zigzagoon -> Galarian Zigzagoon
    264: 10175, // Linoone -> Galarian Linoone
    554: 10176, // Darumaka -> Galarian Darumaka
    555: 10177, // Darmanitan -> Galarian Darmanitan
    562: 10179, // Yamask -> Galarian Yamask
    618: 10180, // Stunfisk -> Galarian Stunfisk
  },

  // Alola Pokédex (16/original-alola) - Alolan forms
  16: {
    19: 10091, // Rattata -> Alolan Rattata
    20: 10092, // Raticate -> Alolan Raticate
    26: 10100, // Raichu -> Alolan Raichu
    27: 10101, // Sandshrew -> Alolan Sandshrew
    28: 10102, // Sandslash -> Alolan Sandslash
    37: 10103, // Vulpix -> Alolan Vulpix
    38: 10104, // Ninetales -> Alolan Ninetales
    50: 10105, // Diglett -> Alolan Diglett
    51: 10106, // Dugtrio -> Alolan Dugtrio
    52: 10107, // Meowth -> Alolan Meowth
    53: 10108, // Persian -> Alolan Persian
    74: 10109, // Geodude -> Alolan Geodude
    75: 10110, // Graveler -> Alolan Graveler
    76: 10111, // Golem -> Alolan Golem
    88: 10112, // Grimer -> Alolan Grimer
    89: 10113, // Muk -> Alolan Muk
    103: 10114, // Exeggutor -> Alolan Exeggutor
    105: 10115, // Marowak -> Alolan Marowak
  },

  // Hisui Pokédex (30/Legends Arceus) - Hisuian forms
  30: {
    58: 10229, // Growlithe -> Hisuian Growlithe
    59: 10230, // Arcanine -> Hisuian Arcanine
    100: 10231, // Voltorb -> Hisuian Voltorb
    101: 10232, // Electrode -> Hisuian Electrode
    157: 10233, // Typhlosion -> Hisuian Typhlosion
    211: 10234, // Qwilfish -> Hisuian Qwilfish
    215: 10235, // Sneasel -> Hisuian Sneasel
    503: 10236, // Samurott -> Hisuian Samurott
    549: 10237, // Lilligant -> Hisuian Lilligant
    550: 10247, // Basculin -> Hisuian Basculin (White-Striped)
    570: 10238, // Zorua -> Hisuian Zorua
    571: 10239, // Zoroark -> Hisuian Zoroark
    628: 10240, // Braviary -> Hisuian Braviary
    705: 10241, // Sliggoo -> Hisuian Sliggoo
    706: 10242, // Goodra -> Hisuian Goodra
    713: 10243, // Avalugg -> Hisuian Avalugg
    724: 10244, // Decidueye -> Hisuian Decidueye
  },

  // Paldea Pokédex (31/Scarlet & Violet) - Paldean forms
  31: {
    128: 10250, // Tauros -> Paldean Tauros (Combat Breed)
    194: 10253, // Wooper -> Paldean Wooper
  },

  // Kitakami Pokédex (32/The Teal Mask) - Paldean forms
  32: {
    128: 10250, // Tauros -> Paldean Tauros (Combat Breed)
    194: 10253, // Wooper -> Paldean Wooper
  },

  // Blueberry Pokédex (33/The Indigo Disk) - Paldean forms
  33: {
    128: 10250, // Tauros -> Paldean Tauros (Combat Breed)
    194: 10253, // Wooper -> Paldean Wooper
  },
};

/**
 * Reads and parses saved user settings from localStorage.
 *
 * @returns {Record<string, *>} Parsed settings object, or an empty object on error or if absent.
 */
function readSavedSettings() {
  try {
    const raw = localStorage.getItem("settings-v1");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Resolves the active game ID based on URL query parameters, saved user settings, or default fallback.
 *
 * @param {string} [search=location.search] - Query string to parse for the `game` parameter.
 * @returns {string} The resolved game identifier (e.g., 'home', 'sv', 'swsh').
 */
export function resolveActiveGameId(search = location.search) {
  const params = new URLSearchParams(search);
  const urlGame = params.get("game");
  if (urlGame) return urlGame;

  const settings = readSavedSettings();
  if (settings.defaultGameMode === "specific" && settings.defaultGameId) {
    return settings.defaultGameId;
  }

  return "home";
}

// Determine active game from URL parameter (?game=za), saved default game, or Pokémon Home
export const ACTIVE_GAME_ID = resolveActiveGameId();
export const ACTIVE_GAME = GAMES[ACTIVE_GAME_ID] || GAMES["home"];
export const BOX_CAPACITY = 30;

export const CAUGHT_STORAGE_KEY = `${ACTIVE_GAME.storagePrefix}-caught-v1`;
export const SHINY_CAUGHT_STORAGE_KEY = `${ACTIVE_GAME.storagePrefix}-shiny-caught-v1`;
export const SEGMENTS_STORAGE_KEY = `${ACTIVE_GAME.storagePrefix}-segments-v1`;

// Global app settings
export const SETTINGS_STORAGE_KEY = "settings-v1";

export const SPECIES_CACHE_KEY = `${ACTIVE_GAME.storagePrefix}-species-names-v1`;
export const SPECIES_CACHE_META_KEY = `${ACTIVE_GAME.storagePrefix}-species-names-meta-v1`;
export const SPECIES_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180 days

// API and UI constants
export const NAME_FETCH_CONCURRENCY = 5;
export const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

// Utility functions for sprite URLs and species name formatting
const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

/**
 * Map of sprite style keys to generator functions that produce image URLs.
 * @type {Record<string, (id: number|string, isShiny: boolean) => string>}
 */
const SPRITE_STYLE_URLS = {
  "official-artwork": (id, isShiny) =>
    `${SPRITE_BASE}/other/official-artwork/${isShiny ? "shiny/" : ""}${id}.png`,
  home: (id, isShiny) =>
    `${SPRITE_BASE}/other/home/${isShiny ? "shiny/" : ""}${id}.png`,
  showdown: (id, isShiny) =>
    `${SPRITE_BASE}/other/showdown/${isShiny ? "shiny/" : ""}${id}.gif`,
  pokesprites: (id, isShiny) =>
    `${SPRITE_BASE}/${isShiny ? "shiny/" : ""}${id}.png`,
};

/**
 * Generates the image/sprite URL for a given Pokémon ID, sprite style, and shiny state.
 *
 * @param {number|string} id - The Pokémon species or form ID.
 * @param {'pokesprites'|'official-artwork'|'home'|'showdown'|string} [style="pokesprites"] - Visual sprite style.
 * @param {boolean} [isShiny=false] - Whether to return the shiny variant sprite URL.
 * @returns {string} URL pointing to the Pokémon sprite image.
 */
export const spriteUrlForSpecies = (
  id,
  style = "pokesprites",
  isShiny = false,
) =>
  (SPRITE_STYLE_URLS[style] || SPRITE_STYLE_URLS["pokesprites"])(id, isShiny);

/**
 * Normalizes a hyphenated Pokémon or form name into a title-cased, space-separated display name.
 * E.g., 'tapu-koko' -> 'Tapu Koko'.
 *
 * @param {string} name - Raw hyphenated species or form name.
 * @returns {string} Formatted display name.
 */
export const normalizeSpeciesName = (name) =>
  name.replace(/-/g, " ").replace(/\b\w/g, (value) => value.toUpperCase());
