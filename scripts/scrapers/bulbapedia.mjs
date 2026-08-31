/**
 * bulbapedia.mjs
 *
 * Scrapes and extracts Pokémon game location and encounter data
 * directly from Bulbapedia's MediaWiki API (w/api.php).
 */

const BULBAPEDIA_API = "https://bulbapedia.bulbagarden.net/w/api.php";

/**
 * Game version aliases mapping Bulbapedia version names to LivingDex game version keys
 */
const BULBAPEDIA_VERSION_MAP = {
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
function cleanWikitext(text) {
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
function extractAvailabilityTemplates(wikitext) {
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
        if (tpl.startsWith("{{Availability/Entry")) {
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
function splitTemplateParams(innerContent) {
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
 * Fetch and extract game locations for a given species from Bulbapedia
 *
 * @param {string} speciesName - Name of the Pokémon (e.g. 'Bulbasaur', 'Tinkatink', 'Pikachu')
 * @returns {Promise<Record<string, string[]>>} Dictionary mapping version key to array of locations
 */
export async function fetchBulbapediaEncounters(speciesName) {
  const pageTitle = `${encodeURIComponent(speciesName)}_(Pokémon)`;
  const url = `${BULBAPEDIA_API}?action=parse&page=${pageTitle}&prop=wikitext&format=json`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "LivingDex-DataBuilder/1.0 (https://github.com/PimBARF/LivingDex)",
      },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const wikitext = data.parse?.wikitext?.["*"] || "";
    if (!wikitext) return {};

    const encounters = {};
    const templates = extractAvailabilityTemplates(wikitext);

    for (const tpl of templates) {
      // Strip {{Availability/Entry...| and trailing }}
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
      ].filter(Boolean);

      for (const [versionKey, bulbNames] of Object.entries(
        BULBAPEDIA_VERSION_MAP,
      )) {
        const matchesVersion = rawVersions.some((v) =>
          bulbNames.some((bn) => v.toLowerCase() === bn.toLowerCase()),
        );

        if (matchesVersion) {
          if (!encounters[versionKey]) encounters[versionKey] = [];
          // Split compound area descriptions by semicolon or newline
          const locParts = cleanedLocation
            .split(/;\s*|\n+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && !encounters[versionKey].includes(s));

          encounters[versionKey].push(...locParts);
        }
      }
    }

    return encounters;
  } catch (err) {
    console.warn(
      `[Bulbapedia] Failed to parse encounters for ${speciesName}: ${err.message}`,
    );
    return {};
  }
}
