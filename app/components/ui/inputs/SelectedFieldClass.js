"use client";

import React from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
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
}) => {
  const brand = getActiveBrand();
  const accent = brand.primary;
  const accentLight = brand.primaryLight;

  return (
    <FormControl
      size="small"
      fullWidth={false}
      required={required}
      sx={{
        m: 0,
        mt: 0,
        minWidth: { xs: 120, sm: 160 },
        maxWidth: { xs: 200, sm: 220 },
        "& .MuiInputBase-root": {
          color: "#fff",
          fontSize: "0.85rem",
          height: FILTER_CONTROL_HEIGHT,
          backgroundColor: "rgba(255,255,255,0.04)",
          borderRadius: "10px",
        },
        "& .MuiOutlinedInput-input": {
          py: 0,
          display: "flex",
          alignItems: "center",
        },
        "& .MuiInputLabel-root": {
          color: "rgba(255,255,255,0.72)",
          fontSize: "0.85rem",
        },
        "& .MuiInputLabel-root.Mui-focused": {
          color: accent,
        },
        "& .MuiSelect-icon": {
          color: "rgba(255,255,255,0.85)",
        },
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: "rgba(255,255,255,0.28)",
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
          <MenuItem value="All">All</MenuItem>
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
