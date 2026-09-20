import React, { useMemo } from "react";
import { Autocomplete, TextField, Box, Typography, Chip } from "@mui/material";
import { createFilterOptions } from "@mui/material/Autocomplete";
import { styled } from "@mui/material/styles";
import { BOOKING_LOCATION_SEARCH_TEXT } from "@/domain/orders/locationOptions";
import { SPAIN_CITY_SEARCH_TEXT } from "@/domain/orders/spainCityOptions";

const StyledAutocomplete = styled(Autocomplete)(({ theme }) => ({
  "& .MuiInputBase-root": {
    height: theme.spacing(5),
    [theme.breakpoints.down("sm")]: {
      "@media (orientation: portrait)": {
        height: theme.spacing(6.25),
      },
    },
  },
}));

function optionLabel(option) {
  if (option == null) return "";
  if (typeof option === "string") return option;
  return String(option.label || option.value || option.name || "");
}

function optionValue(option) {
  if (option == null) return "";
  if (typeof option === "string") return option;
  return String(option.value || option.name || option.label || "");
}

const BookingLocationAutocomplete = ({
  label,
  value,
  options,
  onChange,
  onInputChange,
  dividerBeforeOption,
  sx,
  helperText,
  FormHelperTextProps,
  error = false,
  freeSolo = true,
  ...props
}) => {
  const filterOptions = useMemo(
    () =>
      createFilterOptions({
        ignoreCase: true,
        ignoreAccents: true,
        stringify: (option) => {
          if (typeof option === "string") {
            const extra =
              BOOKING_LOCATION_SEARCH_TEXT[option] ||
              SPAIN_CITY_SEARCH_TEXT[option] ||
              "";
            return `${option} ${extra}`.trim();
          }
          const labelText = optionLabel(option);
          const searchExtra = option?.searchText || "";
          const bookExtra =
            BOOKING_LOCATION_SEARCH_TEXT[optionValue(option)] ||
            SPAIN_CITY_SEARCH_TEXT[optionValue(option)] ||
            "";
          return `${labelText} ${searchExtra} ${bookExtra}`.trim();
        },
      }),
    []
  );

  const resolvedValue = useMemo(() => {
    if (value == null || value === "") return freeSolo ? "" : null;
    if (typeof value === "object") return value;
    const match = (options || []).find(
      (opt) => optionValue(opt) === String(value)
    );
    return match || (freeSolo ? String(value) : null);
  }, [value, options, freeSolo]);

  const renderOption = (listItemProps, option) => {
    const labelText = optionLabel(option);
    const isOffice = typeof option === "object" && option?.kind === "office";
    const address =
      typeof option === "object" ? String(option.address || "") : "";
    const freeNote =
      typeof option === "object" ? String(option.freeNote || "") : "";
    const needsDivider =
      dividerBeforeOption && optionValue(option) === dividerBeforeOption;

    return (
      <li
        {...listItemProps}
        style={{
          ...listItemProps.style,
          ...(needsDivider
            ? {
                borderTop: "2px solid #000",
                marginTop: 4,
                paddingTop: 10,
              }
            : {}),
          ...(isOffice
            ? {
                backgroundColor: "rgba(46, 125, 50, 0.06)",
              }
            : {}),
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", width: "100%", py: 0.25 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Typography component="span" variant="body2" sx={{ fontWeight: isOffice ? 700 : 500 }}>
              {isOffice ? labelText.split(" — ")[0] : labelText}
            </Typography>
            {isOffice && (
              <Chip
                size="small"
                label={freeNote || "Free"}
                color="success"
                variant="outlined"
                sx={{ height: 20, fontSize: "0.65rem" }}
              />
            )}
          </Box>
          {isOffice && address ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ lineHeight: 1.3, mt: 0.15 }}
            >
              {address}
            </Typography>
          ) : null}
        </Box>
      </li>
    );
  };

  return (
    <StyledAutocomplete
      freeSolo={freeSolo}
      options={options}
      value={resolvedValue}
      filterOptions={filterOptions}
      getOptionLabel={optionLabel}
      isOptionEqualToValue={(opt, val) =>
        optionValue(opt) === optionValue(val)
      }
      onChange={(event, newValue, reason, details) => {
        if (onChange) onChange(event, newValue, reason, details);
      }}
      onInputChange={onInputChange}
      renderOption={renderOption}
      sx={sx}
      PaperProps={{
        sx: (theme) => ({
          border: `2px solid ${theme.palette.common.black} !important`,
          borderRadius: theme.shape.borderRadius,
          boxShadow: theme.shadows[6],
          backgroundColor: theme.palette.background.paper,
        }),
      }}
      slotProps={{
        popper: {
          style: { zIndex: 1400 },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          variant="outlined"
          size="small"
          InputLabelProps={{ shrink: true }}
          fullWidth
          error={error}
          helperText={helperText}
          FormHelperTextProps={FormHelperTextProps}
        />
      )}
      {...props}
    />
  );
};

export default BookingLocationAutocomplete;
