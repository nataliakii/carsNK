export const OFFICE_LOCATION_TYPE = Object.freeze({
  OFFICE: "office",
  AIRPORT: "airport",
  TRAIN_STATION: "train_station",
  PORT: "port",
  HOTEL: "hotel",
  OTHER: "other",
});

export const OFFICE_LOCATION_TYPES = Object.freeze(
  Object.values(OFFICE_LOCATION_TYPE)
);

export const OFFICE_STATUS = Object.freeze({
  ACTIVE: "active",
  ARCHIVED: "archived",
});

export const CAR_OFFICE_SCOPE = Object.freeze({
  ALL: "all",
  SELECTED: "selected",
});

export function normalizeOfficeLocationType(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "train" || raw === "station") return OFFICE_LOCATION_TYPE.TRAIN_STATION;
  if (raw === "meeting" || raw === "meeting_point") return OFFICE_LOCATION_TYPE.HOTEL;
  return OFFICE_LOCATION_TYPES.includes(raw) ? raw : OFFICE_LOCATION_TYPE.OFFICE;
}

export function normalizeOfficeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === OFFICE_STATUS.ARCHIVED || raw === "inactive") {
    return OFFICE_STATUS.ARCHIVED;
  }
  return OFFICE_STATUS.ACTIVE;
}

export function normalizeOfficeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function normalizeCarOfficeScope(value, hasSelectedIds) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === CAR_OFFICE_SCOPE.SELECTED) return CAR_OFFICE_SCOPE.SELECTED;
  if (raw === CAR_OFFICE_SCOPE.ALL) return CAR_OFFICE_SCOPE.ALL;
  return hasSelectedIds ? CAR_OFFICE_SCOPE.SELECTED : CAR_OFFICE_SCOPE.ALL;
}
