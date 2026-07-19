/**
 * Shared catalog for Add Car / Bulk Add dropdowns.
 */

export const CAR_BRAND_MODELS = {
  Toyota: ["Yaris", "Corolla", "Aygo", "C-HR", "RAV4", "Auris"],
  Hyundai: ["i10", "i20", "i30", "Tucson", "Kona"],
  Opel: ["Corsa", "Astra", "Karl", "Mokka", "Crossland"],
  Volkswagen: ["Polo", "Golf", "T-Roc", "Tiguan", "Up"],
  Kia: ["Picanto", "Rio", "Ceed", "Sportage", "Stonic"],
  Nissan: ["Micra", "Note", "Qashqai", "Juke"],
  Peugeot: ["108", "208", "308", "2008", "3008"],
  Renault: ["Clio", "Captur", "Megane", "Kadjar"],
  Fiat: ["500", "Panda", "Tipo", "500X"],
  Ford: ["Fiesta", "Focus", "Puma", "Kuga"],
  BMW: ["1 Series", "2 Series", "X1", "X3"],
  "Mercedes-Benz": ["A-Class", "B-Class", "GLA", "C-Class"],
  Suzuki: ["Swift", "Ignis", "Vitara", "Jimny"],
  Skoda: ["Fabia", "Octavia", "Kamiq", "Karoq"],
  Seat: ["Ibiza", "Leon", "Arona"],
  Citroen: ["C1", "C3", "C4", "C3 Aircross"],
  Dacia: ["Sandero", "Duster", "Jogger"],
  Mazda: ["2", "3", "CX-3", "CX-5"],
  Honda: ["Jazz", "Civic", "HR-V"],
  Audi: ["A1", "A3", "Q2", "Q3"],
  Mini: ["Cooper", "Countryman"],
  Smart: ["ForTwo", "ForFour"],
  Tesla: ["Model 3", "Model Y"],
  Volvo: ["XC40", "XC60"],
  MG: ["ZS", "HS", "3"],
};

/** Flat list of "Brand Model" and brand-only options for Autocomplete. */
export function getCarModelSuggestions(extraModels = []) {
  const out = new Set();
  for (const brand of Object.keys(CAR_BRAND_MODELS)) {
    out.add(brand);
    for (const model of CAR_BRAND_MODELS[brand]) {
      out.add(`${brand} ${model}`);
    }
  }
  for (const m of extraModels || []) {
    if (typeof m === "string" && m.trim()) out.add(m.trim());
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

/** Models for a brand (case-insensitive), empty if unknown. */
export function getModelsForBrand(brand) {
  if (!brand) return [];
  const key = Object.keys(CAR_BRAND_MODELS).find(
    (b) => b.toLowerCase() === String(brand).trim().toLowerCase()
  );
  return key ? [...CAR_BRAND_MODELS[key]] : [];
}

export const ENGINE_PRESETS = [
  "1.0",
  "1.2",
  "1.4",
  "1.5",
  "1.6",
  "1.8",
  "2.0",
  "2.2",
  "2.5",
  "3.0",
];

export const ENGINE_POWER_PRESETS = [
  75, 90, 100, 110, 120, 130, 140, 150, 170, 190, 200, 250,
];

export const SEATS_OPTIONS = [2, 4, 5, 7, 8, 9];
export const DOORS_OPTIONS = [2, 3, 4, 5];

export const REGISTRATION_YEAR_OPTIONS = (() => {
  const y = new Date().getFullYear();
  const years = [];
  for (let i = y; i >= y - 25; i -= 1) years.push(i);
  return years;
})();
