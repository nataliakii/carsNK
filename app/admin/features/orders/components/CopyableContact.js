"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { styled } from "@mui/material/styles";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

/** How long the "Copied" confirmation stays on screen. */
const COPIED_FEEDBACK_MS = 1600;

const Row = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(0.5),
  minWidth: 0,
}));

/**
 * A long address must wrap inside the row rather than widen it, otherwise it
 * pushes the copy button out of the panel.
 */
const ContactLink = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightMedium,
  textDecoration: "none",
  minWidth: 0,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  "&:hover": { textDecoration: "underline" },
}));

const Confirmation = styled(Typography)(({ theme }) => ({
  color: theme.palette.success.main,
  whiteSpace: "nowrap",
}));

async function writeToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  // Older and non-secure contexts still have to be able to copy a phone
  // number, which is the whole point of the control.
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "absolute";
  field.style.left = "-9999px";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(field);
  return copied;
}

/**
 * A contact value that can be opened and copied in one row.
 *
 * Whether the value is shown at all is decided upstream by the booking
 * capability resolver; this component only presents what it is given.
 */
export default function CopyableContact({
  value,
  href,
  copyLabel,
  copiedLabel,
}) {
  const text = String(value ?? "").trim();
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    try {
      await writeToClipboard(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      setCopied(false);
    }
  }, [text]);

  if (!text) return null;

  return (
    <Row>
      <ContactLink
        variant="body2"
        component="a"
        href={href}
        title={text}
      >
        {text}
      </ContactLink>
      <Tooltip title={copyLabel}>
        <IconButton size="small" onClick={copy} aria-label={copyLabel}>
          {copied ? (
            <CheckIcon fontSize="inherit" color="success" />
          ) : (
            <ContentCopyIcon fontSize="inherit" />
          )}
        </IconButton>
      </Tooltip>
      {copied ? (
        <Confirmation variant="caption" role="status">
          {copiedLabel}
        </Confirmation>
      ) : null}
    </Row>
  );
}
