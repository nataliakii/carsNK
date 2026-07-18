"use client";

import React, { useRef, useState, useCallback } from "react";
import { Box, Button, Typography, CircularProgress, Paper } from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import { alpha, useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { uploadOrderDrivingLicence } from "@utils/action";
import { MAX_DRIVING_LICENCE_URLS } from "@/domain/orders/normalizeDrivingLicenceUrls";
import DrivingLicenceImageGallery from "./DrivingLicenceImageGallery";

/**
 * @param {{
 *   customerName?: string;
 *   email?: string;
 *   rentalStartDate?: string;
 *   urls: string[];
 *   onUrlsChange: (urls: string[]) => void;
 *   disabled?: boolean;
 *   emphasized?: boolean;
 *   showGalleryPreviewHint?: boolean;
 * }} props
 */
export default function DrivingLicenceUploadField({
  customerName = "",
  email = "",
  rentalStartDate = "",
  urls = [],
  onUrlsChange,
  disabled = false,
  emphasized = false,
  showGalleryPreviewHint = true,
  hideTitle = false,
  hideHint = false,
  uploadButtonLabel,
  uploadButtonSideNote,
  frameLabel,
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const emphasizedBackground = alpha(theme.palette.primary.main, 0.06);

  const canAddMore = urls.length < MAX_DRIVING_LICENCE_URLS;
  const hasStartDate = Boolean(String(rentalStartDate || "").trim());
  const pickDisabled =
    disabled || uploading || !canAddMore || !hasStartDate;

  const handlePickClick = useCallback(() => {
    setError("");
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e) => {
      const list = e.target.files;
      if (!list?.length) return;
      setError("");
      const files = Array.from(list).filter((f) => f && f.size > 0);
      e.target.value = "";

      const remaining = MAX_DRIVING_LICENCE_URLS - urls.length;
      const toUpload = files.slice(0, Math.max(0, remaining));
      if (toUpload.length === 0) return;

      setUploading(true);
      const next = [...urls];
      try {
        for (const file of toUpload) {
          if (next.length >= MAX_DRIVING_LICENCE_URLS) break;
          const url = await uploadOrderDrivingLicence({
            file,
            customerName,
            email,
            rentalStartDate,
          });
          if (!next.includes(url)) next.push(url);
        }
        onUrlsChange(next);
      } catch (err) {
        setError(
          err?.message || t("order.drivingLicenceUploadFailed")
        );
      } finally {
        setUploading(false);
      }
    },
    [urls, onUrlsChange, customerName, email, rentalStartDate, t]
  );

  const removeAt = useCallback(
    (index) => {
      onUrlsChange(urls.filter((_, i) => i !== index));
    },
    [urls, onUrlsChange]
  );

  const titleTypography = hideTitle
    ? null
    : emphasized ? (
        <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {t("order.drivingLicence")}
        </Typography>
      ) : (
        <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
          {t("order.drivingLicence")}
        </Typography>
      );

  const hintTypography = hideHint ? null : (
    <Typography
      variant={emphasized ? "body2" : "caption"}
      color="text.secondary"
      display="block"
      sx={{ mb: emphasized ? 1.25 : 1, mt: emphasized ? 0.25 : 0 }}
    >
      {t("order.drivingLicenceHint")}
    </Typography>
  );

  const needDatesWarning = !hasStartDate ? (
    <Typography
      variant={emphasized ? "body2" : "caption"}
      color="warning.main"
      display="block"
      sx={{ mb: 1 }}
    >
      {t("order.drivingLicenceNeedDates")}
    </Typography>
  ) : null;

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
      multiple
      style={{ display: "none" }}
      onChange={handleFileChange}
    />
  );

  const uploadButton = (
    <Button
      variant={emphasized ? "contained" : "outlined"}
      color="primary"
      size={emphasized ? "medium" : "small"}
      disabled={pickDisabled}
      onClick={handlePickClick}
      startIcon={
        uploading ? (
          <CircularProgress size={emphasized ? 20 : 16} color="inherit" />
        ) : emphasized ? (
          <AddPhotoAlternateIcon />
        ) : null
      }
    >
      {uploading
        ? t("order.drivingLicenceUploading")
        : uploadButtonLabel || t("order.drivingLicenceAddPhoto")}
    </Button>
  );

  const uploadControls = canAddMore
    ? uploadButtonSideNote ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          {uploadButton}
          <Typography
            variant={emphasized ? "body2" : "caption"}
            color="text.secondary"
            sx={{ whiteSpace: "nowrap" }}
          >
            {uploadButtonSideNote}
          </Typography>
        </Box>
      ) : (
        uploadButton
      )
    : null;

  const galleryBlock =
    urls.length > 0 ? (
      <Box sx={{ mt: emphasized ? 2 : 1.5 }}>
        <DrivingLicenceImageGallery
          urls={urls}
          onRemove={disabled || uploading ? undefined : removeAt}
          removeDisabled={disabled || uploading}
          showPreviewHint={showGalleryPreviewHint}
        />
      </Box>
    ) : null;

  const errorBlock = error ? (
    <Typography
      variant="caption"
      color="error"
      display="block"
      sx={{ mt: 1 }}
    >
      {error}
    </Typography>
  ) : null;

  if (emphasized) {
    const showHeader = Boolean(titleTypography || hintTypography);
    const showFrameLabel = Boolean(frameLabel);

    return (
      <Paper
        component={showFrameLabel ? "fieldset" : "div"}
        variant="outlined"
        sx={{
          minWidth: 0,
          m: 0,
          px: { xs: 1.75, sm: 2 },
          pb: { xs: 1.75, sm: 2 },
          pt: showHeader ? { xs: 1.75, sm: 2 } : { xs: 1.1, sm: 1.25 },
          mb: 2,
          borderRadius: 2,
          borderWidth: 2,
          borderColor: "primary.main",
          bgcolor: emphasizedBackground,
          boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.12)} inset`,
        }}
      >
        {showFrameLabel && (
          <Box
            component="legend"
            sx={{
              display: "table",
              width: "auto",
              maxWidth: "100%",
              px: 0.75,
              mx: 0.5,
              whiteSpace: "nowrap",
              color: "primary.main",
              fontSize: theme.typography.caption.fontSize,
              fontWeight: 500,
              lineHeight: 1,
            }}
          >
            {frameLabel}
          </Box>
        )}
        {showHeader && (
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              mb: 0.5,
            }}
          >
            <AddPhotoAlternateIcon
              color="primary"
              sx={{ fontSize: 32, flexShrink: 0, mt: 0.15 }}
              aria-hidden
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {titleTypography}
              {hintTypography}
            </Box>
          </Box>
        )}
        {needDatesWarning}
        {fileInput}
        {uploadControls}
        {errorBlock}
        {galleryBlock}
      </Paper>
    );
  }

  return (
    <Box sx={{ mb: 1 }}>
      {titleTypography}
      {hintTypography}
      {needDatesWarning}
      {fileInput}
      {uploadControls}
      {errorBlock}
      {galleryBlock}
    </Box>
  );
}
