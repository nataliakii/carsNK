import {
  SPAIN_COMMUNITIES,
  SPAIN_PROVINCES,
  communitiesWithVisibleProvinces,
  communityByCode,
  compactServiceAreas,
  coveredProvinceCodes,
  isCommunityFullySelected,
  isOfficialCommunityCode,
  isProvinceCovered,
  provincesForCommunity,
  toggleCommunitySelection,
  toggleProvinceSelection,
} from "../spainAdminDivisions";

const OFFICIAL_NAMES = [
  "Andalucía",
  "Aragón",
  "Asturias",
  "Illes Balears",
  "Canarias",
  "Cantabria",
  "Castilla-La Mancha",
  "Castilla y León",
  "Cataluña",
  "Comunitat Valenciana",
  "Extremadura",
  "Galicia",
  "Comunidad de Madrid",
  "Región de Murcia",
  "Navarra",
  "País Vasco",
  "La Rioja",
];

describe("spainAdminDivisions", () => {
  test("lists all 17 autonomous communities plus Ceuta and Melilla", () => {
    expect(SPAIN_COMMUNITIES).toHaveLength(19);
    expect(SPAIN_COMMUNITIES.map((item) => item.name).slice(0, 17)).toEqual(
      OFFICIAL_NAMES
    );
    expect(SPAIN_COMMUNITIES.map((item) => item.code)).toEqual(
      expect.arrayContaining(["18", "19"])
    );
    expect(SPAIN_COMMUNITIES.some((item) => item.name === "Costa Brava")).toBe(
      false
    );
    expect(isOfficialCommunityCode("09")).toBe(true);
    expect(isOfficialCommunityCode("costa-brava")).toBe(false);
  });

  test("maps each community to its official provinces", () => {
    expect(provincesForCommunity("09").map((item) => item.code).sort()).toEqual([
      "08",
      "17",
      "25",
      "43",
    ]);
    expect(provincesForCommunity("10").map((item) => item.name).sort()).toEqual([
      "Alicante",
      "Castellón",
      "Valencia",
    ]);
    expect(provincesForCommunity("13").map((item) => item.code)).toEqual(["28"]);
    expect(provincesForCommunity("05").map((item) => item.code).sort()).toEqual([
      "35",
      "38",
    ]);
    expect(provincesForCommunity("18").map((item) => item.code)).toEqual(["51"]);
    expect(provincesForCommunity("19").map((item) => item.code)).toEqual(["52"]);
    expect(SPAIN_PROVINCES).toHaveLength(52);
    expect(new Set(SPAIN_PROVINCES.map((item) => item.code)).size).toBe(52);
  });

  test("allows multiple communities and provinces", () => {
    const twoCommunities = compactServiceAreas({
      communityCodes: ["09", "10"],
      provinceCodes: [],
    });
    expect(twoCommunities.communityCodes).toEqual(["09", "10"]);
    expect(coveredProvinceCodes(twoCommunities)).toEqual(
      expect.arrayContaining(["08", "17", "03", "46"])
    );

    const mixed = compactServiceAreas({
      communityCodes: ["13"],
      provinceCodes: ["17", "29"],
    });
    expect(mixed.communityCodes).toEqual(["13"]);
    expect(mixed.provinceCodes.sort()).toEqual(["17", "29"]);
    expect(isProvinceCovered(mixed, "28")).toBe(true);
    expect(isProvinceCovered(mixed, "17")).toBe(true);
    expect(isProvinceCovered(mixed, "08")).toBe(false);
  });

  test("selecting every province promotes to the community", () => {
    const allCatalonia = compactServiceAreas({
      communityCodes: [],
      provinceCodes: ["08", "17", "25", "43"],
    });
    expect(allCatalonia.communityCodes).toEqual(["09"]);
    expect(allCatalonia.provinceCodes).toEqual([]);
    expect(isCommunityFullySelected(allCatalonia, "09")).toBe(true);
  });

  test("toggling a community and then one province leaves the other provinces", () => {
    const whole = toggleCommunitySelection(
      { communityCodes: [], provinceCodes: [] },
      "09"
    );
    expect(whole.communityCodes).toEqual(["09"]);
    expect(
      communitiesWithVisibleProvinces(whole).map((item) => item.code)
    ).toEqual(["09"]);

    const onlyGironaDropped = toggleProvinceSelection(whole, "08");
    expect(onlyGironaDropped.communityCodes).toEqual([]);
    expect(onlyGironaDropped.provinceCodes.sort()).toEqual(["17", "25", "43"]);
    expect(isProvinceCovered(onlyGironaDropped, "08")).toBe(false);
    expect(isProvinceCovered(onlyGironaDropped, "17")).toBe(true);
    expect(communityByCode("09").name).toBe("Cataluña");
  });
});
