/**
 * Natali Cars — Transfer voucher form data.
 * Locale: Greek now (`el`); English (`en`) ready for later bilingual mode.
 */

const MAX_TEXT_LENGTH = 800;

const todayInputValue = () => new Date().toISOString().slice(0, 10);

export const TRANSFER_VOUCHER_STAMP_SRC = "/vouchers/natali-cars-stamp.png";

/** Supported voucher locales. Start with Greek-only UI; `en` reserved. */
export const TRANSFER_VOUCHER_LOCALES = ["el", "en"];

export const COMPANY_STAMP_TEXT = {
  el: [
    "ΜΑΚΑΡΟΒΑ ΝΑΤΑΛΙΑ",
    "ΕΝΟΙΚΙΑΣΕΙΣ - ΠΩΛΗΣΕΙΣ ΑΥΤΟΚΙΝΗΤΩΝ",
    "ΚΕΛΕΣΗ 12 ΝΕΑ ΚΑΛΛΙΚΡΑΤΕΙΑ - ΤΗΛ. 6970 034707",
    "Α.Φ.Μ. 102741962 - Δ.Ο.Υ. Ν. ΜΟΥΔΑΝΙΩΝ",
  ].join("\n"),
  en: [
    "MAKAROVA NATALIA",
    "CAR RENTALS - CAR SALES",
    "KELESI 12, NEA KALLIKRATIA - TEL. 6970 034707",
    "TAX ID 102741962 - TAX OFFICE N. MOUDANIA",
  ].join("\n"),
};

/**
 * Field labels: Greek primary; English kept for future bilingual print.
 * UI currently uses `el` (and optionally shows `en` under it when bilingual).
 */
export const TRANSFER_VOUCHER_LABELS = {
  agreementDateTime: {
    el: "Ημερομηνία Κατάρτισης",
    en: "Agreement Date & Time",
  },
  title: { el: "Κουπόνι μεταφοράς", en: "Transfer voucher" },
  lessee: { el: "Μισθωτής", en: "Lesse" },
  lesseeDetails: { el: "Στοιχεία Μισθωτή", en: "Lesse details" },
  dateOfService: { el: "Ημερομηνία Υπηρεσίας", en: "Date of service" },
  pickUpPoint: { el: "Σημείο παραλαβής", en: "Pick up point" },
  rentalDuration: { el: "Διάρκεια μίσθωσης", en: "Rental duration" },
  vehicleType: { el: "Τύπος οχήματος", en: "Type of vehicle" },
  vehicleRegNum: { el: "Αρ. κυκλ/ρίας", en: "Vehicle reg. num" },
  driverName: { el: "Όνομα οδηγού", en: "Driver's name" },
  clientName: { el: "Όνομα πελάτη", en: "Client's name" },
  startingPoint: { el: "Σημείο έναρξης", en: "Starting point" },
  pickUpTime: { el: "Ώρα παραλαβής", en: "Pick up time" },
  endingTime: { el: "Ώρα λήξης", en: "Ending Time" },
  passengers: { el: "Αριθμός ατόμων", en: "Number of passengers" },
  driverLicenseNo: {
    el: "Αριθμός άδειας οδήγησης",
    en: "Driver's license No.",
  },
  driverIdNo: { el: "Αριθμός ΔΤ οδηγού", en: "Driver's ID No." },
  amount: { el: "Ποσό", en: "Amount" },
  notes: { el: "Παρατηρήσεις", en: "Notes" },
  companyStamp: { el: "Σφραγίδα εταιρείας", en: "Company stamp" },
  customerSignature: { el: "Υπογραφή Μισθωτή", en: "Customer signature" },
};

export function formatVoucherLabel(key, { locale = "el", bilingual = false } = {}) {
  const entry = TRANSFER_VOUCHER_LABELS[key];
  if (!entry) return key;
  if (bilingual) {
    // English on top, Greek under — matches original paper form style.
    return { primary: entry.en, secondary: entry.el };
  }
  if (locale === "en") return { primary: entry.en, secondary: "" };
  return { primary: entry.el, secondary: "" };
}

export const createDefaultTransferVoucherData = () => ({
  /** `el` now; later `en` or bilingual toggle */
  locale: "el",
  bilingual: false,

  companyHeaderTitle: "ΜΑΚΑΡΟΒΑ ΝΑΤΑΛΙΑ",
  companyInfo: COMPANY_STAMP_TEXT.el,
  agreementDate: todayInputValue(),
  agreementTime: "",

  lessee: "",
  lesseeDetails: "",
  clientName: "",

  dateOfService: todayInputValue(),
  startingPoint: "",
  pickUpPoint: "",
  pickUpTime: "",
  endingTime: "",
  rentalDuration: "",

  vehicleType: "",
  vehicleRegNum: "",
  passengers: "",

  driverName: "",
  driverLicenseNo: "",
  driverIdNo: "",

  amount: "",
  notes: "",

  stampSrc: TRANSFER_VOUCHER_STAMP_SRC,
});

const safeString = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value).slice(0, MAX_TEXT_LENGTH);
};

const parseDateParts = (value) => {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

export const formatDateDisplay = (value) => {
  const parts = parseDateParts(value);
  if (parts) {
    return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
  }
  return safeString(value, "") || "";
};

export const normalizeTransferVoucherData = (raw = {}) => {
  const base = createDefaultTransferVoucherData();
  const out = { ...base };
  for (const key of Object.keys(base)) {
    if (raw[key] === undefined) continue;
    if (key === "bilingual") {
      out.bilingual = Boolean(raw.bilingual);
      continue;
    }
    if (key === "locale") {
      out.locale = TRANSFER_VOUCHER_LOCALES.includes(raw.locale)
        ? raw.locale
        : "el";
      continue;
    }
    out[key] = safeString(raw[key], base[key]);
  }
  return out;
};
