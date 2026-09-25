import fs from "node:fs";
import path from "node:path";

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

const LOCALES = { bg, de, el, en, es, pl, ro, ru, sr, uk };

const MODAL = path.join(
  process.cwd(),
  "app/admin/features/orders/modals/BookingDetailsModal.js"
);
const VIEW = path.join(process.cwd(), "domain/booking/bookingDetailsView.js");

/**
 * i18next stores a counted noun under one key per plural category, so
 * `t("…header.days", { count })` is answered by `header.days_one`,
 * `header.days_few`, `header.days_many` and so on. Slavic languages need more of
 * these than English does, which is correct translation, not a missing key.
 */
const PLURAL_SUFFIXES = ["zero", "one", "two", "few", "many", "other"];

function flatten(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) => {
    const p = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" ? flatten(value, p) : [p];
  });
}

function lookup(tree, key) {
  return key.split(".").reduce((node, part) => node?.[part], tree);
}

function stripPluralSuffix(key) {
  const suffix = PLURAL_SUFFIXES.find((s) => key.endsWith(`_${s}`));
  return suffix ? key.slice(0, -(suffix.length + 1)) : key;
}

/** Plural forms stored for a counted key, in PLURAL_SUFFIXES order. */
function pluralFormsOf(tree, key) {
  const parts = key.split(".");
  const leaf = parts.pop();
  const parent = parts.length ? lookup(tree, parts.join(".")) : tree;
  if (!parent || typeof parent !== "object") return [];
  return PLURAL_SUFFIXES.filter((s) => typeof parent[`${leaf}_${s}`] === "string");
}

/**
 * Every string a key resolves to. A subtree prefix such as `…kinds` is completed
 * at runtime by a template literal, so all of its leaves must be translated; a
 * counted noun resolves through its plural forms instead of a flat value.
 */
function translationsFor(tree, key) {
  const node = lookup(tree, key);
  if (node && typeof node === "object") {
    return flatten(node).map((leaf) => lookup(node, leaf));
  }
  if (node !== undefined) return [node];

  const parts = key.split(".");
  const leaf = parts.pop();
  const parent = lookup(tree, parts.join("."));
  return pluralFormsOf(tree, key).map((s) => parent[`${leaf}_${s}`]);
}

/** Key set with plural forms collapsed onto the key the source actually calls. */
function translatableKeys(tree) {
  return [...new Set(flatten(tree).map(stripPluralSuffix))].sort();
}

/** Keys stored as plural forms rather than as one flat string. */
function countedKeys(tree) {
  return [
    ...new Set(
      flatten(tree)
        .map((key) => [key, stripPluralSuffix(key)])
        .filter(([key, base]) => base !== key)
        .map(([, base]) => base)
    ),
  ].sort();
}

/**
 * Categories a counted noun must be translated into: every one an integer count
 * can select, plus `other`, which i18next falls back to. Polish needs one/few/
 * many/other, Romanian one/few/other, German one/other.
 */
function requiredPluralCategories(code) {
  const rules = new Intl.PluralRules(code);
  const needed = new Set(["other"]);
  for (let n = 0; n <= 200; n += 1) needed.add(rules.select(n));
  return PLURAL_SUFFIXES.filter((s) => needed.has(s));
}

/** Categories the language has at all — a form outside these is a mistake. */
function allowedPluralCategories(code) {
  const categories = new Intl.PluralRules(code).resolvedOptions()
    .pluralCategories;
  return PLURAL_SUFFIXES.filter((s) => categories.includes(s));
}

/** Literal `bookingDetails.*` keys mentioned anywhere in the modal or the view. */
function keysUsedInSource() {
  const source = [MODAL, VIEW]
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
  const found = source.match(/bookingDetails(?:\.[A-Za-z0-9_]+)+/g) || [];
  return [...new Set(found)];
}

describe("booking details i18n", () => {
  it("every literal key used by the modal exists in all ten locales", () => {
    const keys = keysUsedInSource();
    expect(keys.length).toBeGreaterThan(50);
    for (const [code, tree] of Object.entries(LOCALES)) {
      for (const key of keys) {
        const translations = translationsFor(tree, key);
        expect(`${code}:${key}:${translations.length > 0}`).toBe(
          `${code}:${key}:true`
        );
        expect(
          `${code}:${key}:${translations.every((v) => typeof v === "string")}`
        ).toBe(`${code}:${key}:true`);
      }
    }
  });

  it("no locale is missing a key another locale has", () => {
    const reference = translatableKeys(en.bookingDetails);
    for (const [code, tree] of Object.entries(LOCALES)) {
      expect(`${code}:${translatableKeys(tree.bookingDetails).join(",")}`).toBe(
        `${code}:${reference.join(",")}`
      );
    }
  });

  it("a counted noun carries every plural form its language needs", () => {
    const counted = countedKeys(en.bookingDetails);
    expect(counted.length).toBeGreaterThan(0);

    for (const [code, tree] of Object.entries(LOCALES)) {
      const allowed = allowedPluralCategories(code);
      for (const base of counted) {
        const present = pluralFormsOf(tree.bookingDetails, base);
        const missing = requiredPluralCategories(code).filter(
          (s) => !present.includes(s)
        );
        const unused = present.filter((s) => !allowed.includes(s));
        expect(`${code}:${base}:missing=${missing.join("|")}`).toBe(
          `${code}:${base}:missing=`
        );
        expect(`${code}:${base}:unused=${unused.join("|")}`).toBe(
          `${code}:${base}:unused=`
        );
      }
    }
  });

  it("the booking payment rate is interpolated, never written as a fixed percentage", () => {
    for (const [code, tree] of Object.entries(LOCALES)) {
      const copy = JSON.stringify(tree.bookingDetails);
      expect(`${code}:${/\d+\s?%/.test(copy)}`).toBe(`${code}:false`);
      expect(tree.bookingDetails.status.awaitingPayment.detail).toContain("{{rate}}");
      expect(tree.bookingDetails.price.paidToRovaro).toContain("{{rate}}");
    }
  });
});
