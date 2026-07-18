import React, { useMemo } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { createFilterOptions } from "@mui/material/Autocomplete";
import { styled } from "@mui/material/styles";
import { BOOKING_LOCATION_SEARCH_TEXT } from "@/domain/orders/locationOptions";

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
  ...props
}) => {
  const filterOptions = useMemo(
    () =>
      createFilterOptions({
        ignoreCase: true,
        stringify: (option) => {
          const label =
            typeof option === "string" ? option : option?.label || "";
          const extra = BOOKING_LOCATION_SEARCH_TEXT[label] || "";
          return `${label} ${extra}`.trim();
        },
      }),
    []
  );

  const renderOption = (listItemProps, option) => {
    const labelText = typeof option === "string" ? option : option?.label || "";
    const needsDivider = dividerBeforeOption && labelText === dividerBeforeOption;

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
        }}
      >
        {labelText}
      </li>
    );
  };

  return (
    <StyledAutocomplete
      freeSolo
      options={options}
      value={value}
      filterOptions={filterOptions}
      onChange={onChange}
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
