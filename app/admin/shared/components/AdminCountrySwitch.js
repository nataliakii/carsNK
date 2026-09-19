"use client";

import { FormControl, MenuItem, Select } from "@mui/material";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";

/**
 * Superadmin-only country switcher (GR / ES / ALL).
 * Filters owners list and car park by company.country.
 */
export default function AdminCountrySwitch({ sx } = {}) {
  const { country, setCountry, options } = useAdminCountryFilter();

  return (
    <FormControl
      size="small"
      sx={{
        minWidth: 118,
        "& .MuiOutlinedInput-root": {
          height: 28,
          color: "#ffc107",
          fontSize: "0.72rem",
          fontWeight: 700,
          bgcolor: "rgba(255, 193, 7, 0.12)",
          "& fieldset": { borderColor: "rgba(255, 193, 7, 0.45)" },
          "&:hover fieldset": { borderColor: "rgba(255, 193, 7, 0.75)" },
          "&.Mui-focused fieldset": { borderColor: "#ffc107" },
        },
        "& .MuiSelect-icon": { color: "#ffc107" },
        ...sx,
      }}
    >
      <Select
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        displayEmpty
        inputProps={{ "aria-label": "Admin country filter" }}
      >
        {options.map((opt) => (
          <MenuItem key={opt.code} value={opt.code} dense>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
