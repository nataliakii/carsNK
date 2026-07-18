"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, CircularProgress, TextField, Typography } from "@mui/material";

/**
 * InlineEditCell
 * - View mode: plain text (no icons)
 * - Edit mode: compact TextField (variant=standard, no label)
 * - Enter / blur => commit
 * - Esc => cancel
 * - Double click to start editing
 */
export default function InlineEditCell({
  value,
  type = "text",
  disabled = false,
  placeholder = "—",
  align = "left",
  sx,
  inputSx,
  inputProps,
  title,
  formatDisplay,
  onCommit,
  onDenied, // optional: called when user double-clicks but editing is not allowed
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const deniedOnceRef = useRef(false);

  // Keep draft in sync when value changes and not editing
  useEffect(() => {
    if (!isEditing) setDraft(value ?? "");
  }, [value, isEditing]);

  const displayText = useMemo(() => {
    const raw = value ?? "";
    if (!raw) return placeholder;
    return formatDisplay ? formatDisplay(raw) : raw;
  }, [value, formatDisplay, placeholder]);

  const startEdit = () => {
    if (disabled) {
      if (!deniedOnceRef.current) {
        deniedOnceRef.current = true;
        onDenied?.();
      }
      return;
    }
    setDraft(value ?? "");
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraft(value ?? "");
    setIsEditing(false);
  };

  const commit = async () => {
    if (disabled) return;

    const next = (draft ?? "").trim();

    // If no change — just exit
    const prev = (value ?? "").trim();
    if (next === prev) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await onCommit?.(next);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <Box
        title={title}
        onDoubleClick={startEdit}
        sx={{
          cursor: disabled ? "default" : "text",
          userSelect: "none",
          width: "100%",
          display: "flex",
          justifyContent: align === "right" ? "flex-end" : "flex-start",
          alignItems: "center",
          minHeight: 24,
          borderRadius: 1,
          px: 0.5,
          ...(disabled
            ? {}
            : {
                "&:hover": {
                  backgroundColor: "rgba(0,0,0,0.04)",
                },
              }),
          ...sx,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            width: "100%",
            textAlign: align,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            opacity: displayText === placeholder ? 0.6 : 1,
          }}
        >
          {displayText}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        alignItems: "center",
        px: 0.5,
        ...sx,
      }}
    >
      <TextField
        autoFocus
        fullWidth
        hiddenLabel
        variant="standard"
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancelEdit();
          }
        }}
        InputProps={{
          disableUnderline: true,
          endAdornment: isSaving ? (
            <CircularProgress size={14} />
          ) : null,
          sx: {
            fontSize: "0.875rem",
            py: 0.25,
            px: 0.5,
            borderRadius: 1,
            border: "1px solid rgba(0,0,0,0.25)",
            backgroundColor: "rgba(255,255,255,0.9)",
            ...inputSx,
          },
        }}
        inputProps={{
          ...(inputProps || {}),
        }}
      />
    </Box>
  );
}

