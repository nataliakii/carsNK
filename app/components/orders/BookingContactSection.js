"use client";

import React from "react";
import { Box, Checkbox, FormControlLabel } from "@mui/material";
import { useTranslation } from "react-i18next";
import { BookingTextField } from "@/app/components/ui";
import DrivingLicenceUploadField from "@/app/components/ui/inputs/DrivingLicenceUploadField";

/**
 * Shared contact + licences + messengers section for admin/client booking modals.
 */
export default function BookingContactSection({
  mode = "client",
  values,
  onFieldChange,
  rentalStartDate = "",
  disabled = false,
  secondDriverPriceLabelValue,
  errors = {},
  drivingLicenceEmphasized = true,
  compactDrivingLicenceUpload = false,
  drivingLicenceUploadButtonLabel,
  drivingLicenceUploadButtonSideNote,
  showDrivingLicencePreviewHint = true,
  drivingLicenceFrameLabel,
}) {
  const { t } = useTranslation();
  const isAdmin = mode === "admin";

  const nameLabel = isAdmin ? (
    t("order.name")
  ) : (
    <>
      <span>{t("order.yourName")}</span>
      <span style={{ color: "red" }}>*</span>
    </>
  );

  const phoneLabel = isAdmin ? (
    t("order.phone")
  ) : (
    <>
      <span>{t("order.phone")}</span>
      <span style={{ color: "red" }}>*</span>
    </>
  );

  const emailLabel = isAdmin ? (
    t("order.email")
  ) : (
    <>
      {t("order.email")}
      <span
        style={{
          color: "green",
          fontWeight: 500,
          marginLeft: 8,
        }}
      >
        {t("basic.optional")}
      </span>
    </>
  );

  return (
    <Box sx={{ mb: 0 }}>
      <Box className={!isAdmin && errors?.name ? "booking-field-shake" : ""}>
        <BookingTextField
          label={nameLabel}
          value={values.customerName || ""}
          onChange={(e) => onFieldChange("customerName", e.target.value)}
          required
          error={Boolean(errors?.name)}
          helperText={errors?.name}
          sx={{ mb: 1 }}
          fullWidth
        />
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: 2,
          mb: 0,
        }}
      >
        <BookingTextField
          label={phoneLabel}
          value={values.phone || ""}
          onChange={(e) => onFieldChange("phone", e.target.value)}
          required
          placeholder={t("order.phoneHint")}
          error={Boolean(errors?.phone)}
          helperText={errors?.phone}
          sx={{ mb: 1, flex: 1, minHeight: 36 }}
        />
        <BookingTextField
          label={emailLabel}
          value={values.email || ""}
          onChange={(e) => onFieldChange("email", e.target.value)}
          type="email"
          error={Boolean(errors?.email)}
          helperText={errors?.email}
          sx={{ mb: 1, flex: 1, minHeight: 36 }}
        />
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 2,
          mt: 0.25,
          mb: 0.5,
          flexWrap: "nowrap",
          overflowX: "auto",
        }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: "fit-content",
            display: "flex",
            alignItems: "center",
            gap: 0,
            flexWrap: "nowrap",
            "& .MuiFormControlLabel-root": {
              flexShrink: 0,
              whiteSpace: "nowrap",
              m: 0,
              mr: 0.125,
              columnGap: 0,
            },
            "& .MuiCheckbox-root": {
              p: "1px",
            },
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={Boolean(values.Viber)}
                onChange={(e) => onFieldChange("Viber", e.target.checked)}
              />
            }
            sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.85rem" } }}
            label="Viber"
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={Boolean(values.Whatsapp)}
                onChange={(e) => onFieldChange("Whatsapp", e.target.checked)}
              />
            }
            sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.85rem" } }}
            label="WhatsApp"
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={Boolean(values.Telegram)}
                onChange={(e) => onFieldChange("Telegram", e.target.checked)}
              />
            }
            sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.85rem" } }}
            label="Telegram"
          />
        </Box>
        <Box
          sx={{
            flex: 1,
            minWidth: "fit-content",
            display: "flex",
            alignItems: "center",
            "& .MuiFormControlLabel-root": {
              flexShrink: 0,
              whiteSpace: "nowrap",
              m: 0,
              columnGap: 0,
            },
            "& .MuiCheckbox-root": {
              p: "1px",
            },
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={Boolean(values.secondDriver)}
                onChange={(e) => onFieldChange("secondDriver", e.target.checked)}
              />
            }
            sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.85rem" } }}
            label={t("order.secondDriver", {
              price: secondDriverPriceLabelValue,
            })}
          />
        </Box>
      </Box>

      <DrivingLicenceUploadField
        emphasized={drivingLicenceEmphasized}
        customerName={values.customerName || ""}
        email={values.email || ""}
        rentalStartDate={rentalStartDate || ""}
        urls={values.drivingLicenceUrls || []}
        onUrlsChange={(urls) => onFieldChange("drivingLicenceUrls", urls)}
        disabled={disabled}
        hideTitle={compactDrivingLicenceUpload}
        hideHint={compactDrivingLicenceUpload}
        uploadButtonLabel={drivingLicenceUploadButtonLabel}
        uploadButtonSideNote={drivingLicenceUploadButtonSideNote}
        showGalleryPreviewHint={showDrivingLicencePreviewHint}
        frameLabel={drivingLicenceFrameLabel}
      />
    </Box>
  );
}
