"use client";

import { Chip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { isPlatformBooking } from "@/domain/admin/rovaroContractorAdmin";
import {
  CUSTOMER_CONFIRMATION,
  resolveCustomerConfirmation,
} from "@/domain/orders/supplierResponseStatus";

const LABEL_KEY = {
  [CUSTOMER_CONFIRMATION.NOT_REQUESTED]: "table.customerNotRequested",
  [CUSTOMER_CONFIRMATION.AWAITING_ACCEPTANCE]: "table.customerAwaitingAcceptance",
  [CUSTOMER_CONFIRMATION.AWAITING_PAYMENT]: "table.customerAwaitingPayment",
  [CUSTOMER_CONFIRMATION.CONFIRMED_BY_PAYMENT]: "table.customerFeePaid",
  [CUSTOMER_CONFIRMATION.PAYMENT_EXPIRED]: "table.toneExpired",
};

const DEFAULT_LABEL = {
  [CUSTOMER_CONFIRMATION.NOT_REQUESTED]: "Not requested yet",
  [CUSTOMER_CONFIRMATION.AWAITING_ACCEPTANCE]: "Awaiting customer acceptance",
  [CUSTOMER_CONFIRMATION.AWAITING_PAYMENT]: "Awaiting Booking Fee",
  [CUSTOMER_CONFIRMATION.CONFIRMED_BY_PAYMENT]: "Booking Fee paid",
  [CUSTOMER_CONFIRMATION.PAYMENT_EXPIRED]: "Payment expired",
};

export default function CustomerConfirmationCell({ order }) {
  const { t } = useTranslation();
  if (!isPlatformBooking(order)) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }

  const code = resolveCustomerConfirmation(order);
  const label = t(LABEL_KEY[code] || "table.customerNotRequested", {
    defaultValue: DEFAULT_LABEL[code] || "Not requested yet",
  });
  const color =
    code === CUSTOMER_CONFIRMATION.CONFIRMED_BY_PAYMENT
      ? "success"
      : code === CUSTOMER_CONFIRMATION.AWAITING_PAYMENT
        ? "warning"
        : "default";

  return <Chip size="small" color={color} label={label} />;
}
