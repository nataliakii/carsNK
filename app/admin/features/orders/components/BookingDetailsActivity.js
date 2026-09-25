"use client";

import { useEffect, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return String(value);
  }
}

function describeEvent(event, t) {
  if (event.action === "ORDER_CALENDAR_RELOCATED") {
    const before = event.orderData?.before || {};
    const after = event.orderData?.after || {};
    const carPart =
      before.carNumber || after.carNumber
        ? `${before.carNumber || "—"} → ${after.carNumber || "—"}`
        : "";
    return (
      t("bookingDetails.activity.relocated", {
        defaultValue: "Calendar relocate{{car}}",
        car: carPart ? ` (${carPart})` : "",
      }) + (event.metadata?.kind ? ` · ${event.metadata.kind}` : "")
    );
  }
  return event.action || "—";
}

/**
 * Compact superadmin activity timeline for Booking Details.
 */
export default function BookingDetailsActivity({ orderId }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!orderId) return undefined;
    let alive = true;
    setLoading(true);
    setError("");
    fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/activity`, {
      credentials: "include",
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok || !body?.success) {
          setError(body?.message || t("bookingDetails.activity.loadFailed"));
          setEvents([]);
          return;
        }
        setEvents(Array.isArray(body.events) ? body.events.slice().reverse() : []);
      })
      .catch(() => {
        if (!alive) return;
        setError(t("bookingDetails.activity.loadFailed"));
        setEvents([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [orderId, t]);

  return (
    <Box>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <CircularProgress size={20} />
        </Box>
      ) : null}
      {error ? (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      ) : null}
      {!loading && !error && events.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          {t("bookingDetails.activity.empty")}
        </Typography>
      ) : null}
      <Box
        component="ul"
        sx={{
          m: 0,
          p: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
          maxHeight: 220,
          overflowY: "auto",
        }}
      >
        {events.map((event) => (
          <Box
            component="li"
            key={event.id}
            sx={{
              borderBottom: "1px solid",
              borderColor: "divider",
              pb: 0.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{ display: "block", fontWeight: 700, color: "text.primary" }}
            >
              {describeEvent(event, t)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatWhen(event.createdAt)}
              {event.userEmail ? ` · ${event.userEmail}` : ""}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
