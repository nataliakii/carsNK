import React from "react";
import MuiButton from "@mui/material/Button";
import { useTheme, useMediaQuery } from "@mui/material";

export default function DefaultButton({
  visibility = true,
  disabled = false,
  relative = false,
  minWidth,
  onClick,
  label,
  children,
  blinking = false,
  sx: sxProp,
  props,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Цвета из темы для мерцающей кнопки
  const blinkColors = {
    main: theme.palette.triadic?.green || "#008900",
    light: theme.palette.triadic?.greenLight || "#33a033",
    text: theme.palette.neutral?.black || "#0a0a0a",
  };

  return (
    visibility && (
      <MuiButton
        variant="contained"
        aria-label={label}
        size="large"
        sx={{
          p: 3,
          m: 1,
          backgroundColor: "secondary.main",
          fontSize: "1.3rem",
          fontWeight: 500,
          position: relative ? "relative" : "absolute",
          lineHeight: "1.5rem",
          textTransform: "uppercase",
          top: relative ? 0 : 5,
          left: relative ? 0 : 5,
          borderRadius: "15px",
          border: "0px solid white",
          marginBottom: 1,
          minWidth: minWidth,
          zIndex: 4,
          // Белый текст на бирюзовом фоне (secondary.main = #008989)
          color: "secondary.contrastText",
          opacity: disabled ? 0.7 : 1,
          "&:hover": {
            backgroundColor: "secondary.dark",
            color: "secondary.contrastText",
            animation: "none",
          },
          // Стили для мерцающей кнопки
          ...(blinking && {
            backgroundColor: blinkColors.main,
            color: blinkColors.text,
            animation: isMobile
              ? "blinkMobile 1.5s ease-in-out infinite"
              : "blinkDesktop 1s linear infinite",
          }),
          "@keyframes blinkMobile": {
            "0%": { transform: "scale(1)", backgroundColor: blinkColors.main },
            "50%": { transform: "scale(1.02)", backgroundColor: blinkColors.light },
            "100%": { transform: "scale(1)", backgroundColor: blinkColors.main },
          },
          "@keyframes blinkDesktop": {
            "0%": { backgroundColor: blinkColors.main, transform: "scale(1)" },
            "50%": { backgroundColor: blinkColors.light, transform: "scale(1.03)" },
            "100%": { backgroundColor: blinkColors.main, transform: "scale(1)" },
          },
          // parent-provided sx overrides defaults
          ...sxProp,
        }}
        onClick={onClick}
        {...props}
      >
        {label && !children && !props && label}
        {children}
      </MuiButton>
    )
  );
}
