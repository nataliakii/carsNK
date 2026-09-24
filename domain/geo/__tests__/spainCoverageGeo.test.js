import fs from "fs";
import path from "path";
import {
  coverageMapBounds,
  featureAdminCode,
  featuresForServiceAreas,
  indexSpainCoverageGeo,
  resolveCoverageCityPoints,
} from "../spainCoverageGeo";
import {
  SPAIN_COMMUNITIES,
  SPAIN_PROVINCES,
} from "../spainAdminDivisions";

function loadBundledGeo() {
  const root = process.cwd();
  const communities = JSON.parse(
    fs.readFileSync(path.join(root, "public/geo/spain-communities.geojson"), "utf8")
  );
  const provinces = JSON.parse(
    fs.readFileSync(path.join(root, "public/geo/spain-provinces.geojson"), "utf8")
  );
  return indexSpainCoverageGeo({ communities, provinces });
}

describe("spainCoverageGeo", () => {
  const geo = loadBundledGeo();

  test("matches every official INE code to a real GeoJSON polygon", () => {
    for (const community of SPAIN_COMMUNITIES) {
      const feature = geo.communities.get(community.code);
      expect(feature).toBeTruthy();
      expect(featureAdminCode(feature)).toBe(community.code);
      expect(feature.geometry.type).toMatch(/Polygon/);
      expect(feature.properties.kind).toBe("community");
    }
    for (const province of SPAIN_PROVINCES) {
      const feature = geo.provinces.get(province.code);
      expect(feature).toBeTruthy();
      expect(featureAdminCode(feature)).toBe(province.code);
      expect(feature.geometry.type).toMatch(/Polygon/);
    }
    expect(geo.communities.get("05")).toBeTruthy();
    expect(geo.communities.get("04")).toBeTruthy();
    expect(geo.communities.get("18")).toBeTruthy();
    expect(geo.communities.get("19")).toBeTruthy();
    expect(geo.provinces.get("51")).toBeTruthy();
    expect(geo.provinces.get("52")).toBeTruthy();
  });

  test("does not draw implied provinces when the whole community is selected", () => {
    const layers = featuresForServiceAreas(
      { communityCodes: ["09"], provinceCodes: ["17"] },
      geo
    );
    expect(layers.communityFeatures.map(featureAdminCode)).toEqual(["09"]);
    expect(layers.provinceFeatures).toEqual([]);
  });

  test("fits the map to selected coverage and falls back to the office", () => {
    const catalonia = coverageMapBounds({
      communityCodes: ["09"],
      geo,
    });
    const [[south, west], [north, east]] = catalonia.bounds;
    expect(south).toBeLessThan(41.98);
    expect(north).toBeGreaterThan(41.98);
    expect(west).toBeLessThan(2.82);
    expect(east).toBeGreaterThan(2.82);

    const girona = coverageMapBounds({
      communityCodes: [],
      provinceCodes: ["17"],
      geo,
    });
    const [[gSouth, gWest], [gNorth, gEast]] = girona.bounds;
    expect(gSouth).toBeLessThan(41.98);
    expect(gNorth).toBeGreaterThan(41.98);
    expect(gWest).toBeLessThan(2.82);
    expect(gEast).toBeGreaterThan(2.82);

    const officeOnly = coverageMapBounds({
      office: { lat: 41.39, lon: 2.16 },
      geo,
    });
    expect(officeOnly.bounds).toBeNull();
    expect(officeOnly.center).toEqual({ lat: 41.39, lon: 2.16 });
    expect(officeOnly.zoom).toBe(11);

    const cities = resolveCoverageCityPoints(
      ["Barcelona"],
      [],
      { Barcelona: { lat: 41.3874, lon: 2.1686 } }
    );
    expect(cities).toEqual([
      { name: "Barcelona", lat: 41.3874, lon: 2.1686 },
    ]);
  });
});
