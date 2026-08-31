#!/usr/bin/env node

/**
 * build-data.mjs
 *
 * Automated multi-source data extraction and compilation pipeline for LivingDex.
 * Compiles master species metadata, evolution chains, multilingual names,
 * traits, stats, cosmetic/gender forms, and game-specific Pokédexes & encounters
 * into optimized static JSON files.
 *
 * Multi-Source Fallback: PokéAPI -> Bulbapedia -> Serebii -> Local Overrides
 *
 * Usage:
 *   node scripts/build-data.mjs [--sample] [--species] [--evolutions] [--games] [--limit=N]
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fork } from "node:child_process";
import {
  fetchBulbapediaEncounters,
  fetchBulbapediaDexRoster,
} from "./scrapers/bulbapedia.mjs";
import {
  fetchSerebiiSVEncounters,
  fetchSerebiiSwShEncounters,
} from "./scrapers/serebii.mjs";
import { fetchSerebiiDexRoster } from "./scrapers/serebii-dex.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(ROOT_DIR, "data");
const CACHE_DIR = path.resolve(ROOT_DIR, ".cache");

// CLI arguments
const args = process.argv.slice(2);
const isSample = args.includes("--sample");
const buildOnlySpecies = args.includes("--species");
const buildOnlyEvolutions = args.includes("--evolutions");
const buildOnlyGames = args.includes("--games");
const shouldDownloadSprites = args.includes("--download-sprites");
const limitArg = args.find((a) => a.startsWith("--limit="));
const maxLimit = limitArg
  ? Number(limitArg.split("=")[1])
  : isSample
    ? 25
    : null;

// Total National Dex species as of Gen 9
const TOTAL_NATIONAL_SPECIES = 1025;
const POKEAPI_BASE = "https://pokeapi.co/api/v2";

/**
 * Concurrency helper with exponential backoff and retry
 */
async function fetchWithRetry(url, { retries = 3, backoff = 300 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "LivingDex-DataBuilder/2.0" },
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await response.json();
    } catch (err) {
      if (attempt === retries) {
        return null;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, backoff * Math.pow(2, attempt - 1)),
      );
    }
  }
  return null;
}

/**
 * File cache for API responses to avoid hammering remote servers on repeated runs
 */
async function cachedFetch(endpoint, cacheSubdir = "pokeapi") {
  const safeFilename = endpoint.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json";
  const cachePath = path.join(CACHE_DIR, cacheSubdir, safeFilename);

  try {
    const cached = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(cached);
  } catch {
    // Cache miss, proceed to fetch
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${POKEAPI_BASE}/${endpoint}`;
  const data = await fetchWithRetry(url);

  if (data !== null) {
    try {
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, JSON.stringify(data), "utf-8");
    } catch {
      /* ignore cache write errors */
    }
  }

  return data;
}

/**
 * Concurrently process an array with bounded worker pool
 */
async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    worker,
  );
  await Promise.all(workers);
  return results;
}

/**
 * Helper to convert roman generation name to integer
 */
function getGenNumber(genName) {
  const key = String(genName || "").replace(/^generation-/, "");
  const map = {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5,
    vi: 6,
    vii: 7,
    viii: 8,
    ix: 9,
  };
  return map[key] || null;
}

/**
 * Title case helper
 */
function prettifyName(name) {
  return String(name || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Build species, stats, traits, and forms database
 */
async function buildSpeciesData(totalSpecies) {
  console.log(
    `\n📦 Building Species, Stats & Forms Database (1 to ${totalSpecies})...`,
  );
  const speciesMap = {};
  const ids = Array.from({ length: totalSpecies }, (_, i) => i + 1);

  await mapConcurrent(ids, 10, async (speciesId) => {
    const speciesData = await cachedFetch(
      `pokemon-species/${speciesId}`,
      "species",
    );
    if (!speciesData) return;

    // Multilingual names
    const names = {};
    for (const entry of speciesData.names || []) {
      const lang = entry.language?.name;
      if (lang) names[lang] = entry.name;
    }
    if (!names.en) names.en = prettifyName(speciesData.name);

    const generation = getGenNumber(speciesData.generation?.name) || 1;
    const evolutionChainId = speciesData.evolution_chain?.url
      ? Number(
          speciesData.evolution_chain.url.match(
            /\/evolution-chain\/(\d+)\//,
          )?.[1],
        )
      : null;

    // Multi-language flavor text map
    const flavorText = {};
    for (const entry of speciesData.flavor_text_entries || []) {
      const lang = entry.language?.name;
      if (lang && !flavorText[lang]) {
        flavorText[lang] = entry.flavor_text.replace(/[\f\n\r]/g, " ").trim();
      }
    }

    // Gather all forms and varieties
    const varieties = speciesData.varieties || [];
    const forms = [];
    const seenFormIds = new Set();
    let defaultPokemonData = null;

    for (const variety of varieties) {
      const pokemonRes = await cachedFetch(
        `pokemon/${variety.pokemon.name}`,
        "pokemon",
      );
      if (!pokemonRes || seenFormIds.has(pokemonRes.id)) continue;
      seenFormIds.add(pokemonRes.id);

      if (variety.is_default || !defaultPokemonData) {
        defaultPokemonData = pokemonRes;
      }

      const isDefault = variety.is_default || false;
      const pokemonName = pokemonRes.name;

      // Determine regional / special form properties
      const isAlolan = pokemonName.includes("-alola");
      const isGalarian = pokemonName.includes("-galar");
      const isHisuian = pokemonName.includes("-hisui");
      const isPaldean = pokemonName.includes("-paldea");
      const isMega = pokemonName.includes("-mega");
      const isGmax = pokemonName.includes("-gmax");
      const isRegional = isAlolan || isGalarian || isHisuian || isPaldean;

      let region = null;
      if (isAlolan) region = "alola";
      else if (isGalarian) region = "galar";
      else if (isHisuian) region = "hisui";
      else if (isPaldean) region = "paldea";

      let formType = "default";
      if (isRegional) formType = "regional";
      else if (isMega) formType = "mega";
      else if (isGmax) formType = "gmax";
      else if (
        pokemonName.includes("-cap") ||
        pokemonName.includes("-ash") ||
        pokemonName.includes("-world")
      )
        formType = "event";
      else if (pokemonName.includes("-female")) formType = "gender";
      else if (!isDefault) formType = "battle";

      const formKey = isDefault
        ? "default"
        : pokemonName.replace(`${speciesData.name}-`, "");

      // Current Types & Historical Types
      const currentTypes = (pokemonRes.types || []).map((t) => t.type.name);
      const pastTypes = {};

      for (const past of pokemonRes.past_types || []) {
        const pastGen = getGenNumber(past.generation?.name);
        if (pastGen) {
          pastTypes[pastGen] = (past.types || []).map((t) => t.type.name);
        }
      }

      forms.push({
        formId: pokemonRes.id,
        name: pokemonName,
        formKey,
        formType,
        isDefault,
        isMega,
        isGmax,
        isRegional,
        isGenderDifference: pokemonName.includes("-female"),
        isCosmetic: false,
        gender: pokemonName.includes("-female") ? "female" : null,
        region,
        types: currentTypes,
        pastTypes: Object.keys(pastTypes).length > 0 ? pastTypes : undefined,
      });
    }

    // If species has sub-forms (e.g. Unown letters, Vivillon patterns)
    if (defaultPokemonData?.forms && defaultPokemonData.forms.length > 1) {
      for (const subFormRef of defaultPokemonData.forms) {
        const subFormData = await cachedFetch(
          `pokemon-form/${subFormRef.name}`,
          "pokemon-form",
        );
        if (subFormData && !seenFormIds.has(subFormData.id)) {
          seenFormIds.add(subFormData.id);
          const fName = subFormData.form_name || subFormData.name;
          const isCosmeticForm =
            !subFormData.is_battle_only && !subFormData.is_mega;

          forms.push({
            formId: subFormData.id,
            name: subFormData.name,
            formKey: fName || "subform",
            formType: isCosmeticForm ? "cosmetic" : "battle",
            isDefault: subFormData.is_default || false,
            isMega: subFormData.is_mega || false,
            isGmax: false,
            isRegional: false,
            isGenderDifference: false,
            isCosmetic: isCosmeticForm,
            gender: null,
            region: null,
            types: (subFormData.types || [])
              .map((t) => t.type.name)
              .filter(Boolean),
          });
        }
      }
    }

    // Base stats extraction
    const baseStats = {
      hp: 0,
      attack: 0,
      defense: 0,
      specialAttack: 0,
      specialDefense: 0,
      speed: 0,
      bst: 0,
    };

    if (defaultPokemonData?.stats) {
      let bst = 0;
      for (const statEntry of defaultPokemonData.stats) {
        const val = statEntry.base_stat || 0;
        bst += val;
        const sName = statEntry.stat?.name;
        if (sName === "hp") baseStats.hp = val;
        else if (sName === "attack") baseStats.attack = val;
        else if (sName === "defense") baseStats.defense = val;
        else if (sName === "special-attack") baseStats.specialAttack = val;
        else if (sName === "special-defense") baseStats.specialDefense = val;
        else if (sName === "speed") baseStats.speed = val;
      }
      baseStats.bst = bst;
    }

    // Physical attributes & classification tags
    const height = defaultPokemonData?.height
      ? defaultPokemonData.height / 10
      : null; // in meters
    const weight = defaultPokemonData?.weight
      ? defaultPokemonData.weight / 10
      : null; // in kg
    const color = speciesData.color?.name || null;
    const shape = speciesData.shape?.name || null;
    const isLegendary = speciesData.is_legendary || false;
    const isMythical = speciesData.is_mythical || false;
    const isBaby = speciesData.is_baby || false;
    const hasGenderDifferences = speciesData.has_gender_differences || false;

    speciesMap[speciesId] = {
      speciesId,
      names,
      generation,
      evolutionChainId,
      flavorText: Object.keys(flavorText).length > 0 ? flavorText : undefined,
      baseStats,
      isLegendary,
      isMythical,
      isBaby,
      hasGenderDifferences,
      height,
      weight,
      color,
      shape,
      forms,
    };
  });

  const outputPath = path.join(DATA_DIR, "species.json");
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(speciesMap, null, 2), "utf-8");
  console.log(
    `✅ Saved ${Object.keys(speciesMap).length} species to ${outputPath}`,
  );
  return speciesMap;
}

/**
 * Format evolution details into human readable condition strings
 */
/**
 * Format evolution details into human readable condition strings
 */
function formatEvoCondition(detail, fromSpeciesId, toSpeciesId) {
  if (!detail) return "Special condition";
  const trigger = detail.trigger?.name || "";
  const parts = [];

  const locName = detail.location?.name || "";
  const itemName = detail.item?.name || "";

  // 1. Moss Rock / Leaf Stone (Leafeon, etc.)
  const isMossRock = [
    "eterna-forest",
    "pinwheel-forest",
    "kalos-route-20",
    "petalburg-woods",
    "lush-jungle",
  ].includes(locName);
  if (isMossRock || (toSpeciesId === 470 && itemName === "leaf-stone")) {
    return "Use Leaf Stone (or Moss Rock)";
  }

  // 2. Ice Rock / Ice Stone (Glaceon, etc.)
  const isIceRock = [
    "sinnoh-route-217",
    "twist-mountain",
    "frost-cavern",
    "shoal-cave",
    "mount-lanakila",
  ].includes(locName);
  if (isIceRock || (toSpeciesId === 471 && itemName === "ice-stone")) {
    return "Use Ice Stone (or Ice Rock)";
  }

  // 3. Magnetic Field / Thunder Stone (Magnezone, Probopass, Vikavolt)
  const isMagneticField = [
    "mt-coronet",
    "chargestone-cave",
    "kalos-route-13",
    "blush-mountain",
    "magnetic-field",
  ].includes(locName);
  if (
    isMagneticField ||
    ([462, 476, 738].includes(toSpeciesId) && itemName === "thunder-stone")
  ) {
    return "Use Thunder Stone (or Magnetic Field)";
  }

  // 4. Sylveon (Fairy-move + Affection/Friendship)
  if (
    toSpeciesId === 700 &&
    (detail.min_affection || detail.min_happiness) &&
    detail.known_move_type?.name === "fairy"
  ) {
    return "Knowing a Fairy-type move, High Friendship";
  }

  // 5. Qwilfish -> Overqwil (Barb Barrage in Strong Style)
  if (toSpeciesId === 904) {
    return "Use Barb Barrage 20 times in Strong Style";
  }

  // 6. Stantler -> Wyrdeer (Psyshield Bash in Agile Style)
  if (toSpeciesId === 899) {
    return "Use Psyshield Bash 20 times in Agile Style";
  }

  // 7. Basculin -> Basculegion (Recoil damage)
  if (toSpeciesId === 902) {
    return "Take 294+ recoil damage without fainting";
  }

  // 8. Primeape -> Annihilape (Rage Fist 20 times)
  if (toSpeciesId === 979) {
    return "Use Rage Fist 20 times";
  }

  // 9. Bisharp -> Kingambit (Defeat 3 Bisharp holding Leader Crest)
  if (toSpeciesId === 983) {
    return "Defeat 3 Bisharp holding Leader’s Crest";
  }

  // 10. Farfetchd -> Sirfetchd (3 Critical hits)
  if (toSpeciesId === 865) {
    return "Land 3 Critical Hits in a single battle";
  }

  // 11. Yamask -> Runerigus (49+ damage under stone bridge)
  if (toSpeciesId === 867) {
    return "Take 49+ damage without fainting and pass under stone bridge in Dusty Bowl";
  }

  if (detail.min_level) parts.push(`Level ${detail.min_level}`);
  if (detail.item?.name) parts.push(`Use ${prettifyName(detail.item.name)}`);
  if (detail.held_item?.name)
    parts.push(`Holding ${prettifyName(detail.held_item.name)}`);
  if (detail.known_move?.name)
    parts.push(`Knowing ${prettifyName(detail.known_move.name)}`);
  if (detail.known_move_type?.name)
    parts.push(
      `Knowing a ${prettifyName(detail.known_move_type.name)}-type move`,
    );
  if (detail.min_happiness) parts.push(`Friendship ${detail.min_happiness}+`);
  if (detail.min_affection) parts.push(`Affection ${detail.min_affection}+`);
  if (detail.location?.name)
    parts.push(`at ${prettifyName(detail.location.name)}`);
  if (detail.time_of_day)
    parts.push(`during ${prettifyName(detail.time_of_day)}`);
  if (detail.trade_species?.name)
    parts.push(`Trade for ${prettifyName(detail.trade_species.name)}`);
  if (detail.party_species?.name)
    parts.push(`With ${prettifyName(detail.party_species.name)} in party`);
  if (detail.needs_overworld_rain) parts.push("While raining");
  if (detail.turn_upside_down) parts.push("Console upside down");
  if (detail.gender === 1) parts.push("Female only");
  if (detail.gender === 2) parts.push("Male only");

  if (trigger === "trade" && !detail.held_item && !detail.trade_species) {
    parts.unshift("Trade");
  } else if (trigger === "shed") {
    parts.unshift("Shed upon level 20 with empty ball & slot");
  }

  return parts.join(", ") || (trigger ? prettifyName(trigger) : "Level up");
}

/**
 * Resolves the regional form scope for a given evolution transition
 */
function resolveTransitionRegion(fromSpeciesId, toSpeciesId, detail) {
  const itemName = detail.item?.name || "";

  // Rattata (19) -> Raticate (20)
  if (fromSpeciesId === 19) {
    if (detail.time_of_day === "night") return "alola";
    return null;
  }

  // Sandshrew (27) -> Sandslash (28)
  if (fromSpeciesId === 27) {
    if (itemName === "ice-stone") return "alola";
    return null;
  }

  // Vulpix (37) -> Ninetales (38)
  if (fromSpeciesId === 37) {
    if (itemName === "ice-stone") return "alola";
    return null;
  }

  // Meowth (52) -> Persian (53) / Perrserker (863)
  if (fromSpeciesId === 52) {
    if (toSpeciesId === 863) return "galar";
    if (toSpeciesId === 53 && detail.min_happiness) return "alola";
    return null;
  }

  // Slowpoke (79) -> Slowbro (80) / Slowking (199)
  if (fromSpeciesId === 79) {
    if (itemName === "galarica-cuff" || itemName === "galarica-wreath")
      return "galar";
    return null;
  }

  // Farfetch'd (83) -> Sirfetch'd (865)
  if (fromSpeciesId === 83 && toSpeciesId === 865) return "galar";

  // Voltorb (100) -> Electrode (101)
  if (fromSpeciesId === 100) {
    if (itemName === "leaf-stone") return "hisui";
    return null;
  }

  // Cubone (104) -> Marowak (105)
  if (fromSpeciesId === 104) {
    if (detail.time_of_day === "night") return "alola";
    return null;
  }

  // Mr. Mime (122) -> Mr. Rime (866)
  if (fromSpeciesId === 122 && toSpeciesId === 866) return "galar";

  // Wooper (194) -> Quagsire (195) / Clodsire (980)
  if (fromSpeciesId === 194) {
    if (toSpeciesId === 980) return "paldea";
    return null;
  }

  // Qwilfish (211) -> Overqwil (904)
  if (fromSpeciesId === 211 && toSpeciesId === 904) return "hisui";

  // Sneasel (215) -> Weavile (461) / Sneasler (903)
  if (fromSpeciesId === 215) {
    if (toSpeciesId === 903) return "hisui";
    return null;
  }

  // Corsola (222) -> Cursola (864)
  if (fromSpeciesId === 222 && toSpeciesId === 864) return "galar";

  // Zigzagoon (263) -> Linoone (264) -> Obstagoon (862)
  if (fromSpeciesId === 264 && toSpeciesId === 862) return "galar";

  // Darumaka (554) -> Darmanitan (555)
  if (fromSpeciesId === 554) {
    if (itemName === "ice-stone") return "galar";
    return null;
  }

  // Yamask (562) -> Cofagrigus (563) / Runerigus (867)
  if (fromSpeciesId === 562) {
    if (toSpeciesId === 867) return "galar";
    return null;
  }

  return null;
}

/**
 * Build evolution chains database with pre-calculated linear flowchart paths
 */
async function buildEvolutionData(speciesMap) {
  console.log(
    `\n🧬 Building Evolution Chains Database & UI Flowchart Paths...`,
  );
  const evolutionMap = {};
  const chainIds = Array.from(
    new Set(
      Object.values(speciesMap)
        .map((s) => s.evolutionChainId)
        .filter(Boolean),
    ),
  ).sort((a, b) => a - b);

  await mapConcurrent(chainIds, 10, async (chainId) => {
    const evoData = await cachedFetch(
      `evolution-chain/${chainId}`,
      "evolutions",
    );
    if (!evoData || !evoData.chain) return;

    const nodes = [];
    const transitions = [];

    function traverse(node) {
      if (!node) return;
      const speciesId = Number(
        node.species?.url?.match(/\/pokemon-species\/(\d+)\//)?.[1],
      );
      if (speciesId) {
        const speciesInfo = speciesMap[speciesId];
        nodes.push({
          speciesId,
          name: node.species.name,
          generation: speciesInfo?.generation || 1,
          isBaby: node.is_baby || false,
        });
      }

      for (const next of node.evolves_to || []) {
        const toSpeciesId = Number(
          next.species?.url?.match(/\/pokemon-species\/(\d+)\//)?.[1],
        );
        if (speciesId && toSpeciesId) {
          const details =
            Array.isArray(next.evolution_details) &&
            next.evolution_details.length > 0
              ? next.evolution_details
              : [{}];

          for (const detail of details) {
            const desc = formatEvoCondition(detail, speciesId, toSpeciesId);
            const transitionRegion = resolveTransitionRegion(
              speciesId,
              toSpeciesId,
              detail,
            );
            const isDuplicate = transitions.some(
              (t) =>
                t.fromSpeciesId === speciesId &&
                t.toSpeciesId === toSpeciesId &&
                t.description === desc &&
                t.region === transitionRegion,
            );
            if (!isDuplicate) {
              transitions.push({
                fromSpeciesId: speciesId,
                fromForm: null,
                toSpeciesId,
                toForm: null,
                trigger: detail.trigger?.name || "level-up",
                minLevel: detail.min_level || null,
                item: detail.item?.name || null,
                heldItem: detail.held_item?.name || null,
                knownMove: detail.known_move?.name || null,
                knownMoveType: detail.known_move_type?.name || null,
                happiness: detail.min_happiness || null,
                timeOfDay: detail.time_of_day || null,
                location: detail.location?.name || null,
                region: transitionRegion,
                tradeSpeciesId: detail.trade_species?.url
                  ? Number(
                      detail.trade_species.url.match(
                        /\/pokemon-species\/(\d+)\//,
                      )?.[1],
                    )
                  : null,
                partySpeciesId: detail.party_species?.url
                  ? Number(
                      detail.party_species.url.match(
                        /\/pokemon-species\/(\d+)\//,
                      )?.[1],
                    )
                  : null,
                gender:
                  detail.gender === 1
                    ? "female"
                    : detail.gender === 2
                      ? "male"
                      : null,
                description: desc,
              });
            }
          }
        }
        traverse(next);
      }
    }

    traverse(evoData.chain);

    // Build pre-computed linear flowchart paths
    const paths = [];
    const rootNode = nodes[0] || null;

    if (rootNode) {
      function buildPathsDfs(currentSpeciesId, currentPath) {
        const outgoing = transitions.filter(
          (t) => t.fromSpeciesId === currentSpeciesId,
        );
        if (outgoing.length === 0) {
          if (currentPath.length > 0) {
            const pathSignature = `${rootNode.speciesId}->${currentPath.map((s) => `${s.toSpeciesId}:${s.description}:${s.region || ""}`).join("->")}`;
            const exists = paths.some(
              (p) =>
                `${p.root.speciesId}->${p.steps.map((s) => `${s.toSpeciesId}:${s.description}:${s.region || ""}`).join("->")}` ===
                pathSignature,
            );
            if (!exists) {
              paths.push({
                root: { speciesId: rootNode.speciesId, name: rootNode.name },
                steps: currentPath,
              });
            }
          }
          return;
        }

        for (const tr of outgoing) {
          const toNode = nodes.find((n) => n.speciesId === tr.toSpeciesId);
          const step = {
            toSpeciesId: tr.toSpeciesId,
            toName: toNode?.name || `Species #${tr.toSpeciesId}`,
            description: tr.description,
            item: tr.item || null,
            region: tr.region || null,
          };
          if (evoData.baby_trigger_item?.name && rootNode.isBaby) {
            step.reverseBreeding = {
              itemName: evoData.baby_trigger_item.name,
            };
          }
          buildPathsDfs(tr.toSpeciesId, [...currentPath, step]);
        }
      }

      buildPathsDfs(rootNode.speciesId, []);
    }

    evolutionMap[chainId] = {
      chainId,
      babyTriggerItem: evoData.baby_trigger_item?.name || null,
      nodes,
      transitions,
      paths,
    };
  });

  const outputPath = path.join(DATA_DIR, "evolutions.json");
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    outputPath,
    JSON.stringify(evolutionMap, null, 2),
    "utf-8",
  );
  console.log(
    `✅ Saved ${Object.keys(evolutionMap).length} evolution chains to ${outputPath}`,
  );
}

/**
 * Regional form mappings for pokedex segments
 */
const REGIONAL_FORM_MAP = {
  // Alolan forms
  alola: {
    19: 10091,
    20: 10092,
    26: 10100,
    27: 10101,
    28: 10102,
    37: 10103,
    38: 10104,
    50: 10105,
    51: 10106,
    52: 10107,
    53: 10108,
    74: 10109,
    75: 10110,
    76: 10111,
    88: 10112,
    89: 10113,
    103: 10114,
    105: 10115,
  },
  // Galarian forms
  galar: {
    52: 10161,
    77: 10162,
    78: 10163,
    79: 10164,
    80: 10165,
    83: 10166,
    110: 10167,
    122: 10168,
    144: 10169,
    145: 10170,
    146: 10171,
    199: 10172,
    222: 10173,
    263: 10174,
    264: 10175,
    554: 10176,
    555: 10177,
    562: 10179,
    618: 10180,
  },
  // Hisuian forms
  hisui: {
    58: 10229,
    59: 10230,
    100: 10231,
    101: 10232,
    157: 10233,
    211: 10234,
    215: 10235,
    503: 10236,
    549: 10237,
    570: 10238,
    571: 10239,
    628: 10240,
    705: 10241,
    706: 10242,
    713: 10243,
    724: 10244,
  },
  // Paldean forms
  paldea: {
    128: 10250,
    194: 10253,
  },
};

/**
 * Gigantamax form IDs
 */
const GIGANTAMAX_FORM_IDS = [
  10195, 10196, 10197, 10198, 10199, 10200, 10201, 10202, 10203, 10204, 10205,
  10206, 10207, 10208, 10209, 10210, 10211, 10212, 10213, 10214, 10215, 10216,
  10217, 10218, 10219, 10220, 10221, 10222, 10223, 10224, 10225, 10226, 10227,
];

/**
 * Comprehensive 18-game configurations
 */
const GAME_CONFIGS = [
  {
    gameId: "home",
    title: "Pokémon HOME",
    group: "special",
    generation: 9,
    versions: ["home"],
    sections: [
      {
        id: "national",
        title: "National Pokédex",
        pokedexId: 1,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "rby",
    title: "Red / Blue / Yellow",
    group: "gen1",
    generation: 1,
    versions: ["red", "blue", "yellow"],
    sections: [
      {
        id: "kanto",
        title: "Kanto Pokédex",
        pokedexId: 2,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "gsc",
    title: "Gold / Silver / Crystal",
    group: "gen2",
    generation: 2,
    versions: ["gold", "silver", "crystal"],
    sections: [
      {
        id: "johto",
        title: "Johto Pokédex",
        pokedexId: 3,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "rse",
    title: "Ruby / Sapphire / Emerald",
    group: "gen3",
    generation: 3,
    versions: ["ruby", "sapphire", "emerald"],
    sections: [
      {
        id: "hoenn",
        title: "Hoenn Pokédex",
        pokedexId: 4,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "frlg",
    title: "FireRed / LeafGreen",
    group: "gen3",
    generation: 3,
    versions: ["firered", "leafgreen"],
    sections: [
      {
        id: "kanto",
        title: "Kanto Pokédex",
        pokedexId: 2,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "dppt",
    title: "Diamond / Pearl / Platinum",
    group: "gen4",
    generation: 4,
    versions: ["diamond", "pearl", "platinum"],
    sections: [
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
  {
    gameId: "hgss",
    title: "HeartGold / SoulSilver",
    group: "gen4",
    generation: 4,
    versions: ["heartgold", "soulsilver"],
    sections: [
      {
        id: "johto-updated",
        title: "Updated Johto Pokédex",
        pokedexId: 7,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "bw",
    title: "Black / White",
    group: "gen5",
    generation: 5,
    versions: ["black", "white"],
    sections: [
      {
        id: "unova",
        title: "Unova Pokédex",
        pokedexId: 8,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "b2w2",
    title: "Black 2 / White 2",
    group: "gen5",
    generation: 5,
    versions: ["black-2", "white-2"],
    sections: [
      {
        id: "unova-updated",
        title: "Updated Unova Pokédex",
        pokedexId: 9,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "xy",
    title: "X / Y",
    group: "gen6",
    generation: 6,
    versions: ["x", "y"],
    sections: [
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
  {
    gameId: "oras",
    title: "Omega Ruby / Alpha Sapphire",
    group: "gen6",
    generation: 6,
    versions: ["omega-ruby", "alpha-sapphire"],
    sections: [
      {
        id: "hoenn-updated",
        title: "Updated Hoenn Pokédex",
        pokedexId: 15,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "sm",
    title: "Sun / Moon",
    group: "gen7",
    generation: 7,
    versions: ["sun", "moon"],
    regionKey: "alola",
    sections: [
      {
        id: "alola",
        title: "Alola Pokédex",
        pokedexId: 16,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "usum",
    title: "Ultra Sun / Ultra Moon",
    group: "gen7",
    generation: 7,
    versions: ["ultra-sun", "ultra-moon"],
    regionKey: "alola",
    sections: [
      {
        id: "alola",
        title: "Alola Pokédex",
        pokedexId: 21,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "lgpe",
    title: "Let's Go Pikachu & Eevee",
    group: "gen7",
    generation: 7,
    versions: ["lets-go-pikachu", "lets-go-eevee"],
    regionKey: "alola",
    sections: [
      {
        id: "kanto",
        title: "Kanto Pokédex",
        pokedexId: 26,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "swsh",
    title: "Sword / Shield",
    group: "gen8",
    generation: 8,
    versions: ["sword", "shield"],
    regionKey: "galar",
    sections: [
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
        manualIds: GIGANTAMAX_FORM_IDS,
        type: "forms",
        optional: true,
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
  {
    gameId: "bdsp",
    title: "Brilliant Diamond / Shining Pearl",
    group: "gen8",
    generation: 8,
    versions: ["brilliant-diamond", "shining-pearl"],
    sections: [
      {
        id: "sinnoh",
        title: "Sinnoh Pokédex",
        pokedexId: 6,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "pla",
    title: "Legends: Arceus",
    group: "special",
    generation: 8,
    versions: ["legends-arceus"],
    regionKey: "hisui",
    sections: [
      {
        id: "hisui",
        title: "Hisui Pokédex",
        pokedexId: 30,
        type: "base",
        optional: false,
      },
    ],
  },
  {
    gameId: "sv",
    title: "Scarlet / Violet",
    group: "gen9",
    generation: 9,
    versions: ["scarlet", "violet"],
    regionKey: "paldea",
    sections: [
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
  {
    gameId: "za",
    title: "Legends: Z-A",
    group: "special",
    generation: 9,
    versions: ["legends-z-a"],
    sections: [
      {
        id: "lumiose-city",
        title: "Lumiose Pokédex",
        pokedexId: 34,
        fallbackDexKey: "lumiose",
        type: "base",
        optional: false,
      },
    ],
  },
];

/**
 * Prettify and clean raw encounter location names from PokéAPI and Bulbapedia
 */
/**
 * Splits a composite encounter location string by top-level commas and semicolons
 * (ignoring commas inside parentheses).
 */
function splitEncounterLocations(rawString) {
  if (!rawString) return [];
  const results = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < rawString.length; i++) {
    const char = rawString[i];
    if (char === "(" || char === "[" || char === "{") depth++;
    else if (char === ")" || char === "]" || char === "}") depth--;

    if (
      (char === ";" || (char === "," && depth === 0) || char === "\n") &&
      depth === 0
    ) {
      const trimmed = current.trim();
      if (trimmed) results.push(trimmed);
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    results.push(current.trim());
  }

  return results;
}

/**
 * Prettify and clean raw encounter location names from PokéAPI and Bulbapedia
 */
function cleanLocationAreaName(rawLocation) {
  if (!rawLocation) return "";
  let text = String(rawLocation).trim();

  // Clean wikitext formatting and link targets if present
  text = text
    .replace(/\[\[(?:[^|\]]*\|)*([^\]]+)\]\]/g, "$1")
    .replace(/'{2,5}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");

  // Clean Tera Raid Battles link text
  text = text.replace(/List of \d+★ Tera Raid Battles \([^)]+\)\|/gi, "");
  text = text.replace(
    /Tera Raid Battle Search \([^)]+\)\|/gi,
    "Tera Raid Battles: ",
  );
  text = text.replace(
    /(?<=\(|,\s*)[^,|()]*(?:\s*\([^)]*\))?\s*\|\s*([1-7]★)/g,
    "$1",
  );

  // Format day-of-the-week and time-of-day shorthand codes
  text = text
    .replace(/(?:\)|\])?(?:TuThSa|tuthsa)\b/gi, " - Tue, Thu, Sat)")
    .replace(/(?:\)|\])?(?:MoWeFr|mowefr)\b/gi, " - Mon, Wed, Fri)")
    .replace(/(?<=\S)(?:MD|md)\b/g, " (Morning, Day)")
    .replace(/(?<=\S)(?:MN|mn)\b/g, " (Morning, Night)")
    .replace(/(?<=\S)(?:DN|dn)\b/g, " (Day, Night)")
    .replace(/\s*\(\s*-\s*/g, " (")
    .replace(/\)\s*\)/g, ")");

  // Fix repeated "Sinnoh, Sinnoh"
  if (text.includes("Sinnoh, Sinnoh")) {
    text = text.replace(
      /(?:Routes\s+)?(?:Sinnoh,\s*)+(.*)/i,
      "Honey Trees (Routes 205–222, $1)",
    );
    text = text.replace(/\s*\(Honey Trees\)/i, "");
  }

  const isKebabOrAllLower = text === text.toLowerCase() || text.includes("-");

  if (isKebabOrAllLower) {
    let parts = text.replace(/-/g, " ").trim().split(/\s+/);
    const regions = [
      "kanto",
      "johto",
      "hoenn",
      "sinnoh",
      "unova",
      "kalos",
      "alola",
      "galar",
      "hisui",
      "paldea",
    ];
    if (parts.length > 1 && regions.includes(parts[0].toLowerCase())) {
      parts.shift();
    }
    if (parts[parts.length - 1]?.toLowerCase() === "area") {
      parts.pop();
    }

    const formattedWords = parts.map((w) => {
      const lower = w.toLowerCase();
      if (/^b?\d+f$/i.test(lower)) {
        return `(${lower.toUpperCase()})`;
      }
      if (lower === "mt" || lower === "mt.") {
        return "Mt.";
      }
      if (lower === "route") {
        return "Route";
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });

    text = formattedWords
      .join(" ")
      .replace(/\s+\((B?\d+F)\)/g, " ($1)")
      .replace(/\bUnknown Area\s*\d*/gi, "Unknown Area")
      .trim();
  }

  text = text
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s*\|\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*\)/g, "")
    .trim();

  return text;
}

/**
 * Scrape or fetch encounters with multi-source fallback (PokéAPI -> Bulbapedia -> Serebii)
 */
async function resolveEncountersForSpecies(
  speciesId,
  formId,
  speciesName,
  targetVersions,
) {
  const result = {};

  // Remake version fallback map
  const REMAKE_FALLBACK_MAP = {
    "brilliant-diamond": ["diamond", "platinum"],
    "shining-pearl": ["pearl", "platinum"],
    firered: ["red", "yellow"],
    leafgreen: ["blue", "yellow"],
    heartgold: ["gold", "crystal"],
    soulsilver: ["silver", "crystal"],
    "omega-ruby": ["ruby", "emerald"],
    "alpha-sapphire": ["sapphire", "emerald"],
  };

  // 1. Try PokéAPI first
  const encData = await cachedFetch(
    `pokemon/${formId}/encounters`,
    "encounters",
  );
  if (Array.isArray(encData) && encData.length > 0) {
    for (const loc of encData) {
      const locationName = cleanLocationAreaName(
        loc.location_area?.name || "Unknown Area",
      );
      if (!locationName) continue;
      for (const detail of loc.version_details || []) {
        const vName = detail.version?.name;
        if (targetVersions.includes(vName)) {
          if (!result[vName]) result[vName] = { locations: [] };
          if (!result[vName].locations.includes(locationName)) {
            result[vName].locations.push(locationName);
          }
        }
      }
    }
  }

  // 2. Check missing target versions
  let missingVersions = targetVersions.filter(
    (v) => !result[v] || result[v].locations.length === 0,
  );

  if (missingVersions.length > 0 && speciesName) {
    // 2a. Bulbapedia Fallback
    const safeName = speciesName.replace(/[^a-zA-Z0-9_-]/g, "_");
    const cachePath = path.join(CACHE_DIR, "bulbapedia", `${safeName}.json`);
    let bulbEncounters = null;

    try {
      bulbEncounters = JSON.parse(await fs.readFile(cachePath, "utf-8"));
    } catch {
      bulbEncounters = await fetchBulbapediaEncounters(speciesName);
      try {
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.writeFile(cachePath, JSON.stringify(bulbEncounters), "utf-8");
      } catch {
        /* ignore */
      }
    }

    if (bulbEncounters) {
      for (const vName of missingVersions) {
        if (bulbEncounters[vName] && bulbEncounters[vName].length > 0) {
          if (!result[vName]) result[vName] = { locations: [] };
          for (const loc of bulbEncounters[vName]) {
            const splitLocs = splitEncounterLocations(loc);
            for (const item of splitLocs) {
              const cleaned = cleanLocationAreaName(item);
              if (cleaned && !result[vName].locations.includes(cleaned)) {
                result[vName].locations.push(cleaned);
              }
            }
          }
        }
      }
    }

    // 2b. Serebii Fallback for SV / SwSh if still missing
    missingVersions = targetVersions.filter(
      (v) => !result[v] || result[v].locations.length === 0,
    );

    if (missingVersions.some((v) => v === "scarlet" || v === "violet")) {
      const serebiiSV = await fetchSerebiiSVEncounters(speciesName);
      for (const v of ["scarlet", "violet"]) {
        if (serebiiSV[v]?.length) {
          if (!result[v]) result[v] = { locations: [] };
          for (const loc of serebiiSV[v]) {
            const splitLocs = splitEncounterLocations(loc);
            for (const item of splitLocs) {
              const cleaned = cleanLocationAreaName(item);
              if (cleaned && !result[v].locations.includes(cleaned)) {
                result[v].locations.push(cleaned);
              }
            }
          }
        }
      }
    }

    if (missingVersions.some((v) => v === "sword" || v === "shield")) {
      const serebiiSwSh = await fetchSerebiiSwShEncounters(speciesName);
      for (const v of ["sword", "shield"]) {
        if (serebiiSwSh[v]?.length) {
          if (!result[v]) result[v] = { locations: [] };
          for (const loc of serebiiSwSh[v]) {
            const splitLocs = splitEncounterLocations(loc);
            for (const item of splitLocs) {
              const cleaned = cleanLocationAreaName(item);
              if (cleaned && !result[v].locations.includes(cleaned)) {
                result[v].locations.push(cleaned);
              }
            }
          }
        }
      }
    }

    // 2c. Remake version fallback (e.g. BDSP -> Diamond/Pearl) if still missing
    missingVersions = targetVersions.filter(
      (v) => !result[v] || result[v].locations.length === 0,
    );

    for (const vName of missingVersions) {
      const fallbacks = REMAKE_FALLBACK_MAP[vName] || [];
      for (const fbVersion of fallbacks) {
        // Try PokéAPI fallback first
        if (Array.isArray(encData) && encData.length > 0) {
          for (const loc of encData) {
            const locationName = cleanLocationAreaName(
              loc.location_area?.name || "Unknown Area",
            );
            if (!locationName) continue;
            for (const detail of loc.version_details || []) {
              if (detail.version?.name === fbVersion) {
                if (!result[vName]) result[vName] = { locations: [] };
                if (!result[vName].locations.includes(locationName)) {
                  result[vName].locations.push(locationName);
                }
              }
            }
          }
        }

        // Try Bulbapedia fallback if still missing
        if (
          (!result[vName] || result[vName].locations.length === 0) &&
          bulbEncounters?.[fbVersion]?.length
        ) {
          if (!result[vName]) result[vName] = { locations: [] };
          for (const loc of bulbEncounters[fbVersion]) {
            const splitLocs = splitEncounterLocations(loc);
            for (const item of splitLocs) {
              const cleaned = cleanLocationAreaName(item);
              if (cleaned && !result[vName].locations.includes(cleaned)) {
                result[vName].locations.push(cleaned);
              }
            }
          }
        }

        if (result[vName]?.locations.length > 0) break;
      }
    }
  }

  return result;
}

/**
 * Build game-specific files with dex entries, DLC segments, and enriched encounters
 */
async function buildGamesData(speciesMap = {}) {
  console.log(
    `\n🎮 Building Game-Specific Dexes & Enriched Encounter Datasets...`,
  );
  const gamesDir = path.join(DATA_DIR, "games");
  await fs.mkdir(gamesDir, { recursive: true });

  for (const cfg of GAME_CONFIGS) {
    console.log(`  -> Processing ${cfg.title} (${cfg.gameId})...`);
    const sections = [];
    const encounters = {};
    const regionalMap = cfg.regionKey
      ? REGIONAL_FORM_MAP[cfg.regionKey] || {}
      : {};

    for (const seg of cfg.sections) {
      let entries = [];

      if (seg.manualIds && Array.isArray(seg.manualIds)) {
        // Direct manual form IDs (e.g. Gigantamax)
        entries = seg.manualIds.map((fId) => {
          // Find matching species
          const matchedSpecies = Object.values(speciesMap).find((s) =>
            s.forms?.some((f) => f.formId === fId),
          );
          return {
            speciesId: matchedSpecies?.speciesId || fId,
            formId: fId,
            dexNumber: null,
          };
        });
      } else if (seg.pokedexId) {
        let pokedexData = await cachedFetch(
          `pokedex/${seg.pokedexId}`,
          "pokedex",
        );

        // Fallback to Serebii / Bulbapedia dex roster if PokéAPI returns 404 or empty
        if (!pokedexData && seg.fallbackDexKey) {
          const serebiiRoster = await fetchSerebiiDexRoster(seg.fallbackDexKey);
          if (serebiiRoster.length) {
            entries = serebiiRoster
              .map((r) => {
                const matched = Object.values(speciesMap).find(
                  (s) =>
                    s.names?.en?.toLowerCase() === r.speciesName.toLowerCase(),
                );
                const speciesId = matched?.speciesId || 0;
                const formId = regionalMap[speciesId] || speciesId;
                return {
                  speciesId,
                  formId,
                  dexNumber: r.dexNumber,
                };
              })
              .filter((e) => e.speciesId > 0);
          }
        } else if (pokedexData?.pokemon_entries) {
          let rawList = pokedexData.pokemon_entries;
          if (seg.startEntry && seg.endEntry) {
            rawList = rawList.filter(
              (e) =>
                (e.entry_number || 0) >= seg.startEntry &&
                (e.entry_number || 0) <= seg.endEntry,
            );
          }

          for (const entry of rawList) {
            const speciesId = Number(
              entry.pokemon_species?.url?.match(
                /\/pokemon-species\/(\d+)\//,
              )?.[1],
            );
            if (speciesId) {
              const formId = regionalMap[speciesId] || speciesId;
              entries.push({
                speciesId,
                formId,
                dexNumber: entry.entry_number || null,
              });
            }
          }
        }
      }

      sections.push({
        id: seg.id,
        title: seg.title,
        type: seg.type,
        optional: seg.optional || false,
        defaultEnabled: seg.defaultEnabled || false,
        startIndex:
          seg.startEntry || seg.startIndex || (entries[0]?.dexNumber ?? 1),
        entries,
      });

      // Sample or full entries for encounters
      const sampleEntries = isSample ? entries.slice(0, 10) : entries;

      await mapConcurrent(sampleEntries, 6, async ({ speciesId, formId }) => {
        if (encounters[speciesId]) return;
        const speciesName = speciesMap[speciesId]?.names?.en || "";
        const encs = await resolveEncountersForSpecies(
          speciesId,
          formId,
          speciesName,
          cfg.versions,
        );
        if (Object.keys(encs).length > 0) {
          encounters[speciesId] = encs;
        }
      });
    }

    const gamePayload = {
      gameId: cfg.gameId,
      title: cfg.title,
      group: cfg.group,
      generation: cfg.generation,
      versions: cfg.versions,
      sections,
      encounters,
    };

    const outPath = path.join(gamesDir, `${cfg.gameId}.json`);
    await fs.writeFile(outPath, JSON.stringify(gamePayload, null, 2), "utf-8");
  }

  console.log(`✅ Saved ${GAME_CONFIGS.length} game files to ${gamesDir}`);
}

/**
 * Main execution controller
 */
async function main() {
  console.log("🚀 LivingDex Data Generation Pipeline started.");
  const totalSpecies = maxLimit || TOTAL_NATIONAL_SPECIES;

  try {
    let speciesMap = null;
    if (!buildOnlyEvolutions && !buildOnlyGames) {
      speciesMap = await buildSpeciesData(totalSpecies);
    } else {
      try {
        speciesMap = JSON.parse(
          await fs.readFile(path.join(DATA_DIR, "species.json"), "utf-8"),
        );
      } catch {
        speciesMap = await buildSpeciesData(totalSpecies);
      }
    }

    if (!buildOnlySpecies && !buildOnlyGames) {
      await buildEvolutionData(speciesMap);
    }

    if (!buildOnlySpecies && !buildOnlyEvolutions) {
      await buildGamesData(speciesMap);
    }

    if (shouldDownloadSprites) {
      console.log("\n⬇️  Launching Sprite Downloader Subprocess...");
      const downloaderScript = path.join(__dirname, "download-sprites.mjs");
      const forwardArgs = args.filter((a) => a !== "--download-sprites");
      await new Promise((resolve, reject) => {
        const child = fork(downloaderScript, forwardArgs);
        child.on("exit", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Sprite downloader exited with code ${code}`));
        });
      });
    }

    console.log("\n🎉 All datasets generated and enriched successfully!");
  } catch (err) {
    console.error("\n❌ Fatal build error:", err);
    process.exit(1);
  }
}

main();
