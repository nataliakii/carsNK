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
    color: theme.palette.primary.main,
    fontWeight: 600,
  },
}));

const BookingDateField = ({ label, value, ...props }) => {
  return (
    <StyledTextField
      label={label}
      variant="outlined"
      value={value}
      InputLabelProps={{ shrink: true }}
      InputProps={{ readOnly: true }}
      size="small"
      {...props}
    />
  );
};

export default BookingDateField;
