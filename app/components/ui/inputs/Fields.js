import React from "react";
import {
  FormControl,
  TextField,
  InputAdornment,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";

// Компонент для рендеринга TextField
const RenderTextField = ({
  name,
  label,
  type = "text",
  defaultValue = "",
  adornment = "",
  updatedCar,
  handleChange,
  isLoading,
  sx = {},
}) => (
  <FormControl fullWidth sx={{ mb: 2, ...sx }}>
    <TextField
      name={name}
      label={label}
      type={type}
      value={updatedCar[name] || defaultValue}
      onChange={handleChange}
      disabled={isLoading}
      size="medium"
      InputLabelProps={{
        shrink: true,
      }}
      InputProps={{
        endAdornment: adornment ? (
          <InputAdornment position="end">{adornment}</InputAdornment>
        ) : null,
      }}
    />
  </FormControl>
);

// Компонент для рендеринга SelectField
const RenderSelectField = ({
  name,
  label,
  options,
  required = false,
  updatedCar = null,
  handleChange,
  isLoading,
  mt = 0,
  sx = {},
}) => (
  <FormControl
    fullWidth
    required={required}
    sx={{ mb: 2, mt: mt, ...sx }}
    disabled={isLoading}
  >
    <InputLabel id={`${name}-label`}>{label}</InputLabel>
    <Select
      labelId={`${name}-label`}
      name={name}
      value={updatedCar ? updatedCar[name] : ""}
      onChange={handleChange}
      label={label}
    >
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          {option.charAt(0).toUpperCase() + option.slice(1)}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);

export { RenderTextField, RenderSelectField };
