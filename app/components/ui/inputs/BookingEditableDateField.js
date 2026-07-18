import React from "react";
import { TextField } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiInputBase-root": {
    height: theme.spacing(5),
    [theme.breakpoints.down("sm")]: {
      "@media (orientation: portrait)": {
        height: theme.spacing(6.25),
      },
    },
  },
  "& .MuiOutlinedInput-input": {
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
  },
}));

const BookingEditableDateField = ({
  label,
  value,
  onChange,
  inputProps,
  error,
  helperText,
  ...props
}) => {
  return (
    <StyledTextField
      label={label}
      type="date"
      variant="outlined"
      value={value || ""}
      onChange={onChange}
      InputLabelProps={{ shrink: true }}
      inputProps={inputProps}
      size="small"
      error={error}
      helperText={helperText}
      {...props}
    />
  );
};

export default BookingEditableDateField;
