import React, { useEffect } from "react";
import { Slide, IconButton, Snackbar as MuiSnackbar } from "@mui/material";
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from "@mui/icons-material";
import PropTypes from "prop-types";
import { styled } from "@mui/system";
import { snackbarContentClasses } from "@mui/material/SnackbarContent";

const styles = ({ theme, isError }) => ({
  [`& .${snackbarContentClasses.root}`]: {
    backgroundColor: isError
      ? theme.palette.primary.red
      : theme.palette.primary.green,
    color: isError ? "white" : theme.palette.text.dark,
    flexWrap: "inherit",
    [theme.breakpoints.up("md")]: {
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 4,
      borderBottomLeftRadius: 4,
    },
  },
  [`& .${snackbarContentClasses.message}`]: {
    fontSize: 16,
    display: "flex",
    alignItems: "center",
  },
  [`& .${snackbarContentClasses.action}`]: {
    paddingLeft: theme.spacing(2),
  },
  "& .MuiSnackbarContent-info": {
    flexShrink: 0,
    marginRight: theme.spacing(2),
  },
  "& .MuiSnackbarContent-close": {
    padding: theme.spacing(1),
  },
});

function Transition(props) {
  return <Slide {...props} direction="down" />;
}

function Snackbar({ message, closeFunc, isError, open }) {
  const handleClose = (event, reason) => {
    if (reason === "clickaway") return;
    if (closeFunc) closeFunc();
  };

  return (
    <MuiSnackbar
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      open={open}
      onClose={handleClose}
      autoHideDuration={isError ? 14000 : 4000}
      TransitionComponent={Transition}
      message={
        <span style={{ display: "flex", alignItems: "center" }}>
          {isError ? (
            <WarningIcon style={{ marginRight: 8, color: "red" }} />
          ) : (
            <InfoIcon style={{ marginRight: 8, color: "green" }} />
          )}
          {message}
        </span>
      }
      action={
        <IconButton aria-label="close" color="inherit" onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      }
    />
  );
}

Snackbar.propTypes = {
  isError: PropTypes.bool,
  message: PropTypes.string.isRequired,
  closeFunc: PropTypes.func.isRequired, // Ensure that the close function is required
};

export default styled(Snackbar)(styles);
