"use client";

import { useEffect, useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import Link from "next/link";

export default function PaymentStatusClient({
  initialPhase,
  orderNumber,
}) {
  const [phase, setPhase] = useState(initialPhase || "pending");

  useEffect(() => {
    if (phase === "paid") return undefined;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id") || "";
    if (!sessionId) return undefined;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/order/pay/status?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!cancelled && data?.phase === "paid") {
          setPhase("paid");
        }
      } catch {
        /* keep pending */
      }
    };

    tick();
    const timer = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [phase]);

  const paid = phase === "paid";

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
        {paid ? "Booking confirmed" : "Payment is being confirmed"}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
        {paid
          ? `Booking confirmed${orderNumber ? ` (ref ${orderNumber})` : ""}. Pay the rest at pickup.`
          : "If you completed checkout, confirmation usually arrives within a minute."}
      </Typography>
      <Button component={Link} href="/" variant="contained" sx={{ mt: 1 }}>
        Back to home
      </Button>
    </Box>
  );
}
