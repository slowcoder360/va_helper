/**
 * Accessibility Utilities
 * 
 * Helper functions and constants for maintaining accessibility standards.
 */

// ============================================
// Screen Reader Only Class
// ============================================

export const srOnly = "sr-only";

// ============================================
// Focus Management
// ============================================

/**
 * Focus the first focusable element within a container
 */
export function focusFirstFocusable(container: HTMLElement | null) {
  if (!container) return;
  
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0] as HTMLElement | undefined;
  firstFocusable?.focus();
}

/**
 * Trap focus within a container (for modals, dialogs)
 */
export function trapFocus(container: HTMLElement) {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0] as HTMLElement;
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleTab = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  };

  container.addEventListener("keydown", handleTab);
  
  return () => {
    container.removeEventListener("keydown", handleTab);
  };
}

// ============================================
// ARIA Live Region Announcements
// ============================================

let liveRegion: HTMLElement | null = null;

function getLiveRegion(): HTMLElement {
  if (liveRegion) return liveRegion;
  
  liveRegion = document.createElement("div");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  liveRegion.className = "sr-only";
  document.body.appendChild(liveRegion);
  
  return liveRegion;
}

/**
 * Announce a message to screen readers
 */
export function announce(message: string, priority: "polite" | "assertive" = "polite") {
  const region = getLiveRegion();
  region.setAttribute("aria-live", priority);
  
  // Clear and set message to ensure announcement
  region.textContent = "";
  setTimeout(() => {
    region.textContent = message;
  }, 100);
}

// ============================================
// Keyboard Navigation Helpers
// ============================================

/**
 * Handle arrow key navigation in a list
 */
export function handleArrowNavigation(
  e: KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  options: {
    orientation?: "horizontal" | "vertical" | "both";
    loop?: boolean;
  } = {}
): number {
  const { orientation = "vertical", loop = true } = options;
  
  let newIndex = currentIndex;
  
  const vertical = orientation === "vertical" || orientation === "both";
  const horizontal = orientation === "horizontal" || orientation === "both";
  
  switch (e.key) {
    case "ArrowUp":
      if (vertical) {
        e.preventDefault();
        newIndex = currentIndex - 1;
        if (newIndex < 0) {
          newIndex = loop ? items.length - 1 : 0;
        }
      }
      break;
    case "ArrowDown":
      if (vertical) {
        e.preventDefault();
        newIndex = currentIndex + 1;
        if (newIndex >= items.length) {
          newIndex = loop ? 0 : items.length - 1;
        }
      }
      break;
    case "ArrowLeft":
      if (horizontal) {
        e.preventDefault();
        newIndex = currentIndex - 1;
        if (newIndex < 0) {
          newIndex = loop ? items.length - 1 : 0;
        }
      }
      break;
    case "ArrowRight":
      if (horizontal) {
        e.preventDefault();
        newIndex = currentIndex + 1;
        if (newIndex >= items.length) {
          newIndex = loop ? 0 : items.length - 1;
        }
      }
      break;
    case "Home":
      e.preventDefault();
      newIndex = 0;
      break;
    case "End":
      e.preventDefault();
      newIndex = items.length - 1;
      break;
  }
  
  if (newIndex !== currentIndex && items[newIndex]) {
    items[newIndex].focus();
  }
  
  return newIndex;
}

// ============================================
// ID Generation for ARIA relationships
// ============================================

let idCounter = 0;

export function generateId(prefix = "vacax"): string {
  return `${prefix}-${++idCounter}`;
}

// ============================================
// Common ARIA Patterns
// ============================================

export interface AriaDescribedByProps {
  "aria-describedby"?: string;
}

export interface AriaLabelledByProps {
  "aria-labelledby"?: string;
}

export interface AriaExpandedProps {
  "aria-expanded": boolean;
  "aria-controls"?: string;
}

/**
 * Generate ARIA props for an expandable element
 */
export function getExpandableProps(
  isExpanded: boolean,
  controlsId: string
): AriaExpandedProps {
  return {
    "aria-expanded": isExpanded,
    "aria-controls": controlsId,
  };
}

/**
 * Generate ARIA props for a tab panel relationship
 */
export function getTabPanelProps(tabId: string, panelId: string) {
  return {
    tab: {
      id: tabId,
      "aria-controls": panelId,
      role: "tab" as const,
    },
    panel: {
      id: panelId,
      "aria-labelledby": tabId,
      role: "tabpanel" as const,
    },
  };
}

// ============================================
// Reduced Motion Check
// ============================================

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
