/**
 * Utility for measuring text width using Canvas API with computed styles
 * Ensures accurate measurement matching actual rendered text
 */

/**
 * Measures text width using Canvas API with computed font styles
 * @param {string} text - Text to measure
 * @param {CSSStyleDeclaration} computedStyle - Computed styles from getComputedStyle
 * @returns {number} Width in pixels
 */
export function measureTextWidth(text, computedStyle) {
  if (typeof window === "undefined" || !computedStyle) return 0;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return 0;

  // Build font string from computed styles
  const fontStyle = computedStyle.fontStyle || "normal";
  const fontWeight = computedStyle.fontWeight || "500";
  const fontSize = computedStyle.fontSize || "14px";
  const fontFamily = computedStyle.fontFamily || "Arial, sans-serif";
  const font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;

  context.font = font;
  const metrics = context.measureText(text);
  
  return metrics.width;
}

/**
 * Gets computed styles from a DOM element
 * @param {HTMLElement} element - DOM element to get styles from
 * @returns {CSSStyleDeclaration|null} Computed styles or null
 */
export function getComputedStyles(element) {
  if (typeof window === "undefined" || !element) return null;
  return window.getComputedStyle(element);
}
