"use client";

import React from "react";
import Snackbar from "@/app/components/ui/feedback/Snackbar";

/**
 * AdminNotifications - централизованные уведомления для админки
 * @param {object} props
 * @param {object} props.notification - { type: number, message: string }
 * @param {function} props.onClose - callback при закрытии
 */
export default function AdminNotifications({ notification, onClose }) {
  if (!notification) return null;

  return (
    <Snackbar
      key={notification.message + notification.type}
      message={notification.message}
      isError={notification.type !== 200}
      closeFunc={onClose}
      open={Boolean(notification)}
    />
  );
}

