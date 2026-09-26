"use client";

import { Chip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { paymentStatusChipForOrder } from "@/domain/orders/bookingPaymentStatus";

export const paymentLinkExpiredChipSx = {
  bgcolor: "warning.light",
  color: "warning.contrastText",
  borderColor: "warning.main",
  fontWeight: 700,
};

export default function BookingPaymentStatusChip({
  order,
  chip,
  size = "small",
  variant = "filled",
  sx,
}) {
  const { t } = useTranslation();
  const resolved = chip || paymentStatusChipForOrder(order);
  if (!resolved) return null;

  return (
    <Chip
      size={size}
      variant={variant}
      label={t(resolved.labelKey, { defaultValue: resolved.label })}
      sx={{ ...paymentLinkExpiredChipSx, ...sx }}
    />
  );
}
