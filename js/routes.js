/**
 * routes.js
 *
 * Canonical linear story route progression datasets, encounter rate parsers,
 * and smart route scoring engine for LivingDex missing Pokémon guide.
 */

/**
 * Factual story route progression lists for all supported games.
 * Ordered chronologically from the starting town to Victory Road and post-game.
 */
export const GAME_ROUTE_PROGRESSION = {
  // Gen 1: Red / Blue / Yellow
  rby: [
    "Pallet Town",
    "Route 1",
    "Viridian City",
    "Route 22",
    "Route 2 South Towards Viridian City",
    "Route 2",
    "Viridian Forest",
    "Pewter City",
    "Route 2 North Towards Pewter City",
    "Route 3",
    "Mt. Moon",
    "Route 4",
    "Cerulean City",
    "Route 24",
    "Route 25",
    "Route 5",
    "Route 6",
    "Underground Path",
    "Vermilion City",
    "Route 11",
    "Digletts Cave",
    "Route 9",
    "Route 10",
    "Rock Tunnel",
    "Pokemon Tower",
    "Lavender Town",
    "Route 8",
    "Route 7",
    "Celadon City",
    "Rocket Game Corner",
    "Route 16",
    "Route 17",
    "Route 18",
    "Route 12",
    "Route 13",
    "Route 14",
    "Route 15",
    "Fuchsia City",
    "Safari Zone",
    "Saffron City",
    "Silph Co",
    "Fighting Dojo",
    "Power Plant",
    "Sea Route 19",
    "Sea Route 20",
    "Seafoam Islands",
    "Cinnabar Island",
    "Pokemon Mansion",
    "Pokémon Mansion",
    "Sea Route 21",
    "Route 23",
    "Victory Road",
    "Indigo Plateau",
    "Cerulean Cave",
  ],

  // Gen 1 Remakes: FireRed / LeafGreen
  frlg: [
    "Pallet Town",
    "Route 1",
    "Viridian City",
    "Route 22",
    "Route 2 South Towards Viridian City",
    "Route 2",
    "Viridian Forest",
    "Pewter City",
    "Route 2 North Towards Pewter City",
    "Route 3",
    "Mt. Moon",
    "Route 4",
    "Cerulean City",
    "Route 24",
    "Route 25",
    "Route 5",
    "Route 6",
    "Underground Path",
    "Vermilion City",
    "Route 11",
    "Digletts Cave",
    "Route 9",
    "Route 10",
    "Rock Tunnel",
    "Pokemon Tower",
    "Lavender Town",
    "Route 8",
    "Route 7",
    "Celadon City",
    "Rocket Game Corner",
    "Rocket Hideout",
    "Route 16",
    "Route 17",
    "Route 18",
    "Route 12",
    "Route 13",
    "Route 14",
    "Route 15",
    "Fuchsia City",
    "Safari Zone",
    "Saffron City",
    "Silph Co",
    "Fighting Dojo",
    "Power Plant",
    "Sea Route 19",
    "Route 19",
    "Sea Route 20",
    "Route 20",
    "Seafoam Islands",
    "Cinnabar Island",
    "Pokemon Mansion",
    "Pokémon Mansion",
    "Sea Route 21",
    "Route 21",
    "One Island",
    "Kindle Road",
    "Mt. Ember",
    "Two Island",
    "Cape Brink",
    "Three Island",
    "Bond Bridge",
    "Berry Forest",
    "Four Island",
    "Icefall Cave",
    "Five Island",
    "Five Isle Meadow",
    "Memorial Pillar",
    "Lost Cave",
    "Six Island",
    "Water Path",
    "Ruin Valley",
    "Dotted Hole",
    "Pattern Bush",
    "Green Path",
    "Outcast Island",
    "Seven Island",
    "Trainer Tower",
    "Sevault Canyon",
    "Tanoby Ruins",
    "Tanoby Key",
    "Tanoby Chambers",
    "Route 23",
    "Victory Road",
    "Indigo Plateau",
    "Cerulean Cave",
  ],

  // Let's Go Pikachu / Eevee
  lgpe: [
    "Pallet Town",
    "Route 1",
    "Viridian City",
    "Route 22",
    "Route 2 South Towards Viridian City",
    "Route 2",
    "Viridian Forest",
    "Pewter City",
    "Route 2 North Towards Pewter City",
    "Route 3",
    "Mt. Moon",
    "Route 4",
    "Cerulean City",
    "Route 24",
    "Route 25",
    "Route 5",
    "Route 6",
    "Underground Path",
    "Vermilion City",
    "Route 11",
    "Digletts Cave",
    "Route 9",
    "Route 10",
    "Rock Tunnel",
    "Pokemon Tower",
    "Lavender Town",
    "Route 8",
    "Route 7",
    "Celadon City",
    "Rocket Game Corner",
    "Route 16",
    "Route 17",
    "Route 18",
    "Route 12",
    "Route 13",
    "Route 14",
    "Route 15",
    "Fuchsia City",
    "Go Park",
    "Saffron City",
    "Silph Co",
    "Fighting Dojo",
    "Power Plant",
    "Sea Route 19",
    "Route 19",
    "Sea Route 20",
    "Route 20",
    "Seafoam Islands",
    "Cinnabar Island",
    "Pokemon Mansion",
    "Pokémon Mansion",
    "Sea Route 21",
    "Route 21",
    "Route 23",
    "Victory Road",
    "Indigo Plateau",
    "Cerulean Cave",
  ],

  // Gen 2: Gold / Silver / Crystal
  gsc: [
    "New Bark Town",
    "Route 29",
    "Cherrygrove City",
    "Route 30",
    "Route 31",
    "Dark Cave",
    "Violet City",
    "Sprout Tower",
    "Ruins of Alph",
    "Route 32",
    "Union Cave",
    "Route 33",
    "Azalea Town",
    "Slowpoke Well",
    "Ilex Forest",
    "Route 34",
    "Goldenrod City",
    "Goldenrod Underground",
    "Radio Tower",
    "Route 35",
    "National Park",
    "Route 36",
    "Route 37",
    "Ecruteak City",
    "Burned Tower",
    "Bell Tower",
    "Tin Tower",
    "Route 38",
    "Route 39",
    "Olivine City",
    "Glitter Lighthouse",
    "Route 40",
    "Route 41",
    "Whirl Islands",
    "Cianwood City",
    "Route 42",
    "Mt. Mortar",
    "Mahogany Town",
    "Rocket Hideout",
    "Route 43",
    "Lake of Rage",
    "Route 44",
    "Ice Path",
    "Blackthorn City",
    "Dragons Den",
    "Route 45",
    "Route 46",
    "Route 27",
    "Tohjo Falls",
    "Route 26",
    "Victory Road",
    "Indigo Plateau",
    // Kanto Post-Game
    "Vermilion City",
    "Route 6",
    "Saffron City",
    "Route 8",
    "Route 7",
    "Celadon City",
    "Route 16",
    "Route 17",
    "Route 18",
    "Fuchsia City",
    "Route 15",
    "Route 14",
    "Route 13",
    "Route 12",
    "Route 11",
    "Digletts Cave",
    "Route 2",
    "Pewter City",
    "Route 3",
    "Mt. Moon",
    "Route 4",
    "Cerulean City",
    "Route 24",
    "Route 25",
    "Route 9",
    "Route 10",
    "Rock Tunnel",
    "Power Plant",
    "Lavender Town",
    "Route 19",
    "Route 20",
    "Seafoam Islands",
    "Cinnabar Island",
    "Route 21",
    "Pallet Town",
    "Route 1",
    "Viridian City",
    "Route 22",
    "Route 28",
    "Mt. Silver",
  ],

  // Gen 4 Remakes: HeartGold / SoulSilver
  hgss: [
    "New Bark Town",
    "Route 29",
    "Cherrygrove City",
    "Route 30",
    "Route 31",
    "Dark Cave",
    "Violet City",
    "Sprout Tower",
    "Ruins of Alph",
    "Route 32",
    "Union Cave",
    "Route 33",
    "Azalea Town",
    "Slowpoke Well",
    "Ilex Forest",
    "Route 34",
    "Goldenrod City",
    "Goldenrod Underground",
    "Radio Tower",
    "Route 35",
    "National Park",
    "Route 36",
    "Route 37",
    "Ecruteak City",
    "Burned Tower",
    "Bell Tower",
    "Tin Tower",
    "Route 38",
    "Route 39",
    "Olivine City",
    "Glitter Lighthouse",
    "Route 40",
    "Route 41",
    "Whirl Islands",
    "Cianwood City",
    "Cliff Edge Gate",
    "Cliff Cave",
    "Route 47",
    "Route 48",
    "Safari Zone",
    "Route 42",
    "Mt. Mortar",
    "Mahogany Town",
    "Rocket Hideout",
    "Route 43",
    "Lake of Rage",
    "Route 44",
    "Ice Path",
    "Blackthorn City",
    "Dragons Den",
    "Route 45",
    "Route 46",
    "Route 27",
    "Tohjo Falls",
    "Route 26",
    "Victory Road",
    "Indigo Plateau",
    // Kanto Post-Game
    "Vermilion City",
    "Route 6",
    "Saffron City",
    "Route 8",
    "Route 7",
    "Celadon City",
    "Route 16",
    "Route 17",
    "Route 18",
    "Fuchsia City",
    "Route 15",
    "Route 14",
    "Route 13",
    "Route 12",
    "Route 11",
    "Digletts Cave",
    "Route 2 South Towards Viridian City",
    "Route 2 North Towards Pewter City",
    "Route 2",
    "Viridian Forest",
    "Pewter City",
    "Route 3",
    "Mt. Moon",
    "Route 4",
    "Cerulean City",
    "Route 24",
    "Route 25",
    "Route 9",
    "Route 10",
    "Rock Tunnel",
    "Power Plant",
    "Lavender Town",
    "Route 19",
    "Route 20",
    "Seafoam Islands",
    "Cinnabar Island",
    "Route 21",
    "Pallet Town",
    "Route 1",
    "Viridian City",
    "Route 22",
    "Cerulean Cave",
    "Route 28",
    "Mt. Silver",
  ],

  // Gen 3: Ruby / Sapphire / Emerald
  rse: [
    "Littleroot Town",
    "Route 101",
    "Oldale Town",
    "Route 103",
    "Route 102",
    "Petalburg City",
    "Route 104",
    "Petalburg Woods",
    "Rustboro City",
    "Route 116",
    "Rusturf Tunnel",
    "Dewford Town",
    "Route 106",
    "Granite Cave",
    "Route 107",
    "Route 108",
    "Abandoned Ship",
    "Route 109",
    "Slateport City",
    "Route 110",
    "New Mauville",
    "Mauville City",
    "Route 117",
    "Verdanturf Town",
    "Route 111",
    "Route 112",
    "Fiery Path",
    "Jagged Pass",
    "Mt. Chimney",
    "Mirage Tower",
    "Route 113",
    "Fallarbor Town",
    "Route 114",
    "Meteor Falls",
    "Route 115",
    "Route 118",
    "Route 119",
    "Weather Institute",
    "Fortree City",
    "Route 120",
    "Route 121",
    "Safari Zone",
    "Route 122",
    "Mt. Pyre",
    "Route 123",
    "Lilycove City",
    "Team Aqua Hideout",
    "Team Magma Hideout",
    "Magma Hideout",
    "Route 124",
    "Mossdeep City",
    "Route 125",
    "Shoal Cave",
    "Route 126",
    "Underwater",
    "Sootopolis City",
    "Cave of Origin",
    "Route 127",
    "Route 128",
    "Seafloor Cavern",
    "Route 129",
    "Route 130",
    "Mirage Island",
    "Route 131",
    "Sky Pillar",
    "Pacifidlog Town",
    "Route 132",
    "Route 133",
    "Route 134",
    "Sealed Chamber",
    "Ever Grande City",
    "Victory Road",
    "Pokemon League",
    "Battle Frontier",
    "Artisan Cave",
    "Desert Underpass",
  ],

  // Gen 3 Remakes: Omega Ruby / Alpha Sapphire
  oras: [
    "Littleroot Town",
    "Route 101",
    "Oldale Town",
    "Route 103",
    "Route 102",
    "Petalburg City",
    "Route 104",
    "Petalburg Woods",
    "Rustboro City",
    "Route 116",
    "Rusturf Tunnel",
    "Dewford Town",
    "Route 106",
    "Granite Cave",
    "Route 107",
    "Route 108",
    "Sea Mauville",
    "Route 109",
    "Slateport City",
    "Route 110",
    "New Mauville",
    "Mauville City",
    "Route 117",
    "Verdanturf Town",
    "Route 111",
    "Route 112",
    "Fiery Path",
    "Jagged Pass",
    "Mt. Chimney",
    "Route 113",
    "Fallarbor Town",
    "Route 114",
    "Meteor Falls",
    "Route 115",
    "Route 118",
    "Route 119",
    "Weather Institute",
    "Fortree City",
    "Route 120",
    "Route 121",
    "Safari Zone",
    "Route 122",
    "Mt. Pyre",
    "Route 123",
    "Lilycove City",
    "Team Aqua Hideout",
    "Team Magma Hideout",
    "Route 124",
    "Mossdeep City",
    "Route 125",
    "Shoal Cave",
    "Route 126",
    "Underwater",
    "Sootopolis City",
    "Cave of Origin",
    "Route 127",
    "Route 128",
    "Seafloor Cavern",
    "Route 129",
    "Route 130",
    "Route 131",
    "Sky Pillar",
    "Pacifidlog Town",
    "Route 132",
    "Route 133",
    "Route 134",
    "Sealed Chamber",
    "Ever Grande City",
    "Victory Road",
    "Pokemon League",
    "Delta Episode",
    "Battle Resort",
    "Mirage Spot",
    "Soaring in the Sky",
  ],

  // Gen 4: Diamond / Pearl / Platinum
  dppt: [
    "Twinleaf Town",
    "Lake Verity",
    "Route 201",
    "Sandgem Town",
    "Route 202",
    "Jubilife City",
    "Route 204",
    "Ravaged Path",
    "Route 203",
    "Oreburgh Gate",
    "Oreburgh City",
    "Oreburgh Mine",
    "Route 207",
    "Floaroma Town",
    "Floaroma Meadow",
    "Valley Windworks",
    "Route 205",
    "Fuego Ironworks",
    "Eterna Forest",
    "Eterna City",
    "Route 206",
    "Wayward Cave",
    "Mt. Coronet",
    "Route 208",
    "Hearthome City",
    "Route 209",
    "Lost Tower",
    "Solaceon Town",
    "Solaceon Ruins",
    "Route 210",
    "Route 215",
    "Veilstone City",
    "Route 214",
    "Ruin Maniac Cave",
    "Maniac Tunnel",
    "Valor Lakefront",
    "Lake Valor",
    "Route 213",
    "Pastoria City",
    "Great Marsh",
    "Route 212",
    "Pokemon Mansion",
    "Trophy Garden",
    "Celestic Town",
    "Route 211",
    "Route 218",
    "Canalave City",
    "Iron Island",
    "Route 216",
    "Route 217",
    "Acuity Lakefront",
    "Lake Acuity",
    "Snowpoint City",
    "Snowpoint Temple",
    "Spear Pillar",
    "Distortion World",
    "Sendoff Spring",
    "Turnback Cave",
    "Route 222",
    "Sunyshore City",
    "Route 223",
    "Victory Road",
    "Pokemon League",
    // Battle Zone Post-Game
    "Fight Area",
    "Route 225",
    "Survival Area",
    "Route 226",
    "Route 227",
    "Stark Mountain",
    "Route 228",
    "Route 229",
    "Resort Area",
    "Route 230",
  ],

  // Gen 4 Remakes: Brilliant Diamond / Shining Pearl
  bdsp: [
    "Twinleaf Town",
    "Lake Verity",
    "Route 201",
    "Sandgem Town",
    "Route 202",
    "Jubilife City",
    "Route 204",
    "Ravaged Path",
    "Route 203",
    "Oreburgh Gate",
    "Oreburgh City",
    "Oreburgh Mine",
    "Route 207",
    "Floaroma Town",
    "Floaroma Meadow",
    "Valley Windworks",
    "Route 205",
    "Fuego Ironworks",
    "Eterna Forest",
    "Eterna City",
    "Route 206",
    "Wayward Cave",
    "Grand Underground",
    "Mt. Coronet",
    "Route 208",
    "Hearthome City",
    "Route 209",
    "Lost Tower",
    "Solaceon Town",
    "Solaceon Ruins",
    "Route 210",
    "Route 215",
    "Veilstone City",
    "Route 214",
    "Ruin Maniac Cave",
    "Maniac Tunnel",
    "Valor Lakefront",
    "Lake Valor",
    "Route 213",
    "Pastoria City",
    "Great Marsh",
    "Route 212",
    "Pokemon Mansion",
    "Trophy Garden",
    "Celestic Town",
    "Route 211",
    "Route 218",
    "Canalave City",
    "Iron Island",
    "Route 216",
    "Route 217",
    "Acuity Lakefront",
    "Lake Acuity",
    "Snowpoint City",
    "Snowpoint Temple",
    "Spear Pillar",
    "Sendoff Spring",
    "Turnback Cave",
    "Route 222",
    "Sunyshore City",
    "Route 223",
    "Victory Road",
    "Pokemon League",
    "Fight Area",
    "Route 225",
    "Survival Area",
    "Route 226",
    "Route 227",
    "Stark Mountain",
    "Route 228",
    "Route 229",
    "Resort Area",
    "Route 230",
    "Ramanas Park",
  ],

  // Gen 5: Black / White
  bw: [
    "Nuvema Town",
    "Route 1",
    "Accumula Town",
    "Route 2",
    "Striaton City",
    "Dreamyard",
    "Route 3",
    "Wellspring Cave",
    "Nacrene City",
    "Pinwheel Forest",
    "Skyarrow Bridge",
    "Castelia City",
    "Route 4",
    "Desert Resort",
    "Relic Castle",
    "Nimbasa City",
    "Route 5",
    "Driftveil Drawbridge",
    "Driftveil City",
    "Cold Storage",
    "Route 6",
    "Chargestone Cave",
    "Mistralton City",
    "Route 7",
    "Celestial Tower",
    "Twist Mountain",
    "Icirrus City",
    "Dragonspiral Tower",
    "Moor of Icirrus",
    "Route 8",
    "Tubeline Bridge",
    "Route 9",
    "Shopping Mall Nine",
    "Opelucid City",
    "Route 10",
    "Victory Road",
    "Ns Castle",
    // Post-Game Unova
    "Route 11",
    "Village Bridge",
    "Route 12",
    "Lacunosa Town",
    "Route 13",
    "Undella Town",
    "Undella Bay",
    "Abyssal Ruins",
    "Route 14",
    "Abundant Shrine",
    "Black City",
    "White Forest",
    "Route 15",
    "Marvelous Bridge",
    "Route 16",
    "Lostlorn Forest",
    "Route 17",
    "Route 18",
    "P2 Laboratory",
    "Giant Chasm",
    "Liberty Garden",
  ],

  // Gen 5: Black 2 / White 2
  b2w2: [
    "Aspertia City",
    "Route 19",
    "Floccesy Town",
    "Route 20",
    "Floccesy Ranch",
    "Virbank City",
    "Virbank Complex",
    "Castelia City",
    "Castelia Sewers",
    "Relic Passage",
    "Route 4",
    "Desert Resort",
    "Relic Castle",
    "Join Avenue",
    "Nimbasa City",
    "Route 5",
    "Route 16",
    "Lostlorn Forest",
    "Driftveil Drawbridge",
    "Driftveil City",
    "Clay Tunnel",
    "Underground Ruins",
    "Route 6",
    "Chargestone Cave",
    "Mistralton City",
    "Route 7",
    "Celestial Tower",
    "Reversal Mountain",
    "Strange House",
    "Lentimas Town",
    "Undella Town",
    "Undella Bay",
    "Seaside Cave",
    "Route 13",
    "Lacunosa Town",
    "Route 12",
    "Village Bridge",
    "Route 11",
    "Opelucid City",
    "Route 9",
    "Shopping Mall Nine",
    "Route 21",
    "Plasma Frigate",
    "Route 22",
    "Giant Chasm",
    "Route 23",
    "Victory Road",
    "Pokemon League",
    // Post-Game Unova
    "Nuvema Town",
    "Route 1",
    "Route 2",
    "Striaton City",
    "Dreamyard",
    "Route 3",
    "Wellspring Cave",
    "Nacrene City",
    "Pinwheel Forest",
    "Skyarrow Bridge",
    "Route 14",
    "Abundant Shrine",
    "Route 15",
    "Marvelous Bridge",
    "Route 17",
    "Route 18",
    "P2 Laboratory",
    "Nature Preserve",
  ],

  // Gen 6: X / Y
  xy: [
    "Vaniville Town",
    "Aquacorde Town",
    "Route 2",
    "Santalune Forest",
    "Route 3",
    "Santalune City",
    "Route 4",
    "Lumiose City",
    "Route 5",
    "Camphrier Town",
    "Route 6",
    "Parfum Palace",
    "Route 7",
    "Connecting Cave",
    "Route 8",
    "Ambrette Town",
    "Route 9",
    "Glittering Cave",
    "Cyllage City",
    "Route 10",
    "Geosenge Town",
    "Route 11",
    "Reflection Cave",
    "Shalour City",
    "Tower of Mastery",
    "Route 12",
    "Azure Bay",
    "Coumarine City",
    "Route 13",
    "Kalos Power Plant",
    "Route 14",
    "Laverre City",
    "Poke Ball Factory",
    "Route 15",
    "Lost Hotel",
    "Dendemille Town",
    "Frost Cavern",
    "Route 16",
    "Route 17",
    "Anistar City",
    "Team Flare Secret HQ",
    "Route 18",
    "Terminus Cave",
    "Couriway Town",
    "Route 19",
    "Snowbelle City",
    "Route 20",
    "Pokemon Village",
    "Route 21",
    "Victory Road",
    "Pokemon League",
    "Kiloude City",
    "Friend Safari",
    "Sea Spirits Den",
    "Unknown Dungeon",
  ],

  // Gen 7: Sun / Moon
  sm: [
    "Iki Town",
    "Route 1",
    "Hauoli Outskirts",
    "Trainers School",
    "Hauoli City",
    "Route 2",
    "Hauoli Cemetery",
    "Berry Fields",
    "Verdant Cavern",
    "Route 3",
    "Melemele Meadow",
    "Seaward Cave",
    "Kalae Bay",
    "Ten Carat Hill",
    // Akala Island
    "Heahea City",
    "Route 4",
    "Paniola Town",
    "Paniola Ranch",
    "Route 5",
    "Brooklet Hill",
    "Route 6",
    "Royal Avenue",
    "Route 7",
    "Wela Volcano Park",
    "Route 8",
    "Lush Jungle",
    "Digletts Tunnel",
    "Route 9",
    "Memorial Hill",
    "Akala Outskirts",
    "Ruins of Life",
    "Hano Beach",
    "Hano Grand Resort",
    // Ula'ula Island
    "Malie City",
    "Malie Garden",
    "Route 10",
    "Mount Hokulani",
    "Route 11",
    "Route 12",
    "Blush Mountain",
    "Secluded Shore",
    "Route 13",
    "Haina Desert",
    "Tapu Village",
    "Route 14",
    "Thrifty Megamart",
    "Route 15",
    "Aether House",
    "Route 16",
    "Ulaula Meadow",
    "Lake of the Sunne",
    "Lake of the Moone",
    "Route 17",
    "Po Town",
    "Mount Lanakila",
    "Aether Paradise",
    // Poni Island
    "Seafolk Village",
    "Poni Wilds",
    "Ancient Poni Path",
    "Poni Breaker Coast",
    "Ruins of Hope",
    "Exeggutor Island",
    "Vast Poni Canyon",
    "Altar of the Sunne",
    "Altar of the Moone",
    "Ultra Space",
    "Pokemon League",
    // Post-Game
    "Poni Grove",
    "Poni Plains",
    "Poni Meadow",
    "Poni Gauntlet",
    "Battle Tree",
    "Resolution Cave",
  ],

  // Gen 7: Ultra Sun / Ultra Moon
  usum: [
    "Iki Town",
    "Route 1",
    "Hauoli Outskirts",
    "Trainers School",
    "Hauoli City",
    "Big Wave Beach",
    "Route 2",
    "Hauoli Cemetery",
    "Berry Fields",
    "Verdant Cavern",
    "Route 3",
    "Melemele Meadow",
    "Seaward Cave",
    "Kalae Bay",
    "Ten Carat Hill",
    // Akala Island
    "Heahea City",
    "Heahea Beach",
    "Route 4",
    "Paniola Town",
    "Paniola Ranch",
    "Route 5",
    "Brooklet Hill",
    "Route 6",
    "Royal Avenue",
    "Route 7",
    "Wela Volcano Park",
    "Route 8",
    "Lush Jungle",
    "Digletts Tunnel",
    "Route 9",
    "Memorial Hill",
    "Akala Outskirts",
    "Ruins of Life",
    "Hano Beach",
    "Hano Grand Resort",
    // Ula'ula Island
    "Malie City",
    "Malie Garden",
    "Route 10",
    "Mount Hokulani",
    "Route 11",
    "Route 12",
    "Blush Mountain",
    "Secluded Shore",
    "Ulaula Beach",
    "Route 13",
    "Haina Desert",
    "Tapu Village",
    "Route 14",
    "Thrifty Megamart",
    "Route 15",
    "Aether House",
    "Route 16",
    "Ulaula Meadow",
    "Lake of the Sunne",
    "Lake of the Moone",
    "Route 17",
    "Po Town",
    "Mount Lanakila",
    "Aether Paradise",
    // Poni Island
    "Seafolk Village",
    "Poni Beach",
    "Poni Wilds",
    "Ancient Poni Path",
    "Poni Breaker Coast",
    "Ruins of Hope",
    "Exeggutor Island",
    "Vast Poni Canyon",
    "Altar of the Sunne",
    "Altar of the Moone",
    "Ultra Megalopolis",
    "Megalo Tower",
    "Ultra Deep Sea",
    "Ultra Space Wilds",
    "Pokemon League",
    // Post-Game
    "Poni Grove",
    "Poni Plains",
    "Poni Meadow",
    "Poni Gauntlet",
    "Battle Tree",
    "Resolution Cave",
    "Team Rainbow Rocket",
  ],

  // Gen 8: Sword / Shield
  swsh: [
    "Postwick",
    "Slumbering Weald",
    "Route 1",
    "Wedgehurst",
    "Route 2",
    "Meetup Spot",
    // South Wild Area
    "Rolling Fields",
    "Dappled Grove",
    "West Lake Axewell",
    "East Lake Axewell",
    "Watchtower Ruins",
    "Giants Seat",
    "South Lake Miloch",
    "North Lake Miloch",
    // Motostoke & Mines
    "Motostoke",
    "Route 3",
    "Galar Mine",
    "Route 4",
    "Turffield",
    "Route 5",
    "Hulbury",
    "Galar Mine No. 2",
    "Motostoke Outskirts",
    // North Wild Area
    "Motostoke Riverbank",
    "Bridge Field",
    "Stony Wilderness",
    "Dusty Bowl",
    "Giants Mirror",
    "Hammerlocke Hills",
    "Giants Cap",
    "Lake of Outrage",
    // Northern Cities
    "Hammerlocke",
    "Route 6",
    "Stow-on-Side",
    "Glimwood Tangle",
    "Ballonlea",
    "Route 7",
    "Route 8",
    "Steamglade",
    "Circhester",
    "Route 9",
    "Circhester Bay",
    "Route 9 Tunnel",
    "Spikemuth",
    "Route 10",
    "Wyndon",
    "Rose Tower",
    "Wyndon Stadium",
    "Energy Plant",
    // Isle of Armor DLC
    "Fields of Honor",
    "Master Dojo",
    "Soothing Wetlands",
    "Forest of Focus",
    "Challenge Beach",
    "Brawlers Cave",
    "Challenge Road",
    "Courageous Cavern",
    "Loop Lagoon",
    "Training Lowlands",
    "Warm-Up Tunnel",
    "Potbottom Desert",
    "Stepping-Stone Sea",
    "Insular Sea",
    "Honeycalm Sea",
    "Honeycalm Island",
    // Crown Tundra DLC
    "Slippery Slope",
    "Freezington",
    "Max Lair",
    "Frostpoint Field",
    "Giants Bed",
    "Old Cemetery",
    "Snowslide Slope",
    "Tunnel to the Top",
    "Path to the Peak",
    "Crown Shrine",
    "Giants Foot",
    "Roaring-Sea Caves",
    "Frigid Sea",
    "Three-Point Pass",
    "Ballimere Lake",
    "Dyna Tree Hill",
  ],

  // Gen 8: Legends: Arceus (Hisui)
  pla: [
    "Prelude Beach",
    "Jubilife Village",
    // Obsidian Fieldlands
    "Obsidian Fieldlands: Aspiration Hill",
    "Obsidian Fieldlands: Horseshoe Plains",
    "Obsidian Fieldlands: Floaro Gardens",
    "Obsidian Fieldlands: Deertrack Heights",
    "Obsidian Fieldlands: Deertrack Path",
    "Obsidian Fieldlands: Windswept Run",
    "Obsidian Fieldlands: Nature's Pantry",
    "Obsidian Fieldlands: Tidewater Dam",
    "Obsidian Fieldlands: The Heartwood",
    "Obsidian Fieldlands: Oreburrow Tunnel",
    "Obsidian Fieldlands: Grueling Grove",
    "Obsidian Fieldlands: Sandgem Flats",
    "Obsidian Fieldlands: Ramanas Island",
    "Obsidian Fieldlands: Lake Verity",
    "Obsidian Fieldlands: Worn Bridge",
    "Obsidian Fieldlands",
    // Crimson Mirelands
    "Crimson Mirelands: Golden Lowlands",
    "Crimson Mirelands: Gapejaw Bog",
    "Crimson Mirelands: Sludge Mound",
    "Crimson Mirelands: Scarlet Bog",
    "Crimson Mirelands: Ursa's Ring",
    "Crimson Mirelands: Droning Meadow",
    "Crimson Mirelands: Cottonsedge Prairie",
    "Crimson Mirelands: Diamond Settlement",
    "Crimson Mirelands: Diamond Heath",
    "Crimson Mirelands: Cloudpool Ridge",
    "Crimson Mirelands: Bolderoll Ravine",
    "Crimson Mirelands: Lake Valor",
    "Crimson Mirelands: Holm of Trials",
    "Crimson Mirelands",
    // Cobalt Coastlands
    "Cobalt Coastlands: Ginkgo Landing",
    "Cobalt Coastlands: Deadwood Haunt",
    "Cobalt Coastlands: Hideaway Bay",
    "Cobalt Coastlands: Tombolo Walk",
    "Cobalt Coastlands: Sand's Reach",
    "Cobalt Coastlands: Castaway Shore",
    "Cobalt Coastlands: Tranquility Cove",
    "Cobalt Coastlands: Islespy Shore",
    "Cobalt Coastlands: Spring Path",
    "Cobalt Coastlands: Veilstone Cape",
    "Cobalt Coastlands: Seagrass Haven",
    "Cobalt Coastlands: Windbreak Stand",
    "Cobalt Coastlands: Firespit Island",
    "Cobalt Coastlands",
    // Coronet Highlands
    "Coronet Highlands: Heavenward Lookout",
    "Coronet Highlands: Wayward Wood",
    "Coronet Highlands: Wayward Cave",
    "Coronet Highlands: Lonely Spring",
    "Coronet Highlands: Fabled Spring",
    "Coronet Highlands: Celestica Ruins",
    "Coronet Highlands: Sacred Plaza",
    "Coronet Highlands: Primeval Grotto",
    "Coronet Highlands: Clamberclaw Cliffs",
    "Coronet Highlands: Bolderoll Pass",
    "Coronet Highlands: Celestica Trail",
    "Coronet Highlands: Cloudcap Pass",
    "Coronet Highlands: Mount Coronet",
    "Coronet Highlands: Temple of Sinnoh",
    "Coronet Highlands: Stone Portal",
    "Coronet Highlands",
    // Alabaster Icelands
    "Alabaster Icelands: Whiteout Valley",
    "Alabaster Icelands: Bonechill Wastes",
    "Alabaster Icelands: Avalugg's Legacy",
    "Alabaster Icelands: Arena's Approach",
    "Alabaster Icelands: Icepeak Arena",
    "Alabaster Icelands: Glacier Terrace",
    "Alabaster Icelands: Avalanche Slopes",
    "Alabaster Icelands: Heart's Crag",
    "Alabaster Icelands: Icepeak Cavern",
    "Alabaster Icelands: Snowfall Cemetery",
    "Alabaster Icelands: Lake Acuity",
    "Alabaster Icelands: Pearl Settlement",
    "Alabaster Icelands: Ice Column Chamber",
    "Alabaster Icelands: Snowpoint Temple",
    "Alabaster Icelands",
    // Postgame
    "Ancient Retreat",
    "Massive Mass Outbreaks",
    "Space-Time Distortions",
  ],

  // Gen 9: Scarlet / Violet
  sv: [
    "Cabo Poco",
    "Poco Path",
    "Inlet Grotto",
    "Los Platos",
    "Mesagoza",
    // Early South & West
    "South Province (Area One)",
    "South Province (Area Two)",
    "South Province (Area Three)",
    "South Province (Area Four)",
    "South Province (Area Five)",
    "Cortondo",
    "West Province (Area One)",
    "Artazon",
    // Mid East & West
    "East Province (Area One)",
    "East Province (Area Two)",
    "East Province (Area Three)",
    "Levincia",
    "Tagtree Thicket",
    "Zapapico",
    "West Province (Area Two)",
    "Asado Desert",
    "Porto Marinada",
    "West Province (Area Three)",
    "Cascarrafa",
    // Late North & Lake
    "Medali",
    "Casseroya Lake",
    "Montenevera",
    "Glaseado Mountain",
    "Dalizapa Passage",
    "North Province (Area One)",
    "North Province (Area Two)",
    "North Province (Area Three)",
    "North Paldean Sea",
    "East Paldean Sea",
    "South Paldean Sea",
    "West Paldean Sea",
    "Alfornada",
    "South Province (Area Six)",
    "Pokemon League",
    "Great Crater of Paldea",
    "Area Zero",
    "Area Zero Underdepths",
    // Teal Mask DLC (Kitakami)
    "Mossui Town",
    "Kitakami Road",
    "Apple Hills",
    "Loyalty Plaza",
    "Reveler's Road",
    "Kitakami Hall",
    "Oni Mountain",
    "Wistful Fields",
    "Paradise Barrens",
    "Infernal Pass",
    "Crystal Pool",
    "Timeless Woods",
    "Fellhorn Gorge",
    // Indigo Disk DLC (Blueberry Academy)
    "Central Plaza",
    "Savanna Biome",
    "Coastal Biome",
    "Canyon Biome",
    "Polar Biome",
    "Torchlit Labyrinth",
    "Chargestone Cavern",
  ],

  // Legends: Z-A (Lumiose City)
  za: [
    "Vert District: Pokémon Research Lab",
    "Centrico Plaza",
    "Vert District",
    "Bleu District",
    "Rouge District",
    "Jaune District",
    "Magenta District",
    "Wild Zone 1",
    "Wild Zone 2",
    "Wild Zone 3",
    "Wild Zone 4",
    "Wild Zone 5",
    "Wild Zone 6",
    "Wild Zone 7",
    "Wild Zone 8",
    "Wild Zone 9",
    "Wild Zone 10",
    "Wild Zone 11",
    "Wild Zone 12",
    "Wild Zone 13",
    "Wild Zone 14",
    "Wild Zone 15",
    "Wild Zone 16",
    "Wild Zone 17",
    "Wild Zone 18",
    "Wild Zone 19",
    "Wild Zone 20",
  ],

  // HOME / Universal fallback
  home: ["Pokémon HOME"],
};

/**
 * Normalizes a raw location string for lookup.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeLocationText(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Parses encounter information (name, chance, levels, isGift) from a raw location entry.
 * @param {string|Object} entry
 * @returns {{ name: string, cleanName: string, chance: number|null, levels: string, isGift: boolean, isStarter: boolean, isTrade: boolean, isRaid: boolean }}
 */
export function parseLocationDetails(entry) {
  if (!entry) {
    return {
      name: "",
      cleanName: "",
      chance: null,
      levels: "",
      isGift: false,
      isStarter: false,
      isTrade: false,
      isRaid: false,
    };
  }

  const rawName = typeof entry === "string" ? entry : entry.location || "";
  const levels = typeof entry === "object" ? entry.levels || "" : "";
  let chance = typeof entry === "object" && typeof entry.chance === "number" ? entry.chance : null;

  // Try extracting chance from string if present e.g. " (20%)" or " (Super Rod - 40%)"
  if (chance === null) {
    const rateMatch = rawName.match(/\b(\d{1,3})%/);
    if (rateMatch) {
      chance = parseInt(rateMatch[1], 10);
    }
  }

  const isGift = /\b(?:gift|fossil|egg|received)\b/i.test(rawName);
  const isStarter = /\bstarter\b/i.test(rawName);
  const isTrade = /\btrade\b/i.test(rawName);
  const isRaid = /\b(?:raid|tera raid|max raid|dynamax)\b/i.test(rawName);

  if (isGift || isStarter) {
    chance = 100;
  }

  return {
    name: rawName,
    cleanName: normalizeLocationText(rawName),
    chance,
    levels,
    isGift,
    isStarter,
    isTrade,
    isRaid,
  };
}

/**
 * Calculates a rarity penalty based on encounter rate percentage.
 * Lower encounter rate incurs higher penalty so common spots take precedence.
 *
 * @param {number|null} chance - Encounter rate (0–100)
 * @param {boolean} isGift - Whether it's a guaranteed gift/starter
 * @returns {number} Rarity penalty offset
 */
export function calculateRarityPenalty(chance, isGift = false) {
  if (isGift || chance === 100) return 0;
  if (chance === null) return 0.2; // Default slight penalty if rate unknown
  if (chance >= 25) return 0; // Common spawn
  if (chance >= 15) return 0.3; // Moderate spawn
  if (chance >= 10) return 0.6; // Uncommon spawn
  if (chance >= 5) return 1.2; // Rare spawn
  if (chance >= 2) return 2.2; // Very rare spawn
  return 3.5; // Ultra rare spawn (1% or lower)
}

/**
 * Finds the best matching route index for a normalized location in a game's route progression.
 *
 * @param {string} gameId
 * @param {string} cleanLoc - Normalized location text
 * @returns {{ index: number, route: string }|null}
 */
export function matchRouteProgression(gameId, cleanLoc) {
  const routes = GAME_ROUTE_PROGRESSION[gameId] || GAME_ROUTE_PROGRESSION.home;
  if (!routes || !cleanLoc) return null;

  let bestMatch = null;
  let maxMatchedLength = 0;

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const cleanRoute = normalizeLocationText(route);
    if (!cleanRoute) continue;

    // Check exact or word boundary match
    const isExact = cleanLoc === cleanRoute;
    const isPrefix = cleanLoc.startsWith(cleanRoute + " ");
    const isContained = cleanLoc.includes(cleanRoute);

    if (isExact || isPrefix || isContained) {
      // Prioritize the most specific (longest) matching route name
      if (cleanRoute.length > maxMatchedLength) {
        maxMatchedLength = cleanRoute.length;
        bestMatch = { index: i, route };
      }
    }
  }

  return bestMatch;
}

/**
 * Resolves full progression and encounter rate metrics for a Pokémon across its available locations.
 *
 * @param {string} gameId - Active game identifier
 * @param {string} version - Active version or 'all'
 * @param {number} speciesId - Species National Dex ID
 * @param {Array<string|Object>} locations - Location entries for the Pokémon
 * @param {Object|null} evolveDetails - Evolution prerequisites/chain details
 * @param {Function} [getBaseSpeciesEarliestScore] - Optional callback to retrieve pre-evolution score
 * @returns {Object} Progression analysis
 */
export function getEncounterProgressionInfo(
  gameId,
  version,
  speciesId,
  locations = [],
  evolveDetails = null,
  getBaseSpeciesEarliestScore = null,
) {
  const routes = GAME_ROUTE_PROGRESSION[gameId] || GAME_ROUTE_PROGRESSION.home;
  const maxRouteIndex = routes.length;

  let earliestRouteIndex = 9999;
  let earliestLocation = null;
  let earliestChance = null;

  let bestSmartScore = 9999;
  let recommendedLocation = null;
  let recommendedChance = null;

  let hasWildOrGift = false;

  if (Array.isArray(locations) && locations.length > 0) {
    for (const locEntry of locations) {
      const details = parseLocationDetails(locEntry);
      if (!details.name) continue;

      // Skip generic evolution tags in raw location list
      if (details.name.startsWith("Evolve ") || details.name.startsWith("Trade ")) {
        continue;
      }

      hasWildOrGift = true;
      const matched = matchRouteProgression(gameId, details.cleanName);

      let routeIndex = maxRouteIndex + 10;
      let matchedRouteName = details.name;

      if (details.isStarter) {
        routeIndex = 0;
        matchedRouteName = "Starter";
      } else if (matched) {
        routeIndex = matched.index;
        matchedRouteName = matched.route;
      }

      const rarityPenalty = calculateRarityPenalty(details.chance, details.isGift);
      const smartScore = routeIndex + rarityPenalty;

      // Track absolute earliest geographic encounter
      if (routeIndex < earliestRouteIndex) {
        earliestRouteIndex = routeIndex;
        earliestLocation = details.name;
        earliestChance = details.chance;
      }

      // Track recommended encounter (balancing route progression + encounter rate)
      if (smartScore < bestSmartScore) {
        bestSmartScore = smartScore;
        recommendedLocation = details.name;
        recommendedChance = details.chance;
      }
    }
  }

  // Handle evolution inheritance if no wild location exists or if pre-evolution is available earlier
  if (evolveDetails?.fromSpeciesId && getBaseSpeciesEarliestScore) {
    const preEvoScores = getBaseSpeciesEarliestScore(evolveDetails.fromSpeciesId);
    if (preEvoScores) {
      const evoOffset = 0.1; // Place evolved form immediately after pre-evolution
      const inheritedEarliest = preEvoScores.earliestRouteIndex + evoOffset;
      const inheritedSmart = preEvoScores.smartRouteIndex + evoOffset;

      if (!hasWildOrGift || inheritedEarliest < earliestRouteIndex) {
        earliestRouteIndex = inheritedEarliest;
        earliestLocation = `Evolve ${evolveDetails.fromName || "pre-evolution"}`;
        earliestChance = null;
      }

      if (!hasWildOrGift || inheritedSmart < bestSmartScore) {
        bestSmartScore = inheritedSmart;
        recommendedLocation = `Evolve ${evolveDetails.fromName || "pre-evolution"}`;
        recommendedChance = null;
      }
    }
  }

  // Fallbacks if no route matched
  if (earliestRouteIndex >= 9999) {
    earliestRouteIndex = maxRouteIndex + 50; // Transfers / post-game fallback
    earliestLocation = hasWildOrGift
      ? locations[0] || "Special Encounter"
      : evolveDetails
        ? `Evolve ${evolveDetails.fromName || "pre-evolution"}`
        : "Transfer / Trade";
  }

  if (bestSmartScore >= 9999) {
    bestSmartScore = earliestRouteIndex;
    recommendedLocation = earliestLocation;
    recommendedChance = earliestChance;
  }

  // Format encounter rate badge text
  let rateBadgeText = "";
  let rateBadgeType = "neutral";

  const activeChance = recommendedChance ?? earliestChance;
  if (typeof activeChance === "number") {
    if (activeChance === 100) {
      rateBadgeText = "Guaranteed / Gift";
      rateBadgeType = "gift";
    } else if (activeChance >= 25) {
      rateBadgeText = `${activeChance}% (Common)`;
      rateBadgeType = "common";
    } else if (activeChance >= 10) {
      rateBadgeText = `${activeChance}% (Uncommon)`;
      rateBadgeType = "uncommon";
    } else {
      rateBadgeText = `${activeChance}% (Rare)`;
      rateBadgeType = "rare";
    }
  }

  const isSmartBetter =
    recommendedLocation &&
    earliestLocation &&
    recommendedLocation !== earliestLocation &&
    earliestChance !== null &&
    earliestChance < 10;

  return {
    earliestRouteIndex,
    smartRouteIndex: bestSmartScore,
    earliestLocation,
    recommendedLocation: recommendedLocation || earliestLocation,
    earliestChance,
    recommendedChance,
    rateBadgeText,
    rateBadgeType,
    isSmartBetter,
  };
}
