"use client";

import React, { useMemo } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { createFilterOptions } from "@mui/material/Autocomplete";
import { getActiveBrand } from "@config/brand";
import { BOOKING_LOCATION_SEARCH_TEXT } from "@/domain/orders/locationOptions";
import { SPAIN_CITY_SEARCH_TEXT } from "@/domain/orders/spainCityOptions";
import { FILTER_CONTROL_HEIGHT } from "@/app/components/ui/inputs/SelectedFieldClass";

/**
 * Dark-themed searchable location control for the catalog filter bar.
 * Matches SelectedFieldClass height / colors; empty value = "Not set".
 */
const FilterLocationAutocomplete = ({
  name,
  label,
  options = [],
  value,
  onChange,
  emptyOptionLabel = "—",
  disabled = false,
  /** Navbar filter bar is dark; dialogs use light. */
  variant = "dark",
}) => {
  const brand = getActiveBrand();
  const accent = brand.primary;
  const accentLight = brand.primaryLight;
  const light = variant === "light";

  const filterOptions = useMemo(
    () =>
      createFilterOptions({
        ignoreCase: true,
        ignoreAccents: true,
        stringify: (option) => {
          const labelText =
            typeof option === "string" ? option : option?.label || "";
          const extra =
            BOOKING_LOCATION_SEARCH_TEXT[labelText] ||
            SPAIN_CITY_SEARCH_TEXT[labelText] ||
            "";
          return `${labelText} ${extra}`.trim();
        },
      }),
    []
  );

  const selected = value && String(value).trim() ? String(value) : null;

  return (
    <Autocomplete
      id={name}
      options={options}
      value={selected}
      disabled={disabled}
      clearOnEscape
      filterOptions={filterOptions}
      onChange={(_event, newValue) => {
        onChange(newValue == null ? "" : String(newValue));
      }}
      getOptionLabel={(option) =>
        typeof option === "string" ? option : option?.label || ""
      }
      isOptionEqualToValue={(option, val) =>
        String(option || "").toLowerCase() === String(val || "").toLowerCase()
      }
      slotProps={{
        popper: {
          style: { zIndex: 1400 },
        },
        paper: {
          sx: {
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: "10px",
            boxShadow: 6,
          },
        },
      }}
      sx={{
        m: 0,
        mt: 0,
        width: "100%",
        minWidth: light ? "100%" : { xs: "100%", sm: 220 },
        maxWidth: light ? "100%" : { xs: "100%", sm: 300 },
        "& .MuiInputBase-root": {
          color: light ? "text.primary" : "#fff",
          fontSize: "0.85rem",
          height: FILTER_CONTROL_HEIGHT,
          backgroundColor: light ? "background.paper" : "rgba(255,255,255,0.04)",
          borderRadius: "10px",
        },
        "& .MuiOutlinedInput-input": {
          py: 0,
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
        "& .MuiInputLabel-root": {
          color: light ? "text.secondary" : "rgba(255,255,255,0.72)",
          fontSize: "0.85rem",
        },
        "& .MuiInputLabel-root.Mui-focused": {
          color: accent,
        },
        "& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator": {
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
      renderInput={(params) => (
        <TextField
          {...params}
          name={name}
          label={label}
          variant="outlined"
          size="small"
          InputLabelProps={{ shrink: true }}
          placeholder={emptyOptionLabel}
          inputProps={{
            ...params.inputProps,
            name,
            "aria-label": label,
          }}
        />
      )}
    />
  );
};

export default FilterLocationAutocomplete;
