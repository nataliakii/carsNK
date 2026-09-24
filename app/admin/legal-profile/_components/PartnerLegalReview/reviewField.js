"use client";

import { Stack, Typography } from "@mui/material";

export function formatPartnerDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function Field({ label, value }) {
  if (!value) return null;
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ py: 0.5 }}
      justifyContent="space-between"
    >
      <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}
