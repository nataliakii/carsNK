"use client";

import React from "react";
import { styled } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";

import { BOOKING_DETAILS_LABEL_COLUMN } from "@/domain/admin/bookingDetailsLayout";

const FieldRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, max-content) minmax(0, 1fr)",
  gap: theme.spacing(0.75),
  alignItems: "baseline",
  padding: theme.spacing(0.2, 0),
  borderBottom: `1px solid ${theme.palette.divider}`,
  "&:last-of-type": { borderBottom: "none" },
}));

const FieldLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  overflowWrap: "break-word",
  wordBreak: "normal",
  fontSize: "0.72rem",
  lineHeight: 1.3,
  maxWidth: BOOKING_DETAILS_LABEL_COLUMN,
}));

const FieldValue = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "strong",
})(({ theme, strong }) => ({
  color: theme.palette.text.primary,
  fontWeight: strong
    ? theme.typography.fontWeightBold
    : theme.typography.fontWeightMedium,
  overflowWrap: "break-word",
  wordBreak: "normal",
  fontSize: "0.8125rem",
  lineHeight: 1.35,
  minWidth: 0,
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
