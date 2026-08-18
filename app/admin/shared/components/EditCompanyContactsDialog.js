"use client";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useTranslation } from "react-i18next";

export default function EditCompanyContactsDialog({
  open,
  busy = false,
  name,
  email,
  tel,
  baseLat = "",
  baseLon = "",
  lockName = false,
  onNameChange,
  onEmailChange,
  onTelChange,
  onBaseLatChange,
  onBaseLonChange,
  onClose,
  onSave,
}) {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>{t("companyProfile.editDialogTitle")}</DialogTitle>
      <DialogContent>
        <Stack gap={1.5} sx={{ pt: 1 }}>
          <TextField
            label={t("companyProfile.companyName")}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            autoFocus={!lockName}
            fullWidth
            disabled={lockName}
            helperText={lockName ? t("companyProfile.mainBrandLocked") : undefined}
          />
          <TextField
            label={t("companyProfile.email")}
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            fullWidth
          />
          <TextField
            label={t("companyProfile.phone")}
            value={tel}
            onChange={(e) => onTelChange(e.target.value)}
            fullWidth
          />
          <TextField
            label={t("companyProfile.baseLat")}
            type="number"
            value={baseLat}
            onChange={(e) => onBaseLatChange(e.target.value)}
            fullWidth
            inputProps={{ step: "any" }}
          />
          <TextField
            label={t("companyProfile.baseLon")}
            type="number"
            value={baseLon}
            onChange={(e) => onBaseLonChange(e.target.value)}
            fullWidth
            inputProps={{ step: "any" }}
            helperText={t("companyProfile.baseCoordsHelper")}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("basic.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={busy || !name.trim()}
          sx={{ textTransform: "none" }}
        >
          {t("basic.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
