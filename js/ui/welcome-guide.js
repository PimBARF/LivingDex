import { hasSeenWelcomeGuide, markWelcomeGuideSeen } from "../storage.js";
import { attachModalHandlers } from "./modals.js";

/**
 * Slide configuration metadata for the Welcome & First-Time Guide.
 */
export const WELCOME_SLIDES = [
  {
    id: "welcome-basics",
    badge: "Step 1 of 5",
    title: "Welcome to LivingDex!",
    tagline:
      "A fast, privacy-first tracker for your Living Pokédex collection.",
    icon: "🌟",
    contentHtml: `
      <div class="welcome-feature-grid">
        <div class="welcome-card">
          <div class="welcome-card-icon">📦</div>
          <div class="welcome-card-content">
            <strong>30-Slot PC Box Organization</strong>
            <p>Pokémon are automatically arranged into clean 30-slot boxes matching the in-game PC box storage layout.</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">🎮</div>
          <div class="welcome-card-content">
            <strong>All Main-Series Games</strong>
            <p>Switch between Pokémon HOME, Scarlet &amp; Violet, Legends: Arceus, and older generations anytime from the top selector.</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">🔒</div>
          <div class="welcome-card-content">
            <strong>100% Client-Side &amp; Offline</strong>
            <p>Zero accounts required. Progress is saved locally to your device and works seamlessly offline as an installable PWA.</p>
          </div>
        </div>
      </div>
    `,
    tip: "Tip: Use the game dropdown in the top bar to choose any Pokédex or DLC expansion.",
  },
  {
    id: "tracking-batch",
    badge: "Step 2 of 5",
    title: "Quick Tracking & Batch Marking",
    tagline: "Mark individual Pokémon or paint across dozens in seconds.",
    icon: "⚡",
    contentHtml: `
      <div class="welcome-feature-grid">
        <div class="welcome-card">
          <div class="welcome-card-icon">👆</div>
          <div class="welcome-card-content">
            <strong>Single Click or Tap</strong>
            <p>Click or tap any Pokémon slot to toggle its caught status instantly.</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">⌨️</div>
          <div class="welcome-card-content">
            <strong>Batch Range Marking (PC)</strong>
            <p>Click one Pokémon, then hold <kbd class="kbd-badge">Shift</kbd> and click another slot to mark the entire range caught or uncaught.</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">📱</div>
          <div class="welcome-card-content">
            <strong>Touch Drag Painting (Mobile)</strong>
            <p><strong>Press &amp; hold</strong> any Pokémon slot (~320ms) then <strong>drag</strong> across slots to paint-mark them with live visual HUD feedback.</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">☑️</div>
          <div class="welcome-card-content">
            <strong>Box Actions</strong>
            <p>Use the <strong>✓ All / ✗ All</strong> button in any box header to mark an entire box of 30 at once.</p>
          </div>
        </div>
      </div>
    `,
    tip: "Tip: Click the small <strong>ⓘ</strong> icon on any Pokémon to view cries, flavor text, evolution trees, and encounter locations!",
  },
  {
    id: "missing-guide",
    badge: "Step 3 of 5",
    title: "Missing Pokémon & Quota Guide",
    tagline:
      "Never wonder where to find an uncaught Pokémon or how many base forms to breed.",
    icon: "🎯",
    contentHtml: `
      <div class="welcome-feature-grid">
        <div class="welcome-card">
          <div class="welcome-card-icon">📋</div>
          <div class="welcome-card-content">
            <strong>Missing Pokémon Tracker</strong>
            <p>Open <strong>🎯 Missing Guide</strong> (or press <kbd class="kbd-badge">M</kbd>) to view all uncaught Pokémon filtered by wild spawn locations, evolution items, and trades.</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">🌳</div>
          <div class="welcome-card-content">
            <strong>Evolutionary Family Quotas</strong>
            <p>Living Dexes require full families! The guide calculates exactly how many base specimens you need (e.g., 3 Bulbasaurs for Bulbasaur, Ivysaur, and Venusaur).</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">🛍️</div>
          <div class="welcome-card-content">
            <strong>Items &amp; Tasks Shopping List</strong>
            <p>An aggregated shopping list of all evolution stones, items, and tasks needed across your entire incomplete dex.</p>
          </div>
        </div>
      </div>
    `,
    tip: "Tip: You can mark Pokémon caught directly from inside the Missing Guide modal!",
  },
  {
    id: "segments-boxes",
    badge: "Step 4 of 5",
    title: "Segments & Custom Box Order",
    tagline: "Tailor your Pokédex to match your personal in-game PC box setup.",
    icon: "📑",
    contentHtml: `
      <div class="welcome-feature-grid">
        <div class="welcome-card">
          <div class="welcome-card-icon">📑</div>
          <div class="welcome-card-content">
            <strong>Toggle Expansions &amp; Forms</strong>
            <p>Open <strong>📑 Segments</strong> to enable or disable DLCs (Teal Mask, Indigo Disk), Regional Forms, Gender variants, and Form collections (Unown, Vivillon, Alcremie).</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">↕️</div>
          <div class="welcome-card-content">
            <strong>Custom Box Reordering</strong>
            <p>Drag segments or use <strong>▲ / ▼</strong> to reorder sections. Each section aligns seamlessly to 30-slot boxes so your physical game matches.</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">✏️</div>
          <div class="welcome-card-content">
            <strong>Rename &amp; Collapse Boxes</strong>
            <p>Click any box header title to rename it (e.g. <em>"Starters"</em> or <em>"Trade Evolutions"</em>). Collapse boxes to keep your view tidy.</p>
          </div>
        </div>
      </div>
    `,
    tip: "Tip: Use the Segments presets (Base, DLC, All Forms, Master) to configure your dex with a single click.",
  },
  {
    id: "pro-tips",
    badge: "Step 5 of 5",
    title: "Pro Tips, Sharing & Shortcuts",
    tagline: "Handy tools to elevate your collection tracking experience.",
    icon: "🚀",
    contentHtml: `
      <div class="welcome-feature-grid">
        <div class="welcome-card">
          <div class="welcome-card-icon">✨</div>
          <div class="welcome-card-content">
            <strong>Shiny Living Dex Mode</strong>
            <p>Click <strong>✨</strong> (or press <kbd class="kbd-badge">S</kbd>) to toggle into a dedicated Shiny tracker with full shiny sprite palettes.</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">🔗</div>
          <div class="welcome-card-content">
            <strong>Zero-Cloud Share Links</strong>
            <p>Click <strong>🔗</strong> to copy a bit-packed compressed URL hash that shares your exact progress snapshot with friends without an account.</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">🎨</div>
          <div class="welcome-card-content">
            <strong>Custom Sprites &amp; Themes</strong>
            <p>Head to <strong>⚙️ Settings</strong> to switch sprite styles (Pixel, HOME 3D, Official Artwork), theme modes, or UI languages.</p>
          </div>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-icon">⌨️</div>
          <div class="welcome-card-content">
            <strong>Keyboard Hotkeys</strong>
            <p>Press <kbd class="kbd-badge">/</kbd> to search, <kbd class="kbd-badge">H</kbd> to cycle caught filter, <kbd class="kbd-badge">[</kbd> / <kbd class="kbd-badge">]</kbd> to jump boxes, and <kbd class="kbd-badge">?</kbd> for all shortcuts.</p>
          </div>
        </div>
      </div>
    `,
    tip: "You can reopen this guide anytime from the <strong>💡 Guide</strong> link in the footer or in <strong>⚙️ Settings</strong>.",
  },
];

let activeSlideIndex = 0;
let modalController = null;

/**
 * Updates the welcome modal UI to render the current active slide.
 */
function renderActiveSlide() {
  const modal = document.getElementById("modalWelcome");
  if (!modal) return;

  const slide = WELCOME_SLIDES[activeSlideIndex];
  if (!slide) return;

  // Header badges & titles
  const badgeEl = modal.querySelector("#welcomeSlideBadge");
  const titleEl = modal.querySelector("#welcomeSlideTitle");
  const taglineEl = modal.querySelector("#welcomeSlideTagline");
  const contentEl = modal.querySelector("#welcomeSlideContent");
  const tipEl = modal.querySelector("#welcomeSlideTip");

  if (badgeEl) badgeEl.textContent = slide.badge;
  if (titleEl) titleEl.textContent = slide.title;
  if (taglineEl) taglineEl.textContent = slide.tagline;
  if (contentEl) contentEl.innerHTML = slide.contentHtml;
  if (tipEl) tipEl.innerHTML = slide.tip;

  // Progress dots
  const dots = modal.querySelectorAll(".welcome-dot");
  dots.forEach((dot, index) => {
    const isActive = index === activeSlideIndex;
    dot.classList.toggle("is-active", isActive);
    dot.setAttribute("aria-current", isActive ? "step" : "false");
  });

  // Action Buttons
  const prevBtn = modal.querySelector("#welcomePrevBtn");
  const nextBtn = modal.querySelector("#welcomeNextBtn");
  const skipBtn = modal.querySelector("#welcomeSkipBtn");

  const isFirst = activeSlideIndex === 0;
  const isLast = activeSlideIndex === WELCOME_SLIDES.length - 1;

  if (prevBtn) {
    prevBtn.disabled = isFirst;
    prevBtn.style.visibility = isFirst ? "hidden" : "visible";
  }

  if (nextBtn) {
    if (isLast) {
      nextBtn.innerHTML = `<span>Get Started!</span> <span aria-hidden="true">🎉</span>`;
      nextBtn.classList.add("btn-success");
      nextBtn.classList.remove("btn-primary");
    } else {
      nextBtn.innerHTML = `<span>Next</span> <span aria-hidden="true">➔</span>`;
      nextBtn.classList.add("btn-primary");
      nextBtn.classList.remove("btn-success");
    }
  }

  if (skipBtn) {
    skipBtn.style.display = isLast ? "none" : "";
  }
}

/**
 * Navigates to a specific slide index.
 *
 * @param {number} targetIndex - Target slide index (0 to length - 1).
 */
export function goToWelcomeSlide(targetIndex) {
  if (targetIndex < 0 || targetIndex >= WELCOME_SLIDES.length) return;
  activeSlideIndex = targetIndex;
  renderActiveSlide();
}

/**
 * Advances to the next slide or completes the guide if on the final slide.
 */
export function nextWelcomeSlide() {
  if (activeSlideIndex < WELCOME_SLIDES.length - 1) {
    activeSlideIndex += 1;
    renderActiveSlide();
  } else {
    completeWelcomeGuide();
  }
}

/**
 * Returns to the previous slide.
 */
export function prevWelcomeSlide() {
  if (activeSlideIndex > 0) {
    activeSlideIndex -= 1;
    renderActiveSlide();
  }
}

/**
 * Completes or dismisses the welcome guide, persists the seen flag, and closes the modal.
 */
export function completeWelcomeGuide() {
  markWelcomeGuideSeen(true);
  modalController?.closeModal();
}

/**
 * Opens the Welcome Guide modal, optionally at a specific slide.
 *
 * @param {number} [startSlide=0] - Initial slide index to display.
 */
export function openWelcomeGuideModal(startSlide = 0) {
  activeSlideIndex = Math.max(
    0,
    Math.min(startSlide, WELCOME_SLIDES.length - 1),
  );
  renderActiveSlide();
  modalController?.openModal();
}

/**
 * Registers event listeners and accessibility controls for the Welcome Guide modal.
 *
 * @returns {{ openModal: () => void, closeModal: () => void }} Modal controller methods.
 */
export function registerWelcomeGuideModal() {
  const modal = document.getElementById("modalWelcome");
  const openBtn = document.getElementById("footerGuideBtn");
  const closeBtn = document.getElementById("closeWelcomeGuide");
  const backdrop = modal?.querySelector("[data-close]");
  const nextBtn = modal?.querySelector("#welcomeNextBtn");
  const prevBtn = modal?.querySelector("#welcomePrevBtn");
  const skipBtn = modal?.querySelector("#welcomeSkipBtn");
  const settingsReplayBtn = document.getElementById("settingsReplayGuideBtn");
  const aboutReplayBtn = document.getElementById("aboutReplayGuideBtn");
  const dotsContainer = modal?.querySelector("#welcomeDotsContainer");

  if (!modal) return { openModal: () => {}, closeModal: () => {} };

  // Generate pagination dots
  if (dotsContainer) {
    dotsContainer.innerHTML = "";
    WELCOME_SLIDES.forEach((slide, idx) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `welcome-dot${idx === 0 ? " is-active" : ""}`;
      dot.setAttribute("aria-label", `Go to ${slide.title}`);
      dot.addEventListener("click", () => goToWelcomeSlide(idx));
      dotsContainer.appendChild(dot);
    });
  }

  // Slide navigation buttons
  nextBtn?.addEventListener("click", nextWelcomeSlide);
  prevBtn?.addEventListener("click", prevWelcomeSlide);
  skipBtn?.addEventListener("click", completeWelcomeGuide);

  // Settings / About replay buttons
  settingsReplayBtn?.addEventListener("click", () => {
    openWelcomeGuideModal(0);
  });
  aboutReplayBtn?.addEventListener("click", () => {
    openWelcomeGuideModal(0);
  });

  // Touch swipe support on modal card
  const card = modal.querySelector(".welcome-modal-card");
  if (card) {
    let touchStartX = 0;
    let touchStartY = 0;

    card.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches && e.touches[0]) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true },
    );

    card.addEventListener(
      "touchend",
      (e) => {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;

        // Horizontal swipe detected (threshold 45px, more horizontal than vertical)
        if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX < 0) {
            // Swiped left -> next
            nextWelcomeSlide();
          } else {
            // Swiped right -> prev
            prevWelcomeSlide();
          }
        }
      },
      { passive: true },
    );
  }

  // Attach modal framework
  modalController = attachModalHandlers({
    modal,
    openBtn,
    closeBtn,
    backdrop,
    onOpen: () => {
      renderActiveSlide();
      const focusTarget = modal.querySelector("#welcomeNextBtn");
      focusTarget?.focus();
    },
    onClose: () => {
      markWelcomeGuideSeen(true);
    },
    onKeydown: (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextWelcomeSlide();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        prevWelcomeSlide();
      }
    },
    focusSelector: "#welcomeNextBtn",
  });

  return modalController;
}

/**
 * Checks if this is a first-time visitor. If so, opens the Welcome Guide after a short delay.
 *
 * @param {number} [delayMs=400] - Delay in milliseconds before opening the modal.
 * @returns {void}
 */
export function checkFirstTimeVisitor(delayMs = 400) {
  if (!hasSeenWelcomeGuide()) {
    setTimeout(() => {
      // Re-verify modal is not already open or blocked by another dialog
      const anyModalOpen = document.querySelector(".modal:not([hidden])");
      if (!anyModalOpen) {
        openWelcomeGuideModal(0);
      }
    }, delayMs);
  }
}
