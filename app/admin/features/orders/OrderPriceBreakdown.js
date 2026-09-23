"use client";

import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  formatReconciledBreakdownRows,
  formatReconciledEuro,
  reconcileAuthoritativePriceBreakdown,
} from "@/domain/orders/priceBreakdownReconciliation";

export default function OrderPriceBreakdown({
  order,
  priceBreakdown,
  locale = "en",
  isSuperAdmin = false,
}) {
  const rec = reconcileAuthoritativePriceBreakdown(
    {
      ...order,
      priceBreakdown,
    },
    { locale }
  );
  const rows = formatReconciledBreakdownRows(rec, locale);
  const showExpand = rows.length > 6;
  const gapMinor = rec.unclassifiedLegacyMinor || rec.unexplainedDifferenceMinor;
  const warning =
    isSuperAdmin && gapMinor
      ? `Price breakdown differs from stored total by ${formatReconciledEuro(Math.abs(gapMinor))}`
      : "";

  const body = (
    <Box
      sx={{
        fontSize: "0.8rem",
        lineHeight: 1.45,
        "& .row": {
          display: "flex",
          justifyContent: "space-between",
          gap: 2,
        },
        "& .total": {
          fontWeight: 700,
          borderTop: "1px solid",
          borderColor: "divider",
          mt: 0.5,
          pt: 0.5,
        },
      }}
    >
      {rows.map((row) => (
        <Typography
          key={`${row.code}-${row.label}`}
          className="row"
          variant="body2"
          sx={{ fontSize: "inherit", color: row.legacy ? "warning.main" : "text.secondary" }}
        >
          <span>{row.label}</span>
          <span>
            {row.free && !row.minor
              ? rec.labels.free
              : formatReconciledEuro(row.minor)}
          </span>
        </Typography>
      ))}
      <Typography className="row total" variant="body2" sx={{ fontSize: "inherit" }}>
        <span>Total</span>
        <span>{formatReconciledEuro(rec.totalMinor)}</span>
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ mt: 1, mb: 1 }}>
      {warning ? (
        <Alert severity="warning" sx={{ mb: 1, py: 0.5 }}>
          {warning}
        </Alert>
      ) : null}
      {showExpand ? (
        <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2">Price details</Typography>
          </AccordionSummary>
          <AccordionDetails>{body}</AccordionDetails>
        </Accordion>
      ) : (
        body
      )}
    </Box>
  );
}
