import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdmin } from "@/lib/adminAuth";
import { connectToDB } from "@lib/database";
import Transfer, { TRANSFER_STATUS } from "@models/Transfer";
import {
  getSessionOwnerId,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";
import {
  claimTransferLead,
  redactUnclaimedPartnerPii,
} from "@/domain/transfers/claimTransfer";
import {
  cancelTransferBySupplier,
  reopenTransferForClaim,
  extendTransferOffer,
  overrideSupplierPayout,
} from "@/domain/transfers/transferOps";
import { notifyTransferEmails } from "@/domain/transfers/notifyTransferEmails";
import { afterTransferClaimed } from "@/domain/transfers/afterClaim";
import { createTransferCheckoutSession } from "@/domain/transfers/stripeCheckout";
import { findEligibleTransferCompanies } from "@/domain/transfers/eligibility";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const id = params?.id;
  if (!id) return json({ success: false, message: "id required" }, 400);

  try {
    await connectToDB();
    const doc = await Transfer.findById(id).lean();
    if (!doc) return json({ success: false, message: "Not found" }, 404);

    const isSuper = isSuperAdminUser(session.user);
    const ownerId = getSessionOwnerId(session.user);
    const assigned = doc.assignedSupplierId || doc.claimedByCompanyId;
    if (
      !isSuper &&
      String(assigned || "") !== String(ownerId || "") &&
      !isTransferVisibleToPartner(doc, ownerId)
    ) {
      return json({ success: false, message: "Forbidden" }, 403);
    }

    const claimedByThis =
      Boolean(ownerId) && String(assigned || "") === String(ownerId);

    let eligible = [];
    if (isSuper) {
      eligible = await findEligibleTransferCompanies(doc);
    }

    const item =
      isSuper || claimedByThis
        ? { ...doc, _id: String(doc._id) }
        : { ...redactUnclaimedPartnerPii(doc), _id: String(doc._id) };

    return json({
      success: true,
      item: {
        ...item,
        eligibleSuppliers: isSuper
          ? eligible.map(({ company, check }) => ({
              id: String(company._id),
              name: company.name,
              email: company.email,
              reasons: check.reasons,
            }))
          : [],
      },
    });
  } catch (error) {
    return json({ success: false, message: error.message }, 500);
  }
}

function isTransferVisibleToPartner(doc, ownerId) {
  if (!ownerId) return false;
  if (String(doc.country || "") && doc.status) {
    // open leads in same country are listed separately; detail ok if in eligible set
    return (doc.eligibleSupplierIds || []).map(String).includes(String(ownerId));
  }
  return false;
}

export async function PATCH(request, { params }) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const id = params?.id;
  if (!id) return json({ success: false, message: "id required" }, 400);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const user = session.user;
  const isSuper = isSuperAdminUser(user);
  const ownerId = getSessionOwnerId(user);
  const actorEmail = user?.email || "";

  try {
    await connectToDB();

    if (payload?.action === "claim") {
      const companyId = isSuper
        ? String(payload.companyId || ownerId || "")
        : ownerId;
      if (!companyId) {
        return json({ success: false, message: "companyId required" }, 400);
      }
      const result = await claimTransferLead({
        transferId: id,
        companyId,
        claimedByEmail: actorEmail,
        actor: isSuper ? "admin" : "supplier",
      });
      if (!result.ok) {
        return json(
          { success: false, message: result.message, code: result.code },
          result.code === "taken" ? 409 : 400
        );
      }
      if (!result.idempotent) {
        try {
          const after = await afterTransferClaimed({
            transfer: result.transfer,
            company: result.company,
          });
          return json({
            success: true,
            item: serializeTransfer(after.transfer || result.transfer),
            message: result.message,
            paymentUrl: after.paymentUrl || null,
          });
        } catch (_) {
          /* ignore */
        }
      }
      return json({
        success: true,
        item: serializeTransfer(result.transfer),
        message: result.message,
      });
    }

    if (payload?.action === "cancel_supplier") {
      if (!ownerId && !isSuper) {
        return json({ success: false, message: "Forbidden" }, 403);
      }
      const result = await cancelTransferBySupplier({
        transferId: id,
        companyId: isSuper ? payload.companyId || ownerId : ownerId,
        reason: payload.reason || "",
        byEmail: actorEmail,
        reopen: payload.reopen !== false,
      });
      if (!result.ok) {
        return json({ success: false, message: result.message }, 400);
      }
      if (result.eligible?.length) {
        try {
          await notifyTransferEmails(result.transfer);
        } catch (_) {
          /* ignore */
        }
      }
      return json({ success: true, item: serializeTransfer(result.transfer) });
    }

    if (payload?.action === "assign_fleet_car") {
      const doc = await Transfer.findById(id);
      if (!doc) return json({ success: false, message: "Not found" }, 404);

      const assigned =
        doc.assignedSupplierId || doc.claimedByCompanyId
          ? String(doc.assignedSupplierId || doc.claimedByCompanyId)
          : "";
      if (!assigned) {
        return json(
          { success: false, message: "Transfer must be claimed first" },
          400
        );
      }
      if (!isSuper && String(ownerId || "") !== assigned) {
        return json({ success: false, message: "Forbidden" }, 403);
      }

      const carIdRaw = payload.carId;
      if (carIdRaw == null || carIdRaw === "") {
        doc.assignedCarId = null;
        await doc.save();
        return json({ success: true, item: serializeTransfer(doc.toObject()) });
      }

      const carId = String(carIdRaw);
      if (!mongoose.Types.ObjectId.isValid(carId)) {
        return json({ success: false, message: "Invalid carId" }, 400);
      }

      const Car = (await import("@models/car")).default;
      const car = await Car.findById(carId).lean();
      if (!car) {
        return json({ success: false, message: "Car not found" }, 404);
      }
      if (String(car.ownerId || "") !== assigned) {
        return json(
          {
            success: false,
            message: "Car must belong to the claiming company fleet",
          },
          400
        );
      }

      doc.assignedCarId = car._id;
      await doc.save();
      return json({ success: true, item: serializeTransfer(doc.toObject()) });
    }

    if (payload?.action === "create_payment_link") {
      const doc = await Transfer.findById(id).lean();
      if (!doc) return json({ success: false, message: "Not found" }, 404);
      const assigned =
        doc.assignedSupplierId || doc.claimedByCompanyId
          ? String(doc.assignedSupplierId || doc.claimedByCompanyId)
          : "";
      if (!isSuper && String(ownerId || "") !== assigned) {
        return json({ success: false, message: "Forbidden" }, 403);
      }

      const pay = await createTransferCheckoutSession(id, {
        forceNew: Boolean(payload.forceNew),
      });
      if (!pay.ok) {
        return json(
          { success: false, message: pay.message, code: pay.code },
          pay.code === "stripe_not_configured" ? 503 : 400
        );
      }

      if (payload.emailCustomer !== false) {
        const customerEmail = String(pay.transfer?.email || doc.email || "").trim();
        if (customerEmail.includes("@") && pay.url) {
          try {
            const { sendEmailDirect } = await import("@/lib/email/sendDirect");
            const { BRAND } = await import("@config/brand");
            const brandName = BRAND?.name || "Platform";
            await sendEmailDirect({
              title: `${brandName} — pay to confirm your transfer`,
              message: [
                `Hi ${pay.transfer?.customerName || doc.customerName || "there"},`,
                `Please complete payment for your transfer ${doc.from} → ${doc.to}:`,
                pay.url,
              ].join("\n"),
              to: [customerEmail],
              meta: { type: "transfer.payment_link" },
            });
          } catch (err) {
            console.error(
              "[transfer payment link] email failed",
              err?.message || err
            );
          }
        }
      }

      return json({
        success: true,
        item: serializeTransfer(pay.transfer),
        paymentUrl: pay.url,
        reused: pay.reused,
        mode: pay.mode,
      });
    }

    if (!isSuper) {
      return json({ success: false, message: "Forbidden" }, 403);
    }

    if (payload?.action === "reopen") {
      const result = await reopenTransferForClaim({
        transferId: id,
        actorEmail,
        reason: payload.reason || "Admin reopen",
        extendHours: payload.extendHours,
        overrideExclude: Boolean(payload.overrideExclude),
        excludeCompanyIds: payload.excludeCompanyIds || [],
      });
      if (!result.ok) {
        return json({ success: false, message: result.message }, 400);
      }
      try {
        await notifyTransferEmails(result.transfer);
      } catch (_) {
        /* ignore */
      }
      return json({
        success: true,
        item: serializeTransfer(result.transfer),
        eligibleCount: result.eligibleCount,
      });
    }

    if (payload?.action === "extend_offer") {
      const result = await extendTransferOffer({
        transferId: id,
        hours: payload.hours || 24,
        actorEmail,
      });
      if (!result.ok) {
        return json({ success: false, message: result.message }, 400);
      }
      return json({ success: true, item: serializeTransfer(result.transfer) });
    }

    if (payload?.action === "override_payout") {
      const result = await overrideSupplierPayout({
        transferId: id,
        supplierPayoutMinor: payload.supplierPayoutMinor,
        reason: payload.reason,
        actorEmail,
      });
      if (!result.ok) {
        return json({ success: false, message: result.message }, 400);
      }
      return json({ success: true, item: serializeTransfer(result.transfer) });
    }

    if (payload?.action === "preview_eligible") {
      const doc = await Transfer.findById(id).lean();
      if (!doc) return json({ success: false, message: "Not found" }, 404);
      const eligible = await findEligibleTransferCompanies(doc);
      return json({
        success: true,
        eligible: eligible.map(({ company, check }) => ({
          id: String(company._id),
          name: company.name,
          ok: check.ok,
          reasons: check.reasons,
        })),
      });
    }

    const updates = {};
    if (payload?.status != null) {
      const status = String(payload.status || "").trim();
      updates.status = status;
    }
    if (payload?.platformCommissionPercent != null) {
      const n = Number(payload.platformCommissionPercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return json(
          { success: false, message: "commission must be 0–100" },
          400
        );
      }
      updates.platformCommissionPercent = n;
    }
    if (payload?.internalNotes != null) {
      updates.internalNotes = String(payload.internalNotes);
    }

    if (!Object.keys(updates).length) {
      return json({ success: false, message: "Nothing to update" }, 400);
    }

    const existing = await Transfer.findById(id).lean();
    if (!existing) return json({ success: false, message: "Not found" }, 404);

    if (updates.status) {
      updates.$push = {
        statusEvents: {
          from: existing.status,
          to: updates.status,
          at: new Date(),
          actor: "admin",
          actorEmail,
          reason: payload.reason || "",
        },
      };
    }

    const setFields = { ...updates };
    delete setFields.$push;
    const updateOps = { $set: setFields };
    if (updates.$push) updateOps.$push = updates.$push;

    const doc = await Transfer.findByIdAndUpdate(id, updateOps, {
      new: true,
    }).lean();

    return json({ success: true, item: serializeTransfer(doc) });
  } catch (error) {
    console.error("[admin/transfers] patch failed", error);
    return json({ success: false, message: error.message }, 500);
  }
}

function serializeTransfer(doc) {
  if (!doc) return null;
  return {
    ...doc,
    _id: String(doc._id),
    claimedByCompanyId: doc.claimedByCompanyId
      ? String(doc.claimedByCompanyId)
      : null,
    assignedSupplierId: doc.assignedSupplierId
      ? String(doc.assignedSupplierId)
      : null,
    assignedCarId: doc.assignedCarId ? String(doc.assignedCarId) : null,
    payment: doc.payment
      ? {
          ...doc.payment,
          checkoutUrl: doc.payment.checkoutUrl || "",
          providerPaymentId: doc.payment.providerPaymentId || "",
        }
      : null,
  };
}
