import {
  carEnumValueKey,
  translateCarEnumValue,
  translateSeasonName,
} from "../translateCarEnum";

const t = (key) => {
  if (key === "car.value.automatic") return "Автомат";
  if (key === "carPark.LowUpSeason") return "Низко-высокий сезон";
  return key;
};

describe("translateCarEnum", () => {
  it("normalizes stored enum strings to i18n slugs", () => {
    expect(carEnumValueKey("Automatic")).toBe("automatic");
    expect(carEnumValueKey("race car")).toBe("race_car");
    expect(carEnumValueKey("gas(lpg)")).toBe("gas_lpg");
    expect(carEnumValueKey("natural gas(cng)")).toBe("natural_gas_cng");
  });

  it("uses a locale label when the key exists", () => {
    expect(translateCarEnumValue(t, "automatic")).toBe("Автомат");
    expect(translateSeasonName(t, "LowUpSeason")).toBe("Низко-высокий сезон");
  });

  it("falls back to a capitalized original when the key is missing", () => {
    expect(translateCarEnumValue(t, "economy")).toBe("Economy");
    expect(translateSeasonName(t, "UnknownSeason")).toBe("UnknownSeason");
  });
});
