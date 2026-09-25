import mongoose from "mongoose";
import {
  CAR_OFFICE_SCOPE,
  OFFICE_STATUS,
  normalizeCarOfficeScope,
  normalizeOfficeLocationType,
  normalizeOfficeStatus,
} from "@/domain/company/officeConstants";
import { normalizeOfficeKey } from "@/domain/company/officeConstants";

export function officeIdString(value) {
  if (value == null) return "";
  if (typeof value === "object" && value._id) return String(value._id);
  return String(value);
}

export function isValidOfficeId(value) {
  return mongoose.Types.ObjectId.isValid(officeIdString(value));
}

function trim(value) {
  return String(value ?? "").trim();
}

/**
 * Canonical company office record. `_id` is assigned when persisting.
 */
export function normalizeOfficeRecord(raw, { assignId = false } = {}) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const name = raw.trim();
    if (!name) return null;
    return {
      _id: assignId ? new mongoose.Types.ObjectId() : undefined,
      name,
      publicName: name,
      address: "",
      city: "",
      country: "",
      placeId: "",
      lat: "",
      lon: "",
      locationType: "office",
      collectionInstructions: "",
      returnInstructions: "",
      openingHours: { start: "", end: "" },
      showPhone: false,
      status: OFFICE_STATUS.ACTIVE,
      freePickup: true,
      freeReturn: true,
      carIds: [],
      archivedAt: null,
    };
  }
  if (typeof raw !== "object") return null;
  const name = trim(raw.name || raw.publicName || raw.label || raw.value);
  if (!name) return null;
  const existingId = officeIdString(raw._id || raw.id);
  const carIds = Array.isArray(raw.carIds)
    ? raw.carIds.map(officeIdString).filter(isValidOfficeId)
    : [];
  let status = normalizeOfficeStatus(raw.status);
  // UI Switch sends `active` — map it when status was omitted or stale.
  if (raw.active === false || raw.active === "false") {
    status = OFFICE_STATUS.ARCHIVED;
  } else if (raw.active === true || raw.active === "true") {
    status = OFFICE_STATUS.ACTIVE;
  }
  return {
    _id: isValidOfficeId(existingId)
      ? existingId
      : assignId
        ? String(new mongoose.Types.ObjectId())
        : undefined,
    name,
    publicName: trim(raw.publicName) || name,
    address: trim(raw.address),
    city: trim(raw.city),
    country: trim(raw.country).toUpperCase(),
    placeId: trim(raw.placeId),
    lat: raw.lat != null && raw.lat !== "" ? trim(raw.lat) : "",
    lon:
      raw.lon != null && raw.lon !== ""
        ? trim(raw.lon)
        : raw.lng != null && raw.lng !== ""
          ? trim(raw.lng)
          : "",
    locationType: normalizeOfficeLocationType(raw.locationType),
    collectionInstructions: trim(raw.collectionInstructions),
    returnInstructions: trim(raw.returnInstructions),
    openingHours: {
      start: trim(raw.openingHours?.start),
      end: trim(raw.openingHours?.end),
    },
    showPhone: Boolean(raw.showPhone),
    status,
    freePickup: raw.freePickup !== false,
    freeReturn: raw.freeReturn !== false,
    carIds,
    archivedAt: raw.archivedAt || null,
  };
}

export function persistOfficeShape(office, { assignId = false } = {}) {
  const row = normalizeOfficeRecord(office, { assignId });
  if (!row) return null;
  const doc = {
    name: row.name,
    publicName: row.publicName,
    address: row.address,
    city: row.city,
    country: row.country,
    placeId: row.placeId,
    lat: row.lat,
    lon: row.lon,
    locationType: row.locationType,
    collectionInstructions: row.collectionInstructions,
    returnInstructions: row.returnInstructions,
    openingHours: row.openingHours,
    showPhone: row.showPhone,
    status: row.status,
    freePickup: row.freePickup,
    freeReturn: row.freeReturn,
    carIds: row.carIds,
    archivedAt: row.status === OFFICE_STATUS.ARCHIVED ? row.archivedAt || new Date() : null,
  };
  if (row._id) doc._id = row._id;
  return doc;
}

export function isOfficeActive(office) {
  return normalizeOfficeStatus(office?.status) === OFFICE_STATUS.ACTIVE;
}

export function archiveOfficeRecord(office) {
  const row = persistOfficeShape(office);
  if (!row) return null;
  return {
    ...row,
    status: OFFICE_STATUS.ARCHIVED,
    archivedAt: new Date(),
  };
}

/**
 * Offices a customer may book for this car. Never returns another company's
 * offices. Empty `officeIds` + scope `all` → every active company office.
 * Legacy `car.offices` names still match when IDs are missing.
 */
export function resolveEligibleOffices({
  car,
  company,
  includeArchived = false,
} = {}) {
  const companyId = String(car?.ownerId || company?._id || "");
  if (company && companyId && String(company._id) !== companyId) {
    return [];
  }
  const stored = (Array.isArray(company?.offices) ? company.offices : [])
    .map((row) => normalizeOfficeRecord(row))
    .filter(Boolean)
    .filter((row) => includeArchived || isOfficeActive(row));

  const selectedIds = (Array.isArray(car?.officeIds) ? car.officeIds : [])
    .map(officeIdString)
    .filter(Boolean);
  const scope = normalizeCarOfficeScope(car?.officeScope, selectedIds.length > 0);

  if (scope === CAR_OFFICE_SCOPE.SELECTED && selectedIds.length) {
    return stored.filter((row) => selectedIds.includes(officeIdString(row._id)));
  }

  const legacyNames = (Array.isArray(car?.offices) ? car.offices : [])
    .map((row) =>
      typeof row === "string"
        ? normalizeOfficeKey(row)
        : normalizeOfficeKey(row?.name)
    )
    .filter(Boolean);
  if (legacyNames.length && stored.length) {
    const matched = stored.filter((row) =>
      legacyNames.includes(normalizeOfficeKey(row.name))
    );
    if (matched.length) return matched;
  }

  return stored;
}

export function findEligibleOffice(offices, officeId) {
  const id = officeIdString(officeId);
  if (!id) return null;
  return (offices || []).find((row) => officeIdString(row._id) === id) || null;
}

export function assertOfficeBelongsToCompany(office, companyId) {
  if (!office) return false;
  if (office.companyId && String(office.companyId) !== String(companyId)) {
    return false;
  }
  return true;
}

export function syncCarOfficeIds({ offices, officeIds, officeScope, company } = {}) {
  if (Array.isArray(officeIds) && officeIds.length) {
    return {
      officeIds: officeIds.map(officeIdString).filter(isValidOfficeId),
      officeScope: normalizeCarOfficeScope(officeScope, true),
    };
  }
  const names = (Array.isArray(offices) ? offices : [])
    .map((row) =>
      normalizeOfficeKey(typeof row === "string" ? row : row?.name)
    )
    .filter(Boolean);
  const matched = (Array.isArray(company?.offices) ? company.offices : [])
    .filter((row) => names.includes(normalizeOfficeKey(row?.name)))
    .map((row) => officeIdString(row._id))
    .filter(isValidOfficeId);
  return {
    officeIds: matched,
    officeScope: normalizeCarOfficeScope(
      officeScope,
      matched.length > 0 && names.length > 0
    ),
  };
}

export function publicOfficeView(office, { companyPhone = "" } = {}) {
  if (!office || !isOfficeActive(office)) return null;
  return {
    id: officeIdString(office._id),
    name: office.publicName || office.name,
    address: office.address || "",
    city: office.city || "",
    country: office.country || "",
    locationType: office.locationType || "office",
    collectionInstructions: office.collectionInstructions || "",
    returnInstructions: office.returnInstructions || "",
    openingHours: office.openingHours || { start: "", end: "" },
    phone: office.showPhone ? companyPhone : "",
    freePickup: true,
    freeReturn: true,
    lat: office.lat || "",
    lon: office.lon || "",
  };
}
