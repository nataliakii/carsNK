/**
 * BufferSettingsModal
 *
 * Modal to configure the minimum buffer hours between rental return and next pickup.
 */

"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Box,
  Button,
  Alert,
  IconButton,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { useMainContext } from "@app/Context";
import { updateCompanyBuffer } from "@utils/action";

export default function BufferSettingsModal({ open, onClose }) {
  const { t } = useTranslation();
  const { company, updateCompanyInContext } = useMainContext();
  const currentBufferTime =
    company?.bufferTime != null ? Number(company.bufferTime) : undefined;
  const [bufferHours, setBufferHours] = useState(currentBufferTime ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setBufferHours(currentBufferTime != null ? currentBufferTime : "");
      setError(null);
      setSuccess(false);
    }
  }, [open, currentBufferTime]);

  const handleSave = async () => {
    if (!company?._id) {
      setError(t("calendar.bufferModal.errors.companyMissing"));
      return;
    }

    const bufferValue = Number(bufferHours);

    if (isNaN(bufferValue) || bufferValue < 0 || bufferValue > 24) {
      setError(t("calendar.bufferModal.errors.invalidRange"));
      return;
    }

    if (currentBufferTime != null && bufferValue === currentBufferTime) {
      setError(t("calendar.bufferModal.errors.unchanged"));
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateCompanyBuffer(company._id, bufferValue);

      if (!result.success) {
        throw new Error(
          result.error || t("calendar.bufferModal.errors.saveFailed")
        );
      }

      setSuccess(true);

      if (result.data) {
        await updateCompanyInContext(company._id, result.data);
      } else {
        await updateCompanyInContext(company._id);
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Error saving bufferTime:", err);
      setError(err.message || t("calendar.bufferModal.errors.saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pb: 1,
        }}
      >
        <Typography variant="h6" component="span">
          {t("calendar.bufferModal.title")}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label={t("basic.close", { defaultValue: "Close" })}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("calendar.bufferModal.intro")}
          </Typography>
          <Typography
            component="ul"
            variant="body2"
            color="text.secondary"
            sx={{ pl: 2, mb: 2 }}
          >
            <li>{t("calendar.bufferModal.bullets.check")}</li>
            <li>{t("calendar.bufferModal.bullets.refuel")}</li>
            <li>{t("calendar.bufferModal.bullets.clean")}</li>
            <li>{t("calendar.bufferModal.bullets.docs")}</li>
          </Typography>
        </Box>

        <TextField
          label={t("calendar.bufferModal.hoursLabel")}
          type="number"
          value={bufferHours}
          onChange={(e) => setBufferHours(Number(e.target.value))}
          fullWidth
          size="small"
          inputProps={{ min: 0, max: 24, step: 1 }}
          sx={{ mb: 2 }}
        />

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            {t("calendar.bufferModal.currentValue", {
              hours: currentBufferTime ?? "—",
            })}
            {company?.bufferTime !== undefined ? (
              <span
                style={{
                  color: "#666",
                  fontSize: "0.875rem",
                  marginLeft: "8px",
                }}
              >
                {t("calendar.bufferModal.fromDatabase")}
              </span>
            ) : (
              <span
                style={{
                  color: "#666",
                  fontSize: "0.875rem",
                  marginLeft: "8px",
                }}
              >
                {t("calendar.bufferModal.fallbackValue")}
              </span>
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("calendar.bufferModal.affectsConflicts")}
          </Typography>
        </Alert>

        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        ) : null}

        {success ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t("calendar.bufferModal.updated", { hours: bufferHours })}
            </Typography>
          </Alert>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          color="inherit"
          disabled={loading}
        >
          {t("calendar.bufferModal.cancel")}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color="primary"
          disabled={
            loading ||
            bufferHours === "" ||
            isNaN(Number(bufferHours)) ||
            (currentBufferTime != null &&
              Number(bufferHours) === currentBufferTime)
          }
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading
            ? t("calendar.bufferModal.saving")
            : t("calendar.bufferModal.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
