import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import { sendTelegramDirect } from "@/lib/telegram/sendDirect";
import { notifyTransferEmails } from "@/domain/transfers/notifyTransferEmails";
import { createTransferOrder } from "@/domain/transfers/createTransferOrder";
import { pickPublicTransferPayload } from "@/domain/transfers/transferPayloadPolicy";
import { resolveMarketCountry } from "@/domain/platform/marketCountry";
import { BRAND } from "@config/brand";
import { formatMinor } from "@/domain/money/minorUnits";
import {
  consumePublicPostOrError,
  transferRateLimitOptions,
} from "@/services/publicPostRateLimit";

export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status });
}

function formatTransferTelegram(doc) {
  const when = doc.datetime
    ? new Date(doc.datetime).toISOString().replace("T", " ").slice(0, 16)
    : "";
  const brand = BRAND?.name || "Platform";
  const quote = doc.quoteSnapshot;
  const priceLine =
    quote?.customerPriceMinor != null
      ? `Price: ${formatMinor(quote.customerPriceMinor, quote.currency || "EUR")} (${quote.pricingMethod})`
      : null;
  const distanceLine =
    doc.distanceKm != null
      ? `Distance: ${doc.distanceKm} km${
          doc.durationMinutes != null ? ` (~${doc.durationMinutes} min)` : ""
        }`
      : null;
  return [
    `🚕 ${brand} — new transfer request`,
    `From: ${doc.from}`,
    `To: ${doc.to}`,
    distanceLine,
    priceLine,
    `When: ${when}`,
    `Passengers: ${doc.passengers}`,
    `Status: ${doc.status}`,
    doc.customerName ? `Name: ${doc.customerName}` : null,
    doc.phone ? `Phone: ${doc.phone}` : null,
    doc.email ? `Email: ${doc.email}` : null,
    doc.notes ? `Notes: ${doc.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON" }, 400);
  }

  const safePayload = pickPublicTransferPayload(payload);

  try {
    await connectToDB();
    const limited = await consumePublicPostOrError(
      request,
      transferRateLimitOptions()
    );
    if (limited) return json(limited.body, limited.status);
    const result = await createTransferOrder(safePayload, {
      marketCountry: resolveMarketCountry(request),
    });
    if (!result.ok) {
      return json(
        { success: false, message: result.message, code: result.code },
        result.status || 400
      );
    }

    const doc = result.transfer;

    try {
      await sendTelegramDirect(formatTransferTelegram(doc));
    } catch (err) {
      console.error("[transfer] telegram failed", err?.message || err);
    }

    if (doc.status !== "MANUAL_QUOTE_REQUIRED") {
      try {
        await notifyTransferEmails(doc.toObject ? doc.toObject() : doc);
      } catch (err) {
        console.error("[transfer] email failed", err?.message || err);
      }
    } else {
      try {
        await notifyTransferEmails(doc.toObject ? doc.toObject() : doc);
      } catch (err) {
        console.error("[transfer] email failed", err?.message || err);
      }
    }

    const quote = result.quote;
    return json(
      {
        success: true,
        id: doc._id.toString(),
        status: doc.status,
        requiresManualQuote: result.requiresManualQuote,
        distanceKm: doc.distanceKm,
        durationMinutes: doc.durationMinutes,
        vehicleCategory: doc.vehicleCategory,
        quote: quote
          ? {
              customerPriceMinor: quote.customerPriceMinor,
              currency: quote.currency,
              pricingMethod: quote.pricingMethod,
              isProvisional: quote.isProvisional,
            }
          : null,
      },
      201
    );
  } catch (error) {
    console.error("[transfer] create failed", error);
    return json(
      { success: false, message: error.message || "Failed to create transfer" },
      500
    );
  }
}
