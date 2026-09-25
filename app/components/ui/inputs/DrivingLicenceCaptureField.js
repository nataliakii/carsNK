"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useTranslation } from "react-i18next";

import {
  LICENCE_FILE_ACCEPT,
  LICENCE_UPLOAD_ERROR,
  uploadDrivingLicenceDocument,
} from "@/app/actions/drivingLicence";
import { issuingCountryOptions } from "@/domain/legal/issuingCountries";
import {
  licenceCaptureMessageKey,
  validateDrivingLicenceFields,
} from "@/domain/legal/drivingLicenceSnapshot";

const Frame = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  borderWidth: theme.spacing(0.25),
  borderColor: theme.palette.primary.main,
  backgroundColor: theme.palette.action.hover,
}));

const Header = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(1.5),
}));

const HeaderIcon = styled(BadgeOutlinedIcon)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontSize: theme.typography.h4.fontSize,
  flexShrink: 0,
}));

const FieldGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  gridTemplateColumns: "1fr 1fr",
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

const UploadRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(2),
}));

const UploadedNote = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.75),
  color: theme.palette.success.main,
}));

const ButtonSpinner = styled(CircularProgress)(({ theme }) => ({
  width: theme.spacing(2),
  height: theme.spacing(2),
}));

const UPLOAD_ERROR_KEY = {
  [LICENCE_UPLOAD_ERROR.UNSUPPORTED_TYPE]: "order.licenceUploadUnsupportedType",
  [LICENCE_UPLOAD_ERROR.TOO_LARGE]: "order.licenceUploadTooLarge",
  [LICENCE_UPLOAD_ERROR.RATE_LIMITED]: "order.licenceUploadRateLimited",
  [LICENCE_UPLOAD_ERROR.UPLOAD_FAILED]: "order.licenceUploadFailed",
};

/** Empty capture value, so callers never have to know the field names. */
export const emptyDrivingLicenceValue = Object.freeze({
  holderName: "",
  licenceNumber: "",
  issuingCountry: "",
  expiryDate: "",
  issueDate: "",
  uploadReceipt: "",
  documentName: "",
});

/**
 * Driving licence capture for the public booking flow.
 *
 * Client-side validation here mirrors the server rules in
 * domain/legal/drivingLicenceSnapshot so the customer is corrected immediately,
 * and it deliberately shares that module rather than restating the rules. The
 * server re-checks everything: this component cannot admit a booking.
 *
 * The browser only ever holds an opaque upload receipt — never a storage URL.
 *
 * @param {{
 *   value: object,
 *   onChange: (next: object) => void,
 *   pickupAtUtc?: string|Date|null,
 *   returnAtUtc?: string|Date|null,
 *   disabled?: boolean,
 *   showErrors?: boolean,
 *   serverErrorKey?: string,
 * }} props
 */
export default function DrivingLicenceCaptureField({
  value,
  onChange,
  pickupAtUtc = null,
  returnAtUtc = null,
  disabled = false,
  showErrors = false,
  serverErrorKey = "",
}) {
  const { t, i18n } = useTranslation();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErrorKey, setUploadErrorKey] = useState("");
  const [touched, setTouched] = useState({});

  const capture = value || emptyDrivingLicenceValue;
  const countryOptions = useMemo(
    () => issuingCountryOptions(i18n?.language || "en"),
    [i18n?.language]
  );
  const selectedCountry = useMemo(
    () =>
      countryOptions.find((option) => option.code === capture.issuingCountry) ||
      null,
    [countryOptions, capture.issuingCountry]
  );

  const fieldCheck = useMemo(
    () =>
      validateDrivingLicenceFields({
        payload: capture,
        pickupAtUtc,
        returnAtUtc,
      }),
    [capture, pickupAtUtc, returnAtUtc]
  );

  const setField = useCallback(
    (field, next) => {
      onChange({ ...capture, [field]: next });
    },
    [capture, onChange]
  );

  const markTouched = useCallback((field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  /** Show a field error once the customer has left it, or on submit. */
  const errorFor = useCallback(
    (field) => {
      if (fieldCheck.ok || fieldCheck.field !== field) return "";
      if (!showErrors && !touched[field]) return "";
      return t(licenceCaptureMessageKey(fieldCheck.code), fieldCheck.message);
    },
    [fieldCheck, showErrors, touched, t]
  );

  const handleFile = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      setUploadErrorKey("");
      setUploading(true);
      // A failed upload clears any earlier receipt: the customer must not be
      // able to submit with a stale document they think they replaced.
      const result = await uploadDrivingLicenceDocument(file);
      setUploading(false);

      if (!result.ok) {
        setUploadErrorKey(
          UPLOAD_ERROR_KEY[result.code] || UPLOAD_ERROR_KEY.UPLOAD_FAILED
        );
        onChange({ ...capture, uploadReceipt: "", documentName: "" });
        return;
      }
      onChange({
        ...capture,
        uploadReceipt: result.receipt,
        documentName: result.fileName || file.name || "",
      });
    },
    [capture, onChange]
  );

  const hasDocument = Boolean(capture.uploadReceipt);
  const documentError =
    uploadErrorKey ||
    (showErrors && !hasDocument ? "order.licenceUploadMissing" : "");

  return (
    <Frame variant="outlined">
      <Header>
        <HeaderIcon aria-hidden />
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>
            {t("order.licenceSectionTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("order.licenceSectionHint")}
          </Typography>
        </Box>
      </Header>

      <FieldGrid>
        <TextField
          label={t("order.licenceHolderLabel")}
          value={capture.holderName || ""}
          onChange={(event) => setField("holderName", event.target.value)}
          onBlur={() => markTouched("holderName")}
          error={Boolean(errorFor("holderName"))}
          helperText={errorFor("holderName")}
          disabled={disabled}
          required
          fullWidth
        />
        <TextField
          label={t("order.licenceNumberLabel")}
          value={capture.licenceNumber || ""}
          onChange={(event) => setField("licenceNumber", event.target.value)}
          onBlur={() => markTouched("licenceNumber")}
          error={Boolean(errorFor("licenceNumber"))}
          helperText={errorFor("licenceNumber")}
          disabled={disabled}
          required
          fullWidth
        />
        <Autocomplete
          options={countryOptions}
          value={selectedCountry}
          getOptionLabel={(option) => option?.label || ""}
          isOptionEqualToValue={(option, selected) =>
            option.code === selected?.code
          }
          onChange={(_event, next) => setField("issuingCountry", next?.code || "")}
          onBlur={() => markTouched("issuingCountry")}
          disabled={disabled}
          fullWidth
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("order.licenceCountryLabel")}
              error={Boolean(errorFor("issuingCountry"))}
              helperText={errorFor("issuingCountry")}
              required
            />
          )}
        />
        <TextField
          label={t("order.licenceExpiryLabel")}
          type="date"
          value={capture.expiryDate || ""}
          onChange={(event) => setField("expiryDate", event.target.value)}
          onBlur={() => markTouched("expiryDate")}
          error={Boolean(errorFor("expiryDate"))}
          helperText={errorFor("expiryDate")}
          disabled={disabled}
          required
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label={t("order.licenceIssueDateLabel")}
          type="date"
          value={capture.issueDate || ""}
          onChange={(event) => setField("issueDate", event.target.value)}
          onBlur={() => markTouched("issueDate")}
          error={Boolean(errorFor("issueDate"))}
          helperText={errorFor("issueDate") || t("order.licenceIssueDateHint")}
          disabled={disabled}
          required
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
      </FieldGrid>

      <UploadRow>
        <input
          ref={inputRef}
          type="file"
          accept={LICENCE_FILE_ACCEPT}
          hidden
          onChange={handleFile}
        />
        <Button
          variant={hasDocument ? "outlined" : "contained"}
          color="primary"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          startIcon={
            uploading ? <ButtonSpinner color="inherit" /> : <UploadFileIcon />
          }
        >
          {uploading
            ? t("order.licenceUploading")
            : hasDocument
              ? t("order.licenceReplaceDocument")
              : t("order.licenceUploadDocument")}
        </Button>
        {hasDocument && !uploading ? (
          <UploadedNote>
            <CheckCircleOutlineIcon fontSize="small" aria-hidden />
            <Typography variant="body2">
              {t("order.licenceDocumentAttached")}
            </Typography>
          </UploadedNote>
        ) : null}
      </UploadRow>

      {documentError ? (
        <Typography variant="caption" color="error" display="block" mt={1}>
          {t(documentError)}
        </Typography>
      ) : null}

      {serverErrorKey ? (
        <Typography variant="body2" color="error" mt={1}>
          {t(serverErrorKey)}
        </Typography>
      ) : null}
    </Frame>
  );
}
