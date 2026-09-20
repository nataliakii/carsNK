import { NextResponse } from "next/server";

import { connectToDB } from "@lib/database";
import AlternativeVehicleOffer from "@models/AlternativeVehicleOffer";
import { decideAlternativeVehicle } from "@/domain/booking/alternativeVehicle";
import { extractAuditContext } from "@/domain/legal/auditTrail";
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
 *
 * The offer id is the unguessable capability; no customer contact details are
 * returned, so a leaked link cannot be used to harvest personal data.
 */
export async function GET(_request, { params }) {
  const { offerId } = await params;
  await connectToDB();

  const offer = await AlternativeVehicleOffer.findOne({ offerId }).lean();
  if (!offer) {
    return NextResponse.json(
      { success: false, message: "Offer not found" },
      { status: 404 }
    );
  }

  const expired = offer.status === "OFFERED" && offer.expiresAt <= new Date();

  return NextResponse.json({
    success: true,
    offer: {
      offerId: offer.offerId,
      status: expired ? "EXPIRED" : offer.status,
      vehicle: offer.vehicle,
      priceMinor: offer.priceMinor,
      originalPriceMinor: offer.originalPriceMinor,
      currency: offer.currency,
      depositMinor: offer.depositMinor,
      insurance: offer.insurance,
      pickup: offer.pickup,
      reasonForReplacement: offer.reasonForReplacement,
      expiresAt: offer.expiresAt,
      /** The customer must know a refund is due if they decline a paid booking. */
      afterPayment: offer.afterPayment,
      decidedAt: offer.decidedAt,
    },
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
    offerId,
    accept: decision === "accept",
    ipAddress,
    userAgent,
    declineReason: String(body?.reason || ""),
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
  });
}
