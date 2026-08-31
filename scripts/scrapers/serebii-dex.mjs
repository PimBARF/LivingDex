/**
 * serebii-dex.mjs
 *
 * Scrapes Pokédex rosters, DLC segments, and species metadata
 * directly from Serebii when PokéAPI has missing/incomplete game entries.
 */

import * as cheerio from "cheerio";

/**
 * Game URL mapping on Serebii for Pokédex lists
 */
const SEREBII_DEX_URLS = {
  paldea: "https://www.serebii.net/pokedex-sv/",
  kitakami: "https://www.serebii.net/scarletviolet/thetealmaskpokedex.shtml",
  blueberry: "https://www.serebii.net/scarletviolet/theindigodiskpokedex.shtml",
  hisui: "https://www.serebii.net/legendsarceus/hisuipokedex.shtml",
  galar: "https://www.serebii.net/pokedex-swsh/",
  armor: "https://www.serebii.net/swordshield/isleofarmorpokedex.shtml",
  tundra: "https://www.serebii.net/swordshield/crowntundrapokedex.shtml",
  lumiose: "https://www.serebii.net/legendsza/pokedex.shtml",
};

/**
 * Extract numerical dex number from string like "#001" or "001"
 */
function parseDexNumber(str) {
  const match = String(str || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * Scrapes a Pokédex roster from Serebii
 *
 * @param {string} dexKey - Key in SEREBII_DEX_URLS
 * @returns {Promise<Array<{ speciesName: string, dexNumber: number|null }>>}
 */
export async function fetchSerebiiDexRoster(dexKey) {
  const url = SEREBII_DEX_URLS[dexKey];
  if (!url) return [];

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];
    const seen = new Set();

    $("table.dextable tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 2) return;

      const numText = $(cells[0]).text().trim();
      const dexNum = parseDexNumber(numText);
      if (dexNum === null) return;

      const nameLink = $(row).find("a[href*='/pokedex']").first();
      let name = nameLink.text().trim();
      if (!name) {
        name = $(cells[1] || cells[2] || cells[3])
          .text()
          .trim();
      }

      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        results.push({
          speciesName: name,
          dexNumber: dexNum,
        });
      }
    });

    return results;
  } catch (err) {
    console.warn(
      `[Serebii] Failed to scrape dex roster for ${dexKey}: ${err.message}`,
    );
    return [];
  }
}

/**
 * Scrape single Pokémon summary from Serebii if missing in PokéAPI
 *
 * @param {string} speciesName
 * @param {string} gameKey - 'sv', 'swsh', 'la'
 * @returns {Promise<Object|null>}
 */
export async function fetchSerebiiSpeciesDetails(speciesName, gameKey = "sv") {
  const cleanName = speciesName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const url = `https://www.serebii.net/pokedex-${gameKey}/${cleanName}/`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const types = [];
    $(
      "a[href*='/pokedex-sv/type/'] img, a[href*='/pokedex-swsh/type/'] img",
    ).each((_, img) => {
      const src = $(img).attr("src") || "";
      const match = src.match(/type\/([a-z]+)\.gif/i);
      if (match && !types.includes(match[1].toLowerCase())) {
        types.push(match[1].toLowerCase());
      }
    });

    return {
      name: speciesName,
      types: types.length ? types : ["normal"],
    };
  } catch (err) {
    return null;
  }
}
