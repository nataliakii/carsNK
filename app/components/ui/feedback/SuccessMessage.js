import React from "react";
import { Typography, Box, Button } from "@mui/material";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/ru";
import { getOrderNumberOfDaysOrZero } from "@/domain/orders/numberOfDays";
dayjs.extend(timezone);
import { useTranslation } from "react-i18next";
import { PAYMENT_LINK_STATUS } from "@/domain/orders/companyRentalPaymentPolicy";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";

function formatEuroAmount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "0";
  const roundedValue = Math.round(numericValue * 100) / 100;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(roundedValue);
}

const SuccessMessage = ({
  submittedOrder,
  presetDates,
  onClose,
  emailSent, // deprecated: уведомления отправляет бэкенд, фронт не знает о них
  message = null,
}) => {
  const { t } = useTranslation();
  const displayTz = submittedOrder?.timezone || "Europe/Athens";
  const isMarketplace = isMarketplaceRequestMode(submittedOrder?.bookingMode);
  const paymentUrl = isMarketplace ? "" : submittedOrder?.paymentUrl || "";
  const paymentLinkStatus = String(submittedOrder?.paymentLinkStatus || "");
  const showPaymentMissing =
    !isMarketplace &&
    !paymentUrl &&
    (paymentLinkStatus === PAYMENT_LINK_STATUS.NOT_CONFIGURED ||
      paymentLinkStatus === PAYMENT_LINK_STATUS.FAILED ||
      paymentLinkStatus === PAYMENT_LINK_STATUS.AMOUNT_TOO_LOW);
  return (
    <Box>
      {message ? (
        <Typography
          textAlign="center"
          sx={{ mt: 3, letterSpacing: 0.1 }}
          variant="h5"
          color="primary.red"
        >
          {message}
        </Typography>
      ) : (
        <Typography
          variant="h6"
          color="primary"
          textAlign="center"
          sx={{ textTransform: "uppercase" }}
        >
          {isMarketplace
            ? t("bookMesssages.bookRequestSent", {
                defaultValue:
                  "Request sent. The rental company will review availability.",
              })
            : t("bookMesssages.bookOK")}
        </Typography>
      )}

      <Typography
        variant="body1"
        sx={{ mt: 2, fontSize: { xs: "1.05rem", sm: "1.1rem" } }}
      >
        {t("bookMesssages.bookReceive")}{" "}
        <Box component="span" sx={{ color: "primary.red", fontWeight: 700 }}>
          {submittedOrder?.carModel}
        </Box>{" "}
        {t("basic.from")}{" "}
        <Box component="span" sx={{ color: "primary.red", fontWeight: 700 }}>
          {dayjs(
            submittedOrder?.timeIn ||
              submittedOrder?.rentalStartDate ||
              presetDates?.startDate
          )
            .tz(displayTz)
            .format("DD.MM.YY")}
          (
          {dayjs(
            submittedOrder?.timeIn ||
              submittedOrder?.rentalStartDate ||
              presetDates?.startDate
          )
            .tz(displayTz)
            .format("HH:mm")}
          )
        </Box>{" "}
        {t("basic.to")}{" "}
        <Box component="span" sx={{ color: "primary.red", fontWeight: 700 }}>
          {dayjs(
            submittedOrder?.timeOut ||
              submittedOrder?.rentalEndDate ||
              presetDates?.endDate
          )
            .tz(displayTz)
            .format("DD.MM.YY")}
          (
          {dayjs(
            submittedOrder?.timeOut ||
              submittedOrder?.rentalEndDate ||
              presetDates?.endDate
          )
            .tz(displayTz)
            .format("HH:mm")}
          )
        </Box>
        .
      </Typography>

      <Box sx={{ textAlign: "center", mt: 3, mb: 1 }}>
        <Typography
          sx={{ letterSpacing: 0.1 }}
          variant="h5"
          color="primary.red"
        >
          {t("bookMesssages.bookDays")}{" "}
          {getOrderNumberOfDaysOrZero(submittedOrder)}
        </Typography>
        <Typography
          sx={{ mt: 0.5, letterSpacing: 0.1 }}
          variant="h5"
          color="primary.red"
        >
          {t("bookMesssages.bookPrice")} €{formatEuroAmount(submittedOrder?.totalPrice)}
        </Typography>
      </Box>
      {emailSent && (
        <Typography variant="body1" sx={{ mt: 1 }}>
          {t("bookMesssages.bookFinalize")}
        </Typography>
      )}
      {paymentUrl ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Button
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            sx={{
              fontWeight: 700,
              backgroundColor: "primary.main",
              color: "white",
            }}
          >
            {t("bookMesssages.payPrepayment", {
              defaultValue: "Pay prepayment",
            })}
          </Button>
        </Box>
      ) : showPaymentMissing ? (
        <Typography
          variant="body2"
          textAlign="center"
          sx={{ mt: 2, color: "warning.main", fontWeight: 600 }}
        >
          {t("bookMesssages.paymentLinkNotConfigured", {
            defaultValue:
              "Payment link is not configured. We will send it when online payment is available.",
          })}
        </Typography>
      ) : null}
      <Typography
        variant="body1"
        textAlign="center"
        sx={{
          mt: 2,
          mb: 0.5,
          px: { xs: 0.5, sm: 1 },
          fontSize: { xs: "1.05rem", sm: "1.1rem" },
          lineHeight: 1.5,
        }}
      >
        {isMarketplace
          ? t("bookMesssages.bookCompanyReview", {
              defaultValue:
                "The company that owns this car will review your dates and confirm if the vehicle is available. You will only be asked to pay after they confirm.",
            })
          : t("order.weContact")}
      </Typography>
      {/* Добавлена кнопка OK для выхода из сообщения */}
      <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
        <Button
          variant="contained"
          color="error" // красный цвет по стилю MUI
          onClick={onClose}
          sx={{
            minWidth: "120px",
            fontWeight: "bold",
            fontSize: "1.1rem",
            backgroundColor: "primary.red", // красный цвет из темы
            color: "white",
            "&:hover": {
              backgroundColor: "#d32f2f",
            },
          }}
        >
          OK
        </Button>
      </Box>
    </Box>
  );
};

export default SuccessMessage;
