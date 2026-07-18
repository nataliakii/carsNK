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

const BookingTimeField = ({
  label,
  value,
  onChange,
  error,
  helperText,
  inputProps,
  FormHelperTextProps,
  ...props
}) => {
  return (
    <StyledTextField
      label={label}
      type="time"
      variant="outlined"
      InputLabelProps={{ shrink: true }}
      value={value}
      inputProps={inputProps}
      onChange={onChange}
      size="small"
      error={error}
      helperText={helperText}
      FormHelperTextProps={FormHelperTextProps}
      {...props}
    />
  );
};

export default BookingTimeField;
