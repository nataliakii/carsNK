/**
 * ConfirmBlockBadge
 * 
 * Маленький ⛔ бейдж который показывается рядом с pending заказами,
 * которые НЕ МОГУТ быть подтверждены из-за конфликта с confirmed заказом.
 */

import React from "react";
import { Box, Tooltip } from "@mui/material";

/**
 * @param {Object} props
 * @param {string} [props.message] - Сообщение о блокировке (для tooltip)
 * @param {boolean} [props.show] - Показывать или нет
 * @param {"small" | "medium"} [props.size] - Размер бейджа
 */
export default function ConfirmBlockBadge({ 
  message, 
  show = true, 
  size = "small" 
}) {
  if (!show) return null;

  const sizeStyles = {
    small: { fontSize: "10px", width: "14px", height: "14px" },
    medium: { fontSize: "12px", width: "18px", height: "18px" },
  };

  const badge = (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...sizeStyles[size],
        borderRadius: "50%",
        backgroundColor: "error.main",
        color: "white",
        fontWeight: "bold",
        lineHeight: 1,
        ml: 0.5,
        flexShrink: 0,
      }}
    >
      ⛔
    </Box>
  );

  if (message) {
    return (
      <Tooltip title={message} arrow placement="top">
        {badge}
      </Tooltip>
    );
  }

  return badge;
}

/**
 * Хелпер для проверки нужно ли показывать бейдж для заказа.
 * Кеш хранит данные (conflictData), не строки — полный текст формируется в EditOrderModal.
 * @param {Object} order
 * @param {Record<string, string | object>} pendingConfirmBlockById - orderId -> string (legacy) или conflictData
 * @returns {{ show: boolean, message: string | null }}
 */
export function shouldShowConfirmBlockBadge(order, pendingConfirmBlockById) {
  if (!order || order.confirmed) {
    return { show: false, message: null };
  }

  const orderId = order._id?.toString();
  const entry = pendingConfirmBlockById?.[orderId];

  return {
    show: !!entry,
    message: !entry ? null : typeof entry === "string" ? entry : "Конфликт с подтверждённым заказом",
  };
}

