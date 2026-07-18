"use client";

import React, { forwardRef } from "react";
import { Button, useTheme } from "@mui/material";
import { keyframes } from "@mui/system";

// Анимация пульсации с градиентом
const bookPulse = keyframes`
  0% {
    box-shadow:
      0 0 10px rgba(0, 137, 137, 0.35),
      0 0 22px rgba(0, 137, 0, 0.25);
    transform: scale(1);
  }

  50% {
    box-shadow:
      0 0 22px rgba(0, 137, 137, 0.55),
      0 0 44px rgba(0, 137, 0, 0.45);
    transform: scale(1.025);
  }

  100% {
    box-shadow:
      0 0 10px rgba(0, 137, 137, 0.35),
      0 0 22px rgba(0, 137, 0, 0.25);
    transform: scale(1);
  }
`;



/**
 * Градиентная пульсирующая кнопка "Забронировать"
 * Бирюзово-зелёный градиент с эффектом свечения
 */
const GradientBookButton = forwardRef(
  ({ children, label, onClick, disabled, sx, ...props }, ref) => {
    const theme = useTheme();

    return (
      <Button
        ref={ref}
        variant="contained"
        onClick={onClick}
        disabled={disabled}
    sx={{
  background: "linear-gradient(135deg, #008989 0%, #008988 100%)",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "1.1rem",
  padding: "12px 28px",
  minWidth: "200px",
  borderRadius: "12px",
  textTransform: "none",
  whiteSpace: "pre-line",
  textAlign: "center",

  textShadow: "0 1px 2px rgba(0,0,0,0.2)",

  boxShadow:
    "0 0 14px rgba(0, 137, 137, 0.4), 0 0 28px rgba(0, 137, 0, 0.3)",

  animation: disabled
    ? "none"
    : `${bookPulse} 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite`,

  transition: "transform 0.25s ease, box-shadow 0.25s ease",

  "&:hover": {
    animation: "none",
    transform: "translateY(-2px) scale(1.03)",
    boxShadow:
      "0 8px 28px rgba(0, 137, 137, 0.55), 0 0 36px rgba(0, 137, 0, 0.45)",
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

