/**
 * Server-side catalog strings for car SEO spec/feature labels.
 * Reads existing locale JSON — does not add or overwrite keys.
 */

import en from "../../locales/en.json";
import es from "../../locales/es.json";
import ru from "../../locales/ru.json";
import uk from "../../locales/uk.json";
import de from "../../locales/de.json";
import { translateCarEnumValue } from "@/domain/cars/translateCarEnum";

const PACKS = { en, es, ru, uk, de };

function getPack(localeCandidate) {
  const locale = String(localeCandidate || "en")
    .toLowerCase()
    .split("-")[0];
  return PACKS[locale] || PACKS.en;
}

export function getCarSeoUiCopy(localeCandidate) {
  const pack = getPack(localeCandidate);
  const car = pack.car || PACKS.en.car;
  const t = (key) => {
    const parts = String(key || "").split(".");
    let cur = pack;
    for (const part of parts) {
      if (cur == null) return key;
      cur = cur[part];
    }
    return cur == null || cur === "" ? key : cur;
  };

  return {
    t,
    transmission: car.transmission,
    fuel: car.fuel,
    seats: car.seats,
    air: car.air,
    doors: car.doors,
    enginePow: car["engine-pow"],
    engine: car.engine,
    year: car["reg-year"],
    classLabel: car.class,
    deposit: car.deposit,
    noDeposit: car.noDeposit,
    yes: car.yes,
    no: car.no,
    translateValue: (raw) => translateCarEnumValue(t, raw),
  };
}
