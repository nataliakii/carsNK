"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * Подтверждение выхода из модалки заказа при несохранённых изменениях.
 */
export default function OrderUnsavedCloseDialog({
  open,
  onClose,
  onDiscard,
  onSaveAndExit,
  saving = false,
}) {
  const { t } = useTranslation();
  const cancelLabel = t("basic.cancel");
  const cancelButtonLabel =
    cancelLabel.charAt(0).toUpperCase() + cancelLabel.slice(1);

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          maxWidth: 473,
        },
      }}
    >
      <DialogContent sx={{ px: 3, pt: 3, pb: 2 }}>
        {t("order.unsavedChangesMessage")}
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          pt: 0,
          gap: 1,
          flexWrap: "nowrap",
          justifyContent: { xs: "space-between", sm: "center" },
          "& > button": {
            whiteSpace: "nowrap",
            minWidth: { xs: 0, sm: "auto" },
            flex: { xs: 1, sm: "0 0 auto" },
            px: { xs: 1.5, sm: 2.25 },
          },
          "& > button:first-of-type, & > button:last-of-type": {
            flex: { xs: 1.35, sm: "0 0 auto" },
          },
          "& > button:nth-of-type(2)": {
            flex: { xs: 0.9, sm: "0 0 auto" },
            px: { xs: 1.5, sm: 2 },
          },
        }}
      >
        <Button
          variant="contained"
          color="primary"
          onClick={onDiscard}
          disabled={saving}
        >
          {t("order.leaveWithoutSaving")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onClose}
          disabled={saving}
        >
          {cancelButtonLabel}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onSaveAndExit}
          disabled={saving}
        >
          {saving ? t("order.processing") : t("order.leaveWithSaving")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
