"use client";

import React from "react";
import { styled } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";

import { BOOKING_DETAILS_LABEL_COLUMN } from "@/domain/admin/bookingDetailsLayout";

const FieldRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: theme.spacing(0.25),
  padding: theme.spacing(0.75, 0),
  borderBottom: `1px solid ${theme.palette.divider}`,
  "&:last-of-type": { borderBottom: "none" },
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: `minmax(0, ${BOOKING_DETAILS_LABEL_COLUMN}px) minmax(0, 1fr)`,
    alignItems: "baseline",
    gap: theme.spacing(2),
  },
}));

const FieldLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  overflowWrap: "anywhere",
}));

const FieldValue = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "strong",
})(({ theme, strong }) => ({
  color: theme.palette.text.primary,
  fontWeight: strong
    ? theme.typography.fontWeightBold
    : theme.typography.fontWeightMedium,
  overflowWrap: "anywhere",
}));

/**
 * A read-only label/value pair.
 *
 * Read-only data is rendered as semantic text, never as a disabled input, so
 * it is not mistaken for something that could be edited.
 */
const SummaryField = ({ label, value, strong = false, children }) => {
  const hasValue = children != null || (value != null && value !== "");
  if (!hasValue) return null;
  return (
    <FieldRow component="div">
      <FieldLabel variant="body2" component="dt">
        {label}
      </FieldLabel>
      <FieldValue variant="body2" component="dd" strong={strong ? 1 : 0}>
        {children ?? value}
      </FieldValue>
    </FieldRow>
  );
};

export const SummaryList = styled(Box)(({ theme }) => ({
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0),
}));

export default SummaryField;
