"use client";

import { useState } from "react";
import { Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";

export default function SendMyPasswordResetButton({
  variant = "text",
  size = "small",
  fullWidth = false,
  sx,
}) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/account/send-password-reset", {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        throw new Error(body.message || t("header.resetPasswordFailed"));
      }
      enqueueSnackbar(
        body.message ||
          t("header.resetPasswordSent", { email: body.email || "" }),
        { variant: "success" }
      );
    } catch (err) {
      enqueueSnackbar(err.message || t("header.resetPasswordFailed"), {
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      disabled={busy}
      onClick={send}
      sx={sx}
    >
      {busy
        ? t("header.resetPasswordSending")
        : t("header.resetPasswordEmailMe")}
    </Button>
  );
}
