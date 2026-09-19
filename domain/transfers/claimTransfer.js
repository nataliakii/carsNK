import Transfer, {
  TRANSFER_STATUS,
  isTransferOpenStatus,
  normalizeTransferStatus,
} from "@models/Transfer";
import Company from "@models/company";
import mongoose from "mongoose";
import { isCompanyEligibleForTransfer } from "@/domain/transfers/eligibility";
import { locationDisplayName } from "@/domain/transfers/locationSnapshot";
import { formatMinor } from "@/domain/money/minorUnits";

/**
 * Atomic first-wins claim with idempotency for the winning supplier.
 */
export async function claimTransferLead({
  transferId,
  companyId,
  claimedByEmail = "",
  actor = "supplier",
}) {
  if (
    !mongoose.Types.ObjectId.isValid(String(transferId)) ||
    !mongoose.Types.ObjectId.isValid(String(companyId))
  ) {
    return { ok: false, message: "Invalid id", code: "invalid" };
  }

  const company = await Company.findById(companyId)
    .select("name email country transferServices")
    .lean();
  if (!company) {
    return { ok: false, message: "Company not found", code: "company" };
  }

  const existing = await Transfer.findById(transferId).lean();
  if (!existing) {
    return { ok: false, message: "Transfer not found", code: "not_found" };
  }

  const assignedId =
    existing.assignedSupplierId || existing.claimedByCompanyId || null;

  // Idempotent: same winner retries
  if (
    normalizeTransferStatus(existing.status) === TRANSFER_STATUS.CLAIMED &&
    assignedId &&
    String(assignedId) === String(companyId)
  ) {
    await Transfer.findByIdAndUpdate(transferId, {
      $push: {
        claimAttempts: {
          companyId,
          at: new Date(),
          result: "idempotent",
          message: "Already assigned to this company",
        },
      },
    });
    return {
      ok: true,
      transfer: existing,
      company,
      idempotent: true,
      message: "The transfer has been assigned to your company.",
    };
  }

  if (!isTransferOpenStatus(existing.status) || assignedId) {
    await Transfer.findByIdAndUpdate(transferId, {
      $push: {
        claimAttempts: {
          companyId,
          at: new Date(),
          result: "taken",
          message: "Already claimed by another company",
        },
      },
    });
    return {
      ok: false,
      message:
        "Sorry, this transfer has already been accepted by another company.",
      code: "taken",
      transfer: existing,
    };
  }

  if (
    existing.offerExpiresAt &&
    new Date(existing.offerExpiresAt).getTime() < Date.now()
  ) {
    await Transfer.findByIdAndUpdate(transferId, {
      $push: {
        claimAttempts: {
          companyId,
          at: new Date(),
          result: "expired",
          message: "Offer expired",
        },
      },
    });
    return {
      ok: false,
      message: "This transfer offer has expired",
      code: "expired",
      transfer: existing,
    };
  }

  const excluded = (existing.excludedSupplierIds || []).map(String);
  if (excluded.includes(String(companyId))) {
    await Transfer.findByIdAndUpdate(transferId, {
      $push: {
        claimAttempts: {
          companyId,
          at: new Date(),
          result: "ineligible",
          message: "Company excluded from this offer",
        },
      },
    });
    return {
      ok: false,
      message: "Your company is not eligible to claim this transfer",
      code: "ineligible",
      transfer: existing,
    };
  }

  const eligibleIds = (existing.eligibleSupplierIds || []).map(String);
  if (eligibleIds.length && !eligibleIds.includes(String(companyId))) {
    await Transfer.findByIdAndUpdate(transferId, {
      $push: {
        claimAttempts: {
          companyId,
          at: new Date(),
          result: "ineligible",
          message: "Not in eligible supplier set",
        },
      },
    });
    return {
      ok: false,
      message: "Your company is not eligible to claim this transfer",
      code: "ineligible",
      transfer: existing,
    };
  }

  const eligibility = isCompanyEligibleForTransfer(company, existing);
  // During migration: if transferServices not configured, allow claim for same-country admins
  // only when eligibleSupplierIds was empty (legacy leads).
  if (!eligibility.ok && eligibleIds.length > 0) {
    await Transfer.findByIdAndUpdate(transferId, {
      $push: {
        claimAttempts: {
          companyId,
          at: new Date(),
          result: "ineligible",
          message: eligibility.reasons.join(","),
        },
      },
    });
    return {
      ok: false,
      message: "Your company is not eligible to claim this transfer",
      code: "ineligible",
      transfer: existing,
    };
  }

  const email =
    String(claimedByEmail || "").trim() ||
    String(company.email || "").trim();

  const payout =
    existing.quoteSnapshot?.supplierPayoutMinor ?? null;

  const now = new Date();
  const openStatuses = [
    TRANSFER_STATUS.OPEN_FOR_CLAIM,
    TRANSFER_STATUS.REOPENED_FOR_CLAIM,
    "open",
    "new",
    "seen",
  ];

  const updated = await Transfer.findOneAndUpdate(
    {
      _id: transferId,
      status: { $in: openStatuses },
      $and: [
        {
          $or: [
            { assignedSupplierId: null },
            { assignedSupplierId: { $exists: false } },
          ],
        },
        {
          $or: [
            { claimedByCompanyId: null },
            { claimedByCompanyId: { $exists: false } },
          ],
        },
        {
          $or: [
            { offerExpiresAt: null },
            { offerExpiresAt: { $exists: false } },
            { offerExpiresAt: { $gt: now } },
          ],
        },
        {
          $or: [
            { excludedSupplierIds: { $size: 0 } },
            { excludedSupplierIds: { $nin: [companyId] } },
            { excludedSupplierIds: { $exists: false } },
          ],
        },
      ],
    },
    {
      $set: {
        status: TRANSFER_STATUS.CLAIMED,
        assignedSupplierId: companyId,
        claimedByCompanyId: companyId,
        claimedByEmail: email,
        claimedAt: now,
      },
      $push: {
        assignmentHistory: {
          companyId,
          companyName: company.name || "",
          action: actor === "admin" ? "manual_assign" : "claimed",
          at: now,
          byEmail: email,
          supplierPayoutMinor: payout,
        },
        claimAttempts: {
          companyId,
          at: now,
          result: "success",
          message: "Claimed",
        },
        statusEvents: {
          from: existing.status,
          to: TRANSFER_STATUS.CLAIMED,
          at: now,
          actor,
          actorEmail: email,
        },
      },
    },
    { new: true }
  ).lean();

  if (updated) {
    return {
      ok: true,
      transfer: updated,
      company,
      message: "The transfer has been assigned to your company.",
    };
  }

  const again = await Transfer.findById(transferId).lean();
  if (!again) {
    return { ok: false, message: "Transfer not found", code: "not_found" };
  }

  const againAssigned =
    again.assignedSupplierId || again.claimedByCompanyId || null;
  if (
    normalizeTransferStatus(again.status) === TRANSFER_STATUS.CLAIMED &&
    againAssigned &&
    String(againAssigned) === String(companyId)
  ) {
    return {
      ok: true,
      transfer: again,
      company,
      idempotent: true,
      message: "The transfer has been assigned to your company.",
    };
  }

  await Transfer.findByIdAndUpdate(transferId, {
    $push: {
      claimAttempts: {
        companyId,
        at: new Date(),
        result: "taken",
        message: "Lost race",
      },
    },
  });

  return {
    ok: false,
    message:
      "Sorry, this transfer has already been accepted by another company.",
    code: "taken",
    transfer: again,
  };
}

function publicLocationHint(loc) {
  if (!loc || typeof loc !== "object") return loc;
  return {
    city: loc.city || "",
    locationType: loc.locationType || "",
    country: loc.country || "",
  };
}

/**
 * Overlay that strips customer PII from a transfer document/API row.
 * Route city names remain; phone/email/name/notes/private address do not.
 */
export function redactUnclaimedPartnerPii(item) {
  const masked = publicTransferSummary(item, { revealContact: false });
  const rest = { ...(item || {}) };
  delete rest.notes;
  delete rest.flightNumber;
  delete rest.flightArrivalTime;
  delete rest.hotelName;
  delete rest.signText;
  delete rest.customerFirstName;
  delete rest.customerLastName;
  delete rest.customerName;
  delete rest.phone;
  delete rest.phoneCountryCode;
  delete rest.email;
  delete rest.communications;
  delete rest.additionalStops;
  delete rest.accessibilityRequirements;
  delete rest.specialRequirements;
  delete rest.origin;
  delete rest.destination;
  return {
    ...rest,
    customerName: masked.customerName,
    customerFirstName: "",
    customerLastName: "",
    phone: "",
    phoneCountryCode: "",
    email: "",
    notes: "",
    specialRequirements: masked.specialRequirements,
    accessibilityRequirements: "",
    flightNumber: "",
    flightArrivalTime: "",
    signText: "",
    hotelName: masked.hotelName,
    communications: [],
    additionalStops: [],
    origin: publicLocationHint(item?.origin),
    destination: publicLocationHint(item?.destination),
  };
}

export function publicTransferSummary(doc, { revealContact = false } = {}) {
  if (!doc) return null;
  const phone = String(doc.phone || "");

  const quote = doc.quoteSnapshot;
  const payoutMinor = quote?.supplierPayoutMinor;
  const currency = quote?.currency || "EUR";

  return {
    id: String(doc._id),
    from: doc.from || locationDisplayName(doc.origin),
    to: doc.to || locationDisplayName(doc.destination),
    originCity: doc.origin?.city || "",
    destinationCity: doc.destination?.city || "",
    originType: doc.origin?.locationType || "",
    destinationType: doc.destination?.locationType || "",
    distanceKm: doc.distanceKm,
    durationMinutes: doc.durationMinutes,
    passengers: doc.passengers,
    adults: doc.adults,
    childrenCount: Array.isArray(doc.children) ? doc.children.length : 0,
    standardSuitcases: doc.standardSuitcases,
    cabinBags: doc.cabinBags,
    vehicleCategory: doc.vehicleCategory,
    datetime: doc.datetime,
    specialRequirements: revealContact
      ? doc.notes
      : doc.accessibilityRequirements
        ? "Accessibility requirements noted"
        : "",
    notes: revealContact ? doc.notes : "",
    accessibilityRequirements: revealContact
      ? doc.accessibilityRequirements
      : "",
    flightNumber: revealContact ? doc.flightNumber : "",
    customerName: revealContact
      ? doc.customerName ||
        [doc.customerFirstName, doc.customerLastName].filter(Boolean).join(" ")
      : doc.customerName
        ? "Available after claim"
        : "",
    phone: revealContact ? phone : "",
    email: revealContact ? doc.email : "",
    signText: revealContact ? doc.signText : "",
    hotelName: revealContact ? doc.hotelName : doc.hotelName ? "Hotel pickup" : "",
    status: doc.status,
    country: doc.country,
    supplierPayoutMinor: payoutMinor ?? null,
    supplierPayoutFormatted:
      payoutMinor != null ? formatMinor(payoutMinor, currency) : null,
    currency,
    platformCommissionPercent: doc.platformCommissionPercent,
    available: isTransferOpenStatus(doc.status) && !doc.assignedSupplierId && !doc.claimedByCompanyId,
    claimedAt: doc.claimedAt || null,
  };
}
