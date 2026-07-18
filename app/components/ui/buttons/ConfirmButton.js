"use client";

import React, { forwardRef } from "react";
import { Button, CircularProgress, useTheme } from "@mui/material";
import { keyframes } from "@mui/system";

// Анимация пульсации для активной кнопки подтверждения
const confirmPulse = keyframes`
  0% {
    box-shadow: 0 0 12px rgba(0, 137, 137, 0.4);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 24px rgba(0, 137, 137, 0.6);
    transform: scale(1.02);
  }
  100% {
    box-shadow: 0 0 12px rgba(0, 137, 137, 0.4);
    transform: scale(1);
  }
`;

/**
 * Кнопка подтверждения (OK, Confirm, Submit, Save)
 * Бирюзовая с пульсацией
 * 
 * @param {string} label - Текст кнопки
 * @param {boolean} loading - Показать спиннер
 * @param {boolean} pulse - Включить пульсацию
 * @param {boolean} disabled - Отключить кнопку
 * @param {function} onClick - Обработчик клика
 * @param {object} sx - Дополнительные стили
 */
const ConfirmButton = forwardRef(
  (
    {
      children,
      label,
      loading = false,
      pulse = false,
      disabled = false,
      onClick,
      startIcon,
      fullWidth = false,
      size = "medium",
      sx,
      ...props
    },
    ref
  ) => {
    const theme = useTheme();
    const isDisabled = disabled || loading;

    return (
      <Button
        ref={ref}
        variant="contained"
        onClick={onClick}
        disabled={isDisabled}
        fullWidth={fullWidth}
        size={size}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : startIcon}
        sx={{
          // Основные стили
          backgroundColor: theme.palette.secondary?.main || "#008989",
          color: "#ffffff",
          lineHeight: "1.2",
          fontWeight: 600,
          fontSize: size === "small" ? "0.875rem" : "1rem",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          padding: size === "small" ? "8px 16px" : "12px 28px",
          minWidth: "120px",
          borderRadius: "8px",
          border: "none",
          transition: "all 0.2s ease-in-out",
          // Пульсация
          animation: pulse && !isDisabled ? `${confirmPulse} 2s ease-in-out infinite` : "none",
          // Hover
          "&:hover": {
            backgroundColor: theme.palette.secondary?.dark || "#006b6b",
            transform: "translateY(-1px)",
            boxShadow: "0 4px 12px rgba(0, 137, 137, 0.4)",
          },
          // Active
          "&:active": {
            transform: "translateY(0)",
          },
          // Disabled
          "&:disabled": {
            backgroundColor: theme.palette.neutral?.gray400 || "#bdbdbd",
            color: theme.palette.neutral?.gray600 || "#757575",
            boxShadow: "none",
            animation: "none",
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

ConfirmButton.displayName = "ConfirmButton";

export default ConfirmButton;

