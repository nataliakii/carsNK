/**
 * Shared Rovaro brand geometry.
 *
 * Wordmark (lowercase "rovaro"):
 *   ink "ro" + magenta connected "va" monogram + ink "ro"
 * Favicon / loader mark:
 *   solid magenta squircle + white "va" (same VA_LOCAL paths)
 *
 * The first "o" is a complete ring — never notched, masked, or joined to "v".
 * Only "v"+"a" form the connected monogram.
 */
export const ROVARO_MAGENTA = "#E9004F";
export const ROVARO_INK_DARK = "#FFFFFF";
export const ROVARO_INK_LIGHT = "#0A0A0A";

/** Compact mark canvas (128 viewBox, 120×120 squircle). */
export const MARK_VIEWBOX = "0 0 128 128";
export const MARK_TILE = { x: 4, y: 4, size: 120, rx: 32 };

/**
 * Connected VA monogram — shared by wordmark, favicon, and loader.
 * One outer silhouette (no overlapping subpaths) + A counter hole.
 * Soft readable "v" flowing into single-story "a".
 * Local height matches WORDMARK_RO (~192).
 */
export const VA_LOCAL = {
  width: 300,
  height: 192,
  paths: [
    // Soft V (two rounded tops) → continuous merge into A
    [
      "M20 16",
      "C20 6 28 0 40 0",
      "L72 0",
      "C84 0 92 10 96 24",
      "L110 120",
      "C114 140 128 150 148 146",
      "C160 143 168 132 172 118",
      "L180 40",
      "C184 16 198 0 222 0",
      "C268 0 300 34 300 90",
      "C300 154 266 192 216 192",
      "L152 192",
      "C112 192 88 174 74 150",
      "C60 126 44 84 32 48",
      "C26 30 20 22 20 16",
      "Z",
    ].join(""),
    // A counter — kept fully inside the A bowl (right of the VA join)
    "M228 132C256 132 276 114 276 90C276 66 256 48 228 48C200 48 180 66 180 90C180 114 200 132 228 132Z",
  ],
};

/** @deprecated alias — prefer VA_LOCAL */
export const OVA_VA_PATHS = VA_LOCAL.paths;
export const OVA_LOCAL = {
  width: VA_LOCAL.width,
  height: VA_LOCAL.height,
  paths: VA_LOCAL.paths,
  vaPaths: VA_LOCAL.paths,
  oPaths: [],
};

/** Final (and first) "ro" pair — complete O ring, never masked. */
export const WORDMARK_RO = {
  width: 305.247,
  height: 192.362,
  paths: [
    "M192.215 191.366C191.115 191.149 187.74 190.497 184.715 189.916C151.409 183.517 123.665 159.77 112.302 127.933C107.641 114.871 106.338 105.636 106.99 90.264C107.618 75.455 109.81 66.577 115.796 54.602C128.845 28.496 150.821 10.41 178.715 2.82C186.085 0.815 189.543 0.507 204.715 0.507C219.854 0.507 223.353 0.817 230.647 2.803C272.74 14.267 300.153 47.995 302.392 91.075C305.015 141.541 272.846 181.809 222.956 190.509C215.259 191.851 197.232 192.354 192.215 191.366Z",
    "M0.045 188.409C-0.212 187.739 -0.232 162.508 0 132.341C0.461 72.446 0.47 72.343 6.682 56.234C16.13 31.736 39.035 10.99 64.747 3.643C72.235 1.504 86.062 0.01 98.465 0L108.715 -0.008 L108.715 26.992L108.715 53.992 L96.821 53.992C71.87 53.992 58.945 62.379 52.902 82.492C51.676 86.569 51.322 96.945 50.978 138.721L50.558 189.95 L25.535 189.789C6.911 189.669 0.393 189.316 0.045 188.409Z",
    "M217.255 139.449C240.888 133.334 254.754 107.763 248.163 82.452C242.054 58.99 217.11 45.171 192.42 51.568C183.98 53.755 179.252 56.371 172.927 62.352C155.055 79.253 154.138 108.163 170.892 126.494C182.233 138.903 200.087 143.892 217.255 139.449Z",
  ],
};

/** Standalone R (legacy / tests). Prefer WORDMARK_RO for "ro" pairs. */
export const WORDMARK_R = {
  width: 119.106,
  height: 190.19,
  paths: [
    "M0 132.338C0.34 75.714 0.395 74.335 2.602 66.993C8.075 48.783 19.523 31.245 32.882 20.601C51.948 5.411 70.187 0.014 102.508 0L118.758 -0.007 L118.758 26.38L118.758 52.766 L101.508 53.243C78.955 53.866 72.454 56.065 63.092 66.238C58.137 71.623 56.515 74.58 54.257 82.346C52.774 87.447 52.544 94.485 52.411 138.833L52.258 189.493 L25.955 189.838L-0.348 190.183 L0 132.338Z",
  ],
};

/** Compact-mark transform: white VA centred on the magenta tile. */
export const VA_ON_MARK = (() => {
  const pad = 18;
  const inner = MARK_TILE.size - pad * 2;
  const scale = inner / Math.max(VA_LOCAL.width, VA_LOCAL.height);
  const drawnW = VA_LOCAL.width * scale;
  const drawnH = VA_LOCAL.height * scale;
  return {
    x: MARK_TILE.x + (MARK_TILE.size - drawnW) / 2,
    y: MARK_TILE.y + (MARK_TILE.size - drawnH) / 2,
    scale,
  };
})();

/** @deprecated */
export const OVA_ON_MARK = VA_ON_MARK;

const _padX = 8;
const _padY = 18;
const _gapRoVa = 28;
const _gapVaRo = 20;
const _roScale = 1;
const _vaScale = 1;
const _ro1X = _padX;
const _vaX = _ro1X + WORDMARK_RO.width * _roScale + _gapRoVa;
const _ro2X = _vaX + VA_LOCAL.width * _vaScale + _gapVaRo;
const _wmWidth = _ro2X + WORDMARK_RO.width * _roScale + _padX;
const _wmHeight = _padY * 2 + WORDMARK_RO.height;

export const WORDMARK_LAYOUT = {
  padX: _padX,
  padY: _padY,
  gapRoVa: _gapRoVa,
  gapVaRo: _gapVaRo,
  roScale: _roScale,
  vaScale: _vaScale,
  width: _wmWidth,
  height: _wmHeight,
  letterY: _padY,
  ro1X: _ro1X,
  vaX: _vaX,
  ro2X: _ro2X,
  tagGap: 18,
  tagHeight: 36,
  taggedHeight: _wmHeight + 18 + 36,
  tagline: "Road-ready. Value clear. Roam easy.",
};
