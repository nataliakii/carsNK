"use client";

import { useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  Typography,
} from "@mui/material";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import AirportShuttleIcon from "@mui/icons-material/AirportShuttle";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import { useAdminPendingInbox } from "@app/hooks/useAdminPendingInbox";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";
import { usePendingPartnerReviews } from "@app/hooks/usePendingPartnerReviews";
import GavelIcon from "@mui/icons-material/Gavel";
import { ROLE } from "@/domain/orders/admin-rbac";
import { useAdminViewAs } from "@app/hooks/useAdminViewAs";
import { legalNavHref } from "@/domain/legal/companyLegalPage";

/**
 * Admin inbox bell: badge = unprocessed rentals + transfers.
 * Toasts when the pending count increases while the tab is open.
 */
export default function AdminPendingInboxBell() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAdmin = Boolean(session?.user?.isAdmin);
  const isSuperAdmin = Number(session?.user?.role) === ROLE.SUPERADMIN;
  const { active: viewAsActive } = useAdminViewAs();
  const legalHref = legalNavHref({
    role: session?.user?.role,
    companyContextActive: viewAsActive,
  });
  const { country } = useAdminCountryFilter();
  const {
    rentals,
    transfers,
    total: inboxTotal,
    arrival,
    dismissArrival,
    refresh,
  } = useAdminPendingInbox({
    enabled: isAdmin && status === "authenticated",
    country,
  });
  const legalPending = usePendingPartnerReviews({
    enabled: isSuperAdmin && !viewAsActive && status === "authenticated",
    country,
  });

  /** Bell ≠ Orders badge: inbox (rentals+transfers) + legal reviews, once each. */
  const total = inboxTotal + (isSuperAdmin && !viewAsActive ? legalPending : 0);

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const baseTitleRef = useRef("");

  // Keep tab title in sync with pending count
  useEffect(() => {
    if (!isAdmin || typeof document === "undefined") return undefined;
    if (!baseTitleRef.current) {
      baseTitleRef.current = document.title.replace(/^\(\d+\+?\)\s*/, "");
    }
    const base = baseTitleRef.current || "Admin";
    document.title =
      total > 0 ? `(${total > 99 ? "99+" : total}) ${base}` : base;
  }, [isAdmin, total]);

  // Browser notification when count rises (only if already granted)
  useEffect(() => {
    if (!arrival || typeof window === "undefined") return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    try {
      const n = new Notification(
        t("inbox.newOrdersTitle", {
          defaultValue: "New orders",
          count: arrival.delta,
        }),
        {
          body: t("inbox.newOrdersBody", {
            defaultValue:
              "{{rentals}} rentals · {{transfers}} transfers pending",
            rentals: arrival.rentals,
            transfers: arrival.transfers,
          }),
          tag: "rovaro-pending-inbox",
        }
      );
      n.onclick = () => {
        window.focus();
        router.push("/admin/orders");
        n.close();
      };
    } catch {
      // ignore
    }
  }, [arrival, router, t]);

  if (!isAdmin) return null;

  const go = (href) => {
    setAnchorEl(null);
    router.push(href);
  };

  return (
    <>
      <IconButton
        color="inherit"
        size="small"
        aria-label={t("inbox.pendingAria", {
          defaultValue: "Pending orders",
          count: total,
        })}
        onClick={(e) => {
          setAnchorEl(e.currentTarget);
          refresh();
        }}
        sx={{
          color: "rgba(255,255,255,0.9)",
          "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
        }}
      >
        <Badge
          badgeContent={total > 99 ? "99+" : total}
          color="error"
          overlap="circular"
          invisible={total <= 0}
        >
          <NotificationsNoneIcon fontSize="small" />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { minWidth: 260, mt: 1 } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {t("inbox.title", { defaultValue: "Unprocessed orders" })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {total > 0
              ? t("inbox.summary", {
                  defaultValue: "{{count}} need attention",
                  count: total,
                })
              : t("inbox.empty", { defaultValue: "All caught up" })}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => go("/admin/orders")}>
          <ListItemIcon>
            <DirectionsCarIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={t("header.carRentals", { defaultValue: "Car rentals" })}
            secondary={
              rentals > 0
                ? t("inbox.pendingCount", {
                    defaultValue: "{{count}} pending",
                    count: rentals,
                  })
                : t("inbox.none", { defaultValue: "None pending" })
            }
          />
          {rentals > 0 ? (
            <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
              {rentals}
            </Typography>
          ) : null}
        </MenuItem>
        <MenuItem onClick={() => go("/admin/orders?tab=transfers")}>
          <ListItemIcon>
            <AirportShuttleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={t("header.transfers", { defaultValue: "Transfers" })}
            secondary={
              transfers > 0
                ? t("inbox.pendingCount", {
                    defaultValue: "{{count}} pending",
                    count: transfers,
                  })
                : t("inbox.none", { defaultValue: "None pending" })
            }
          />
          {transfers > 0 ? (
            <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
              {transfers}
            </Typography>
          ) : null}
        </MenuItem>
        {isSuperAdmin ? (
          <MenuItem onClick={() => go(legalHref)}>
            <ListItemIcon>
              <GavelIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={t("header.legal", { defaultValue: "Legal" })}
              secondary={
                legalPending > 0
                  ? t("inbox.pendingCount", {
                      defaultValue: "{{count}} pending",
                      count: legalPending,
                    })
                  : t("inbox.none", { defaultValue: "None pending" })
              }
            />
            {legalPending > 0 ? (
              <Typography variant="body2" color="error" sx={{ fontWeight: 700 }}>
                {legalPending}
              </Typography>
            ) : null}
          </MenuItem>
        ) : null}
      </Menu>

      <Snackbar
        open={Boolean(arrival)}
        autoHideDuration={8000}
        onClose={dismissArrival}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{ top: { xs: 72, sm: 80 } }}
      >
        <Alert
          onClose={dismissArrival}
          severity="info"
          variant="filled"
          sx={{ width: "100%", cursor: "pointer" }}
          onClick={() => {
            dismissArrival();
            router.push(
              (arrival?.transfers || 0) > (arrival?.rentals || 0)
                ? "/admin/orders?tab=transfers"
                : "/admin/orders"
            );
          }}
        >
          {t("inbox.toastNew", {
            defaultValue: "New order received — {{count}} unprocessed",
            count: arrival?.total ?? arrival?.delta ?? total,
          })}
        </Alert>
      </Snackbar>
    </>
  );
}
