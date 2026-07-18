"use client";

import React, { forwardRef } from "react";
import { Button, CircularProgress, useTheme } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

/**
 * Кнопка удаления (Delete, Remove)
 * Красная с иконкой
 * 
 * @param {string} label - Текст кнопки
 * @param {boolean} loading - Показать спиннер
 * @param {boolean} disabled - Отключить кнопку
 * @param {function} onClick - Обработчик клика
 * @param {boolean} showIcon - Показать иконку удаления
 * @param {object} sx - Дополнительные стили
 */
const DeleteButton = forwardRef(
  (
    {
      children,
      label,
      loading = false,
      disabled = false,
      onClick,
      showIcon = true,
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
        startIcon={
          loading ? (
            <CircularProgress size={20} color="inherit" />
          ) : showIcon ? (
            <DeleteIcon />
          ) : null
        }
        sx={{
          // Основные стили
          backgroundColor: theme.palette.primary?.main || "#890000",
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
          // Hover
          "&:hover": {
            backgroundColor: theme.palette.primary?.dark || "#5c0000",
            transform: "translateY(-1px)",
            boxShadow: "0 4px 12px rgba(137, 0, 0, 0.4)",
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

DeleteButton.displayName = "DeleteButton";

export default DeleteButton;

