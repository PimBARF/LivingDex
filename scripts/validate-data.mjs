#!/usr/bin/env node

/**
 * validate-data.mjs
 *
 * Validates generated static JSON datasets against the schema requirements.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../data");

async function validate() {
  console.log("🔍 Validating generated datasets...");
  let errors = 0;

  // 1. Validate species.json
  try {
    const speciesPath = path.join(DATA_DIR, "species.json");
    const content = JSON.parse(await fs.readFile(speciesPath, "utf-8"));
    const count = Object.keys(content).length;
    console.log(`  ✓ species.json contains ${count} species entries`);

    for (const [id, s] of Object.entries(content)) {
      if (
        !s.speciesId ||
        !s.names?.en ||
        !s.generation ||
        !Array.isArray(s.forms)
      ) {
        console.error(`  ❌ Invalid species entry for #${id}:`, s);
        errors++;
      }
    }
  } catch (err) {
    console.error("  ❌ Failed reading species.json:", err.message);
    errors++;
  }

  // 2. Validate evolutions.json
  try {
    const evoPath = path.join(DATA_DIR, "evolutions.json");
    const content = JSON.parse(await fs.readFile(evoPath, "utf-8"));
    const count = Object.keys(content).length;
    console.log(`  ✓ evolutions.json contains ${count} evolution chains`);

    for (const [id, chain] of Object.entries(content)) {
      if (
        !chain.chainId ||
        !Array.isArray(chain.nodes) ||
        !Array.isArray(chain.transitions)
      ) {
        console.error(`  ❌ Invalid evolution chain for #${id}:`, chain);
        errors++;
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
    console.log(`  ✓ games/ contains ${files.length} game files`);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const gameContent = JSON.parse(
        await fs.readFile(path.join(gamesDir, file), "utf-8"),
      );
      if (
        !gameContent.gameId ||
        !gameContent.title ||
        !Array.isArray(gameContent.sections)
      ) {
        console.error(`  ❌ Invalid game file: ${file}`);
        errors++;
      }
    }
  } catch (err) {
    console.error("  ❌ Failed reading games directory:", err.message);
    errors++;
  }

  if (errors === 0) {
    console.log("\n✅ All datasets validated successfully with 0 errors!");
  } else {
    console.error(`\n❌ Validation failed with ${errors} error(s).`);
    process.exit(1);
  }
}

validate();
