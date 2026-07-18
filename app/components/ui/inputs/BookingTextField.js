import React from "react";
import { TextField } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledTextField = styled(TextField)(({ theme }) => ({
  "& .MuiInputBase-root": {
    height: theme.spacing(7),
    [theme.breakpoints.down("sm")]: {
      "@media (orientation: portrait)": {
        height: theme.spacing(6.25),
      },
    },
  },
}));

const BookingTextField = ({
  label,
  value,
  onChange,
  error,
  helperText,
  type = "text",
  required,
  ...props
}) => {
  return (
    <StyledTextField
      label={label}
      variant="outlined"
      fullWidth
      value={value}
      onChange={onChange}
      type={type}
      error={error}
      helperText={helperText}
      {...props}
    />
  );
};

export default BookingTextField;
