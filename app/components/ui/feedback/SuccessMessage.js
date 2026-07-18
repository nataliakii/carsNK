import React from "react";
import { Typography, Box, Button } from "@mui/material";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/ru";
import { getOrderNumberOfDaysOrZero } from "@/domain/orders/numberOfDays";
dayjs.extend(timezone);
import { useTranslation } from "react-i18next";

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
  // ...
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
          {t("bookMesssages.bookOK")}
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
            .tz("Europe/Athens")
            .format("DD.MM.YY")}
          (
          {dayjs(
            submittedOrder?.timeIn ||
              submittedOrder?.rentalStartDate ||
              presetDates?.startDate
          )
            .tz("Europe/Athens")
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
            .tz("Europe/Athens")
            .format("DD.MM.YY")}
          (
          {dayjs(
            submittedOrder?.timeOut ||
              submittedOrder?.rentalEndDate ||
              presetDates?.endDate
          )
            .tz("Europe/Athens")
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
        {t("order.weContact")}
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
