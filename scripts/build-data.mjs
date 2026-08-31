#!/usr/bin/env node

/**
 * build-data.mjs
 *
 * Automated data extraction and compilation pipeline for LivingDex.
 * Compiles master species metadata, evolution chains, multilingual names,
 * and game-specific Pokédexes & encounters into optimized static JSON files.
 *
 * Usage:
 *   node scripts/build-data.mjs [--sample] [--species] [--evolutions] [--games] [--limit=N]
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
async function fetchWithRetry(url, { retries = 3, backoff = 500 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "LivingDex-DataBuilder/1.0" },
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await response.json();
    } catch (err) {
      if (attempt === retries) {
        console.warn(
          `[WARN] Failed fetching ${url} after ${retries} attempts: ${err.message}`,
        );
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
 * Build species and forms database
 */
async function buildSpeciesData(totalSpecies) {
  console.log(
    `\n📦 Building Species & Forms Database (1 to ${totalSpecies})...`,
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

    // Extract default flavor text (English)
    const flavorEntry = (speciesData.flavor_text_entries || []).find(
      (e) => e.language?.name === "en",
    );
    const flavorText = flavorEntry
      ? flavorEntry.flavor_text.replace(/[\f\n\r]/g, " ")
      : "";

    // Gather all forms for this species
    const varieties = speciesData.varieties || [];
    const forms = [];

    for (const variety of varieties) {
      const pokemonRes = await cachedFetch(
        `pokemon/${variety.pokemon.name}`,
        "pokemon",
      );
      if (!pokemonRes) continue;

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

      const formKey = pokemonName.replace(`${speciesData.name}-`, "");

      // Types & Past Types
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
        formKey: isDefault ? "default" : formKey,
        isDefault,
        isMega,
        isGmax,
        isRegional,
        region,
        types: currentTypes,
        pastTypes: Object.keys(pastTypes).length > 0 ? pastTypes : undefined,
      });
    }

    speciesMap[speciesId] = {
      speciesId,
      names,
      generation,
      evolutionChainId,
      flavorText: flavorText ? { en: flavorText } : undefined,
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
function formatEvoCondition(detail) {
  if (!detail) return "Special condition";
  const trigger = detail.trigger?.name || "";
  const parts = [];

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

  if (trigger === "trade" && !detail.held_item && !detail.trade_species) {
    parts.unshift("Trade");
  } else if (trigger === "shed") {
    parts.unshift("Shed upon level 20 with empty ball & slot");
  }

  return parts.join(", ") || (trigger ? prettifyName(trigger) : "Level up");
}

/**
 * Build evolution chains database
 */
async function buildEvolutionData(speciesMap) {
  console.log(`\n🧬 Building Evolution Chains Database...`);
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
              description: formatEvoCondition(detail),
            });
          }
        }
        traverse(next);
      }
    }

    traverse(evoData.chain);

    evolutionMap[chainId] = {
      chainId,
      babyTriggerItem: evoData.baby_trigger_item?.name || null,
      nodes,
      transitions,
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
 * Game definitions mapping to compile game-specific dexes
 */
const GAME_CONFIGS = [
  {
    gameId: "rby",
    title: "Red / Blue / Yellow",
    group: "gen1",
    generation: 1,
    pokedexId: 2,
    versions: ["red", "blue", "yellow"],
  },
  {
    gameId: "gsc",
    title: "Gold / Silver / Crystal",
    group: "gen2",
    generation: 2,
    pokedexId: 3,
    versions: ["gold", "silver", "crystal"],
  },
  {
    gameId: "rse",
    title: "Ruby / Sapphire / Emerald",
    group: "gen3",
    generation: 3,
    pokedexId: 4,
    versions: ["ruby", "sapphire", "emerald"],
  },
  {
    gameId: "frlg",
    title: "FireRed / LeafGreen",
    group: "gen3",
    generation: 3,
    pokedexId: 2,
    versions: ["firered", "leafgreen"],
  },
  {
    gameId: "dppt",
    title: "Diamond / Pearl / Platinum",
    group: "gen4",
    generation: 4,
    pokedexId: 5,
    versions: ["diamond", "pearl", "platinum"],
  },
  {
    gameId: "hgss",
    title: "HeartGold / SoulSilver",
    group: "gen4",
    generation: 4,
    pokedexId: 7,
    versions: ["heartgold", "soulsilver"],
  },
  {
    gameId: "bw",
    title: "Black / White",
    group: "gen5",
    generation: 5,
    pokedexId: 8,
    versions: ["black", "white"],
  },
  {
    gameId: "b2w2",
    title: "Black 2 / White 2",
    group: "gen5",
    generation: 5,
    pokedexId: 9,
    versions: ["black-2", "white-2"],
  },
  {
    gameId: "xy",
    title: "X / Y",
    group: "gen6",
    generation: 6,
    pokedexId: 12,
    versions: ["x", "y"],
  },
  {
    gameId: "oras",
    title: "Omega Ruby / Alpha Sapphire",
    group: "gen6",
    generation: 6,
    pokedexId: 15,
    versions: ["omega-ruby", "alpha-sapphire"],
  },
  {
    gameId: "sm",
    title: "Sun / Moon",
    group: "gen7",
    generation: 7,
    pokedexId: 16,
    versions: ["sun", "moon"],
  },
  {
    gameId: "usum",
    title: "Ultra Sun / Ultra Moon",
    group: "gen7",
    generation: 7,
    pokedexId: 21,
    versions: ["ultra-sun", "ultra-moon"],
  },
  {
    gameId: "lgpe",
    title: "Let's Go Pikachu / Eevee",
    group: "gen7",
    generation: 7,
    pokedexId: 26,
    versions: ["lets-go-pikachu", "lets-go-eevee"],
  },
  {
    gameId: "swsh",
    title: "Sword / Shield",
    group: "gen8",
    generation: 8,
    pokedexId: 27,
    versions: ["sword", "shield"],
  },
  {
    gameId: "bdsp",
    title: "Brilliant Diamond / Shining Pearl",
    group: "gen8",
    generation: 8,
    pokedexId: 5,
    versions: ["brilliant-diamond", "shining-pearl"],
  },
  {
    gameId: "sv",
    title: "Scarlet / Violet",
    group: "gen9",
    generation: 9,
    pokedexId: 31,
    versions: ["scarlet", "violet"],
  },
];

/**
 * Build game-specific files with dex entries and encounters
 */
async function buildGamesData() {
  console.log(`\n🎮 Building Game-Specific Dexes & Encounter Datasets...`);
  const gamesDir = path.join(DATA_DIR, "games");
  await fs.mkdir(gamesDir, { recursive: true });

  for (const cfg of GAME_CONFIGS) {
    console.log(`  -> Processing ${cfg.title} (${cfg.gameId})...`);
    const pokedexData = await cachedFetch(
      `pokedex/${cfg.pokedexId}`,
      "pokedex",
    );
    const entries = [];

    if (pokedexData && pokedexData.pokemon_entries) {
      for (const entry of pokedexData.pokemon_entries) {
        const speciesId = Number(
          entry.pokemon_species?.url?.match(/\/pokemon-species\/(\d+)\//)?.[1],
        );
        if (speciesId) {
          entries.push({
            speciesId,
            formId: speciesId,
            dexNumber: entry.entry_number || null,
          });
        }
      }
    }

    // Encounters dictionary
    const encounters = {};
    const sampleSpecies = entries.slice(0, 30); // sample or full list

    await mapConcurrent(sampleSpecies, 8, async ({ speciesId, formId }) => {
      const encData = await cachedFetch(
        `pokemon/${formId}/encounters`,
        "encounters",
      );
      if (!encData || !Array.isArray(encData)) return;

      for (const loc of encData) {
        const locationName =
          loc.location_area?.name?.replace(/-/g, " ") || "Unknown Area";
        for (const detail of loc.version_details || []) {
          const vName = detail.version?.name;
          if (cfg.versions.includes(vName)) {
            if (!encounters[speciesId]) encounters[speciesId] = {};
            if (!encounters[speciesId][vName])
              encounters[speciesId][vName] = { locations: [] };
            if (
              !encounters[speciesId][vName].locations.includes(locationName)
            ) {
              encounters[speciesId][vName].locations.push(locationName);
            }
          }
        }
      }
    });

    const gamePayload = {
      gameId: cfg.gameId,
      title: cfg.title,
      group: cfg.group,
      generation: cfg.generation,
      versions: cfg.versions,
      sections: [
        {
          id: "base",
          title: "Regional Pokédex",
          type: "base",
          optional: false,
          entries,
        },
      ],
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
      // Load existing species.json if only building other parts
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
      await buildGamesData();
    }

    console.log("\n🎉 All datasets generated successfully!");
  } catch (err) {
    console.error("\n❌ Fatal build error:", err);
    process.exit(1);
  }
}

main();
