"use client";

import React from "react";
import { styled } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";

const TagRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== "emphasis",
})(({ theme, emphasis }) => ({
  display: "inline-flex",
  alignItems: "baseline",
  alignSelf: "flex-start",
  gap: theme.spacing(0.75),
  maxWidth: "100%",
  padding: theme.spacing(0.25, 1),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${
    emphasis ? theme.palette.primary.main : theme.palette.divider
  }`,
  backgroundColor: theme.palette.background.paper,
}));

const TagLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
}));

const TagValue = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightBold,
  overflowWrap: "anywhere",
}));

/**
 * A money figure that belongs to the field above it — a delivery charge, a
 * surcharge — shown as its own element rather than as helper text that reads
 * like a hint and disappears into the form.
 */
const PriceTag = ({ label, value, emphasis = false, ...rest }) => {
  if (value == null || value === "") return null;
  return (
    <TagRoot emphasis={emphasis ? 1 : 0} {...rest}>
      {label ? <TagLabel variant="caption">{label}</TagLabel> : null}
      <TagValue variant="body2">{value}</TagValue>
    </TagRoot>
  );
};

export default PriceTag;
