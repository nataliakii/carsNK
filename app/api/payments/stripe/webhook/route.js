import { NextResponse } from "next/server";
import { connectToDB } from "@lib/database";
import {
  getStripeMode,
  getStripeWebhookSecret,
  isStripeConfigured,
} from "@config/stripe";
import { getStripeClient } from "@/lib/stripe";
import { markTransferPaidFromCheckoutSession } from "@/domain/transfers/stripeCheckout";
import { markRentalPaidFromCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import { createConfirmedBookingSnapshot } from "@/domain/booking/partnerBookingConfirmation";

export const runtime = "nodejs";

/**
 * Stripe webhook — raw body required for signature verification.
 * Configure endpoint: POST /api/payments/stripe/webhook
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded
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

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      const kind = session?.metadata?.kind;
      if (kind === "rental") {
        const result = await markRentalPaidFromCheckoutSession(session);
        if (!result.ok && result.code !== "not_paid") {
          console.error("[stripe webhook] rental pay failed", result);
        }
        // Successful prepayment is what makes the booking binding, so this is
        // where the immutable record of the agreed terms is written. It is
        // idempotent, and a failure here must not fail the webhook.
        if (result.ok && result.order?._id) {
          await createConfirmedBookingSnapshot({
            orderId: String(result.order._id),
          }).catch((err) => {
            console.error(
              "[stripe webhook] booking snapshot failed",
              err?.message || err
            );
          });
        }
      } else if (kind === "transfer") {
        const result = await markTransferPaidFromCheckoutSession(session);
        if (!result.ok && result.code !== "not_paid") {
          console.error("[stripe webhook] transfer pay failed", result);
        }
      }
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
