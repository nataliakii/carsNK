"use client";

import React from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  useMediaQuery,
  useTheme,
} from "@mui/material";

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
}) => {
  const theme = useTheme();
  // detect small landscape phones
  const isLandscapeSmall = useMediaQuery(
    "(max-width:900px) and (orientation: landscape)"
  );

  // Цвета для тёмного фона
  const darkBg = theme.palette.backgroundDark1 || {};
  const textColor = darkBg.text || "#ffffff";
  const accentColor = darkBg.secondary || "#4dd4d4"; // Светло-бирюзовый для акцентов

  return (
    <FormControl
      fullWidth={false}
      required={required}
      sx={{
        mt: 1,
        minWidth: { xs: 160, sm: 280 },
        maxWidth: { xs: 180, sm: 300 },
        "& .MuiInputBase-root": {
          color: textColor,
          fontSize: { xs: "0.85rem", sm: "1rem" },
        },
        "& .MuiInputLabel-root": {
          color: textColor,
          fontSize: { xs: "0.75rem", sm: "1rem" },
        },
        "& .MuiInputLabel-root.Mui-focused": {
          color: accentColor, // Бирюзовый при фокусе
        },
        "& .MuiSelect-icon": {
          color: textColor,
        },
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: darkBg.textSecondary || "#b0b0b0",
        },
        "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: accentColor, // Бирюзовый при hover
        },
        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
          {
            borderColor: accentColor, // Бирюзовый при фокусе
            borderWidth: 2,
          },
      }}
      disabled={isLoading}
    >
      <InputLabel id={`${name}-label`}>{label}</InputLabel>
      <Select
        labelId={`${name}-label`}
        size={isLandscapeSmall ? "small" : "medium"}
        name={name}
        value={value || "All"}
        onChange={handleChange}
        label={label}
      >
        <MenuItem value="All">All</MenuItem>
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
