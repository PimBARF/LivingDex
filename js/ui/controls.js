import {
  loadSettings,
  loadCaughtSlots,
  encodeCaughtState,
} from "../storage.js";
import { applyTheme, isMotionReduced } from "./theme.js";
import { showToast } from "./modals.js";
import { isShinyMode, setShinyMode, rebuildDexView } from "../state.js";
import { buildActiveDexSections } from "../api.js";

/**
 * Toggles the visibility of caught Pokémon slots based on the filter checkbox state.
 * Adds or removes the `hide-caught` CSS class on `document.body`.
 *
 * @returns {void}
 */
export function applyHideCaughtFilter() {
  const toggle = document.getElementById("toggleUncaught");
  const enabled = toggle?.checked;
  document.body.classList.toggle("hide-caught", !!enabled);
}

// =============================================================================
// HEADER CONTROLS & USER INTERACTIONS
// =============================================================================

/**
 * Filters and highlights Pokémon cells based on a search query.
 * Supports searching by regional or national Pokédex number (e.g. "#42", "42") or by Pokémon name.
 * Highlights matching cells, dims non-matching cells, and scrolls the first match into view.
 *
 * @param {string} query - The search query string entered by the user.
 * @returns {void}
 */
export function applySearchFilter(query) {
  const trimmed = query.trim().toLowerCase();
  const cells = [...document.querySelectorAll(".cell:not(.is-placeholder)")];
  cells.forEach((cell) => cell.classList.remove("highlight", "dimmed"));

  if (!trimmed) return;

  let matches = [];

  // Match by number (regional or national ID)
  if (/^#?\d+$/.test(trimmed)) {
    const number = Number(trimmed.replace("#", ""));
    matches = cells.filter((cell) => {
      const regional = Number(cell.dataset.regional) || NaN;
      const national = Number(cell.dataset.national) || NaN;
      const label = (cell.querySelector(".label")?.textContent || "").trim();
      return (
        regional === number ||
        national === number ||
        label === `#${number}` ||
        label === String(number)
      );
    });
  } else {
    // Match by name
    matches = cells.filter((cell) => {
      const name =
        cell.dataset.name || cell.querySelector(".label")?.textContent || "";
      return name.toLowerCase().includes(trimmed);
    });
  }

  if (matches.length) {
    const matchedCells = new Set(matches);
    cells.forEach((cell) => {
      if (!matchedCells.has(cell)) cell.classList.add("dimmed");
    });
    matches.forEach((cell) => cell.classList.add("highlight"));
    matches[0].scrollIntoView({
      behavior: isMotionReduced() ? "auto" : "smooth",
      block: "center",
    });
  }
}

/**
 * Registers all header control event listeners and initializes their UI state.
 * Handles search input, uncaught toggle, hide caught button, theme toggle,
 * shiny mode toggle, share URL generation, and mobile search bar collapse on scroll.
 *
 * @param {number} [slotCount] - Total number of slots in the active Pokédex used as a fallback for share link encoding.
 * @returns {void}
 */
export function registerHeaderControls(slotCount) {
  const searchInput = document.getElementById("search");
  const uncaughtToggle = document.getElementById("toggleUncaught");
  const themeToggle = document.getElementById("themeToggle");
  const shareButton = document.getElementById("shareDex");
  const shinyToggle = document.getElementById("shinyToggle");
  const hideCaughtBtn = document.getElementById("hideCaughtBtn");

  /**
   * Synchronizes the hide/show caught button text and ARIA state with the checkbox state.
   *
   * @returns {void}
   */
  const updateHideCaughtUi = () => {
    if (!hideCaughtBtn || !uncaughtToggle) return;
    const checked = !!uncaughtToggle.checked;
    hideCaughtBtn.textContent = checked ? "Show caught" : "Hide caught";
    hideCaughtBtn.setAttribute("aria-pressed", String(checked));
  };

  // Search input
  searchInput?.addEventListener("input", (event) =>
    applySearchFilter(event.target.value),
  );

  // Uncaught filter toggle
  uncaughtToggle?.addEventListener("change", () => {
    applyHideCaughtFilter();
    updateHideCaughtUi();
  });

  // Hide caught button
  hideCaughtBtn?.addEventListener("click", () => {
    if (!uncaughtToggle) return;
    uncaughtToggle.checked = !uncaughtToggle.checked;
    applyHideCaughtFilter();
    updateHideCaughtUi();
  });

  // Theme toggle
  themeToggle?.addEventListener("click", () => {
    const settings = loadSettings();
    const currentMode = settings.theme || "light";
    // Toggle between light and dark (if 'auto', switch to light or dark based on current resolved theme)
    let nextMode;
    if (currentMode === "auto") {
      const resolved =
        document.documentElement.getAttribute("data-theme") || "light";
      nextMode = resolved === "dark" ? "light" : "dark";
    } else {
      nextMode = currentMode === "dark" ? "light" : "dark";
    }
    applyTheme(nextMode);
  });

  // Shiny toggle
  shinyToggle?.addEventListener("click", async () => {
    const nextMode = !isShinyMode;
    setShinyMode(nextMode);

    document.body.classList.toggle("shiny-mode", nextMode);

    shinyToggle.setAttribute("aria-pressed", String(nextMode));
    shinyToggle.classList.toggle("active", nextMode);

    // Rebuild the dex view to reflect shiny mode change
    const { sections } = await buildActiveDexSections();
    const combinedSpeciesIds = sections.flatMap((s) =>
      s.entries.map((e) => e.speciesId),
    );
    const currentSlotCount = combinedSpeciesIds.length;
    rebuildDexView({ sections, slotCount: currentSlotCount });
  });

  // Share button
  shareButton?.addEventListener("click", async () => {
    const activeSlotCount =
      document.querySelectorAll(".cell:not(.is-placeholder)").length ||
      slotCount;
    const url =
      location.origin +
      location.pathname +
      location.search +
      encodeCaughtState(loadCaughtSlots(), activeSlotCount);
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied to clipboard!", "success");
    } catch {
      prompt("Copy this link:", url);
      showToast("Manual copy required.", "warning");
    }
  });

  // Initialize hide caught UI state
  if (uncaughtToggle) {
    uncaughtToggle.checked = !!loadSettings().hideCaughtDefault;
  }
  applyHideCaughtFilter();
  updateHideCaughtUi();

  // Mobile: collapse the search bar after scrolling down a bit
  /**
   * Determines if the viewport matches mobile screen dimensions (<= 640px).
   *
   * @returns {boolean} True if the screen is mobile-sized, false otherwise.
   */
  const isMobile = () => window.matchMedia("(max-width: 640px)").matches;
  const COLLAPSE_Y = 120; // px scrolled to collapse
  const EXPAND_Y = 60; // px to expand again (hysteresis)

  /**
   * Updates header scroll and collapsed search bar CSS classes based on vertical scroll offset and device width.
   *
   * @returns {void}
   */
  const updateSearchCollapse = () => {
    document.body.classList.toggle("is-scrolled", window.scrollY > COLLAPSE_Y);
    if (!isMobile()) {
      document.body.classList.remove("search-collapsed");
      return;
    }
    if (window.scrollY > COLLAPSE_Y) {
      document.body.classList.add("search-collapsed");
    } else if (window.scrollY < EXPAND_Y) {
      document.body.classList.remove("search-collapsed");
    }
  };

  // Expand when focusing the search input
  searchInput?.addEventListener("focus", () => {
    document.body.classList.remove("search-collapsed");
  });

  window.addEventListener("scroll", updateSearchCollapse, { passive: true });
  window.addEventListener("resize", updateSearchCollapse);
  // Run once on init in case the page loads scrolled
  updateSearchCollapse();
}

/**
 * Registers event listeners for the "scroll to top" button.
 * Shows the button after scrolling down past a threshold and scrolls back smoothly when clicked.
 *
 * @returns {void}
 */
export function registerScrollToTopButton() {
  const button = document.getElementById("scrollTop");
  if (!button) return;

  const threshold = 320; // px

  /**
   * Toggles the visible class on the scroll button when page scroll exceeds the threshold.
   *
   * @returns {void}
   */
  function onScroll() {
    if (window.scrollY > threshold) {
      button.classList.add("is-visible");
    } else {
      button.classList.remove("is-visible");
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  button.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: isMotionReduced() ? "auto" : "smooth",
    });
  });
}
