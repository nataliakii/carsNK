"use client";

import React from "react";
import { Box, Typography } from "@mui/material";
import ModalLayout from "./ModalLayout";
import { CancelButton, ActionButton } from "../index";

/**
 * Модальное окно подтверждения действия
 * 
 * @param {boolean} open - открыто ли окно
 * @param {function} onClose - обработчик закрытия
 * @param {function} onConfirm - обработчик подтверждения
 * @param {string} title - заголовок (опционально)
 * @param {string} message - текст сообщения
 * @param {string} confirmLabel - текст кнопки подтверждения
 * @param {string} cancelLabel - текст кнопки отмены
 * @param {string} confirmColor - цвет кнопки подтверждения: "primary" | "success" | "warning"
 * @param {boolean} loading - показать загрузку
 */
const ConfirmModal = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "ДА",
  cancelLabel = "НЕТ",
  confirmColor = "success",
  loading = false,
}) => {
  return (
    <ModalLayout
      open={open}
      onClose={onClose}
      title={title}
      size="small"
      showCloseButton={false}
      closeOnBackdropClick={false}
      closeOnEscape={false}
      centerVertically={false}
    >
      <Typography sx={{ mb: 3, color: "text.primary" }}>{message}</Typography>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
        <CancelButton onClick={onClose} label={cancelLabel} disabled={loading} />
        <ActionButton
          color={confirmColor}
          onClick={onConfirm}
          label={confirmLabel}
          loading={loading}
        />
      </Box>
    </ModalLayout>
  );
};

export default ConfirmModal;

