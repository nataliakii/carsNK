"use client";

import { useState } from "react";
import { Box, Collapse, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

function euro(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "€0.00";
  return `€${value.toFixed(2)}`;
}

function euroMinor(minor) {
  return euro((Number(minor) || 0) / 100);
}

function moneyLabel(amount, { pending = false } = {}) {
  if (pending) return "To be confirmed";
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) return "Free";
  return euro(value);
}

function Row({ label, value, strong = false, dense = false }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        gap: 2,
        py: dense ? 0.1 : 0.2,
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontWeight: strong ? 700 : 400, fontSize: dense ? "0.85rem" : undefined }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: strong ? 700 : 500,
          whiteSpace: "nowrap",
          fontSize: dense ? "0.85rem" : undefined,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Compact booking totals. Collapsed by default: Total + Pay now once.
 * Expand for the line-item breakdown (no second Pay now / Total).
 */
export default function BookingPriceDetails({
  summary,
  parts,
  split,
  pickupMethod = "office",
  returnMethod = "office",
  pickupVerified = true,
  returnVerified = true,
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = "booking-price-details-panel";
  const total = euro(summary?.totalPrice);
  const payNow = split ? euroMinor(split.platformAmountMinor) : null;
  const payAtPickup = split ? euroMinor(split.supplierBalanceMinor) : null;
  const base =
    parts?.baseRentalMinor != null
      ? euroMinor(parts.baseRentalMinor)
      : euro(summary?.rentalPrice);
  const insurance = Number(parts?.insuranceMinor || 0);
  const extras = Number(parts?.extrasMinor || 0);
  const discount = Number(parts?.discountMinor || 0);
  const pickupPending = pickupMethod === "delivery" && !pickupVerified;
  const returnPending = returnMethod === "delivery" && !returnVerified;
  const estimated = pickupPending || returnPending;

  return (
    <Box
      data-testid="price-details"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        px: 1.25,
        py: 0.75,
        mb: 1.25,
        maxWidth: "100%",
      }}
    >
      <Box
        component="button"
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((prev) => !prev)}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          border: 0,
          background: "none",
          p: 0,
          m: 0,
          cursor: "pointer",
          font: "inherit",
          color: "inherit",
        }}
      >
        <Typography component="span" sx={{ fontSize: "0.9rem", fontWeight: 700 }}>
          Booking summary
        </Typography>
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 150ms",
            color: "text.secondary",
          }}
        />
      </Box>

      <Box sx={{ mt: 0.35 }}>
        <Row label="Total" value={total} strong dense />
        {payNow ? <Row label="Pay now" value={payNow} strong dense /> : null}
        {estimated ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", lineHeight: 1.3 }}
          >
            Estimated — delivery charge to be confirmed.
          </Typography>
        ) : null}
        {payAtPickup && !expanded ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", lineHeight: 1.3 }}
          >
            Remaining {payAtPickup} paid to the supplier.
          </Typography>
        ) : null}
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box id={panelId} sx={{ pt: 0.5, borderTop: "1px dashed", borderColor: "divider", mt: 0.5 }}>
          <Row label="Base rental" value={base} dense />
          <Row
            label="Pick-up"
            value={
              pickupMethod === "office"
                ? "Free"
                : moneyLabel(summary?.pickupDeliveryCost, { pending: pickupPending })
            }
            dense
          />
          <Row
            label="Return collection"
            value={
              returnMethod === "office"
                ? "Free"
                : moneyLabel(summary?.returnDeliveryCost, { pending: returnPending })
            }
            dense
          />
          {insurance > 0 ? <Row label="Insurance" value={euroMinor(insurance)} dense /> : null}
          {extras > 0 ? <Row label="Extras" value={euroMinor(extras)} dense /> : null}
          {discount > 0 ? (
            <Row label="Discounts" value={`−${euroMinor(discount)}`} dense />
          ) : null}
          {payAtPickup ? <Row label="Pay at pickup" value={payAtPickup} dense /> : null}
        </Box>
      </Collapse>
    </Box>
  );
}
