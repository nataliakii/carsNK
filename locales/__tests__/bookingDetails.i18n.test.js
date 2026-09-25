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

function flatten(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) => {
    const p = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" ? flatten(value, p) : [p];
  });
}

function lookup(tree, key) {
  return key.split(".").reduce((node, part) => node?.[part], tree);
}

/**
 * i18next spells plurals as `key_one` / `key_few` / `key_many`, and how many
 * forms a language needs is a property of that language. Russian and Polish
 * legitimately carry forms English does not, so parity is compared per key
 * family rather than per literal key.
 */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function keyFamilies(node) {
  return [
    ...new Set(flatten(node).map((key) => key.replace(PLURAL_SUFFIX, ""))),
  ].sort();
}

/** The forms stored under a family name the source calls without a suffix. */
function pluralForms(tree, key) {
  const parts = key.split(".");
  const leaf = parts.pop();
  const parent = lookup(tree, parts.join("."));
  if (!parent || typeof parent !== "object") return undefined;
  const forms = Object.entries(parent)
    .filter(([name]) => name.replace(PLURAL_SUFFIX, "") === leaf)
    .map(([, value]) => value);
  return forms.length ? forms : undefined;
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
        // A prefix such as `...kinds` is completed at runtime by a template
        // literal, so its whole subtree has to be translated.
        // A pluralised key is stored as `key_one` / `key_other`; the source
        // calls it by its family name and i18next picks the form.
        const node = lookup(tree, key) ?? pluralForms(tree, key);
        const leaves =
          node && typeof node === "object"
            ? flatten(node).map((leaf) => lookup(node, leaf))
            : [node];
        expect(`${code}:${key}:${leaves.every((v) => typeof v === "string")}`).toBe(
          `${code}:${key}:true`
        );
        expect(`${code}:${key}:${leaves.length > 0}`).toBe(`${code}:${key}:true`);
      }
    }
  });

  it("no locale is missing a key another locale has", () => {
    const reference = keyFamilies(en.bookingDetails);
    for (const [code, tree] of Object.entries(LOCALES)) {
      expect(`${code}:${keyFamilies(tree.bookingDetails).join(",")}`).toBe(
        `${code}:${reference.join(",")}`
      );
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
