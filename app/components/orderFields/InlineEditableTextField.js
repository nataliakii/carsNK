"use client";

import React, { useState, useRef, useEffect } from "react";
import { TextField } from "@mui/material";

/**
 * InlineEditableTextField
 * 
 * TextField that shows read-only view by default, enters edit mode on double-click.
 * Commits on blur or Enter, cancels on Escape.
 * 
 * Props:
 * - label, value, onChange (required)
 * - type: "text" | "number" | "date" | "time" | "datetime-local" etc
 * - disabled: if true, never enters edit mode
 * - required, inputProps, helperText, error
 * - sx: passthrough
 * - formatDisplay?: function(value) -> string for view mode display
 * - onCommit?: callback(value) when value is committed
 * - onCancel?: callback() when edit is cancelled
 */
export default function InlineEditableTextField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  required = false,
  inputProps = {},
  helperText,
  error,
  sx = {},
  formatDisplay,
  onCommit,
  onCancel,
  ...otherProps
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const inputRef = useRef(null);

  // Sync draftValue when value prop changes (but not when editing)
  useEffect(() => {
    if (!isEditing) {
      setDraftValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // For date/time inputs, select all text
      if (type === "date" || type === "time" || type === "datetime-local") {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleDoubleClick = () => {
    if (disabled) return;
    setIsEditing(true);
    setDraftValue(value);
  };

  const handleCommit = () => {
    if (isEditing) {
      const newValue = draftValue;
      onChange(newValue);
      if (onCommit) {
        onCommit(newValue);
      }
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    if (isEditing) {
      setDraftValue(value); // Restore original value
      if (onCancel) {
        onCancel();
      }
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = (e) => {
    // For date/time inputs, check if the relatedTarget is the calendar picker
    // If so, don't commit yet - let the picker handle the selection
    if (
      (type === "date" || type === "time" || type === "datetime-local") &&
      e.relatedTarget &&
      (e.relatedTarget.closest(".MuiPickersPopper-root") ||
        e.relatedTarget.closest(".MuiPaper-root"))
    ) {
      return; // Don't commit if clicking on picker
    }
    
    // Small delay to allow onClick handlers to fire first (e.g., for date picker)
    setTimeout(() => {
      if (isEditing) {
        handleCommit();
      }
    }, 200);
  };

  const displayValue = isEditing
    ? draftValue
    : formatDisplay
    ? formatDisplay(value)
    : value || "";

  // Styles for hiding calendar/time picker icons
  const hidePickerStyles =
    type === "date" || type === "time" || type === "datetime-local"
      ? {
          "& input::-webkit-calendar-picker-indicator": {
            display: "none",
          },
          "& input::-webkit-clear-button": {
            display: "none",
          },
          "& input": {
            cursor: isEditing ? "text" : "pointer",
          },
        }
      : {};

  return (
    <TextField
      {...otherProps}
      label={label}
      type={type}
      value={displayValue}
      onChange={(e) => {
        if (isEditing) {
          setDraftValue(e.target.value);
        }
      }}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      disabled={disabled}
      required={required}
      error={error}
      helperText={helperText}
      inputRef={inputRef}
      InputProps={{
        readOnly: !isEditing && !disabled,
        ...otherProps.InputProps,
      }}
      inputProps={{
        ...inputProps,
        ...otherProps.inputProps,
      }}
      sx={{
        ...hidePickerStyles,
        ...sx,
      }}
    />
  );
}

