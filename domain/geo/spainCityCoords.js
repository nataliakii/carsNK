import {
  SPAIN_CITY_OPTIONS,
  SPAIN_CITY_SEARCH_TEXT,
} from "@/domain/orders/spainCityOptions";

/**
 * City-centre / terminal coordinates for the curated Spanish catalog.
 *
 * These back the base-location picker when Google Places is unavailable
 * (no key, referer-restricted key, quota, rate limit), so Spanish companies
 * can always set a base without typing coordinates by hand.
 */
export const SPAIN_CITY_COORDS = {
  Barcelona: { lat: 41.3874, lon: 2.1686 },
  Girona: { lat: 41.9794, lon: 2.8214 },
  "Costa Brava": { lat: 41.85, lon: 3.0833 },
  "Lloret de Mar": { lat: 41.7005, lon: 2.845 },
  Blanes: { lat: 41.6748, lon: 2.7906 },
  "Tossa de Mar": { lat: 41.7196, lon: 2.931 },
  "Platja d'Aro": { lat: 41.8175, lon: 3.0665 },
  Roses: { lat: 42.262, lon: 3.1764 },
  Figueres: { lat: 42.2662, lon: 2.9622 },
  Empuriabrava: { lat: 42.247, lon: 3.12 },
  Palafrugell: { lat: 41.9174, lon: 3.1631 },
  Cadaqués: { lat: 42.2887, lon: 3.2778 },
  Sitges: { lat: 41.2371, lon: 1.8055 },
  Tarragona: { lat: 41.1189, lon: 1.2445 },
  Reus: { lat: 41.156, lon: 1.1069 },
  Lleida: { lat: 41.6176, lon: 0.62 },
  Salou: { lat: 41.0763, lon: 1.1417 },
  Cambrils: { lat: 41.0669, lon: 1.056 },
  Madrid: { lat: 40.4168, lon: -3.7038 },
  Valencia: { lat: 39.4699, lon: -0.3763 },
  Alicante: { lat: 38.3452, lon: -0.481 },
  Malaga: { lat: 36.7213, lon: -4.4214 },
  Sevilla: { lat: 37.3891, lon: -5.9845 },
  Bilbao: { lat: 43.263, lon: -2.935 },
  Zaragoza: { lat: 41.6488, lon: -0.8891 },
  Palma: { lat: 39.5696, lon: 2.6502 },
  Murcia: { lat: 37.9922, lon: -1.1307 },
  Granada: { lat: 37.1773, lon: -3.5986 },
  Cordoba: { lat: 37.8882, lon: -4.7794 },
  Santander: { lat: 43.4623, lon: -3.81 },
  "San Sebastian": { lat: 43.3183, lon: -1.9812 },
  Pamplona: { lat: 42.8125, lon: -1.6458 },
  Toledo: { lat: 39.8628, lon: -4.0273 },
  Cadiz: { lat: 36.5271, lon: -6.2886 },
  Marbella: { lat: 36.5101, lon: -4.8824 },
  Benidorm: { lat: 38.5411, lon: -0.1225 },
  Ibiza: { lat: 38.9067, lon: 1.4206 },
  Torremolinos: { lat: 36.625, lon: -4.4999 },
  Fuengirola: { lat: 36.5397, lon: -4.6256 },
  Cartagena: { lat: 37.6257, lon: -0.9966 },
  "Jerez de la Frontera": { lat: 36.685, lon: -6.1261 },
  Algeciras: { lat: 36.1408, lon: -5.4562 },
  Gijon: { lat: 43.5322, lon: -5.6611 },
  Oviedo: { lat: 43.3619, lon: -5.8494 },
  Vigo: { lat: 42.2406, lon: -8.7207 },
  "A Coruna": { lat: 43.3623, lon: -8.4115 },
  "Vitoria-Gasteiz": { lat: 42.8467, lon: -2.6716 },
  Logrono: { lat: 42.4627, lon: -2.445 },
  "Las Palmas": { lat: 28.1235, lon: -15.4363 },
  "Santa Cruz de Tenerife": { lat: 28.4636, lon: -16.2518 },
  Albacete: { lat: 38.9943, lon: -1.8585 },
  Almeria: { lat: 36.834, lon: -2.4637 },
  Avila: { lat: 40.6565, lon: -4.6818 },
  Badajoz: { lat: 38.8794, lon: -6.9707 },
  Burgos: { lat: 42.3439, lon: -3.6969 },
  Caceres: { lat: 39.4753, lon: -6.3724 },
  Castellon: { lat: 39.9864, lon: -0.0513 },
  "Ciudad Real": { lat: 38.9848, lon: -3.9273 },
  Cuenca: { lat: 40.0704, lon: -2.1374 },
  Guadalajara: { lat: 40.632, lon: -3.1669 },
  Huelva: { lat: 37.2614, lon: -6.9447 },
  Huesca: { lat: 42.1362, lon: -0.4087 },
  Jaen: { lat: 37.7796, lon: -3.7849 },
  Leon: { lat: 42.5987, lon: -5.5671 },
  Lugo: { lat: 43.0121, lon: -7.5559 },
  Ourense: { lat: 42.3358, lon: -7.8639 },
  Palencia: { lat: 42.0096, lon: -4.5288 },
  Pontevedra: { lat: 42.431, lon: -8.6444 },
  Salamanca: { lat: 40.9701, lon: -5.6635 },
  Segovia: { lat: 40.9429, lon: -4.1088 },
  Soria: { lat: 41.7665, lon: -2.479 },
  Teruel: { lat: 40.3456, lon: -1.1065 },
  Valladolid: { lat: 41.6523, lon: -4.7245 },
  Zamora: { lat: 41.5033, lon: -5.7446 },
  "Barcelona Airport": { lat: 41.2971, lon: 2.0785 },
  "Madrid Airport": { lat: 40.4719, lon: -3.5626 },
  "Malaga Airport": { lat: 36.6749, lon: -4.4991 },
  "Alicante Airport": { lat: 38.2822, lon: -0.5582 },
  "Valencia Airport": { lat: 39.4893, lon: -0.4816 },
  "Palma Airport": { lat: 39.5517, lon: 2.7388 },
  "Sevilla Airport": { lat: 37.418, lon: -5.8931 },
  "Bilbao Airport": { lat: 43.3011, lon: -2.9106 },
  "Girona Airport": { lat: 41.901, lon: 2.7605 },
  "Ibiza Airport": { lat: 38.8729, lon: 1.3731 },
  "Tenerife South Airport": { lat: 28.0445, lon: -16.5725 },
};

/**
 * Spanish cities in the `toPublicCity` shape consumed by the city pickers.
 * Only names that have coordinates are returned.
 */
export function spainFallbackCities() {
  return SPAIN_CITY_OPTIONS.filter((name) => SPAIN_CITY_COORDS[name]).map(
    (name) => ({
      _id: `es:${name}`,
      slug: `es-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      country: "ES",
      kind: name.includes("Airport") ? "airport" : "city",
      searchText: SPAIN_CITY_SEARCH_TEXT[name] || "",
      coords: {
        lat: String(SPAIN_CITY_COORDS[name].lat),
        lon: String(SPAIN_CITY_COORDS[name].lon),
      },
    })
  );
}
