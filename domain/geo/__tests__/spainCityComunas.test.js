import { COSTA_BRAVA_CITIES } from "../spainCoverageRegions";
import {
  SPAIN_CITY_COMUNAS,
  addComunaTowns,
  citiesWithComuna,
  cityComunaForName,
  comunaMatchState,
  insertComunaSearchOptions,
  queryLooksLikeComuna,
  removeComunaTowns,
  selectedComunaHubs,
  toggleComunaTowns,
} from "../spainCityComunas";

describe("Spain city comunas", () => {
  test("lists hubs that have a curated comuna", () => {
    expect(citiesWithComuna()).toEqual([
      "Barcelona",
      "Valencia",
      "Alicante",
      "Madrid",
      "Malaga",
      "Castellon",
      "Girona",
    ]);
  });

  test("Barcelona comuna is metro towns, not Costa Brava or the airport", () => {
    const towns = SPAIN_CITY_COMUNAS.Barcelona.towns;
    expect(towns).toEqual(
      expect.arrayContaining(["Sitges", "Badalona", "Sabadell"])
    );
    expect(towns).not.toContain("Barcelona");
    expect(towns).not.toContain("Barcelona Airport");
    expect(towns).not.toContain("Costa Brava");
    for (const coast of COSTA_BRAVA_CITIES) {
      expect(towns).not.toContain(coast);
    }
  });

  test("Valencia community is Comunitat Valenciana, not a tiny metro list", () => {
    const towns = SPAIN_CITY_COMUNAS.Valencia.towns;
    expect(towns).toEqual(
      expect.arrayContaining(["Alicante", "Benidorm", "Gandia", "Castellon"])
    );
    expect(towns).not.toContain("Valencia");
    expect(towns).not.toContain("Barcelona");
  });

  test("Alicante comuna is Costa Blanca towns, not Valencia city or the airport", () => {
    const towns = SPAIN_CITY_COMUNAS.Alicante.towns;
    expect(towns).toEqual(
      expect.arrayContaining(["Benidorm", "Denia", "Calpe", "Elche"])
    );
    expect(towns).not.toContain("Alicante");
    expect(towns).not.toContain("Alicante Airport");
    expect(towns).not.toContain("Valencia");
    expect(towns).not.toContain("Barcelona");
  });

  test("Madrid comuna is Comunidad towns, not the airport", () => {
    expect(SPAIN_CITY_COMUNAS.Madrid.towns).toEqual([
      "Alcala de Henares",
      "Aranjuez",
      "El Escorial",
    ]);
    expect(SPAIN_CITY_COMUNAS.Madrid.towns).not.toContain("Madrid Airport");
    expect(SPAIN_CITY_COMUNAS.Madrid.towns).not.toContain("Toledo");
  });

  test("hub city is never duplicated inside its own extras", () => {
    for (const [hub, preset] of Object.entries(SPAIN_CITY_COMUNAS)) {
      expect(preset.towns).not.toContain(hub);
    }
  });

  test("Girona community is Costa Brava; airports have no pack of their own", () => {
    expect(cityComunaForName("Girona").towns).toEqual(
      expect.arrayContaining(["Lloret de Mar", "Cadaqués"])
    );
    expect(cityComunaForName("Girona Airport")).toBeNull();
    expect(cityComunaForName("Barcelona Airport")).toBeNull();
    expect(cityComunaForName("Madrid Airport")).toBeNull();
    expect(cityComunaForName("Costa Brava")).toBeNull();
  });

  test("selecting Comunitat from Valencia adds towns; they stay individually removable", () => {
    const withComuna = addComunaTowns(["Valencia"], "Valencia");
    expect(withComuna).toEqual(
      expect.arrayContaining(["Valencia", "Alicante", "Gandia"])
    );
    expect(comunaMatchState(withComuna, "Valencia")).toBe("all");

    const subset = withComuna.filter((name) => name !== "Gandia");
    expect(subset).toContain("Valencia");
    expect(subset).toContain("Alicante");
    expect(subset).not.toContain("Gandia");
    expect(comunaMatchState(subset, "Valencia")).toBe("some");

    expect(removeComunaTowns(withComuna, "Valencia")).toEqual(["Valencia"]);
  });

  test("toggle all → city only; toggle city → add towns again", () => {
    const selected = addComunaTowns(["Madrid"], "Barcelona");
    expect(selected).toContain("Madrid");
    expect(comunaMatchState(selected, "Barcelona")).toBe("all");

    const cityOnly = toggleComunaTowns(selected, "Barcelona");
    expect(cityOnly).toContain("Madrid");
    expect(cityOnly).toContain("Barcelona");
    expect(cityOnly).not.toContain("Sitges");
    expect(cityOnly).not.toContain("Badalona");

    const again = toggleComunaTowns(cityOnly, "Barcelona");
    expect(again).toEqual(
      expect.arrayContaining(["Madrid", "Barcelona", "Sitges"])
    );
  });

  test("search offers a second comuna row after the city", () => {
    const options = insertComunaSearchOptions(
      [{ source: "catalog", id: "v", name: "Valencia" }],
      { query: "valencia", country: "ES" }
    );
    expect(options.map((o) => o.source)).toEqual(["catalog", "comuna"]);
    expect(options[1].id).toBe("comuna:valencia");
    expect(options[1].towns).toEqual(
      expect.arrayContaining(["Alicante", "Gandia"])
    );
  });

  test("comuna search rows stay Spain-only", () => {
    expect(
      insertComunaSearchOptions(
        [{ source: "catalog", id: "v", name: "Valencia" }],
        { query: "valencia", country: "GR" }
      )
    ).toEqual([{ source: "catalog", id: "v", name: "Valencia" }]);
  });

  test("selectedComunaHubs only lists hubs that are ticked", () => {
    expect(selectedComunaHubs(["Valencia", "Zaragoza", "Sitges"])).toEqual([
      "Valencia",
    ]);
    expect(selectedComunaHubs(["Barcelona", "Alicante"])).toEqual([
      "Barcelona",
      "Alicante",
    ]);
  });

  test("querying comuna lists every hub preset", () => {
    expect(queryLooksLikeComuna("комуна")).toBe(true);
    expect(queryLooksLikeComuna("Comunitat")).toBe(true);
    const options = insertComunaSearchOptions([], {
      query: "comuna",
      country: "ES",
    });
    expect(options.every((o) => o.source === "comuna")).toBe(true);
    expect(options.map((o) => o.name)).toEqual(
      expect.arrayContaining(["Barcelona", "Valencia", "Alicante"])
    );
  });
});
