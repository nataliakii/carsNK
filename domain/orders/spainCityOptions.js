/**
 * Curated Spanish cities for Rovaro catalog Pick-up / Return.
 * Exact street address is collected later in BookingModal (placeInDetail / placeOutDetail).
 * English labels are canonical storage values (same as Greece location names).
 *
 * Coverage: provincial capitals, major tourist cities, Catalonia / Costa Brava,
 * and main airports. Search uses labels + SPAIN_CITY_SEARCH_TEXT (accent-insensitive in UI).
 */

/** Strip diacritics / fold case for autocomplete matching. */
export function normalizeSpainCitySearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const SPAIN_CITY_OPTIONS = [
  // Hubs & Catalonia / Costa Brava (surface first for common Rovaro trips)
  "Barcelona",
  "Girona",
  "Costa Brava",
  "Lloret de Mar",
  "Blanes",
  "Tossa de Mar",
  "Platja d'Aro",
  "Roses",
  "Figueres",
  "Empuriabrava",
  "Palafrugell",
  "Cadaqués",
  "Sitges",
  "Tarragona",
  "Reus",
  "Lleida",
  "Salou",
  "Cambrils",
  // Major metros & tourist cities
  "Madrid",
  "Valencia",
  "Alicante",
  "Malaga",
  "Sevilla",
  "Bilbao",
  "Zaragoza",
  "Palma",
  "Murcia",
  "Granada",
  "Cordoba",
  "Santander",
  "San Sebastian",
  "Pamplona",
  "Toledo",
  "Cadiz",
  "Marbella",
  "Benidorm",
  "Ibiza",
  "Torremolinos",
  "Fuengirola",
  "Cartagena",
  "Jerez de la Frontera",
  "Algeciras",
  "Gijon",
  "Oviedo",
  "Vigo",
  "A Coruna",
  "Vitoria-Gasteiz",
  "Logrono",
  "Las Palmas",
  "Santa Cruz de Tenerife",
  // Remaining provincial capitals
  "Albacete",
  "Almeria",
  "Avila",
  "Badajoz",
  "Burgos",
  "Caceres",
  "Castellon",
  "Ciudad Real",
  "Cuenca",
  "Guadalajara",
  "Huelva",
  "Huesca",
  "Jaen",
  "Leon",
  "Lugo",
  "Ourense",
  "Palencia",
  "Pontevedra",
  "Salamanca",
  "Segovia",
  "Soria",
  "Teruel",
  "Valladolid",
  "Zamora",
  // Airports
  "Barcelona Airport",
  "Madrid Airport",
  "Malaga Airport",
  "Alicante Airport",
  "Valencia Airport",
  "Palma Airport",
  "Sevilla Airport",
  "Bilbao Airport",
  "Girona Airport",
  "Ibiza Airport",
  "Tenerife South Airport",
];

export const DEFAULT_SPAIN_BOOKING_LOCATION = "Barcelona";

/** Extra tokens for Autocomplete search (Latin / common variants / Spanish spellings). */
export const SPAIN_CITY_SEARCH_TEXT = {
  Barcelona: "bcn catalunya catalonia el prat barcelone",
  Girona: "gerona costa brava",
  "Costa Brava": "catalunya catalonia coast",
  "Lloret de Mar": "lloret costa brava",
  Blanes: "blanes costa brava",
  "Tossa de Mar": "tossa costa brava",
  "Platja d'Aro": "platja d aro playa de aro costa brava",
  Roses: "rosas costa brava",
  Figueres: "figueras dali",
  Empuriabrava: "empuries costa brava",
  Palafrugell: "palafrugell costa brava",
  Cadaqués: "cadaques costa brava",
  Sitges: "sitges barcelona coast",
  Tarragona: "tgn",
  Reus: "reu",
  Lleida: "lerida lleida",
  Salou: "salou costa dorada",
  Cambrils: "cambrils costa dorada",
  Madrid: "mad capital barajas",
  Valencia: "vlc",
  Alicante: "alc alacant",
  Malaga: "agp malaga costa del sol málaga",
  Sevilla: "svq seville sevilla",
  Bilbao: "bio bilbo",
  Zaragoza: "zaz saragossa",
  Palma: "pmi mallorca majorca palma de mallorca",
  Murcia: "mrc",
  Granada: "grx",
  Cordoba: "cordoba córdoba",
  Santander: "sdr cantabria",
  "San Sebastian": "donostia ss san sebastian sebastián",
  Pamplona: "pna iruna iruña",
  Toledo: "toledo",
  Cadiz: "cadiz cádiz",
  Marbella: "marbella costa del sol",
  Benidorm: "benidorm costa blanca",
  Ibiza: "ibiza eivissa",
  Torremolinos: "torremolinos costa del sol",
  Fuengirola: "fuengirola costa del sol",
  Cartagena: "cartagena murcia",
  "Jerez de la Frontera": "jerez sherry",
  Algeciras: "algeciras gibraltar",
  Gijon: "gijon gijón asturias",
  Oviedo: "oviedo asturias",
  Vigo: "vigo galicia",
  "A Coruna": "a coruna coruña la coruna la coruña galicia",
  "Vitoria-Gasteiz": "vitoria gasteiz alava araba",
  Logrono: "logrono logroño la rioja",
  "Las Palmas": "las palmas gran canaria",
  "Santa Cruz de Tenerife": "tenerife santa cruz",
  Albacete: "albacete",
  Almeria: "almeria almería",
  Avila: "avila ávila",
  Badajoz: "badajoz extremadura",
  Burgos: "burgos",
  Caceres: "caceres cáceres",
  Castellon: "castellon castellón castelló",
  "Ciudad Real": "ciudad real",
  Cuenca: "cuenca",
  Guadalajara: "guadalajara",
  Huelva: "huelva",
  Huesca: "huesca",
  Jaen: "jaen jaén",
  Leon: "leon león",
  Lugo: "lugo",
  Ourense: "ourense orense",
  Palencia: "palencia",
  Pontevedra: "pontevedra",
  Salamanca: "salamanca",
  Segovia: "segovia",
  Soria: "soria",
  Teruel: "teruel",
  Valladolid: "valladolid",
  Zamora: "zamora",
  "Barcelona Airport": "bcn el prat aeropuerto airport",
  "Madrid Airport": "mad barajas aeropuerto airport",
  "Malaga Airport": "agp costa del sol aeropuerto airport málaga",
  "Alicante Airport": "alc alacant elche elx aeropuerto airport",
  "Valencia Airport": "vlc manises aeropuerto airport",
  "Palma Airport": "pmi mallorca aeropuerto airport",
  "Sevilla Airport": "svq seville aeropuerto airport",
  "Bilbao Airport": "bio bilbao aeropuerto airport",
  "Girona Airport": "gro gerona costa brava aeropuerto airport",
  "Ibiza Airport": "ibz eivissa aeropuerto airport",
  "Tenerife South Airport": "tfs tenerife sur aeropuerto airport",
};

/**
 * Returns cities whose label or search tokens match `query` (accent-insensitive).
 * Used by tests and as a reference for Autocomplete stringify behaviour.
 */
export function filterSpainCityOptions(query, options = SPAIN_CITY_OPTIONS) {
  const needle = normalizeSpainCitySearchText(query);
  if (!needle) return [...options];
  return options.filter((name) => {
    const haystack = normalizeSpainCitySearchText(
      `${name} ${SPAIN_CITY_SEARCH_TEXT[name] || ""}`
    );
    return haystack.includes(needle);
  });
}

export function isSpainCityOption(value) {
  const key = normalizeSpainCitySearchText(value);
  if (!key) return false;
  return SPAIN_CITY_OPTIONS.some(
    (name) => normalizeSpainCitySearchText(name) === key
  );
}

export function spainCityRequiresAddressDetail(value) {
  const key = normalizeSpainCitySearchText(value);
  if (!key) return false;
  if (key.includes("airport")) return false;
  return isSpainCityOption(value);
}
