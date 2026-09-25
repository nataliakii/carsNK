import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import {
  getStripeMode,
  getStripeWebhookSecret,
  isStripeConfigured,
} from "@config/stripe";
import { getStripeClient } from "@/lib/stripe";
import { markTransferPaidFromCheckoutSession } from "@/domain/transfers/stripeCheckout";
import {
  handleRentalCheckoutExpired,
  handleRentalPaymentFailed,
  markRentalPaidEmailsSent,
  markRentalPaidFromCheckoutSession,
  recordRentalRefundOrDispute,
} from "@/domain/orders/rentalStripeCheckout";
import { createConfirmedBookingSnapshot } from "@/domain/booking/partnerBookingConfirmation";
import { sendPaidConfirmationEmails } from "@/domain/orders/marketplaceBookingEmails";

export const runtime = "nodejs";

async function finalizePaidRental(result) {
  if (!result?.ok || !result.order?._id) return;
  if (result.idempotent && result.order.payment?.paidEmailsSentAt) return;

  await createConfirmedBookingSnapshot({
    orderId: String(result.order._id),
  }).catch((err) => {
    console.error("[stripe webhook] booking snapshot failed", err?.message || err);
  });

  if (result.order.payment?.paidEmailsSentAt) return;

  try {
    const mailed = await sendPaidConfirmationEmails({ order: result.order });
    if (mailed?.settled) {
      await markRentalPaidEmailsSent(result.order._id);
    }
  } catch (err) {
    console.error("[stripe webhook] paid emails failed", err?.message || err);
  }
}

/**
 * Stripe webhook — raw body required for signature verification.
 * Configure endpoint: POST /api/payments/stripe/webhook
 *
 * Paid events confirm the booking. Verification mismatches are audited and
 * still return { received: true } so Stripe does not retry a dangerous pay.
 */
export async function POST(request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { success: false, message: "Stripe not configured" },
      { status: 503 }
    );
  }

  const mode = getStripeMode();
  const webhookSecret = getStripeWebhookSecret(mode);
  if (!webhookSecret) {
    return NextResponse.json(
      { success: false, message: "Webhook secret missing" },
      { status: 503 }
    );
  }

  const stripe = getStripeClient(mode);
  if (!stripe) {
    return NextResponse.json(
      { success: false, message: "Stripe client unavailable" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { success: false, message: "Missing stripe-signature" },
      { status: 400 }
    );
  }

  let event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] signature failed", err?.message || err);
    return NextResponse.json(
      { success: false, message: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    await connectToDB();
    const object = event.data?.object || {};
    const kind = object?.metadata?.kind;

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      if (kind === "rental" || (!kind && object?.metadata?.orderId)) {
        const result = await markRentalPaidFromCheckoutSession(object, {
          eventId: event.id,
        });
        if (!result.ok && result.code !== "not_paid") {
          console.error("[stripe webhook] rental pay failed", result);
        }
        if (result.ok) {
          await finalizePaidRental(result);
        }
      } else if (kind === "transfer") {
        const result = await markTransferPaidFromCheckoutSession(object);
        if (!result.ok && result.code !== "not_paid") {
          console.error("[stripe webhook] transfer pay failed", result);
        }
      }
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      if (kind === "rental" || object?.metadata?.orderId) {
        if (event.type === "checkout.session.expired") {
          await handleRentalCheckoutExpired(object);
        } else {
          await handleRentalPaymentFailed(object);
        }
      }
    } else if (
      event.type === "charge.refunded" ||
      event.type === "refund.created" ||
      event.type === "charge.dispute.created" ||
      event.type === "charge.dispute.updated" ||
      event.type === "charge.dispute.closed"
    ) {
      await recordRentalRefundOrDispute(event.type, object, {
        eventId: event.id,
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe webhook] handler failed", err);
    return NextResponse.json(
      { success: false, message: err.message || "Webhook handler failed" },
      { status: 500 }
    );
  }
}
