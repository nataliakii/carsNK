"use client";

import React from "react";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";

/**
 * AdminLoader - компонент загрузки для секций админки
 * @param {object} props
 * @param {string} props.message - кастомное сообщение загрузки
 * @param {boolean} props.fullScreen - занять весь экран
 * @param {string} props.size - размер спиннера: 'small' | 'medium' | 'large'
 */
export default function AdminLoader({ 
  message, 
  fullScreen = false, 
  size = "medium" 
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const spinnerSize = {
    small: 24,
    medium: 40,
    large: 60,
  }[size] || 40;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: fullScreen ? 0 : 8,
        minHeight: fullScreen ? "100vh" : 200,
        width: "100%",
        gap: 2,
      }}
    >
      <CircularProgress 
        size={spinnerSize}
        sx={{ 
          color: theme.palette.secondary.main 
        }} 
      />
      {message && (
        <Typography 
          variant="body2" 
          color="text.secondary"
          sx={{ mt: 1 }}
        >
          {message || t("basic.loading")}
        </Typography>
      )}
    </Box>
  );
}

