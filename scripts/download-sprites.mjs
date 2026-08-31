#!/usr/bin/env node

/**
 * download-sprites.mjs
 *
 * Automated downloader for Pokémon sprites (regular & shiny) across styles
 * for personal local offline use and archiving.
 *
 * Usage:
 *   node scripts/download-sprites.mjs [--style=pokesprites|official-artwork|home|showdown|all] [--limit=N] [--sample] [--shiny-only] [--regular-only] [--force] [--concurrency=N]
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.resolve(ROOT_DIR, "data");
const SPRITES_DIR = path.resolve(ROOT_DIR, "assets", "sprites");

// CLI Arguments
const args = process.argv.slice(2);
const isSample = args.includes("--sample");
const isForce = args.includes("--force");
const isShinyOnly = args.includes("--shiny-only");
const isRegularOnly = args.includes("--regular-only");

const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : isSample ? 10 : null;

const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
const concurrency = concurrencyArg ? Number(concurrencyArg.split("=")[1]) : 15;

const styleArg = args.find((a) => a.startsWith("--style="));
const requestedStyle = styleArg
  ? styleArg.split("=")[1].toLowerCase()
  : "pokesprites";

const GITHUB_SPRITE_RAW_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

const STYLES = {
  pokesprites: {
    ext: "png",
    regularUrl: (id) => `${GITHUB_SPRITE_RAW_BASE}/${id}.png`,
    shinyUrl: (id) => `${GITHUB_SPRITE_RAW_BASE}/shiny/${id}.png`,
  },
  "official-artwork": {
    ext: "png",
    regularUrl: (id) =>
      `${GITHUB_SPRITE_RAW_BASE}/other/official-artwork/${id}.png`,
    shinyUrl: (id) =>
      `${GITHUB_SPRITE_RAW_BASE}/other/official-artwork/shiny/${id}.png`,
  },
  home: {
    ext: "png",
    regularUrl: (id) => `${GITHUB_SPRITE_RAW_BASE}/other/home/${id}.png`,
    shinyUrl: (id) => `${GITHUB_SPRITE_RAW_BASE}/other/home/shiny/${id}.png`,
  },
  showdown: {
    ext: "gif",
    regularUrl: (id) => `${GITHUB_SPRITE_RAW_BASE}/other/showdown/${id}.gif`,
    shinyUrl: (id) =>
      `${GITHUB_SPRITE_RAW_BASE}/other/showdown/shiny/${id}.gif`,
  },
};

/**
 * Download file from URL with retries and exponential backoff
 */
async function downloadFileWithRetry(
  url,
  destPath,
  { retries = 3, backoff = 300 } = {},
) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "LivingDex-SpriteDownloader/1.0" },
      });
      if (res.status === 404) {
        return { status: "not_found" };
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, buffer);
      return { status: "downloaded", size: buffer.length };
    } catch (err) {
      if (attempt === retries) {
        return { status: "error", error: err.message };
      }
      await new Promise((r) =>
        setTimeout(r, backoff * Math.pow(2, attempt - 1)),
      );
    }
  }
  return { status: "error", error: "Max retries reached" };
}

/**
 * Bounded concurrency worker pool
 */
async function mapConcurrent(items, workerCount, fn, onProgress) {
  let index = 0;
  let completed = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      await fn(items[i], i);
      completed++;
      if (onProgress && completed % 25 === 0) {
        onProgress(completed, items.length);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(workerCount, items.length) },
    worker,
  );
  await Promise.all(workers);
  if (onProgress) {
    onProgress(completed, items.length);
  }
}

/**
 * Collect all species and form IDs from species.json
 */
async function loadTargetIds() {
  const speciesFile = path.join(DATA_DIR, "species.json");
  const uniqueIds = new Set();

  try {
    const raw = await fs.readFile(speciesFile, "utf-8");
    const speciesMap = JSON.parse(raw);
    for (const [idStr, s] of Object.entries(speciesMap)) {
      uniqueIds.add(Number(idStr));
      if (Array.isArray(s.forms)) {
        for (const f of s.forms) {
          if (f.formId) uniqueIds.add(Number(f.formId));
        }
      }
    }
  } catch (err) {
    console.warn(
      "Could not read species.json, falling back to 1..1025:",
      err.message,
    );
    for (let i = 1; i <= 1025; i++) {
      uniqueIds.add(i);
    }
  }

  let list = Array.from(uniqueIds).sort((a, b) => a - b);
  if (limit && limit > 0) {
    list = list.slice(0, limit);
  }
  return list;
}

/**
 * Check if file exists and has content
 */
async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.size > 0;
  } catch {
    return false;
  }
}

/**
 * Main downloader routine
 */
async function main() {
  console.log("🎨 LivingDex Sprite Downloader (Personal Archive Tool)");
  console.log(`📁 Target directory: ${SPRITES_DIR}`);

  const activeStyles =
    requestedStyle === "all"
      ? Object.keys(STYLES)
      : [requestedStyle in STYLES ? requestedStyle : "pokesprites"];

  console.log(`✨ Selected styles: ${activeStyles.join(", ")}`);
  const targetIds = await loadTargetIds();
  console.log(`🔢 Unique target IDs to process: ${targetIds.length}`);

  for (const style of activeStyles) {
    const config = STYLES[style];
    console.log(`\n⬇️  Processing style [${style}] (.${config.ext})...`);

    const downloadTasks = [];

    for (const id of targetIds) {
      if (!isShinyOnly) {
        downloadTasks.push({
          id,
          isShiny: false,
          url: config.regularUrl(id),
          dest: path.join(SPRITES_DIR, style, `${id}.${config.ext}`),
        });
      }
      if (!isRegularOnly) {
        downloadTasks.push({
          id,
          isShiny: true,
          url: config.shinyUrl(id),
          dest: path.join(SPRITES_DIR, style, "shiny", `${id}.${config.ext}`),
        });
      }
    }

    let downloadedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    await mapConcurrent(
      downloadTasks,
      concurrency,
      async (task) => {
        if (!isForce && (await fileExists(task.dest))) {
          skippedCount++;
          return;
        }

        const res = await downloadFileWithRetry(task.url, task.dest);
        if (res.status === "downloaded") {
          downloadedCount++;
        } else if (res.status === "not_found") {
          notFoundCount++;
        } else {
          errorCount++;
        }
      },
      (done, total) => {
        process.stdout.write(
          `\r   Progress: ${done}/${total} (${Math.round((done / total) * 100)}%) — DL: ${downloadedCount}, Skip: ${skippedCount}, 404: ${notFoundCount}`,
        );
      },
    );

    console.log(
      `\n   ✅ Finished [${style}]: ${downloadedCount} downloaded, ${skippedCount} existing skipped, ${notFoundCount} not found, ${errorCount} errors.`,
    );
  }

  console.log("\n🎉 Sprite downloading process complete!");
}

main().catch((err) => {
  console.error("❌ Fatal error downloading sprites:", err);
  process.exit(1);
});
