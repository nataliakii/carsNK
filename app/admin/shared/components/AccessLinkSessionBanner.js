"use client";

import { Alert, Button, Typography } from "@mui/material";
import { signOut, useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";

function formatExpiry(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

/**
 * Persistent notice while a company admin is signed in via a 7-day superlink.
 */
export default function AccessLinkSessionBanner() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user;
  if (!user?.viaAccessLink || user.invalidAccessLink) return null;

  return (
    <Alert
      severity="warning"
      sx={{
        borderRadius: 0,
        py: 0.75,
        "& .MuiAlert-message": { width: "100%" },
      }}
      action={
        <Button
          color="inherit"
          size="small"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          {t("header.logout")}
        </Button>
      }
    >
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {t("header.accessLinkBannerTitle", {
          defaultValue: "Temporary company login link",
        })}
      </Typography>
      <Typography variant="body2">
        {t("header.accessLinkBannerBody", {
          defaultValue:
            "You are in the admin with a 7-day link, not a password. It expires {{when}}.",
          when: formatExpiry(user.accessExpiresAt) || "soon",
        })}
      </Typography>
    </Alert>
  );
}
