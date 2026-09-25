"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormLabel,
  Paper,
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

const UploadRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(1),
}));

const UploadLabel = styled(FormLabel)(({ theme }) => ({
  display: "block",
  marginBottom: theme.spacing(0.5),
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
 * Driving licence photo capture for the public booking flow.
 *
 * The browser only ever holds an opaque upload receipt — never a storage URL.
 * Typed licence fields are not collected here; the server stores the verified
 * upload and optional metadata when provided elsewhere.
 *
 * @param {{
 *   value: object,
 *   onChange: (next: object) => void,
 *   disabled?: boolean,
 *   showErrors?: boolean,
 *   serverErrorKey?: string,
 * }} props
 */
export default function DrivingLicenceCaptureField({
  value,
  onChange,
  disabled = false,
  showErrors = false,
  serverErrorKey = "",
}) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErrorKey, setUploadErrorKey] = useState("");

  const capture = value || emptyDrivingLicenceValue;
  const captureRef = useRef(capture);
  captureRef.current = capture;

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

      const current = captureRef.current || emptyDrivingLicenceValue;
      if (!result.ok) {
        setUploadErrorKey(
          UPLOAD_ERROR_KEY[result.code] || UPLOAD_ERROR_KEY.UPLOAD_FAILED
        );
        onChange({ ...current, uploadReceipt: "", documentName: "" });
        return;
      }
      setUploadErrorKey("");
      onChange({
        ...current,
        uploadReceipt: result.receipt,
        documentName: result.fileName || file.name || "",
      });
    },
    [onChange]
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

      <UploadLabel required>
        {t("order.licenceUploadDocument")}
      </UploadLabel>
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
