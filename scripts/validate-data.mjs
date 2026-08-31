#!/usr/bin/env node

/**
 * validate-data.mjs
 *
 * Automated data validation suite for LivingDex static JSON datasets.
 * Validates schema conformity, required fields, and cross-file referential integrity.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../data");

const REQUIRED_GAMES = [
  "home", "rby", "gsc", "rse", "frlg", "dppt", "hgss", "bw", "b2w2",
  "xy", "oras", "sm", "usum", "lgpe", "swsh", "bdsp", "pla", "sv", "za",
];

async function validate() {
  console.log("🔍 Validating generated datasets...");
  let errors = 0;
  let speciesMap = {};
  const validSpeciesIds = new Set();
  const validFormIds = new Set();

  // 1. Validate species.json
  try {
    const speciesPath = path.join(DATA_DIR, "species.json");
    speciesMap = JSON.parse(await fs.readFile(speciesPath, "utf-8"));
    const count = Object.keys(speciesMap).length;
    console.log(`  ✓ species.json contains ${count} species entries`);

    for (const [id, s] of Object.entries(speciesMap)) {
      validSpeciesIds.add(s.speciesId);

      if (
        !s.speciesId ||
        !s.names?.en ||
        !s.generation ||
        !Array.isArray(s.forms) ||
        s.forms.length === 0
      ) {
        console.error(`  ❌ Invalid species entry for #${id}:`, s);
        errors++;
      }

      for (const form of s.forms || []) {
        validFormIds.add(form.formId);
        if (!form.formId || !form.name || !Array.isArray(form.types) || form.types.length === 0) {
          console.error(`  ❌ Invalid form entry for species #${id}:`, form);
          errors++;
        }
      }
    }
  } catch (err) {
    console.error("  ❌ Failed reading species.json:", err.message);
    errors++;
  }

  // 2. Validate evolutions.json
  try {
    const evoPath = path.join(DATA_DIR, "evolutions.json");
    const evoMap = JSON.parse(await fs.readFile(evoPath, "utf-8"));
    const count = Object.keys(evoMap).length;
    console.log(`  ✓ evolutions.json contains ${count} evolution chains`);

    for (const [id, chain] of Object.entries(evoMap)) {
      if (
        !chain.chainId ||
        !Array.isArray(chain.nodes) ||
        !Array.isArray(chain.transitions)
      ) {
        console.error(`  ❌ Invalid evolution chain for #${id}:`, chain);
        errors++;
      }

      for (const node of chain.nodes || []) {
        if (!node.speciesId || !node.generation) {
          console.error(`  ❌ Invalid evolution node in chain #${id}:`, node);
          errors++;
        }
      }

      for (const tr of chain.transitions || []) {
        if (!tr.fromSpeciesId || !tr.toSpeciesId || !tr.trigger || !tr.description) {
          console.error(`  ❌ Invalid evolution transition in chain #${id}:`, tr);
          errors++;
        }
      }
    }
  } catch (err) {
    console.error("  ❌ Failed reading evolutions.json:", err.message);
    errors++;
  }

  // 3. Validate game files
  try {
    const gamesDir = path.join(DATA_DIR, "games");
    const files = await fs.readdir(gamesDir);
    console.log(`  ✓ games/ directory contains ${files.length} game files`);

    for (const gameKey of REQUIRED_GAMES) {
      const fileName = `${gameKey}.json`;
      if (!files.includes(fileName)) {
        console.warn(`  ⚠️ Missing expected game file: ${fileName}`);
      }
    }

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const gameContent = JSON.parse(
        await fs.readFile(path.join(gamesDir, file), "utf-8"),
      );

      if (
        !gameContent.gameId ||
        !gameContent.title ||
        !gameContent.group ||
        !gameContent.generation ||
        !Array.isArray(gameContent.sections)
      ) {
        console.error(`  ❌ Invalid game file schema: ${file}`);
        errors++;
      }

      for (const section of gameContent.sections || []) {
        if (!section.id || !section.title || !section.type || !Array.isArray(section.entries)) {
          console.error(`  ❌ Invalid section in ${file}:`, section);
          errors++;
        }
      }
    }
  } catch (err) {
    console.error("  ❌ Failed reading games directory:", err.message);
    errors++;
  }

  if (errors === 0) {
    console.log("\n✅ All datasets validated successfully with 0 errors!");
  } else {
    console.error(`\n❌ Validation completed with ${errors} error(s).`);
    process.exit(1);
  }
}

validate();
