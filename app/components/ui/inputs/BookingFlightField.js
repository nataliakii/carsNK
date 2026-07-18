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
}));

const BookingFlightField = ({ label, value, onChange, ...props }) => {
  return (
    <StyledTextField
      label={label}
      value={value}
      onChange={onChange}
      size="small"
      InputLabelProps={{ shrink: true }}
      {...props}
    />
  );
};

export default BookingFlightField;
