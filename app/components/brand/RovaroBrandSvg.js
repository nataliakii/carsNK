"use client";

/**
 * Crisp vector Rovaro logos.
 *
 * Wordmark: lowercase "rovaro" = ink "ro" + magenta "va" + ink "ro"
 * Mark/favicon: solid magenta squircle + white "va" (shared VA_LOCAL paths)
 */

import {
  MARK_TILE,
  MARK_VIEWBOX,
  ROVARO_INK_DARK,
  ROVARO_INK_LIGHT,
  ROVARO_MAGENTA,
  VA_LOCAL,
  VA_ON_MARK,
  WORDMARK_LAYOUT,
  WORDMARK_RO,
} from "./rovaroOvaGeometry";

export { ROVARO_MAGENTA };

/** One compound path so evenodd punches inner holes. */
function EvenOddGroup({ paths, fill }) {
  return <path d={paths.join(" ")} fill={fill} fillRule="evenodd" />;
}

/**
 * Shared VA monogram — identical geometry in wordmark, favicon, and loader.
 */
export function VaLigature({ fill, x = 0, y = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <EvenOddGroup paths={VA_LOCAL.paths} fill={fill} />
    </g>
  );
}

/** @deprecated use VaLigature — O is no longer part of the mark ligature */
export function OvaLigature(props) {
  return <VaLigature {...props} />;
}

/**
 * App / favicon mark — solid magenta squircle + white VA.
 * No glow, frame inset, smoke, or gradients.
 */
export function RovaroMarkSvg({
  size = 40,
  title = "rovaro",
  className,
  style,
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={MARK_VIEWBOX}
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
      style={style}
    >
      <rect
        x={MARK_TILE.x}
        y={MARK_TILE.y}
        width={MARK_TILE.size}
        height={MARK_TILE.size}
        rx={MARK_TILE.rx}
        fill={ROVARO_MAGENTA}
      />
      <VaLigature
        fill="#FFFFFF"
        x={VA_ON_MARK.x}
        y={VA_ON_MARK.y}
        scale={VA_ON_MARK.scale}
      />
    </svg>
  );
}

/**
 * Wordmark: ro (ink) + va (magenta) + ro (ink)
 * @param {"light"|"dark"} tone — light = black ink; dark = white ink
 */
export function RovaroWordmarkSvg({
  height = 32,
  tone = "light",
  showTagline = false,
  title = "rovaro",
  className,
  style,
}) {
  const ink = tone === "dark" ? ROVARO_INK_DARK : ROVARO_INK_LIGHT;
  const L = WORDMARK_LAYOUT;
  const viewH = showTagline ? L.taggedHeight : L.height;
  const width = Math.round((height * L.width) / viewH);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${L.width} ${viewH}`}
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
      style={{ display: "block", ...style }}
    >
      <g transform={`translate(${L.ro1X} ${L.letterY}) scale(${L.roScale})`}>
        <EvenOddGroup paths={WORDMARK_RO.paths} fill={ink} />
      </g>
      <VaLigature
        fill={ROVARO_MAGENTA}
        x={L.vaX}
        y={L.letterY}
        scale={L.vaScale}
      />
      <g transform={`translate(${L.ro2X} ${L.letterY}) scale(${L.roScale})`}>
        <EvenOddGroup paths={WORDMARK_RO.paths} fill={ink} />
      </g>
      {showTagline ? (
        <text
          x={L.ro1X}
          y={L.height + L.tagGap + 8}
          fill={ink}
          fontFamily="Nunito, 'Segoe UI', system-ui, sans-serif"
          fontWeight="500"
          fontSize="28"
          letterSpacing="0.12"
          opacity="0.92"
        >
          {L.tagline}
        </text>
      ) : null}
    </svg>
  );
}
