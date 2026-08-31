/**
 * serebii.mjs
 *
 * Scrapes game-specific encounter tables directly from Serebii HTML dex pages.
 */

import * as cheerio from "cheerio";

/**
 * Fetch and extract game encounters from Serebii SV Pokédex
 *
 * @param {string} speciesName - Name of the Pokémon
 * @returns {Promise<Record<string, string[]>>} Dictionary mapping version names to location arrays
 */
export async function fetchSerebiiSVEncounters(speciesName) {
  const cleanName = speciesName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const url = `https://www.serebii.net/pokedex-sv/${cleanName}/`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return {};
    const html = await res.text();
    const $ = cheerio.load(html);
    const encounters = { scarlet: [], violet: [] };

    $("table.dextable tr").each((_, row) => {
      const text = $(row).text().replace(/\s+/g, " ").trim();
      if (!text) return;

      if (text.startsWith("Scarlet")) {
        const cleaned = text
          .replace(/^Scarlet\s*/, "")
          .replace(/Map$/, "")
          .trim();
        if (cleaned && !cleaned.toLowerCase().includes("unobtainable")) {
          encounters.scarlet.push(cleaned);
        }
      } else if (text.startsWith("Violet")) {
        const cleaned = text
          .replace(/^Violet\s*/, "")
          .replace(/Map$/, "")
          .trim();
        if (cleaned && !cleaned.toLowerCase().includes("unobtainable")) {
          encounters.violet.push(cleaned);
        }
      }
    });

    return encounters;
  } catch (err) {
    console.warn(
      `[Serebii] Failed to scrape SV encounters for ${speciesName}: ${err.message}`,
    );
    return {};
  }
}

/**
 * Fetch and extract game encounters for Sword & Shield from Serebii
 *
 * @param {string} speciesName
 * @returns {Promise<Record<string, string[]>>}
 */
export async function fetchSerebiiSwShEncounters(speciesName) {
  const cleanName = speciesName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const url = `https://www.serebii.net/pokedex-swsh/${cleanName}/`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return {};
    const html = await res.text();
    const $ = cheerio.load(html);
    const encounters = { sword: [], shield: [] };

    $("table.dextable tr").each((_, row) => {
      const text = $(row).text().replace(/\s+/g, " ").trim();
      if (!text) return;

      if (text.startsWith("Sword")) {
        const cleaned = text
          .replace(/^Sword\s*/, "")
          .replace(/Map$/, "")
          .trim();
        if (cleaned && !cleaned.toLowerCase().includes("unobtainable")) {
          encounters.sword.push(cleaned);
        }
      } else if (text.startsWith("Shield")) {
        const cleaned = text
          .replace(/^Shield\s*/, "")
          .replace(/Map$/, "")
          .trim();
        if (cleaned && !cleaned.toLowerCase().includes("unobtainable")) {
          encounters.shield.push(cleaned);
        }
      }
    });

    return encounters;
  } catch (err) {
    return {};
  }
}
