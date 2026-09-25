/**
 * The dropdowns a supplier picks from must not be able to express a proposal
 * the replacement rules would reject, so the option lists and the rules are
 * tested against the same ladder.
 */

import fs from "fs";
import path from "path";

import bg from "@/locales/bg.json";
import de from "@/locales/de.json";
import el from "@/locales/el.json";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import pl from "@/locales/pl.json";
import ro from "@/locales/ro.json";
import ru from "@/locales/ru.json";
import sr from "@/locales/sr.json";
import uk from "@/locales/uk.json";

import { evaluateEquivalentReplacement } from "@/domain/booking/equivalentReplacement";
import { REPLACEMENT_SOURCE } from "@/domain/booking/equivalentReplacementCopy";
import {
  REPLACEMENT_SEATS_MAX,
  canGuaranteeEquivalent,
  carValueLabelKey,
  normalizeOriginalVehicle,
  replacementClassOptions,
  replacementGuaranteeFloor,
  replacementLuggageOptions,
  replacementSeatOptions,
  replacementTransmissionOptions,
} from "@/domain/booking/replacementGuarantee";
import {
  VEHICLE_CLASS_RANK,
  classRank,
  vehicleClassesAtOrAbove,
} from "@/domain/booking/vehicleClassLadder";

const LOCALES = { bg, de, el, en, es, pl, ro, ru, sr, uk };

function lookup(tree, key) {
  return key.split(".").reduce((node, part) => node?.[part], tree);
}

describe("the class ladder", () => {
  it("offers the requested class and everything above it, never below", () => {
    const options = replacementClassOptions("economy");
    expect(options[0]).toBe("economy");
    for (const option of options) {
      expect(classRank(option)).toBeGreaterThanOrEqual(classRank("economy"));
    }
    expect(options).not.toContain("mini");
    expect(options).toContain("premium");
  });

  it("offers nothing at all for a class the ladder does not know", () => {
    expect(replacementClassOptions("spaceship")).toEqual([]);
    expect(replacementClassOptions("")).toEqual([]);
    expect(vehicleClassesAtOrAbove("spaceship")).toEqual([]);
  });

  it("keeps the requested class on the list even when the fleet no longer uses it", () => {
    // `suv` ranks in the ladder but is not one of the current car classes.
    expect(VEHICLE_CLASS_RANK).toContain("suv");
    expect(replacementClassOptions("suv")[0]).toBe("suv");
  });

  it("only offers classes the replacement rules accept", () => {
    const original = {
      category: "compact",
      transmission: "manual",
      seats: 5,
      luggage: 2,
      totalPrice: 300,
    };
    for (const category of replacementClassOptions("compact")) {
      const result = evaluateEquivalentReplacement({
        original,
        proposal: {
          replacementSource: REPLACEMENT_SOURCE.GUARANTEED_EQUIVALENT,
          category,
          supplierMessage: "Workshop delay.",
        },
      });
      expect(`${category}:${result.ok}`).toBe(`${category}:true`);
    }
    for (const category of ["mini", "economy"]) {
      expect(replacementClassOptions("compact")).not.toContain(category);
    }
  });
});

describe("the other dropdowns", () => {
  it("offers only the requested transmission, because it may not change", () => {
    expect(replacementTransmissionOptions("manual")).toEqual(["manual"]);
    expect(replacementTransmissionOptions("automatic")).toEqual(["automatic"]);
    expect(replacementTransmissionOptions("")).toEqual([]);
  });

  it("offers seat counts from the requested one upwards", () => {
    expect(replacementSeatOptions(4)).toEqual([4, 5, 6, 7, 8, 9]);
    expect(replacementSeatOptions(REPLACEMENT_SEATS_MAX)).toEqual([REPLACEMENT_SEATS_MAX]);
    expect(replacementSeatOptions(null)).toEqual([]);
  });

  it("offers luggage from the requested capacity, or the whole range when unknown", () => {
    expect(replacementLuggageOptions(3)[0]).toBe(3);
    expect(replacementLuggageOptions(null)[0]).toBe(0);
  });

  it("labels every offered value from the shared car vocabulary", () => {
    const values = [
      ...VEHICLE_CLASS_RANK,
      ...replacementTransmissionOptions("manual"),
      ...replacementTransmissionOptions("automatic"),
    ];
    for (const [code, tree] of Object.entries(LOCALES)) {
      for (const value of values) {
        const key = carValueLabelKey(value);
        expect(`${code}:${key}:${typeof lookup(tree, key)}`).toBe(
          `${code}:${key}:string`
        );
      }
    }
  });
});

describe("the guarantee floor", () => {
  it("reads the promise off the original booking whatever the field is called", () => {
    expect(normalizeOriginalVehicle({ category: "Economy", seats: "4" })).toMatchObject({
      class: "economy",
      seats: 4,
    });
    expect(
      replacementGuaranteeFloor({
        class: "compact",
        transmission: "Manual",
        seats: 5,
        luggage: 2,
        price: 250,
      })
    ).toEqual({
      classAtLeast: "compact",
      transmission: "manual",
      seatsAtLeast: 5,
      luggageAtLeast: 2,
      totalPriceAtMost: 250,
    });
  });

  it("cannot promise anything when the booking records no class, transmission or seats", () => {
    const complete = { class: "economy", transmission: "manual", seats: 4 };
    expect(canGuaranteeEquivalent(complete)).toBe(true);
    expect(canGuaranteeEquivalent({ ...complete, class: "" })).toBe(false);
    expect(canGuaranteeEquivalent({ ...complete, transmission: "" })).toBe(false);
    expect(canGuaranteeEquivalent({ ...complete, seats: null })).toBe(false);
  });

  it("stays importable by a client component", () => {
    for (const file of [
      "domain/booking/replacementGuarantee.js",
      "domain/booking/vehicleClassLadder.js",
      "domain/booking/equivalentReplacementCopy.js",
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/from "crypto"/);
      expect(source).not.toMatch(/@lib\/database/);
      expect(source).not.toMatch(/mongoose/);
    }
  });
});
