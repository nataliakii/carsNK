"use client";

import { useState } from "react";
import {
  Box,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import {
  bookingFeeTable,
  renderBookingFeeTable,
} from "@/domain/legal/bookingFeeOutcomes";
import { legalDocumentLayout } from "@/domain/legal/contentSanitizer";

const COL_MIN_WIDTH = 160;

/**
 * One Booking Fee outcomes table.
 *
 * Public Terms page: width is 100% of MainContainer only (never 100vw /
 * negative margins). Mobile scrolls horizontally inside the table wrapper.
 * `compact` collapses it before payment (booking / admin).
 */
export default function BookingFeeOutcomesTable({
  language = "en",
  compact = false,
  viewport,
}) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("sm"), {
    defaultMatches: false,
    noSsr: true,
  });
  const resolvedViewport =
    viewport || (compact && isNarrow ? "mobile" : "desktop");
  const [open, setOpen] = useState(!compact);
  const table = bookingFeeTable(language);
  const rendered = renderBookingFeeTable(language);
  const layout = legalDocumentLayout(resolvedViewport);
  const stacked = compact && layout.tableDisplay === "stacked";
  // Public (non-compact) always uses a real table with internal overflow so
  // the page never grows horizontally past MainContainer.
  const needsHorizontalScroll = !stacked;

  const body = stacked ? (
    <Box>
      {rendered.rows.map((row) => (
        <Box
          key={row.situation}
          sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {row.situation}
          </Typography>
          <Typography variant="body2">
            {table.columns[1]}: {row.bookingFee}
          </Typography>
          <Typography variant="body2">
            {table.columns[2]}: {row.supplierConsequence}
          </Typography>
        </Box>
      ))}
    </Box>
  ) : (
    <Table
      size="small"
      aria-label={table.title}
      sx={{
        width: "100%",
        minWidth: needsHorizontalScroll ? COL_MIN_WIDTH * table.columns.length : 0,
        tableLayout: "auto",
      }}
    >
      <TableHead>
        <TableRow>
          {table.columns.map((column) => (
            <TableCell
              key={column}
              component="th"
              scope="col"
              sx={{
                fontWeight: 700,
                minWidth: COL_MIN_WIDTH,
                whiteSpace: "nowrap",
              }}
            >
              {column}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rendered.rows.map((row) => (
          <TableRow key={row.situation}>
            <TableCell sx={{ minWidth: COL_MIN_WIDTH }}>{row.situation}</TableCell>
            <TableCell sx={{ minWidth: COL_MIN_WIDTH }}>{row.bookingFee}</TableCell>
            <TableCell sx={{ minWidth: COL_MIN_WIDTH }}>
              {row.supplierConsequence}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <Box
      data-testid="booking-fee-outcomes-table"
      sx={{
        my: compact ? 1.5 : 3,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        ...(compact
          ? null
          : {
              p: { xs: 1.5, sm: 2, md: 2.5 },
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
            }),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Typography
          variant={compact ? "subtitle2" : "h6"}
          sx={{ fontWeight: 800 }}
        >
          {table.title}
        </Typography>
        {compact ? (
          <IconButton
            size="small"
            aria-label={table.title}
            onClick={() => setOpen((value) => !value)}
            sx={{ transform: open ? "rotate(180deg)" : "none" }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Box>
      <Collapse in={open}>
        <Box
          sx={{
            overflowX: needsHorizontalScroll ? "auto" : "visible",
            WebkitOverflowScrolling: "touch",
            mt: 1,
            maxWidth: "100%",
          }}
        >
          {body}
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 1 }}
        >
          {table.footnote}
        </Typography>
      </Collapse>
    </Box>
  );
}
