"use client";

import React from "react";
import { Modal, Box, Typography, IconButton, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Базовый layout для модальных окон
 * 
 * Unified close behavior contract:
 * - By default, modals cannot be closed by backdrop click or Escape key
 *   (prevents accidental closure of transactional/destructive dialogs)
 * - Close button (X) always closes the modal
 * - Enable closeOnBackdropClick/closeOnEscape only for informational/confirmation dialogs
 * 
 * @param {boolean} open - открыто ли окно
 * @param {function} onClose - обработчик закрытия
 * @param {string} title - заголовок (опционально)
 * @param {string} size - размер: "small" | "medium" | "large" | "fullWidth"
 * @param {boolean} showCloseButton - показывать крестик закрытия (default: true)
 * @param {boolean} closeOnBackdropClick - разрешить закрытие по клику вне модального окна (default: false)
 * @param {boolean} closeOnEscape - разрешить закрытие по Escape (default: false)
 * @param {boolean} centerVertically - центрировать по вертикали
 * @param {object} sx - дополнительные стили для контейнера
 * @param {ReactNode} children - содержимое
 */
const ModalLayout = ({
  open,
  onClose,
  title,
  size = "medium",
  showCloseButton = true,
  closeOnBackdropClick = false,
  closeOnEscape = false,
  centerVertically = true,
  sx,
  children,
  ...props
}) => {
  const theme = useTheme();

  // Unified close handler that respects the close behavior contract
  // MUI Modal calls onClose(event, reason) where reason can be:
  // - "backdropClick" - user clicked outside
  // - "escapeKeyDown" - user pressed Escape
  // - other values for programmatic close (X button, etc.)
  const handleClose = (event, reason) => {
    // X button and programmatic closes always work
    if (reason === "backdropClick" && !closeOnBackdropClick) {
      return; // Ignore backdrop clicks when disabled
    }
    if (reason === "escapeKeyDown" && !closeOnEscape) {
      return; // Ignore Escape key when disabled
    }
    // All other reasons (including undefined for X button) are allowed
    onClose(event, reason);
  };

  const sizeStyles = {
    small: { minWidth: 300, maxWidth: 400 },
    medium: { minWidth: 400, maxWidth: 600 },
    large: { minWidth: 600, maxWidth: 900 },
    fullWidth: { minWidth: 800, maxWidth: 1000 },
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      disableEscapeKeyDown={!closeOnEscape}
      sx={{
        display: "flex",
        alignItems: centerVertically ? "center" : "flex-start",
        justifyContent: "center",
        pt: centerVertically ? 0 : "10vh",
      }}
      {...props}
    >
      <Box
        sx={{
          backgroundColor: "background.paper",
          borderRadius: 2,
          boxShadow: 24,
          p: 3,
          maxHeight: "90vh",
          overflowY: "auto",
          width: "fit-content",
          maxWidth: "95vw",
          ...sizeStyles[size],
          ...sx,
        }}
      >
        {/* Header с заголовком и кнопкой закрытия */}
        {(title || showCloseButton) && (
          <Box
            className={showCloseButton ? "no-print" : ""}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: title ? 2 : 0,
            }}
          >
            {title && (
              <Typography
                variant="h6"
                component="h2"
                sx={{ color: "text.primary", fontWeight: 600 }}
              >
                {title}
              </Typography>
            )}
            {showCloseButton && (
              <IconButton
                onClick={(e) => handleClose(e, "buttonClick")}
                size="small"
                sx={{
                  ml: "auto",
                  color: "text.secondary",
                  "&:hover": { color: "primary.main" },
                }}
              >
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        )}

        {/* Содержимое */}
        {children}
      </Box>
    </Modal>
  );
};

export default ModalLayout;

