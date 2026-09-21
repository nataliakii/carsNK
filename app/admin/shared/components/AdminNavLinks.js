"use client";

import Link from "next/link";
import { Box, ListItem, ListItemText, Typography } from "@mui/material";
import PendingCountBadge from "@app/admin/shared/components/PendingCountBadge";

export const adminNavLinkSx = {
  px: { md: 0.85, lg: 1.25 },
  py: 0.35,
  fontSize: { md: 13, lg: 14 },
  fontWeight: 500,
  textTransform: "none",
  whiteSpace: "nowrap",
  lineHeight: 1.2,
  letterSpacing: "0.01em",
  wordSpacing: "0.16em",
  color: "inherit",
  opacity: 0.78,
  borderBottom: "1px solid transparent",
  borderRadius: 0,
  minWidth: "auto",
  "&:hover": {
    opacity: 1,
    backgroundColor: "transparent",
  },
};

export const adminNavActiveSx = {
  opacity: 1,
  fontWeight: 600,
  borderBottom: "1px solid rgba(255,255,255,0.8)",
};

function NavLabel({ label, badge }) {
  if (!badge) return label;
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
    >
      {label}
      <PendingCountBadge count={badge} sx={{ ml: 0 }} />
    </Box>
  );
}

/**
 * Compact admin top-nav items. Desktop = underlined links; drawer = list.
 */
export default function AdminNavLinks({
  items,
  pathname,
  variant = "desktop",
  onNavigate,
}) {
  if (variant === "drawer") {
    return items.map((item) => (
      <ListItem
        key={item.id}
        button
        component={Link}
        href={item.href}
        onClick={onNavigate}
        selected={item.match(pathname)}
      >
        <ListItemText primary={<NavLabel label={item.label} badge={item.badge} />} />
      </ListItem>
    ));
  }

  return items.map((item) => {
    const active = item.match(pathname);
    return (
      <Link
        key={item.id}
        href={item.href}
        className="admin-nav-link"
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Typography
          sx={{
            ...adminNavLinkSx,
            ...(active ? adminNavActiveSx : null),
          }}
        >
          {item.label}
        </Typography>
        {item.badge ? (
          <PendingCountBadge count={item.badge} sx={{ ml: 0 }} />
        ) : null}
      </Link>
    );
  });
}
