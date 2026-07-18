"use client";

import React, { useMemo } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import dayjs from "dayjs";
import { formatDate } from "@utils/businessTime";
import { getOrderColor } from "@/domain/orders/getOrderColor";

const cardEnter = keyframes`
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

function customerDisplayName(order) {
  if (!order) return "—";
  return (
    order.customerName ||
    order.customer ||
    order.clientName ||
    order.name ||
    "—"
  );
}

function inclusiveRentalDays(order) {
  if (!order?.rentalStartDate || !order?.rentalEndDate) return 1;
  const start = dayjs(order.rentalStartDate).startOf("day");
  const end = dayjs(order.rentalEndDate).startOf("day");
  const d = end.diff(start, "day") + 1;
  return Number.isFinite(d) && d > 0 ? d : 1;
}

function effectiveOrderPrice(order) {
  if (!order) return null;
  if (order.OverridePrice !== null && order.OverridePrice !== undefined) {
    const manual = Number(order.OverridePrice);
    return Number.isFinite(manual) ? manual : null;
  }
  const auto = Number(order.totalPrice);
  return Number.isFinite(auto) ? auto : null;
}

/**
 * Компактная карточка предпросмотра заказа при hover (не модалка, без действий).
 */
export default function OrderHoverPreview({ order, conflictHint = false }) {
  const theme = useTheme();

  const { oc, badgeColor, badgeTextColor, durationLabel, priceLine } =
    useMemo(() => {
      if (!order) {
        return {
          oc: null,
          badgeColor: "#757575",
          badgeTextColor: "#fff",
          durationLabel: "",
          priceLine: null,
        };
      }
      const ocLocal = getOrderColor(order);
      const main = ocLocal.main;
      const contrast =
        typeof theme.palette?.getContrastText === "function"
          ? theme.palette.getContrastText(main)
          : "#fff";

      const days = inclusiveRentalDays(order);
      const durationLabelLocal = `${days} дн.`;

      // Calendar hover must show effective fixed order price (manual override first).
      const price = effectiveOrderPrice(order);
      const priceLineLocal =
        price != null && Number.isFinite(Number(price))
          ? `€${Number(price).toFixed(2)}`
          : null;

      return {
        oc: ocLocal,
        badgeColor: main,
        badgeTextColor: contrast,
        durationLabel: durationLabelLocal,
        priceLine: priceLineLocal,
      };
    }, [order, theme.palette]);

  if (!order) return null;

  const statusLabel = oc?.label ?? "—";
  const startStr = formatDate(order.rentalStartDate, "DD.MM.YYYY");
  const endStr = formatDate(order.rentalEndDate, "DD.MM.YYYY");

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 236,
        boxSizing: "border-box",
        p: 1.25,
        pointerEvents: "none",
        animation: `${cardEnter} 0.18s ease-out`,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
          mb: 0.75,
        }}
      >
        <Typography
          component="div"
          variant="body2"
          sx={{
            fontWeight: 700,
            fontSize: "0.8125rem",
            lineHeight: 1.25,
            color: "text.primary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1,
          }}
        >
          {customerDisplayName(order)}
        </Typography>
        <Box
          component="span"
          sx={{
            flexShrink: 0,
            px: 0.65,
            py: 0.2,
            borderRadius: "6px",
            fontSize: "0.625rem",
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: 0.02,
            textTransform: "none",
            bgcolor: badgeColor,
            color: badgeTextColor,
            maxWidth: 108,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={statusLabel}
        >
          {statusLabel}
        </Box>
      </Box>

      <Typography
        variant="body2"
        sx={{
          fontSize: "0.75rem",
          fontWeight: 500,
          color: "text.primary",
          lineHeight: 1.35,
          mb: 0.25,
        }}
      >
        {startStr}
        <Box component="span" sx={{ mx: 0.35, color: "text.disabled" }}>
          →
        </Box>
        {endStr}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontSize: "0.6875rem",
          color: "text.secondary",
          lineHeight: 1.3,
          mb: priceLine || conflictHint ? 0.5 : 0,
        }}
      >
        {durationLabel}
      </Typography>

      {(priceLine || conflictHint) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: priceLine ? "space-between" : "flex-end",
            gap: 1,
            pt: 0.5,
            mt: 0.25,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          {priceLine ? (
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                color: "text.secondary",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {priceLine}
            </Typography>
          ) : null}
          {conflictHint ? (
            <Typography
              component="span"
              variant="caption"
              sx={{
                flexShrink: 0,
                fontSize: "0.75rem",
                color: "warning.dark",
                fontWeight: 700,
              }}
              title="На эту дату есть пересечение по машине"
            >
              ⚠
            </Typography>
          ) : null}
        </Box>
      )}
    </Box>
  );
}
