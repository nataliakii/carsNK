import { Box, Typography, Button } from "@mui/material";
import Link from "next/link";
import { connectToDB } from "@lib/database";
import { getStripeClient } from "@/lib/stripe";
import { markRentalPaidFromCheckoutSession } from "@/domain/orders/rentalStripeCheckout";
import { BRAND } from "@config/brand";

export const dynamic = "force-dynamic";

async function confirmSession(sessionId) {
  if (!sessionId) return { ok: false };
  try {
    await connectToDB();
    const stripe = getStripeClient();
    if (!stripe) return { ok: false };
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return { ok: false };
    await markRentalPaidFromCheckoutSession(session);
    return { ok: true };
  } catch (err) {
    console.error("[order pay success]", err?.message || err);
    return { ok: false };
  }
}

export default async function OrderPaySuccessPage({ searchParams }) {
  const confirmed = await confirmSession(searchParams?.session_id || "");
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
        {confirmed.ok ? "Prepayment received" : "Thanks — processing payment"}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
        {confirmed.ok
          ? `Your rental prepayment with ${brand} is recorded. Any remaining balance is paid at pickup.`
          : "If you completed checkout, confirmation usually arrives within a minute."}
      </Typography>
      <Button component={Link} href="/" variant="contained" sx={{ mt: 1 }}>
        Back to home
      </Button>
    </Box>
  );
}
