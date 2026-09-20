"use client";

import React, { forwardRef, useMemo } from "react";
import { Button, useTheme } from "@mui/material";
import { alpha, keyframes } from "@mui/system";
import { isGreeceSite } from "@config/brand";

/**
 * Pulsing "Book" CTA on the car calendar — colors follow active brand (theme).
 * Greece: cyan gradient + navy text. Rovaro: solid pink + white text.
 */
const GradientBookButton = forwardRef(
  ({ children, label, onClick, disabled, sx, ...props }, ref) => {
    const theme = useTheme();
    const primary = theme.palette.primary.main;
    const primaryDark = theme.palette.primary.dark;
    const primaryLight = theme.palette.primary.light;
    const textColor = theme.palette.primary.contrastText;
    const isGreece = isGreeceSite();

    const bookPulse = useMemo(
      () =>
        keyframes`
      0% {
        box-shadow:
          0 0 10px ${alpha(primary, 0.4)},
          0 0 22px ${alpha(theme.palette.secondary.main, isGreece ? 0.2 : 0.1)};
        transform: scale(1);
      }

      50% {
        box-shadow:
          0 0 22px ${alpha(primary, isGreece ? 0.6 : 0.45)},
          0 0 44px ${alpha(primaryLight, isGreece ? 0.35 : 0.2)};
        transform: scale(1.025);
      }

      100% {
        box-shadow:
          0 0 10px ${alpha(primary, 0.4)},
          0 0 22px ${alpha(theme.palette.secondary.main, isGreece ? 0.2 : 0.1)};
        transform: scale(1);
      }
    `,
      [primary, primaryLight, theme.palette.secondary.main, isGreece]
    );

    const background = isGreece
      ? `linear-gradient(135deg, ${primary} 0%, ${primaryDark} 100%)`
      : primary;

    const restingShadow = isGreece
      ? `0 0 14px ${alpha(primary, 0.4)}, 0 0 28px ${alpha(primaryDark, 0.3)}`
      : `0 4px 14px ${alpha(primary, 0.35)}`;

    const hoverShadow = isGreece
      ? `0 8px 28px ${alpha(primary, 0.55)}, 0 0 36px ${alpha(primaryDark, 0.45)}`
      : `0 6px 20px ${alpha(primaryDark, 0.45)}`;

    return (
      <Button
        ref={ref}
        variant="contained"
        onClick={onClick}
        disabled={disabled}
        sx={{
          background,
          color: textColor,
          fontWeight: 700,
          fontSize: "1.1rem",
          padding: "12px 28px",
          minWidth: "200px",
          borderRadius: "12px",
          textTransform: "none",
          whiteSpace: "pre-line",
          textAlign: "center",
          textShadow: isGreece
            ? "0 1px 2px rgba(0,0,0,0.2)"
            : "none",
          boxShadow: restingShadow,
          animation: disabled
            ? "none"
            : `${bookPulse} 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
          transition: "transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease",
          "&:hover": {
            animation: "none",
            transform: "translateY(-2px) scale(1.03)",
            background: isGreece
              ? `linear-gradient(135deg, ${primaryLight} 0%, ${primary} 100%)`
              : primaryDark,
            boxShadow: hoverShadow,
          },
          "&:disabled": {
            background: theme.palette.neutral?.gray400 || "#bdbdbd",
            color: theme.palette.neutral?.gray600 || "#757575",
            boxShadow: "none",
          },
          ...sx,
        }}
        {...props}
      >
        {label || children}
      </Button>
    );
  }
);

GradientBookButton.displayName = "GradientBookButton";

export default GradientBookButton;
