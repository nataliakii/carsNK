"use client";

import React, { forwardRef } from "react";
import { Button, CircularProgress, useTheme } from "@mui/material";

/**
 * Универсальная кнопка действия (Add, Edit, View, etc.)
 * Цвет настраивается через color prop
 * 
 * @param {string} label - Текст кнопки
 * @param {string} color - Цвет: "primary" | "secondary" | "success" | "warning"
 * @param {string} variant - Вариант: "contained" | "outlined" | "text"
 * @param {boolean} loading - Показать спиннер
 * @param {boolean} disabled - Отключить кнопку
 * @param {function} onClick - Обработчик клика
 * @param {object} sx - Дополнительные стили
 */
const ActionButton = forwardRef(
  (
    {
      children,
      label,
      color = "primary",
      variant = "contained",
      loading = false,
      disabled = false,
      onClick,
      startIcon,
      endIcon,
      fullWidth = false,
      size = "medium",
      sx,
      ...props
    },
    ref
  ) => {
    const theme = useTheme();
    const isDisabled = disabled || loading;

    // Определение цветов на основе color prop
    const getColors = () => {
      const colors = {
        primary: {
          main: theme.palette.primary?.main || "#890000",
          dark: theme.palette.primary?.dark || "#5c0000",
          text: "#ffffff",
        },
        secondary: {
          main: theme.palette.secondary?.main || "#008989",
          dark: theme.palette.secondary?.dark || "#006b6b",
          text: "#ffffff",
        },
        success: {
          main: theme.palette.success?.main || "#008900",
          dark: theme.palette.success?.dark || "#006b00",
          text: "#ffffff",
        },
        warning: {
          main: theme.palette.warning?.main || "#894500",
          dark: theme.palette.warning?.dark || "#5c2e00",
          text: "#ffffff",
        },
      };
      return colors[color] || colors.primary;
    };

    const colorSet = getColors();

    const getVariantStyles = () => {
      if (variant === "outlined") {
        return {
          backgroundColor: "transparent",
          color: colorSet.main,
          border: `2px solid ${colorSet.main}`,
          "&:hover": {
            backgroundColor: `${colorSet.main}10`,
            borderColor: colorSet.dark,
            color: colorSet.dark,
          },
        };
      }
      if (variant === "text") {
        return {
          backgroundColor: "transparent",
          color: colorSet.main,
          border: "none",
          "&:hover": {
            backgroundColor: `${colorSet.main}10`,
            color: colorSet.dark,
          },
        };
      }
      // contained (default)
      return {
        backgroundColor: colorSet.main,
        color: colorSet.text,
        border: "none",
        "&:hover": {
          backgroundColor: colorSet.dark,
          transform: "translateY(-1px)",
          boxShadow: `0 4px 12px ${colorSet.main}40`,
        },
      };
    };

    return (
      <Button
        ref={ref}
        variant={variant}
        onClick={onClick}
        disabled={isDisabled}
        fullWidth={fullWidth}
        size={size}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : startIcon}
        endIcon={!loading ? endIcon : null}
        sx={{
          // Основные стили
          fontWeight: 600,
          fontSize: size === "small" ? "0.875rem" : "1rem",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          padding: size === "small" ? "8px 16px" : "12px 28px",
          minWidth: "120px",
          borderRadius: "8px",
          transition: "all 0.2s ease-in-out",
          // Стили варианта
          ...getVariantStyles(),
          // Active
          "&:active": {
            transform: "translateY(0)",
          },
          // Disabled
          "&:disabled": {
            backgroundColor:
              variant === "contained"
                ? theme.palette.neutral?.gray400 || "#bdbdbd"
                : "transparent",
            color: theme.palette.neutral?.gray500 || "#9e9e9e",
            borderColor:
              variant === "outlined" ? theme.palette.neutral?.gray300 || "#e0e0e0" : undefined,
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

ActionButton.displayName = "ActionButton";

export default ActionButton;

