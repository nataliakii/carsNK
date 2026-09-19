"use client";

/**
 * Crisp vector rovaro logos — no bitmap crops.
 * Magenta accent on letters "ova"; rounded geometric mark ("ova").
 */

export const ROVARO_MAGENTA = "#E30052";

/** App / favicon mark — magenta squircle + white ova ligature */
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
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
      style={style}
    >
      <rect x="4" y="4" width="120" height="120" rx="32" fill={ROVARO_MAGENTA} />
      <circle
        cx="34"
        cy="64"
        r="16"
        stroke="#FFFFFF"
        strokeWidth="11"
        fill="none"
      />
      <path
        d="M52 48 L64 84 L76 48"
        stroke="#FFFFFF"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle
        cx="94"
        cy="64"
        r="16"
        stroke="#FFFFFF"
        strokeWidth="11"
        fill="none"
      />
      <path
        d="M110 64 V88"
        stroke="#FFFFFF"
        strokeWidth="11"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Wordmark: r + magenta ova + ro
 * @param {"light"|"dark"} tone — light = black ink; dark = white ink (for navy/black bars)
 * @param {boolean} showTagline
 */
export function RovaroWordmarkSvg({
  height = 32,
  tone = "light",
  showTagline = false,
  title = "rovaro",
  className,
  style,
}) {
  const ink = tone === "dark" ? "#FFFFFF" : "#0A0A0A";
  const viewH = showTagline ? 100 : 64;
  const width = Math.round((height * 320) / viewH);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 320 ${viewH}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
      style={{ display: "block", ...style }}
    >
      <text
        x="2"
        y="50"
        fontFamily="Nunito, 'Arial Rounded MT Bold', 'Segoe UI', system-ui, sans-serif"
        fontWeight="900"
        fontSize="56"
        letterSpacing="-1.6"
      >
        <tspan fill={ink}>r</tspan>
        <tspan fill={ROVARO_MAGENTA}>ova</tspan>
        <tspan fill={ink}>ro</tspan>
      </text>
      {showTagline ? (
        <text
          x="4"
          y="86"
          fill={ink}
          fontFamily="Nunito, 'Segoe UI', system-ui, sans-serif"
          fontWeight="500"
          fontSize="13"
          letterSpacing="0.15"
          opacity="0.92"
        >
          Local cars. Clear terms. Easy booking.
        </text>
      ) : null}
    </svg>
  );
}
