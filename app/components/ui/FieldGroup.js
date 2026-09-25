"use client";

import React from "react";
import { styled } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";

/** Related fields pair up on anything wider than a phone. */
const DEFAULT_COLUMNS = 2;
const DEFAULT_ROW_BREAKPOINT = "sm";

const GroupRoot = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  minWidth: 0,
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
}));

const GroupHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "baseline",
  gap: theme.spacing(1),
  paddingBottom: theme.spacing(0.5),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const GroupTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.primary,
}));

const GroupBody = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
  minWidth: 0,
}));

/**
 * A row of fields that share one line on a wide screen and stack on a narrow
 * one. `minmax(0, 1fr)` columns are what keep a long value — an email address,
 * an address suggestion list — from pushing the row past the modal edge.
 */
export const FieldRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== "columns" && prop !== "breakpoint",
})(
  ({
    theme,
    columns = DEFAULT_COLUMNS,
    breakpoint = DEFAULT_ROW_BREAKPOINT,
  }) => ({
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(1.5),
    width: "100%",
    minWidth: 0,
    [theme.breakpoints.up(breakpoint)]: {
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: theme.spacing(2),
    },
  })
);

/** Vertical rhythm between groups, so every modal separates them identically. */
export const FieldGroupStack = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
  minWidth: 0,
}));

/**
 * A titled block of related data.
 *
 * The internal order form and the platform booking view both group their data
 * with this, so editable fields and read-only `SummaryField` rows end up inside
 * the same frame, heading and divider instead of two look-alike layouts.
 */
const FieldGroup = ({ title, children, ...rest }) => (
  <GroupRoot {...rest}>
    {title ? (
      <GroupHeader>
        <GroupTitle variant="subtitle2">{title}</GroupTitle>
      </GroupHeader>
    ) : null}
    <GroupBody>{children}</GroupBody>
  </GroupRoot>
);

export default FieldGroup;
