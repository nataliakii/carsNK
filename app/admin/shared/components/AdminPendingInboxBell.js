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
import {
  adminInboxBadges,
  adminInboxGroups,
} from "@/domain/orders/inboxView";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";
import { usePendingPartnerReviews } from "@app/hooks/usePendingPartnerReviews";
import GavelIcon from "@mui/icons-material/Gavel";
import { ROLE } from "@/domain/orders/admin-rbac";
import { useAdminViewAs } from "@app/hooks/useAdminViewAs";

const GROUP_ITEM_ICONS = {
  rentals: <DirectionsCarIcon fontSize="small" />,
  transfers: <AirportShuttleIcon fontSize="small" />,
};

/** Booking rows show their own count; setup tasks show their action line. */
function itemSecondary(t, item) {
  if (item.descriptionKey) {
    return t(item.descriptionKey, {
      defaultValue: item.description,
      ...(item.descriptionParams || null),
    });
  }
  if (!item.count) return t("inbox.none", { defaultValue: "None pending" });
  if (item.id === "rentals") {
    return t("inbox.bookingsNeedAttention", {
      defaultValue: "{{count}} bookings need attention",
      count: item.count,
    });
  }
  return t("inbox.pendingCount", {
    defaultValue: "{{count}} pending",
    count: item.count,
  });
}

/**
 * Admin inbox bell: badge = booking tasks + company setup tasks.
 * Toasts when the pending count increases while the tab is open.
 */
export default function AdminPendingInboxBell() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session, status } = useSession();
  const isAdmin = Boolean(session?.user?.isAdmin);
  const isSuperAdmin = Number(session?.user?.role) === ROLE.SUPERADMIN;
  const { active: viewAsActive } = useAdminViewAs();
  const { country } = useAdminCountryFilter();
  const inbox = useAdminPendingInbox({
    enabled: isAdmin && status === "authenticated",
    country,
  });
  const { arrival, dismissArrival, refresh } = inbox;
  const legalPending = usePendingPartnerReviews({
    enabled: isSuperAdmin && !viewAsActive && status === "authenticated",
    country,
  });

  const platformMode = isSuperAdmin && !viewAsActive;
  /** Same response the navbar badges read. */
  const badges = adminInboxBadges(inbox);
  const groups = adminInboxGroups(inbox, {
    includeCompanySetup: !platformMode,
  });
  /** Company: server total (bookings + setup). Platform: that total plus partner reviews. */
  const total = badges.bell + (platformMode ? legalPending : 0);

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
        {groups.map((group) => [
          <Box key={`${group.id}-label`} sx={{ px: 2, pt: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {t(group.labelKey, { defaultValue: group.label })}
            </Typography>
          </Box>,
          ...(group.items.length
            ? group.items.map((item) => (
                <MenuItem key={item.id} onClick={() => go(item.href)}>
                  {GROUP_ITEM_ICONS[item.id] ? (
                    <ListItemIcon>{GROUP_ITEM_ICONS[item.id]}</ListItemIcon>
                  ) : null}
                  <ListItemText
                    primary={t(item.titleKey, { defaultValue: item.title })}
                    secondary={itemSecondary(t, item)}
                  />
                  {item.count > 0 ? (
                    <Typography
                      variant="body2"
                      color="error"
                      sx={{ fontWeight: 700 }}
                    >
                      {item.count}
                    </Typography>
                  ) : null}
                </MenuItem>
              ))
            : [
                <MenuItem key={`${group.id}-empty`} disabled>
                  <ListItemText
                    primary={t("inbox.none", { defaultValue: "None pending" })}
                  />
                </MenuItem>,
              ]),
        ])}
        {platformMode ? (
          <MenuItem onClick={() => go("/admin/partners?tab=review")}>
            <ListItemIcon>
              <GavelIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={t("header.partners", { defaultValue: "Partners" })}
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
