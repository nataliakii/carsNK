"use client";

import { useState } from "react";
import { Box, Collapse, Typography, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import BookingFeeOutcomesTable from "@app/components/Legal/BookingFeeOutcomesTable";
import LegalDocumentModal from "@app/components/Legal/LegalDocumentModal";

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

function Row({ label, value, strong = false }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 0.25 }}>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 400 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 500, whiteSpace: "nowrap" }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function BookingPriceDetails({
  summary,
  parts,
  split,
  pickupMethod = "office",
  returnMethod = "office",
  pickupVerified = true,
  returnVerified = true,
}) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"), { defaultMatches: false, noSsr: true });
  const [userExpanded, setUserExpanded] = useState(null);
  const [feeOpen, setFeeOpen] = useState(false);
  const expanded = userExpanded === null ? desktop : userExpanded;
  const panelId = "booking-price-details-panel";
  const total = euro(summary?.totalPrice);
  const payNow = split ? euroMinor(split.platformAmountMinor) : null;
  const payAtPickup = split ? euroMinor(split.supplierBalanceMinor) : null;
  const base = parts?.baseRentalMinor != null ? euroMinor(parts.baseRentalMinor) : euro(summary?.rentalPrice);
  const insurance = Number(parts?.insuranceMinor || 0);
  const extras = Number(parts?.extrasMinor || 0);
  const discount = Number(parts?.discountMinor || 0);
  const pickupPending = pickupMethod === "delivery" && !pickupVerified;
  const returnPending = returnMethod === "delivery" && !returnVerified;
  const estimated = pickupPending || returnPending;

  return (
    <Box
      data-testid="price-details"
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, px: 1.5, py: 1, mb: 1.5, maxWidth: "100%" }}
    >
      <Box
        component="button"
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setUserExpanded(!expanded)}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: 0,
          background: "none",
          p: 0,
          m: 0,
          cursor: "pointer",
          font: "inherit",
          color: "inherit",
        }}
      >
        <Typography component="span" sx={{ fontSize: "0.95rem", fontWeight: 700 }}>
          Booking summary
        </Typography>
        <ExpandMoreIcon
          fontSize="small"
          sx={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
        />
      </Box>
      <Row label="Total" value={total} strong />
      {estimated ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          Estimated — delivery charge to be confirmed.
        </Typography>
      ) : null}
      {payNow ? <Row label="Pay now" value={payNow} strong /> : null}
      {payAtPickup ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          Remaining {payAtPickup} paid to the supplier.
        </Typography>
      ) : null}
      {split ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Rovaro Booking Fee — {payNow}{" "}
          <Box
            component="button"
            type="button"
            onClick={() => setFeeOpen(true)}
            sx={{
              border: 0,
              p: 0,
              background: "none",
              color: "var(--color-text-accent, #c2185b)",
              font: "inherit",
              fontSize: "0.85rem",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            See when the Booking Fee is refunded
          </Box>
        </Typography>
      ) : null}
      <Collapse in={expanded} unmountOnExit>
        <Box id={panelId} sx={{ pt: 0.75 }}>
          <Row label="Base rental" value={base} />
          <Row
            label="Pick-up"
            value={
              pickupMethod === "office"
                ? "Free"
                : moneyLabel(summary?.pickupDeliveryCost, { pending: pickupPending })
            }
          />
          <Row
            label="Return collection"
            value={
              returnMethod === "office"
                ? "Free"
                : moneyLabel(summary?.returnDeliveryCost, { pending: returnPending })
            }
          />
          {insurance > 0 ? <Row label="Insurance" value={euroMinor(insurance)} /> : null}
          {extras > 0 ? <Row label="Extras" value={euroMinor(extras)} /> : null}
          {discount > 0 ? <Row label="Discounts" value={`−${euroMinor(discount)}`} /> : null}
          <Row label="Total" value={total} strong />
          {payNow ? <Row label="Pay now" value={payNow} /> : null}
          {payAtPickup ? <Row label="Pay at pickup" value={payAtPickup} /> : null}
        </Box>
      </Collapse>
      <LegalDocumentModal
        open={feeOpen}
        onClose={() => setFeeOpen(false)}
        title="Booking Fee"
        closeLabel="Close"
      >
        <BookingFeeOutcomesTable language="en" embedded viewport={desktop ? "desktop" : "mobile"} />
      </LegalDocumentModal>
    </Box>
  );
}
