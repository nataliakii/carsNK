/**
 * Countries that can appear on a driving licence.
 *
 * Only the ISO 3166-1 alpha-2 codes are data here. The displayed country name
 * comes from `Intl.DisplayNames` in the customer's own language, so adding a
 * locale does not mean translating two hundred country names by hand, and the
 * stored value is a stable code rather than a localised string.
 */

export const ISSUING_COUNTRY_CODES = Object.freeze([
  "AD", "AE", "AF", "AG", "AL", "AM", "AO", "AR", "AT", "AU", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BN", "BO", "BR",
  "BS", "BT", "BW", "BY", "BZ",
  "CA", "CD", "CF", "CG", "CH", "CI", "CL", "CM", "CN", "CO", "CR", "CU",
  "CV", "CY", "CZ",
  "DE", "DJ", "DK", "DM", "DO", "DZ",
  "EC", "EE", "EG", "ER", "ES", "ET",
  "FI", "FJ", "FR",
  "GA", "GB", "GD", "GE", "GH", "GM", "GN", "GQ", "GR", "GT", "GW", "GY",
  "HN", "HR", "HT", "HU",
  "ID", "IE", "IL", "IN", "IQ", "IR", "IS", "IT",
  "JM", "JO", "JP",
  "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KZ",
  "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY",
  "MA", "MC", "MD", "ME", "MG", "MH", "MK", "ML", "MM", "MN", "MR", "MT",
  "MU", "MV", "MW", "MX", "MY", "MZ",
  "NA", "NE", "NG", "NI", "NL", "NO", "NP", "NR", "NZ",
  "OM",
  "PA", "PE", "PG", "PH", "PK", "PL", "PS", "PT", "PW", "PY",
  "QA",
  "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SI", "SK", "SL", "SM", "SN", "SO",
  "SR", "SS", "ST", "SV", "SY", "SZ",
  "TD", "TG", "TH", "TJ", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW",
  "TZ",
  "UA", "UG", "US", "UY", "UZ",
  "VA", "VC", "VE", "VN", "VU",
  "WS",
  "YE",
  "ZA", "ZM", "ZW",
]);

export function isIssuingCountryCode(value) {
  return ISSUING_COUNTRY_CODES.includes(String(value || "").toUpperCase());
}

/**
 * Codes paired with a localised label, sorted by that label.
 *
 * Falls back to the bare code when the runtime has no display-name data, so a
 * missing Intl dataset degrades to "DE" rather than to an empty dropdown.
 *
 * @param {string} locale
 * @returns {{ code: string, label: string }[]}
 */
export function issuingCountryOptions(locale = "en") {
  let display = null;
  try {
    display = new Intl.DisplayNames([locale || "en"], { type: "region" });
  } catch {
    display = null;
  }

  const options = ISSUING_COUNTRY_CODES.map((code) => {
    let label = code;
    try {
      label = display?.of(code) || code;
    } catch {
      label = code;
    }
    return { code, label };
  });

  try {
    const collator = new Intl.Collator(locale || "en");
    options.sort((left, right) => collator.compare(left.label, right.label));
  } catch {
    options.sort((left, right) => left.label.localeCompare(right.label));
  }
  return options;
}
