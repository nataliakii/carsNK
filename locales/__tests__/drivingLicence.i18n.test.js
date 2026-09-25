/**
 * Every customer-visible licence string must exist in every locale.
 * A missing key would surface the raw key name to a customer mid-booking.
 */

import bg from "@locales/bg.json";
import de from "@locales/de.json";
import el from "@locales/el.json";
import en from "@locales/en.json";
import es from "@locales/es.json";
import pl from "@locales/pl.json";
import ro from "@locales/ro.json";
import ru from "@locales/ru.json";
import sr from "@locales/sr.json";
import uk from "@locales/uk.json";

import {
  LICENCE_CAPTURE_CODE,
  licenceCaptureMessageKey,
} from "@/domain/legal/drivingLicenceSnapshot";

const BUNDLES = { bg, de, el, en, es, pl, ro, ru, sr, uk };

const LICENCE_KEYS = [
  "licenceSectionTitle",
  "licenceSectionHint",
  "licenceHolderLabel",
  "licenceNumberLabel",
  "licenceCountryLabel",
  "licenceExpiryLabel",
  "licenceIssueDateLabel",
  "licenceIssueDateHint",
  "licenceUploadDocument",
  "licenceReplaceDocument",
  "licenceUploading",
  "licenceDocumentAttached",
  "licenceUploadUnsupportedType",
  "licenceUploadTooLarge",
  "licenceUploadRateLimited",
  "licenceRequired",
  "licenceUploadMissing",
  "licenceUploadFailed",
  "licenceHolderRequired",
  "licenceNumberRequired",
  "licenceCountryRequired",
  "licenceExpiryRequired",
  "licenceExpiresBeforeReturn",
  "licenceIssueDateRequired",
  "licenceIssueDateInvalid",
  "licenceNotProvided",
];

describe("driving licence translations", () => {
  it("covers all ten locales", () => {
    expect(Object.keys(BUNDLES)).toHaveLength(10);
  });

  it.each(Object.keys(BUNDLES))("%s has every licence string", (locale) => {
    const order = BUNDLES[locale].order || {};
    const missing = LICENCE_KEYS.filter(
      (key) => typeof order[key] !== "string" || order[key].trim() === ""
    );
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(BUNDLES))(
    "%s translates rather than copying the English text",
    (locale) => {
      if (locale === "en") return;
      const order = BUNDLES[locale].order || {};
      const identical = LICENCE_KEYS.filter(
        (key) => order[key] === en.order[key] && en.order[key].length > 20
      );
      expect(identical).toEqual([]);
    }
  );

  it("has a translated sentence for every server refusal code", () => {
    for (const code of Object.values(LICENCE_CAPTURE_CODE)) {
      const key = licenceCaptureMessageKey(code);
      expect(key.startsWith("order.")).toBe(true);
      const leaf = key.slice("order.".length);
      const missing = Object.entries(BUNDLES)
        .filter(([, bundle]) => {
          const value = bundle.order?.[leaf];
          return typeof value !== "string" || value.trim() === "";
        })
        .map(([locale]) => `${locale}.${key}`);
      expect(missing).toEqual([]);
    }
  });
});
