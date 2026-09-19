import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { connectToDB } from "@lib/database";
import Transfer, {
  TRANSFER_STATUS,
  TRANSFER_OPEN_STATUSES,
  isTransferOpenStatus,
  normalizeTransferStatus,
} from "@models/Transfer";
import Company from "@models/company";
import {
  getSessionOwnerId,
  isSuperAdminUser,
} from "@/domain/owners/ownerScope";
import { normalizeAdminCountryFilter } from "@/domain/platform/adminCountryScope";
import { getSiteCountryConfig } from "@config/siteCountry";
import { redactUnclaimedPartnerPii } from "@/domain/transfers/claimTransfer";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function serialize(item, companyNameById = {}) {
  const claimedId = item.assignedSupplierId
    ? String(item.assignedSupplierId)
    : item.claimedByCompanyId
      ? String(item.claimedByCompanyId)
      : null;
  const quote = item.quoteSnapshot;
  return {
    ...item,
    _id: item._id.toString(),
    status: normalizeTransferStatus(item.status),
    claimedByCompanyId: claimedId,
    assignedSupplierId: claimedId,
    claimedByCompanyName: claimedId
      ? companyNameById[claimedId] || claimedId
      : null,
    assignedCarId: item.assignedCarId ? String(item.assignedCarId) : null,
    isOpen: isTransferOpenStatus(item.status) && !claimedId,
    customerPriceMinor: quote?.customerPriceMinor ?? null,
    supplierPayoutMinor: quote?.supplierPayoutMinor ?? null,
    platformMarginMinor: quote?.platformMarginMinor ?? null,
    pricingMethod: quote?.pricingMethod ?? null,
    currency: quote?.currency || "EUR",
    paymentStatus: item.payment?.status || null,
    paymentCheckoutUrl: item.payment?.checkoutUrl || null,
    paymentCollectionMode: item.payment?.collectionMode || null,
    paymentOnSiteAmountMinor: item.payment?.onSiteAmountMinor ?? null,
  };
}

function serializeForViewer(item, companyNameById, { isSuperAdmin, ownerId }) {
  const serialized = serialize(item, companyNameById);
  if (isSuperAdmin) return serialized;

  const claimedByThisCompany =
    Boolean(ownerId) &&
    serialized.claimedByCompanyId &&
    String(serialized.claimedByCompanyId) === String(ownerId);

  if (claimedByThisCompany) return serialized;

  return redactUnclaimedPartnerPii(serialized);
}

export async function GET(request) {
  const { session, errorResponse } = await requireAdmin(request);
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(request.url);
  const status = String(searchParams.get("status") || "").trim();
  const countryParam = normalizeAdminCountryFilter(
    searchParams.get("country") || getSiteCountryConfig().country
  );
  const limit = Math.min(
    200,
    Math.max(1, Number(searchParams.get("limit")) || 100)
  );

  try {
    await connectToDB();
    const user = session.user;
    let filter = {};

    if (isSuperAdminUser(user)) {
      if (status === "open") {
        filter = {
          status: { $in: TRANSFER_OPEN_STATUSES },
          $or: [
            { assignedSupplierId: null },
            { assignedSupplierId: { $exists: false } },
          ],
        };
      } else if (status) {
        filter.status = status;
      }
      if (countryParam !== "ALL") {
        filter.country = countryParam;
      }
    } else {
      const ownerId = getSessionOwnerId(user);
      if (!ownerId) {
        return json({ success: false, message: "Forbidden" }, 403);
      }
      const company = await Company.findById(ownerId).select("country").lean();
      const companyCountry = String(company?.country || "").toUpperCase();
      filter = {
        $or: [
          {
            status: { $in: TRANSFER_OPEN_STATUSES },
            country: companyCountry,
            $or: [
              { assignedSupplierId: null },
              { assignedSupplierId: { $exists: false } },
            ],
          },
          { assignedSupplierId: ownerId },
          { claimedByCompanyId: ownerId },
        ],
      };
      if (status === "claimed" || status === TRANSFER_STATUS.CLAIMED) {
        filter = {
          $or: [
            { assignedSupplierId: ownerId },
            { claimedByCompanyId: ownerId },
          ],
          status: {
            $in: [TRANSFER_STATUS.CLAIMED, "claimed"],
          },
        };
      } else if (status === "open") {
        filter = {
          status: { $in: TRANSFER_OPEN_STATUSES },
          country: companyCountry,
          $or: [
            { assignedSupplierId: null },
            { assignedSupplierId: { $exists: false } },
          ],
        };
      } else if (status) {
        filter = {
          $or: [
            { assignedSupplierId: ownerId },
            { claimedByCompanyId: ownerId },
          ],
          status,
        };
      }
    }

    const items = await Transfer.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const companyIds = [
      ...new Set(
        items
          .map((i) =>
            i.assignedSupplierId
              ? String(i.assignedSupplierId)
              : i.claimedByCompanyId
                ? String(i.claimedByCompanyId)
                : ""
          )
          .filter(Boolean)
      ),
    ];
    const companies = companyIds.length
      ? await Company.find({ _id: { $in: companyIds } })
          .select("name")
          .lean()
      : [];
    const companyNameById = {};
    for (const c of companies) {
      companyNameById[String(c._id)] = c.name;
    }

    return json({
      success: true,
      country: countryParam,
      items: items.map((item) =>
        serializeForViewer(item, companyNameById, {
          isSuperAdmin: isSuperAdminUser(user),
          ownerId: isSuperAdminUser(user) ? null : getSessionOwnerId(user),
        })
      ),
    });
  } catch (error) {
    console.error("[admin/transfers] list failed", error);
    return json({ success: false, message: error.message }, 500);
  }
}
