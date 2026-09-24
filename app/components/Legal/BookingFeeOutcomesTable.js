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
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import {
  bookingFeeTable,
  renderBookingFeeTable,
} from "@/domain/legal/bookingFeeOutcomes";
import { legalDocumentLayout } from "@/domain/legal/contentSanitizer";

/**
 * One Booking Fee outcomes table. `compact` collapses it before payment.
 */
export default function BookingFeeOutcomesTable({
  language = "en",
  compact = false,
  viewport = "desktop",
}) {
  const [open, setOpen] = useState(!compact);
  const table = bookingFeeTable(language);
  const rendered = renderBookingFeeTable(language);
  const layout = legalDocumentLayout(viewport);
  const stacked = layout.tableDisplay === "stacked";

  const body = stacked ? (
    <Box>
      {rendered.rows.map((row) => (
        <Box key={row.situation} sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.situation}</Typography>
          <Typography variant="body2">{table.columns[1]}: {row.bookingFee}</Typography>
          <Typography variant="body2">{table.columns[2]}: {row.supplierConsequence}</Typography>
        </Box>
      ))}
    </Box>
  ) : (
    <Table size="small" sx={{ minWidth: layout.horizontalScroll ? 640 : 0 }}>
      <TableHead>
        <TableRow>
          {table.columns.map((column) => (
            <TableCell key={column} sx={{ fontWeight: 700 }}>{column}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rendered.rows.map((row) => (
          <TableRow key={row.situation}>
            <TableCell>{row.situation}</TableCell>
            <TableCell>{row.bookingFee}</TableCell>
            <TableCell>{row.supplierConsequence}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <Box sx={{ my: 1.5, maxWidth: layout.maxWidth }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Typography variant={compact ? "subtitle2" : "h6"} sx={{ fontWeight: 800 }}>
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
        <Box sx={{ overflowX: layout.horizontalScroll ? "auto" : "visible", mt: 1 }}>
          {body}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          {table.footnote}
        </Typography>
      </Collapse>
    </Box>
  );
}
