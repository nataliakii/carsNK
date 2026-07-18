"use client";

import React, { forwardRef } from "react";
import { Button, useTheme } from "@mui/material";

/**
 * Кнопка отмены (Cancel, Close, Back)
 * Серая outlined с красным hover
 * 
 * @param {string} label - Текст кнопки
 * @param {boolean} disabled - Отключить кнопку
 * @param {function} onClick - Обработчик клика
 * @param {object} sx - Дополнительные стили
 */
const CancelButton = forwardRef(
  (
    {
      children,
      label,
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

    return (
      <Button
        ref={ref}
        variant="outlined"
        onClick={onClick}
        disabled={disabled}
        fullWidth={fullWidth}
        size={size}
        startIcon={startIcon}
        sx={{
          // Основные стили
          borderColor: theme.palette.neutral?.gray400 || "#bdbdbd",
          color: theme.palette.text?.secondary || "#757575",
          fontWeight: 600,
          fontSize: size === "small" ? "0.875rem" : "1rem",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          padding: size === "small" ? "8px 16px" : "12px 28px",
          minWidth: "120px",
          borderRadius: "8px",
          borderWidth: "2px",
          transition: "all 0.2s ease-in-out",
          // Hover - красноватый акцент
          "&:hover": {
            borderColor: theme.palette.primary?.main || "#890000",
            color: theme.palette.primary?.main || "#890000",
            backgroundColor: "rgba(137, 0, 0, 0.04)",
            borderWidth: "2px",
          },
          // Active
          "&:active": {
            transform: "translateY(1px)",
          },
          // Disabled
          "&:disabled": {
            borderColor: theme.palette.neutral?.gray300 || "#e0e0e0",
            color: theme.palette.neutral?.gray400 || "#bdbdbd",
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

CancelButton.displayName = "CancelButton";

export default CancelButton;

