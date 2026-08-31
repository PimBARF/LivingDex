/**
 * bulbapedia.mjs
 *
 * Scrapes and extracts Pokémon game location and encounter data,
 * regional Pokédex rosters, and evolution details directly from Bulbapedia's
 * MediaWiki API (w/api.php).
 */

const BULBAPEDIA_API = "https://bulbapedia.bulbagarden.net/w/api.php";

/** Rate limiting queue delay (ms) */
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 60;

async function throttledFetch(url, options = {}) {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, options);
}

/**
 * Game version aliases mapping Bulbapedia version names to LivingDex game version keys
 */
export const BULBAPEDIA_VERSION_MAP = {
  // Gen 1
  red: ["Red"],
  blue: ["Blue"],
  yellow: ["Yellow"],
  // Gen 2
  gold: ["Gold"],
  silver: ["Silver"],
  crystal: ["Crystal"],
  // Gen 3
  ruby: ["Ruby"],
  sapphire: ["Sapphire"],
  emerald: ["Emerald"],
  firered: ["FireRed"],
  leafgreen: ["LeafGreen"],
  // Gen 4
  diamond: ["Diamond"],
  pearl: ["Pearl"],
  platinum: ["Platinum"],
  heartgold: ["HeartGold"],
  soulsilver: ["SoulSilver"],
  // Gen 5
  black: ["Black"],
  white: ["White"],
  "black-2": ["Black 2"],
  "white-2": ["White 2"],
  // Gen 6
  x: ["X"],
  y: ["Y"],
  "omega-ruby": ["Omega Ruby"],
  "alpha-sapphire": ["Alpha Sapphire"],
  // Gen 7
  sun: ["Sun"],
  moon: ["Moon"],
  "ultra-sun": ["Ultra Sun"],
  "ultra-moon": ["Ultra Moon"],
  "lets-go-pikachu": ["Let's Go Pikachu", "Let's Go, Pikachu!"],
  "lets-go-eevee": ["Let's Go Eevee", "Let's Go, Eevee!"],
  // Gen 8
  sword: ["Sword"],
  shield: ["Shield"],
  "brilliant-diamond": ["Brilliant Diamond"],
  "shining-pearl": ["Shining Pearl"],
  "legends-arceus": ["Legends: Arceus"],
  // Gen 9
  scarlet: ["Scarlet"],
  violet: ["Violet"],
  "legends-z-a": ["Legends: Z-A"],
};

/**
 * Clean wikitext formatting to plain readable location text
 */
export function cleanWikitext(text) {
  if (!text) return "";
  return (
    text
      // Replace wiki links [[Target|Label]] -> Label, [[Target]] -> Target
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
      // Replace Bulbapedia specific templates like {{FB|Region|Location}} or {{DL|...|Name}}
      .replace(/\{\{[^|]+\|[^|]+\|([^}]+)\}\}/g, "$1")
      .replace(/\{\{[^|]+\|([^}]+)\}\}/g, "$1")
      // Replace linebreaks and HTML tags
      .replace(/<br\s*\/?>/gi, "; ")
      .replace(/<sup[^>]*>.*?<\/sup>/gi, "")
      .replace(/<[^>]+>/g, "")
      // Clean remaining template curlies
      .replace(/\{\{|\}\}/g, "")
      // Remove extra whitespaces
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Extracts top-level MediaWiki templates from text balancing double curly braces
 */
export function extractAvailabilityTemplates(wikitext) {
  const templates = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < wikitext.length - 1; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      if (depth === 0) start = i;
      depth++;
      i++;
    } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const tpl = wikitext.slice(start, i + 2);
        if (tpl.startsWith("{{Availability/Entry") || tpl.startsWith("{{Availability/Gen")) {
          templates.push(tpl);
        }
        start = -1;
      }
      i++;
    }
  }

  return templates;
}

/**
 * Split template parameters respecting nested templates and links
 */
export function splitTemplateParams(innerContent) {
  const params = {};
  let depth = 0;
  let current = "";

  for (let i = 0; i < innerContent.length; i++) {
    const char = innerContent[i];
    if (char === "{" || char === "[") depth++;
    else if (char === "}" || char === "]") depth--;

    if (char === "|" && depth === 0) {
      const [k, ...v] = current.split("=");
      if (k && v.length > 0) {
        params[k.trim().toLowerCase()] = v.join("=").trim();
      }
      current = "";
    } else {
      current += char;
    }
  }

  if (current) {
    const [k, ...v] = current.split("=");
    if (k && v.length > 0) {
      params[k.trim().toLowerCase()] = v.join("=").trim();
    }
  }

  return params;
}

/**
 * Fetch wikitext of a Bulbapedia page
 */
export async function fetchBulbapediaPageWikitext(pageTitle) {
  const url = `${BULBAPEDIA_API}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json`;
  try {
    const res = await throttledFetch(url, {
      headers: {
        "User-Agent": "LivingDex-DataBuilder/1.0 (https://github.com/PimBARF/LivingDex)",
      },
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.parse?.wikitext?.["*"] || "";
  } catch (err) {
    return "";
  }
}

/**
 * Fetch and extract game locations for a given species from Bulbapedia
 *
 * @param {string} speciesName - Name of the Pokémon (e.g. 'Bulbasaur', 'Tinkatink', 'Pikachu')
 * @returns {Promise<Record<string, string[]>>} Dictionary mapping version key to array of locations
 */
export async function fetchBulbapediaEncounters(speciesName) {
  const pageTitle = `${speciesName}_(Pokémon)`;
  const wikitext = await fetchBulbapediaPageWikitext(pageTitle);
  if (!wikitext) return {};

  const encounters = {};
  const templates = extractAvailabilityTemplates(wikitext);

  for (const tpl of templates) {
    const firstPipe = tpl.indexOf("|");
    if (firstPipe === -1) continue;
    const inner = tpl.slice(firstPipe + 1, -2);
    const params = splitTemplateParams(inner);

    const rawArea = params.area || params.location || "";
    if (!rawArea || rawArea.toLowerCase().includes("unobtainable")) continue;

    const cleanedLocation = cleanWikitext(rawArea);
    if (!cleanedLocation) continue;

    const rawVersions = [
      params.v,
      params.v2,
      params.v3,
      params.v4,
      params.v5,
      params.game,
      params.games,
    ].filter(Boolean);

    for (const [versionKey, bulbNames] of Object.entries(BULBAPEDIA_VERSION_MAP)) {
      const matchesVersion = rawVersions.some((v) =>
        bulbNames.some((bn) => v.toLowerCase() === bn.toLowerCase())
      );

      if (matchesVersion) {
        if (!encounters[versionKey]) encounters[versionKey] = [];
        const locParts = cleanedLocation
          .split(/;\s*|\n+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !encounters[versionKey].includes(s));

        encounters[versionKey].push(...locParts);
      }
    }
  }

  return encounters;
}

/**
 * Scrapes a regional Pokédex roster from Bulbapedia
 *
 * @param {string} pageTitle - e.g. "List_of_Pokémon_by_Paldea_Pokédex_number"
 * @returns {Promise<Array<{ speciesName: string, dexNumber: number|null }>>}
 */
export async function fetchBulbapediaDexRoster(pageTitle) {
  const wikitext = await fetchBulbapediaPageWikitext(pageTitle);
  if (!wikitext) return [];

  const results = [];
  const lines = wikitext.split("\n");
  const seen = new Set();

  for (const line of lines) {
    // MediaWiki row format for dex tables often: {{rdex|001|Bulbasaur|...}} or #001 [[Bulbasaur]]
    const templateMatch = line.match(/\{\{(?:rdex|ndex|MSP)\|([0-9]+)\|([^|]+)/i);
    if (templateMatch) {
      const dexNum = Number(templateMatch[1]);
      const name = templateMatch[2].trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        results.push({ speciesName: name, dexNumber: dexNum });
      }
      continue;
    }

    const linkMatch = line.match(/#?([0-9]{1,4})\s+\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    if (linkMatch) {
      const dexNum = Number(linkMatch[1]);
      const name = linkMatch[2].replace(/\s*\(Pokémon\)$/i, "").trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        results.push({ speciesName: name, dexNumber: dexNum });
      }
    }
  }

  return results;
}
