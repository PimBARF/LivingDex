import {
  loadSettings,
  loadCaughtSlots,
  encodeCaughtState,
} from "../storage.js";
import { applyTheme, isMotionReduced } from "./theme.js";
import { showToast } from "./modals.js";

/**
 * Toggle visibility of caught slots based on filter checkbox state.
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
 * Apply search filter to cells based on query.
 * Supports searching by number (#42, 42) or by name.
 * Highlights matches and dims non-matches.
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
 * Register all header control event listeners.
 * Includes: search, filter, theme toggle, and share button.
 */
export function registerHeaderControls(slotCount) {
  const searchInput = document.getElementById("search");
  const uncaughtToggle = document.getElementById("toggleUncaught");
  const themeToggle = document.getElementById("themeToggle");
  const shareButton = document.getElementById("shareDex");
  const hideCaughtBtn = document.getElementById("hideCaughtBtn");

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
  const isMobile = () => window.matchMedia("(max-width: 640px)").matches;
  const COLLAPSE_Y = 120; // px scrolled to collapse
  const EXPAND_Y = 60; // px to expand again (hysteresis)
  const updateSearchCollapse = () => {
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
 * Register scroll-to-top button behavior.
 * Shows the button after scrolling down a bit and scrolls back smoothly.
 */
export function registerScrollToTopButton() {
  const button = document.getElementById("scrollTop");
  if (!button) return;

  const threshold = 320; // px

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
