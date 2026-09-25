/**
 * Shared catalog for Add Car / Bulk Add dropdowns.
 * Focus: EU / Spain rental fleets (SEAT, Cupra + common EU brands).
 * Autocomplete stays freeSolo — partners can still type any model.
 */

export const CAR_BRAND_MODELS = {
  // Spain — SEAT / Cupra first so they sort near the top of brand-only picks in UX searches
  Seat: [
    "Ibiza",
    "Leon",
    "Arona",
    "Ateca",
    "Tarraco",
    "Toledo",
    "Alhambra",
    "Mii",
    "Cordoba",
  ],
  Cupra: ["Formentor", "Leon", "Ateca", "Born", "Terramar", "Tavascan"],

  Audi: ["A1", "A3", "A4", "A5", "A6", "Q2", "Q3", "Q5", "Q7", "Q8", "e-tron", "TT"],
  BMW: [
    "1 Series",
    "2 Series",
    "3 Series",
    "4 Series",
    "5 Series",
    "X1",
    "X2",
    "X3",
    "X4",
    "X5",
    "iX1",
    "iX3",
    "i4",
  ],
  Citroen: [
    "C1",
    "C3",
    "C3 Aircross",
    "C4",
    "C4 Cactus",
    "C5 Aircross",
    "Berlingo",
    "SpaceTourer",
  ],
  Dacia: ["Sandero", "Logan", "Duster", "Jogger", "Spring", "Lodgy"],
  Fiat: ["500", "500e", "500X", "Panda", "Tipo", "Doblo", "Talento"],
  Ford: ["Fiesta", "Focus", "Puma", "Kuga", "EcoSport", "Mustang Mach-E", "Transit Custom"],
  Honda: ["Jazz", "Civic", "HR-V", "CR-V", "e:Ny1"],
  Hyundai: [
    "i10",
    "i20",
    "i30",
    "Bayon",
    "Kona",
    "Tucson",
    "Santa Fe",
    "Ioniq 5",
    "Ioniq 6",
  ],
  Jeep: ["Renegade", "Compass", "Avenger"],
  Kia: [
    "Picanto",
    "Rio",
    "Ceed",
    "XCeed",
    "Stonic",
    "Niro",
    "Sportage",
    "Sorento",
    "EV6",
  ],
  Mazda: ["2", "3", "CX-3", "CX-30", "CX-5", "MX-30"],
  "Mercedes-Benz": [
    "A-Class",
    "B-Class",
    "C-Class",
    "E-Class",
    "CLA",
    "GLA",
    "GLB",
    "GLC",
    "EQA",
    "EQB",
    "EQC",
    "Vito",
    "V-Class",
  ],
  MG: ["3", "ZS", "HS", "4", "5", "Marvel R"],
  Mini: ["Cooper", "Countryman", "Clubman", "Aceman"],
  Mitsubishi: ["Space Star", "ASX", "Eclipse Cross", "Outlander"],
  Nissan: ["Micra", "Note", "Juke", "Qashqai", "X-Trail", "Leaf", "Townstar"],
  Opel: [
    "Corsa",
    "Astra",
    "Karl",
    "Mokka",
    "Crossland",
    "Grandland",
    "Combo Life",
    "Zafira Life",
  ],
  Peugeot: [
    "108",
    "208",
    "308",
    "2008",
    "3008",
    "5008",
    "Rifter",
    "Traveller",
    "e-208",
    "e-2008",
  ],
  Renault: [
    "Clio",
    "Captur",
    "Megane",
    "Arkana",
    "Kadjar",
    "Austral",
    "Scenic",
    "Espace",
    "Kangoo",
    "Trafic",
    "Zoe",
    "Megane E-Tech",
  ],
  Skoda: [
    "Fabia",
    "Scala",
    "Octavia",
    "Superb",
    "Kamiq",
    "Karoq",
    "Kodiaq",
    "Enyaq",
  ],
  Smart: ["ForTwo", "ForFour", "#1", "#3"],
  Suzuki: ["Swift", "Ignis", "Vitara", "S-Cross", "Jimny", "Across"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X"],
  Toyota: [
    "Aygo",
    "Aygo X",
    "Yaris",
    "Yaris Cross",
    "Corolla",
    "Corolla Cross",
    "Auris",
    "C-HR",
    "RAV4",
    "Highlander",
    "Proace City",
    "Proace Verso",
    "bZ4X",
  ],
  Volkswagen: [
    "Up",
    "Polo",
    "Golf",
    "ID.3",
    "ID.4",
    "ID.Buzz",
    "T-Cross",
    "T-Roc",
    "Tiguan",
    "Touran",
    "Passat",
    "Arteon",
    "Caddy",
    "Multivan",
    "Transporter",
  ],
  Volvo: ["XC40", "XC60", "XC90", "C40", "EX30", "EX40", "V60", "S60"],
  BYD: ["Atto 3", "Dolphin", "Seal", "Seal U"],
  Alpine: ["A110"],
  Lexus: ["UX", "NX", "RX", "LBX"],
  Land Rover: ["Discovery Sport", "Range Rover Evoque", "Range Rover Velar"],
  Alfa Romeo: ["Giulia", "Stelvio", "Tonale", "Junior"],
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
