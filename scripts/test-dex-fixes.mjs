/**
 * test-dex-fixes.mjs
 * Comprehensive automated validation suite for all LivingDex bug fixes and refactored architecture.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const species = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/species.json"), "utf8"),
);
const evolutions = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/evolutions.json"), "utf8"),
);
const dppt = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/games/dppt.json"), "utf8"),
);
const bdsp = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/games/bdsp.json"), "utf8"),
);
const sv = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/games/sv.json"), "utf8"),
);
const rby = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/games/rby.json"), "utf8"),
);
const gsc = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/games/gsc.json"), "utf8"),
);
const sm = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/games/sm.json"), "utf8"),
);
const lgpe = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/games/lgpe.json"), "utf8"),
);

// Mock window and fetch for db.js test execution in Node
globalThis.window = {
  __livingDexNames: {},
};
for (const [id, s] of Object.entries(species)) {
  globalThis.window.__livingDexNames[Number(id)] =
    s.names?.en || `Species #${id}`;
}

globalThis.fetch = async (url) => {
  const filePath = path.join(ROOT, url);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      ok: true,
      json: async () => data,
    };
  }
  throw new Error(`404: ${url}`);
};

const { getPokemonModalData } = await import("../js/db.js");

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
  passed++;
}

console.log("\n🧪 RUNNING LIVINGDEX VERIFICATION SUITE...\n");

// --- TEST 1: Generation 1 Clefairy Evolution Line ---
const gen1ClefairyModal = await getPokemonModalData(35, 35, "rby");
assert(
  gen1ClefairyModal.evolutionPaths.length === 1,
  "Gen 1 Clefairy has exactly 1 evolution path",
);
assert(
  gen1ClefairyModal.evolutionPaths[0].root.speciesId === 35,
  "Gen 1 Clefairy root is Clefairy (#35), NOT Cleffa (#173)",
);
assert(
  gen1ClefairyModal.evolutionPaths[0].steps.length === 1 &&
    gen1ClefairyModal.evolutionPaths[0].steps[0].toSpeciesId === 36,
  "Gen 1 Clefairy evolves only to Clefable (#36)",
);

// --- TEST 2: Generation 1 Eevee Evolution Line ---
const gen1EeveeModal = await getPokemonModalData(133, 133, "rby");
const gen1EeveeTargetIds = gen1EeveeModal.evolutionPaths.flatMap((p) =>
  p.steps.map((s) => s.toSpeciesId),
);
assert(
  gen1EeveeModal.evolutionPaths.length === 3,
  "Gen 1 Eevee has exactly 3 evolution paths",
);
assert(
  gen1EeveeTargetIds.includes(134) &&
    gen1EeveeTargetIds.includes(135) &&
    gen1EeveeTargetIds.includes(136),
  "Gen 1 Eevee evolves only to Vaporeon, Jolteon, Flareon",
);
assert(
  !gen1EeveeTargetIds.includes(196) && !gen1EeveeTargetIds.includes(700),
  "Gen 1 Eevee does NOT evolve to Espeon/Sylveon",
);

// --- TEST 3: Generation 1 Breeding Disabled ---
const gen1SnorlaxModal = await getPokemonModalData(143, 143, "rby");
assert(
  gen1SnorlaxModal.evolutionPaths.every((p) =>
    p.steps.every((s) => !s.reverseBreeding),
  ),
  "Gen 1 has no reverse breeding enabled",
);

// --- TEST 4: Generation 2 Clefairy Evolution Line (Cleffa exists) ---
const gen2ClefairyModal = await getPokemonModalData(35, 35, "gsc");
assert(
  gen2ClefairyModal.evolutionPaths[0].root.speciesId === 173,
  "Gen 2 Clefairy root is Cleffa (#173)",
);
assert(
  gen2ClefairyModal.evolutionPaths[0].steps.length === 2,
  "Gen 2 Clefairy path includes Cleffa -> Clefairy -> Clefable",
);

// --- TEST 5: BDSP Geodude Deduplication & Encounters ---
const bdspGeodudeModal = await getPokemonModalData(74, 74, "bdsp");
assert(
  bdspGeodudeModal.evolutionPaths.length === 1,
  "BDSP Geodude renders exactly 1 evolution line",
);
assert(
  bdsp.encounters["74"]?.["brilliant-diamond"]?.locations?.length > 0,
  "BDSP Geodude has fully populated encounter locations",
);

// --- TEST 6: Extended Sinnoh Pokédex Numbering ---
const extendedSection = dppt.sections.find((s) => s.id === "sinnoh-extended");
assert(
  extendedSection.startIndex === 152,
  "Extended Sinnoh Pokédex startIndex is 152",
);
assert(
  extendedSection.entries[0].dexNumber === 152,
  "Extended Sinnoh Pokédex first entry dexNumber is 152",
);
assert(
  extendedSection.entries[0].speciesId === 479,
  "First entry in Extended Sinnoh Pokédex is Rotom (#479)",
);

// --- TEST 7: BDSP Munchlax Encounter Formatting ---
const munchlaxBDSP = bdsp.encounters["446"];
const munchlaxStr = JSON.stringify(munchlaxBDSP);
assert(
  !munchlaxStr.includes("Sinnoh, Sinnoh"),
  "BDSP Munchlax does not contain repeating 'Sinnoh, Sinnoh'",
);
assert(
  munchlaxStr.includes("Honey Trees"),
  "BDSP Munchlax mentions Honey Trees",
);

// --- TEST 8: SV Tauros Encounter Formatting & Paldean Sprite in Modal ---
const taurosSV = sv.encounters["128"];
const taurosStr = JSON.stringify(taurosSV);
assert(
  !taurosStr.includes("List of 4★") && !taurosStr.includes("'''"),
  "SV Tauros has clean encounter text without wikitext artifacts",
);
const paldeanTaurosModal = await getPokemonModalData(128, 10250, "sv");
assert(
  paldeanTaurosModal.evolutionPaths[0].root.spriteId === 10250,
  "Paldean Tauros modal uses Paldean sprite ID 10250",
);

// --- TEST 9: PokéAPI Location Area Prettification ---
const pidgeyRBY = rby.encounters["16"];
const pidgeyStr = JSON.stringify(pidgeyRBY);
assert(
  !pidgeyStr.includes("kanto-route-1-area") && pidgeyStr.includes("Route 1"),
  "RBY encounters are converted from raw kebab to Title Case",
);

// --- TEST 10: Kakuna in GSC Day/Time Token Cleaning ---
const kakunaGSC = gsc.encounters["14"];
const kakunaStr = JSON.stringify(kakunaGSC);
assert(
  !kakunaStr.includes("tuthsa") && !kakunaStr.includes("TuThSa"),
  "GSC Kakuna does not contain raw 'tuthsa' artifact",
);
assert(
  kakunaStr.includes("Tue, Thu, Sat"),
  "GSC Kakuna properly formats day of the week parenthetical",
);

// --- TEST 11: Vulpix in GSC (Gen 2) - No Ice Stone ---
const gscVulpixModal = await getPokemonModalData(37, 37, "gsc");
const gscVulpixSteps = gscVulpixModal.evolutionPaths.flatMap((p) => p.steps);
assert(gscVulpixSteps.length === 1, "GSC Vulpix has exactly 1 evolution step");
assert(
  gscVulpixSteps[0].description === "Use Fire Stone",
  "GSC Vulpix evolves only with Fire Stone (no Ice Stone)",
);

// --- TEST 12: Vulpix & Ninetales in SM (Gen 7) - Form-Specific Evolution & Sprites ---
const smKantoVulpixModal = await getPokemonModalData(37, 37, "sm");
assert(
  smKantoVulpixModal.evolutionPaths[0].steps[0].description ===
    "Use Fire Stone",
  "Kantonian Vulpix in SM evolves via Fire Stone",
);
assert(
  smKantoVulpixModal.evolutionPaths[0].steps[0].toSpriteId === 38,
  "Kantonian Vulpix evolves to Kantonian Ninetales (spriteId 38)",
);

const smAlolaVulpixModal = await getPokemonModalData(37, 10103, "sm");
assert(
  smAlolaVulpixModal.evolutionPaths[0].root.spriteId === 10103,
  "Alolan Vulpix root sprite is 10103",
);
assert(
  smAlolaVulpixModal.evolutionPaths[0].steps[0].description === "Use Ice Stone",
  "Alolan Vulpix evolves via Ice Stone",
);
assert(
  smAlolaVulpixModal.evolutionPaths[0].steps[0].toSpriteId === 10104,
  "Alolan Vulpix evolves to Alolan Ninetales (spriteId 10104)",
);

// --- TEST 13: LGPE Magneton Cross-Gen Evolution Restrictions ---
const lgpeMagnetonModal = await getPokemonModalData(82, 82, "lgpe");
const lgpeMagnetonTargets = lgpeMagnetonModal.evolutionPaths.flatMap((p) =>
  p.steps.map((s) => s.toSpeciesId),
);
assert(
  !lgpeMagnetonTargets.includes(462),
  "In LGPE, Magneton shows NO evolution to Magnezone (#462)",
);

const dpptMagnetonModal = await getPokemonModalData(82, 82, "dppt");
const dpptMagnetonTargets = dpptMagnetonModal.evolutionPaths.flatMap((p) =>
  p.steps.map((s) => s.toSpeciesId),
);
assert(
  dpptMagnetonTargets.includes(462),
  "In DPPT, Magneton evolves to Magnezone (#462)",
);
assert(
  dpptMagnetonModal.evolutionPaths[0].steps.some((s) =>
    s.description.includes("Magnetic Field"),
  ),
  "Magnezone has clean magnetic field description",
);

// --- TEST 14: Chingling BDSP Multi-Location Splitting ---
const chinglingBDSP = bdsp.encounters["433"];
const chinglingLocations = chinglingBDSP["brilliant-diamond"].locations;
assert(
  chinglingLocations.includes("Route 211") &&
    chinglingLocations.includes("Lake Valor") &&
    chinglingLocations.includes("Mt. Coronet"),
  "Chingling multi-location string is split into individual entries",
);

// --- TEST 15: Eevee in Legends: Z-A (No Duplicate Evolutions) ---
const zaEeveeModal = await getPokemonModalData(133, 133, "za");
assert(
  zaEeveeModal.evolutionPaths.length === 8,
  "Eevee in Legends: Z-A has exactly 8 distinct evolution paths",
);
const zaLeafeonSteps = zaEeveeModal.evolutionPaths.filter(
  (p) => p.steps[0].toSpeciesId === 470,
);
assert(
  zaLeafeonSteps.length === 1,
  "Leafeon has exactly 1 deduplicated evolution path",
);
const zaSylveonSteps = zaEeveeModal.evolutionPaths.filter(
  (p) => p.steps[0].toSpeciesId === 700,
);
assert(
  zaSylveonSteps.length === 1,
  "Sylveon has exactly 1 deduplicated evolution path",
);

// --- TEST 16: Encounters in Legends: Arceus and Legends: Z-A Enabled ---
const plaPikachuModal = await getPokemonModalData(25, 25, "pla");
assert(
  plaPikachuModal.showEncounters === true,
  "Legends: Arceus encounters are enabled",
);
assert(
  plaPikachuModal.encounterGroups.length > 0 &&
    plaPikachuModal.encounterGroups[0].locations.length > 0,
  "PLA Pikachu has populated encounter locations",
);

const zaPikachuModal = await getPokemonModalData(25, 25, "za");
assert(
  zaPikachuModal.showEncounters === true,
  "Legends: Z-A encounters are enabled",
);
assert(
  zaPikachuModal.encounterGroups.length > 0 &&
    zaPikachuModal.encounterGroups[0].locations.length > 0,
  "ZA Pikachu has populated encounter locations",
);

// --- TEST 17: Voltorb in RBY (No Leaf Stone Evolution) ---
const rbyVoltorbModal = await getPokemonModalData(100, 100, "rby");
assert(
  rbyVoltorbModal.evolutionPaths.length === 1,
  "RBY Voltorb has exactly 1 evolution path",
);
assert(
  rbyVoltorbModal.evolutionPaths[0].steps[0].description === "Level 30",
  "RBY Voltorb evolves only at Level 30 (no Leaf Stone)",
);

// --- TEST 18: Slowpoke in RBY (No Galarica Items) ---
const rbySlowpokeModal = await getPokemonModalData(79, 79, "rby");
assert(
  rbySlowpokeModal.evolutionPaths.length === 1,
  "RBY Slowpoke has exactly 1 evolution path",
);
assert(
  rbySlowpokeModal.evolutionPaths[0].steps[0].description === "Level 37",
  "RBY Slowpoke evolves only at Level 37 (no Galarica Cuff/Wreath)",
);

console.log(`\n🎉 ALL ${passed}/${total} TESTS PASSED SUCCESSFULLY!\n`);
