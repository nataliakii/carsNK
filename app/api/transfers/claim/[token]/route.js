import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import Transfer, { isTransferOpenStatus } from "@models/Transfer";
import Company from "@models/company";
import { verifyOrResolveClaimToken, markOfferUsed } from "@/domain/transfers/claimToken";
import {
  claimTransferLead,
  publicTransferSummary,
} from "@/domain/transfers/claimTransfer";
import { afterTransferClaimed } from "@/domain/transfers/afterClaim";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

async function loadClaimContext(token) {
  await connectToDB();
  const verified = await verifyOrResolveClaimToken(token);
  if (!verified.ok) {
    return { error: verified.message, status: 400 };
  }
  const transfer = await Transfer.findById(verified.transferId).lean();
  if (!transfer) {
    return { error: "Transfer not found", status: 404 };
  }
  const company = await Company.findById(verified.companyId)
    .select("name email country transferServices")
    .lean();
  if (!company) {
    return { error: "Company not found", status: 404 };
  }
  return { verified, transfer, company };
}

export async function GET(_request, { params }) {
  const token = params?.token;
  const ctx = await loadClaimContext(token);
  if (ctx.error) {
    return json({ success: false, message: ctx.error }, ctx.status || 400);
  }

  const assigned =
    ctx.transfer.assignedSupplierId || ctx.transfer.claimedByCompanyId;
  const available =
    isTransferOpenStatus(ctx.transfer.status) && !assigned;

  const isWinner =
    assigned && String(assigned) === String(ctx.verified.companyId);

  return json({
    success: true,
    available,
    reason: available
      ? null
      : isWinner
        ? "The transfer has been assigned to your company."
        : "Sorry, this transfer has already been accepted by another company.",
    companyName: ctx.company.name,
    transfer: publicTransferSummary(ctx.transfer, {
      revealContact: Boolean(isWinner),
    }),
  });
}

export async function POST(_request, { params }) {
  const token = params?.token;
  const ctx = await loadClaimContext(token);
  if (ctx.error) {
    return json({ success: false, message: ctx.error }, ctx.status || 400);
  }

  const result = await claimTransferLead({
    transferId: ctx.verified.transferId,
    companyId: ctx.verified.companyId,
    claimedByEmail: ctx.company.email,
  });

  if (!result.ok) {
    return json(
      {
        success: false,
        message: result.message,
        code: result.code,
        available: false,
        transfer: publicTransferSummary(result.transfer, {
          revealContact: false,
        }),
      },
      result.code === "taken" ? 409 : 400
    );
  }

  if (ctx.verified.offer?._id && !result.idempotent) {
    await markOfferUsed(ctx.verified.offer._id);
  }

  if (!result.idempotent) {
    try {
      await afterTransferClaimed({
        transfer: result.transfer,
        company: ctx.company,
      });
    } catch (err) {
      console.error("[transfer claim] after-claim failed", err?.message || err);
    }
  }

  return json({
    success: true,
    available: false,
    claimed: true,
    idempotent: Boolean(result.idempotent),
    message:
      result.message || "The transfer has been assigned to your company.",
    transfer: publicTransferSummary(result.transfer, { revealContact: true }),
    companyName: ctx.company.name,
  });
}
