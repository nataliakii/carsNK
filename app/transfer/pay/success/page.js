import { Box, Typography, Button } from "@mui/material";
import Link from "next/link";
import { connectToDB } from "@lib/database";
import { getStripeClient } from "@/lib/stripe";
import { markTransferPaidFromCheckoutSession } from "@/domain/transfers/stripeCheckout";
import { BRAND } from "@config/brand";

export const dynamic = "force-dynamic";

async function confirmSession(sessionId) {
  if (!sessionId) return { ok: false };
  try {
    await connectToDB();
    const stripe = getStripeClient();
    if (!stripe) return { ok: false, message: "Stripe not configured" };
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return { ok: false, message: "Payment not completed yet" };
    }
    await markTransferPaidFromCheckoutSession(session);
    return { ok: true };
  } catch (err) {
    console.error("[transfer pay success]", err?.message || err);
    return { ok: false, message: err.message };
  }
}

export default async function TransferPaySuccessPage({ searchParams }) {
  const sessionId = searchParams?.session_id || "";
  const confirmed = await confirmSession(sessionId);
  const brand = BRAND?.name || "Rovaro";

  return (
    <Box
      sx={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        px: 3,
        textAlign: "center",
      }}
    >
      <Typography variant="h4" component="h1" fontWeight={700}>
        {confirmed.ok ? "Payment received" : "Thanks — processing payment"}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
        {confirmed.ok
          ? `Your transfer with ${brand} is confirmed. You will receive an email shortly.`
          : "If you completed checkout, confirmation usually arrives within a minute. You can close this page."}
      </Typography>
      <Button component={Link} href="/" variant="contained" sx={{ mt: 1 }}>
        Back to home
      </Button>
    </Box>
  );
}
