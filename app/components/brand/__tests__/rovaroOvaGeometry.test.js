import React from "react";
import { existsSync } from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MARK_TILE,
  ROVARO_MAGENTA,
  VA_LOCAL,
  VA_ON_MARK,
  WORDMARK_LAYOUT,
  WORDMARK_RO,
} from "../rovaroOvaGeometry";
import { RovaroMarkSvg, RovaroWordmarkSvg } from "../RovaroBrandSvg";

const brandDir = path.join(process.cwd(), "public/brand/rovaro");

describe("Rovaro brand geometry (ro + va + ro)", () => {
  test("wordmark is ink ro + magenta va + ink ro with shared VA paths", () => {
    const mark = renderToStaticMarkup(<RovaroMarkSvg size={56} title="rovaro" />);
    const wordmark = renderToStaticMarkup(
      <RovaroWordmarkSvg height={34} tone="dark" title="rovaro" />
    );

    for (const d of VA_LOCAL.paths) {
      expect(mark).toContain(d);
      expect(wordmark).toContain(d);
    }
    for (const d of WORDMARK_RO.paths) {
      expect(wordmark).toContain(d);
      expect(mark).not.toContain(d);
    }
    expect(mark).toContain(ROVARO_MAGENTA);
    expect(mark).toContain("#FFFFFF");
    expect(wordmark).toContain(ROVARO_MAGENTA);
    expect(ROVARO_MAGENTA).toBe("#E9004F");
  });

  test("mark is solid magenta tile + white VA (no frame/smoke)", () => {
    const mark = renderToStaticMarkup(<RovaroMarkSvg size={56} title="rovaro" />);
    expect(mark).toContain('viewBox="0 0 128 128"');
    expect(mark).toContain(`width="${MARK_TILE.size}"`);
    expect(mark).toContain(`rx="${MARK_TILE.rx}"`);
    expect(mark).toContain(
      `translate(${VA_ON_MARK.x} ${VA_ON_MARK.y}) scale(${VA_ON_MARK.scale})`
    );
    expect(mark).not.toContain("#000000");
    expect(mark).not.toMatch(/filter=|feGaussianBlur/);
    expect(mark.match(/<rect /g) || []).toHaveLength(1);
  });

  test("first o in WORDMARK_RO is a complete ring (outer + hole)", () => {
    expect(WORDMARK_RO.paths).toHaveLength(3);
    expect(WORDMARK_RO.paths[0]).toContain("305.015");
    expect(WORDMARK_RO.paths[0]).toContain("106.338");
  });

  test("wordmark layout spaces o from va (no connection)", () => {
    expect(WORDMARK_LAYOUT.gapRoVa).toBeGreaterThanOrEqual(16);
    expect(WORDMARK_LAYOUT.vaX).toBeGreaterThan(
      WORDMARK_LAYOUT.ro1X + WORDMARK_RO.width * WORDMARK_LAYOUT.roScale
    );
    const html = renderToStaticMarkup(
      <RovaroWordmarkSvg height={34} tone="dark" title="rovaro" />
    );
    expect(html).toContain(
      `viewBox="0 0 ${WORDMARK_LAYOUT.width} ${WORDMARK_LAYOUT.height}"`
    );
    expect(html).toContain(`scale(${WORDMARK_LAYOUT.vaScale})`);
  });

  test("approved raster wordmarks + ova favicon sizes exist", () => {
    for (const name of [
      "rovaro-white-background.png",
      "wordmark-compact.png",
      "rovaro-transparent.png",
      "mark.png",
      "favicon.png",
      "favicon.ico",
      "favicon-16.png",
      "favicon-32.png",
      "favicon-48.png",
      "favicon-64.png",
      "favicon-128.png",
      "favicon-192.png",
      "favicon-512.png",
      "apple-icon.png",
    ]) {
      expect(existsSync(path.join(brandDir, name))).toBe(true);
    }
  });
});
