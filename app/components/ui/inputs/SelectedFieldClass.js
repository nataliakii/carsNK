"use client";

import React from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { getActiveBrand } from "@config/brand";

/** Shared height with Navbar search TextField (MUI size=small). */
export const FILTER_CONTROL_HEIGHT = 40;

const SelectedFieldClass = ({
  name,
  label,
  options,
  value,
  handleChange,
  required = false,
  isLoading = false,
  /** Optional: custom label per option (e.g. seat counts). Default: capitalize first letter. */
  formatMenuItemLabel,
  /** When false, omit the "All" option (e.g. booking locations). */
  includeAllOption = true,
  /** Label for empty selection when includeAllOption is false. */
  emptyOptionLabel = "—",
  /** Navbar filter bar is dark; dialogs use light. */
  variant = "dark",
}) => {
  const { t } = useTranslation();
  const brand = getActiveBrand();
  const accent = brand.primary;
  const accentLight = brand.primaryLight;
  const light = variant === "light";

  return (
    <FormControl
      size="small"
      fullWidth={light}
      required={required}
      sx={{
        m: 0,
        mt: 0,
        minWidth: light ? "100%" : { xs: 120, sm: 160 },
        maxWidth: light ? "100%" : { xs: 200, sm: 220 },
        "& .MuiInputBase-root": {
          color: light ? "text.primary" : "#fff",
          fontSize: "0.85rem",
          height: FILTER_CONTROL_HEIGHT,
          backgroundColor: light ? "background.paper" : "rgba(255,255,255,0.04)",
          borderRadius: "10px",
        },
        "& .MuiOutlinedInput-input": {
          py: 0,
          display: "flex",
          alignItems: "center",
        },
        "& .MuiInputLabel-root": {
          color: light ? "text.secondary" : "rgba(255,255,255,0.72)",
          fontSize: "0.85rem",
          letterSpacing: "0.01em",
          wordSpacing: "0.12em",
        },
        "& .MuiSelect-select": {
          letterSpacing: "0.01em",
          wordSpacing: "0.12em",
        },
        "& .MuiInputLabel-root.Mui-focused": {
          color: accent,
        },
        "& .MuiSelect-icon": {
          color: light ? "text.secondary" : "rgba(255,255,255,0.85)",
        },
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: light ? "rgba(0,0,0,0.23)" : "rgba(255,255,255,0.28)",
        },
        "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: accentLight,
        },
        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
          {
            borderColor: accent,
            borderWidth: 1,
          },
      }}
      disabled={isLoading}
    >
      <InputLabel id={`${name}-label`} shrink>
        {label}
      </InputLabel>
      <Select
        labelId={`${name}-label`}
        size="small"
        name={name}
        value={includeAllOption ? value || "All" : value ?? ""}
        onChange={handleChange}
        label={label}
        notched
        displayEmpty={!includeAllOption}
      >
        {includeAllOption ? (
          <MenuItem value="All">{t("header.filterAll")}</MenuItem>
        ) : (
          <MenuItem value="">
            <em>{emptyOptionLabel}</em>
          </MenuItem>
        )}
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {formatMenuItemLabel
              ? formatMenuItemLabel(option)
              : option.charAt(0).toUpperCase() + option.slice(1)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default SelectedFieldClass;
