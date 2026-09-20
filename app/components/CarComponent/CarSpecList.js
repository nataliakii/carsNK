"use client";

import React from "react";
import { Box, Typography } from "@mui/material";
import Image from "next/image";

/**
 * Presentation layer for car specification rows.
 * Data comes from domain/cars/carSpecs.js so the catalog card and the
 * details modal render identical labels/values.
 */

/** Muted, uppercase caption used above every spec block. */
export function CarSpecCaption({ children, sx }) {
  return (
    <Typography
      component="h6"
      sx={{
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "text.secondary",
        mb: 0.75,
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}

/**
 * One spec row: fixed-width icon, flexible label, right-aligned value.
 * The fixed icon box and the right-aligned value are what keep every row on a
 * consistent baseline and every value in the same optical column.
 */
export function CarSpecRow({ item, dense = false }) {
  const labelOnly = item.labelOnly || !item.value;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        minWidth: 0,
        py: dense ? 0.25 : 0.4,
        gridColumn: labelOnly ? { xs: "auto", md: "1 / -1" } : "auto",
      }}
    >
      <Box
        sx={{
          position: "relative",
          flex: "0 0 auto",
          width: 18,
          height: 18,
          opacity: 0.7,
        }}
      >
        <Image
          src={item.icon}
          alt=""
          aria-hidden="true"
          fill
          sizes="18px"
          style={{ objectFit: "contain" }}
        />
      </Box>

      <Typography
        component="span"
        sx={{
          flex: "1 1 auto",
          minWidth: 0,
          fontSize: { xs: "0.76rem", sm: "0.8rem" },
          lineHeight: 1.35,
          color: labelOnly ? "text.primary" : "text.secondary",
          fontWeight: labelOnly ? 600 : 400,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={item.label}
      >
        {item.label}
      </Typography>

      {labelOnly ? null : (
        <Typography
          component="span"
          sx={{
            // Never shrink: the label absorbs any overflow, values stay whole.
            flex: "0 0 auto",
            fontSize: { xs: "0.78rem", sm: "0.82rem" },
            lineHeight: 1.35,
            fontWeight: 600,
            color: "text.primary",
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          {item.value}
        </Typography>
      )}
    </Box>
  );
}

/**
 * Two columns from `md` up, single column below. Between `sm` and `md` the
 * card is already split into two columns, so a second spec column would leave
 * ~170px per row and start clipping labels.
 */
export function CarSpecGrid({ items, columns = 2, dense = false }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: `repeat(${columns}, minmax(0, 1fr))`,
        },
        columnGap: 2,
        rowGap: 0.25,
        minWidth: 0,
      }}
    >
      {items.map((item) => (
        <CarSpecRow key={item.key} item={item} dense={dense} />
      ))}
    </Box>
  );
}

/** Caption + grid. Pass `title={null}` to render the grid on its own. */
export default function CarSpecSection({
  title,
  items,
  columns = 2,
  dense = false,
  sx,
}) {
  if (!items?.length) return null;
  return (
    <Box sx={{ width: "100%", minWidth: 0, ...sx }}>
      {title ? <CarSpecCaption>{title}</CarSpecCaption> : null}
      <CarSpecGrid items={items} columns={columns} dense={dense} />
    </Box>
  );
}
