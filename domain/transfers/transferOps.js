import Transfer, {
  TRANSFER_STATUS,
  normalizeTransferStatus,
  defaultOfferTtlHours,
} from "@models/Transfer";
import { canActorTransition } from "@/domain/transfers/transferStatus";
import { revokeTransferOffers } from "@/domain/transfers/claimToken";
import { findEligibleTransferCompanies } from "@/domain/transfers/eligibility";

/**
 * Supplier cancels after claim — preserves assignment history.
 */
export async function cancelTransferBySupplier({
  transferId,
  companyId,
  reason = "",
  byEmail = "",
  reopen = true,
}) {
  const doc = await Transfer.findById(transferId);
  if (!doc) return { ok: false, message: "Not found", code: "not_found" };

  const assigned = doc.assignedSupplierId || doc.claimedByCompanyId;
  if (!assigned || String(assigned) !== String(companyId)) {
    return { ok: false, message: "Not the assigned supplier", code: "forbidden" };
  }

  const from = doc.status;
  if (
    !canActorTransition(from, TRANSFER_STATUS.SUPPLIER_CANCELLED, "supplier")
  ) {
    return { ok: false, message: "Invalid status transition", code: "status" };
  }

  const now = new Date();
  doc.status = TRANSFER_STATUS.SUPPLIER_CANCELLED;
  doc.cancellationReason = String(reason || "").trim();
  doc.assignmentHistory.push({
    companyId,
    companyName: "",
    action: "cancelled",
    at: now,
    byEmail,
    reason: doc.cancellationReason,
  });
  doc.statusEvents.push({
    from,
    to: TRANSFER_STATUS.SUPPLIER_CANCELLED,
    at: now,
    actor: "supplier",
    actorEmail: byEmail,
    reason: doc.cancellationReason,
  });
  // Keep assignedSupplierId for audit; clear active assignment pointers for reopen
  doc.claimedByCompanyId = null;
  doc.assignedSupplierId = null;
  doc.claimedAt = null;
  doc.excludedSupplierIds = [
    ...new Set([
      ...(doc.excludedSupplierIds || []).map(String),
      String(companyId),
    ]),
  ];

  await doc.save();
  await revokeTransferOffers(transferId);

  if (reopen) {
    return reopenTransferForClaim({
      transferId,
      actorEmail: byEmail,
      reason: `Reopened after supplier cancellation: ${reason}`,
    });
  }

  return { ok: true, transfer: doc.toObject() };
}

/**
 * Reopen an expired/cancelled transfer to eligible suppliers.
 */
export async function reopenTransferForClaim({
  transferId,
  actorEmail = "",
  reason = "",
  extendHours,
  overrideExclude = false,
  excludeCompanyIds = [],
}) {
  const doc = await Transfer.findById(transferId);
  if (!doc) return { ok: false, message: "Not found", code: "not_found" };

  const from = doc.status;
  const to = TRANSFER_STATUS.REOPENED_FOR_CLAIM;
  if (!canActorTransition(from, to, "admin") && from !== TRANSFER_STATUS.SUPPLIER_CANCELLED) {
    // allow system reopen from supplier cancel path
    if (
      normalizeTransferStatus(from) !== TRANSFER_STATUS.SUPPLIER_CANCELLED &&
      normalizeTransferStatus(from) !== TRANSFER_STATUS.EXPIRED_UNCLAIMED
    ) {
      return { ok: false, message: "Cannot reopen from this status", code: "status" };
    }
  }

  const excluded = overrideExclude
    ? excludeCompanyIds.map(String)
    : [
        ...new Set([
          ...(doc.excludedSupplierIds || []).map(String),
          ...excludeCompanyIds.map(String),
        ]),
      ];

  const eligible = await findEligibleTransferCompanies(doc.toObject(), {
    excludeCompanyIds: excluded,
  });

  const hours = Number(extendHours) || defaultOfferTtlHours();
  const now = new Date();
  doc.status = TRANSFER_STATUS.REOPENED_FOR_CLAIM;
  doc.excludedSupplierIds = excluded;
  doc.eligibleSupplierIds = eligible.map((e) => e.company._id);
  doc.assignedSupplierId = null;
  doc.claimedByCompanyId = null;
  doc.claimedAt = null;
  doc.offerExpiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
  doc.assignmentHistory.push({
    companyId: excluded[0] || doc.excludedSupplierIds?.[0] || doc._id,
    companyName: "",
    action: "reopened",
    at: now,
    byEmail: actorEmail,
    reason,
  });
  doc.statusEvents.push({
    from,
    to,
    at: now,
    actor: "admin",
    actorEmail,
    reason,
  });
  await doc.save();

  return {
    ok: true,
    transfer: doc.toObject(),
    eligibleCount: eligible.length,
    eligible,
  };
}

/**
 * Mark unclaimed transfers as expired.
 */
export async function expireUnclaimedTransfers({ now = new Date() } = {}) {
  const result = await Transfer.updateMany(
    {
      status: {
        $in: [
          TRANSFER_STATUS.OPEN_FOR_CLAIM,
          TRANSFER_STATUS.REOPENED_FOR_CLAIM,
          "open",
          "new",
          "seen",
        ],
      },
      offerExpiresAt: { $lte: now },
      $or: [
        { assignedSupplierId: null },
        { assignedSupplierId: { $exists: false } },
      ],
    },
    {
      $set: { status: TRANSFER_STATUS.EXPIRED_UNCLAIMED },
      $push: {
        statusEvents: {
          from: TRANSFER_STATUS.OPEN_FOR_CLAIM,
          to: TRANSFER_STATUS.EXPIRED_UNCLAIMED,
          at: now,
          actor: "system",
          reason: "Offer window expired",
        },
      },
    }
  );
  return { ok: true, modified: result.modifiedCount || 0 };
}

/**
 * Extend offer expiry (super-admin).
 */
export async function extendTransferOffer({
  transferId,
  hours = 24,
  actorEmail = "",
}) {
  const doc = await Transfer.findById(transferId);
  if (!doc) return { ok: false, message: "Not found" };
  const base =
    doc.offerExpiresAt && new Date(doc.offerExpiresAt) > new Date()
      ? new Date(doc.offerExpiresAt)
      : new Date();
  doc.offerExpiresAt = new Date(base.getTime() + Number(hours) * 60 * 60 * 1000);
  if (
    normalizeTransferStatus(doc.status) === TRANSFER_STATUS.EXPIRED_UNCLAIMED
  ) {
    doc.status = TRANSFER_STATUS.OPEN_FOR_CLAIM;
  }
  doc.statusEvents.push({
    from: doc.status,
    to: doc.status,
    at: new Date(),
    actor: "admin",
    actorEmail,
    reason: `Offer extended by ${hours}h`,
  });
  await doc.save();
  return { ok: true, transfer: doc.toObject() };
}

/**
 * Override supplier payout on snapshot (audited by caller).
 */
export async function overrideSupplierPayout({
  transferId,
  supplierPayoutMinor,
  reason,
  actorEmail = "",
}) {
  if (!reason || !String(reason).trim()) {
    return { ok: false, message: "Reason required for payout override" };
  }
  const n = Number(supplierPayoutMinor);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, message: "Invalid payout" };
  }
  const doc = await Transfer.findById(transferId);
  if (!doc?.quoteSnapshot) {
    return { ok: false, message: "No quote snapshot" };
  }
  const prev = doc.quoteSnapshot.supplierPayoutMinor;
  doc.quoteSnapshot.supplierPayoutMinor = Math.round(n);
  doc.quoteSnapshot.platformMarginMinor =
    Number(doc.quoteSnapshot.customerPriceMinor || 0) -
    Math.round(n) -
    Number(doc.quoteSnapshot.paymentProcessingAmountMinor || 0);
  doc.quoteSnapshot.adminOverrideReason = String(reason).trim();
  doc.internalNotes = [
    doc.internalNotes || "",
    `[payout override ${new Date().toISOString()} by ${actorEmail}] ${prev} → ${n}: ${reason}`,
  ]
    .filter(Boolean)
    .join("\n");
  await doc.save();
  return { ok: true, transfer: doc.toObject() };
}
