"use client";

import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

export default function PartnerSupportMessagesList({ orderId, isSuperAdmin }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!orderId || !isSuperAdmin) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/order/support-message?orderId=${encodeURIComponent(orderId)}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(json.items)) {
          setItems(json.items);
        }
      } catch {
        /* history is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, isSuperAdmin]);

  if (!isSuperAdmin || items.length === 0) return null;

  return (
    <Box>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontWeight: 600, display: "block", mb: 0.75 }}
      >
        {t("partnerSupport.historyTitle", {
          defaultValue: "Partner messages to Rovaro support",
        })}
      </Typography>
      {items.map((item) => (
        <Box
          key={item.id}
          sx={{
            mb: 1,
            p: 1,
            borderRadius: 1,
            bgcolor: "action.hover",
            fontSize: "0.8rem",
          }}
        >
          <Typography variant="caption" display="block" color="text.secondary">
            {item.createdAt
              ? new Date(item.createdAt).toLocaleString()
              : ""}
            {item.reason ? ` · ${item.reason}` : ""}
            {item.emailStatus ? ` · ${item.emailStatus}` : ""}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {item.message}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
