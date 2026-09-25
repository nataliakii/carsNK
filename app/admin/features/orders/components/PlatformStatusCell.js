"use client";

import { Button, Stack, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  PLATFORM_BOOKING_STATUS,
  canPlatformConfirmBooking,
  getPlatformBookingStatus,
} from "@/domain/orders/supplierResponseStatus";

export default function PlatformStatusCell({
  order,
  isClient,
  busy,
  onToggleConfirm,
}) {
  const { t } = useTranslation();
  const platform = getPlatformBookingStatus(order);
  const canConfirm = isClient ? canPlatformConfirmBooking(order) : !order.confirmed;
  const canUnconfirm = order.confirmed === true;

  let label = t("table.platformPending");
  if (platform === PLATFORM_BOOKING_STATUS.CONFIRMED) label = t("table.platformConfirmed");
  if (platform === PLATFORM_BOOKING_STATUS.CANCELLED) label = t("table.platformCancelled");

  if (!isClient) {
    return (
      <Tooltip title={t("table.internalOrderHint")}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 600, color: "text.secondary", maxWidth: 88 }}
        >
          {t("table.internalNotRovaro")}
        </Typography>
      </Tooltip>
    );
  }

  return (
    <Stack spacing={0.5} alignItems="center">
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      {canConfirm ? (
        <Button
          size="small"
          variant="contained"
          disabled={busy}
          onClick={onToggleConfirm}
          sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
        >
          {t("table.confirmBooking")}
        </Button>
      ) : null}
      {canUnconfirm ? (
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={onToggleConfirm}
          sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
        >
          {t("table.cancelConfirmation")}
        </Button>
      ) : null}
    </Stack>
  );
}
