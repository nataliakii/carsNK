import { NextResponse } from "next/server";

import { decideAlternativeVehicle } from "@/domain/booking/alternativeVehicle";
import { buildAlternativeOfferView } from "@/domain/booking/alternativeVehicleView";
import { extractAuditContext } from "@/domain/legal/auditTrail";
import { normalizeOfferCapabilityId } from "@/domain/booking/alternativeOfferCore";
import {
  consumePublicPostOrError,
  alternativeDecisionRateLimitOptions,
} from "@/services/publicPostRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Customer-facing alternative vehicle offer.
 *
 *   GET  — read the offer. Read-only; viewing never accepts anything.
 *   POST — record the customer's explicit accept or decline.
 */
export async function GET(_request, { params }) {
  const { offerId } = await params;
  const capabilityId = normalizeOfferCapabilityId(offerId);
  if (!capabilityId) {
    return NextResponse.json(
      { success: false, message: "Offer not found" },
      { status: 404 }
    );
  }
  const view = await buildAlternativeOfferView(capabilityId);
  if (!view) {
    return NextResponse.json(
      { success: false, message: "Offer not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    offer: view,
  });
}

export async function POST(request, { params }) {
  const limited = await consumePublicPostOrError(
    request,
    alternativeDecisionRateLimitOptions()
  );
  if (limited) {
    return NextResponse.json(limited.body, { status: limited.status });
  }

  const { offerId } = await params;
  const capabilityId = normalizeOfferCapabilityId(offerId);
  if (!capabilityId) {
    return NextResponse.json(
      { success: false, message: "Offer not found" },
      { status: 404 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON" },
      { status: 400 }
    );
  }

  const decision = String(body?.decision || "");
  if (decision !== "accept" && decision !== "decline") {
    return NextResponse.json(
      { success: false, message: "decision must be accept or decline" },
      { status: 400 }
    );
  }

  const { ipAddress, userAgent } = extractAuditContext(request);
  const result = await decideAlternativeVehicle({
    offerId: capabilityId,
    accept: decision === "accept",
    ipAddress,
    userAgent,
    declineReason: String(body?.reason || ""),
    termsAccepted:
      body?.termsAccepted === true ||
      body?.termsAccepted === "true" ||
      body?.termsAccepted === "yes",
  });

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message, code: result.code },
      { status: result.status || 400 }
    );
  }

  return NextResponse.json({
    success: true,
    status: result.status,
    idempotent: Boolean(result.idempotent),
    refundRequired: Boolean(result.refundRequired),
    paymentUrl: result.paymentUrl || "",
    paymentLinkGenerationFailed: Boolean(result.paymentLinkGenerationFailed),
  });
}
