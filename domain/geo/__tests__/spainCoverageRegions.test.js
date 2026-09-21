import {
  ALICANTE_PROVINCE_CITIES,
  BARCELONA_METRO_CITIES,
  COSTA_BRAVA_CITIES,
  COSTA_DEL_SOL_CITIES,
  COMUNIDAD_MADRID_CITIES,
  COMUNITAT_VALENCIANA_CITIES,
  VALENCIA_METRO_CITIES,
  addRegionCities,
  coverageRegionsForCountry,
  regionMatchState,
  removeRegionCities,
  toggleRegionCities,
} from "../spainCoverageRegions";

describe("Spain coverage regions", () => {
  test("Barcelona metro is nearby towns, not Costa Brava or the airport", () => {
    expect(BARCELONA_METRO_CITIES).toEqual(
      expect.arrayContaining(["Barcelona", "Sitges", "Badalona"])
    );
    expect(BARCELONA_METRO_CITIES).not.toContain("Lloret de Mar");
    expect(BARCELONA_METRO_CITIES).not.toContain("Costa Brava");
    expect(BARCELONA_METRO_CITIES).not.toContain("Barcelona Airport");
  });

  test("Costa Brava is Girona-coast towns, not Barcelona city", () => {
    expect(COSTA_BRAVA_CITIES).toEqual(
      expect.arrayContaining([
        "Lloret de Mar",
        "Tossa de Mar",
        "Blanes",
        "Roses",
        "Cadaqués",
      ])
    );
    expect(COSTA_BRAVA_CITIES).not.toContain("Barcelona");
    expect(COSTA_BRAVA_CITIES).not.toContain("Barcelona Airport");
    expect(COSTA_BRAVA_CITIES).not.toContain("Sitges");
    expect(COSTA_BRAVA_CITIES).not.toContain("Costa Brava");
  });

  test("Comunitat Valenciana is the autonomous community, not only Valencia city", () => {
    expect(COMUNITAT_VALENCIANA_CITIES).toEqual(
      expect.arrayContaining([
        "Valencia",
        "Alicante",
        "Castellon",
        "Benidorm",
        "Valencia Airport",
      ])
    );
    expect(COMUNITAT_VALENCIANA_CITIES).not.toContain("Barcelona");
  });

  test("Valencia metro is nearby towns, not Alicante province or the airport", () => {
    expect(VALENCIA_METRO_CITIES).toEqual(
      expect.arrayContaining(["Valencia", "Torrent", "Gandia"])
    );
    expect(VALENCIA_METRO_CITIES).not.toContain("Alicante");
    expect(VALENCIA_METRO_CITIES).not.toContain("Benidorm");
    expect(VALENCIA_METRO_CITIES).not.toContain("Valencia Airport");
  });

  test("Alicante province is Costa Blanca, not Valencia city", () => {
    expect(ALICANTE_PROVINCE_CITIES).toEqual(
      expect.arrayContaining(["Alicante", "Benidorm", "Elche", "Calpe"])
    );
    expect(ALICANTE_PROVINCE_CITIES).not.toContain("Valencia");
    expect(ALICANTE_PROVINCE_CITIES).not.toContain("Castellon");
    expect(ALICANTE_PROVINCE_CITIES).not.toContain("Peniscola");
    expect(ALICANTE_PROVINCE_CITIES).not.toContain("Gandia");
    expect(ALICANTE_PROVINCE_CITIES).not.toContain("Alicante Airport");
  });

  test("Comunidad de Madrid is curated towns, not every municipality", () => {
    expect(COMUNIDAD_MADRID_CITIES).toEqual(
      expect.arrayContaining([
        "Madrid",
        "Alcala de Henares",
        "Aranjuez",
        "El Escorial",
      ])
    );
    expect(COMUNIDAD_MADRID_CITIES).not.toContain("Toledo");
    expect(COMUNIDAD_MADRID_CITIES).not.toContain("Barcelona");
    expect(COMUNIDAD_MADRID_CITIES).not.toContain("Madrid Airport");
  });

  test("Costa del Sol is Malaga plus nearby towns", () => {
    expect(COSTA_DEL_SOL_CITIES).toEqual(
      expect.arrayContaining(["Malaga", "Marbella", "Fuengirola"])
    );
    expect(COSTA_DEL_SOL_CITIES).not.toContain("Barcelona");
    expect(COSTA_DEL_SOL_CITIES).not.toContain("Malaga Airport");
  });

  test("regions are Spain-only bulk shortcuts (Costa Brava + Comunitat)", () => {
    expect(coverageRegionsForCountry("ES").map((r) => r.id)).toEqual([
      "costa-brava",
      "comunitat-valenciana",
    ]);
    expect(coverageRegionsForCountry("GR")).toEqual([]);
  });

  test("selecting a region adds cities; individual cities can be removed", () => {
    const withValencia = addRegionCities(
      ["Valencia"],
      COMUNITAT_VALENCIANA_CITIES
    );
    expect(withValencia).toEqual(
      expect.arrayContaining(["Valencia", "Alicante", "Benidorm"])
    );
    expect(new Set(withValencia).size).toBe(withValencia.length);

    const subset = removeRegionCities(withValencia, ["Alicante", "Benidorm"]);
    expect(subset).toContain("Valencia");
    expect(subset).not.toContain("Alicante");
    expect(subset).not.toContain("Benidorm");
    expect(regionMatchState(subset, COMUNITAT_VALENCIANA_CITIES)).toBe("some");
  });

  test("toggling an all-selected region removes its cities and keeps extras", () => {
    const selected = addRegionCities(["Madrid"], COSTA_BRAVA_CITIES);
    expect(regionMatchState(selected, COSTA_BRAVA_CITIES)).toBe("all");
    const next = toggleRegionCities(selected, COSTA_BRAVA_CITIES);
    expect(next).toEqual(["Madrid"]);
    expect(toggleRegionCities(next, COSTA_BRAVA_CITIES)).toEqual(
      expect.arrayContaining(["Madrid", "Lloret de Mar"])
    );
  });
});
