"use client";

import React from "react";
import {
  Typography,
  Box,
  Button,
  Paper,
  Stack,
  Divider,
} from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
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

const Root = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: theme.spacing(2.5),
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(0.5),
  paddingInline: theme.spacing(0.5),
  [theme.breakpoints.up("sm")]: {
    paddingInline: theme.spacing(1),
    gap: theme.spacing(3),
  },
}));

const Hero = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: theme.spacing(1.5),
}));

const SuccessIconBadge = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: theme.spacing(7),
  height: theme.spacing(7),
  borderRadius: "50%",
  backgroundColor: alpha(theme.palette.primary.main, 0.12),
  color: theme.palette.primary.main,
  [theme.breakpoints.up("sm")]: {
    width: theme.spacing(8),
    height: theme.spacing(8),
  },
}));

const SuccessIcon = styled(CheckCircleOutlineIcon)(({ theme }) => ({
  fontSize: theme.typography.h4.fontSize,
  [theme.breakpoints.up("sm")]: {
    fontSize: theme.typography.h3.fontSize,
  },
}));

const SuccessTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: theme.typography.h6.lineHeight,
  maxWidth: theme.spacing(44),
  [theme.breakpoints.up("sm")]: {
    maxWidth: theme.spacing(52),
    lineHeight: theme.typography.h5.lineHeight,
  },
}));

const LeadText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  textAlign: "center",
  lineHeight: theme.typography.body1.lineHeight,
  maxWidth: theme.spacing(48),
  marginInline: "auto",
  [theme.breakpoints.up("sm")]: {
    maxWidth: theme.spacing(56),
  },
}));

const Highlight = styled("span")(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: theme.typography.fontWeightBold,
}));

const SummaryCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  backgroundColor: theme.palette.background.subtle,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: "none",
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(2.5),
  },
}));

const SummaryRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: theme.spacing(2),
  paddingBlock: theme.spacing(0.75),
}));

const SummaryLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  flex: "1 1 auto",
}));

const SummaryValue = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightBold,
  flexShrink: 0,
  textAlign: "right",
}));

const SummaryDivider = styled(Divider)(({ theme }) => ({
  marginBlock: theme.spacing(0.25),
}));

const NoteText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textAlign: "center",
  lineHeight: theme.typography.body2.lineHeight,
  maxWidth: theme.spacing(50),
  marginInline: "auto",
}));

const WarningNote = styled(NoteText)(({ theme }) => ({
  color: theme.palette.warning.main,
  fontWeight: theme.typography.fontWeightMedium,
}));

const ActionsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  paddingTop: theme.spacing(0.5),
}));

const PrimaryAction = styled(Button)(({ theme }) => ({
  minWidth: theme.spacing(18),
  fontWeight: theme.typography.fontWeightBold,
  paddingInline: theme.spacing(4),
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    maxWidth: theme.spacing(40),
  },
}));

const PaymentActionRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
}));

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

  const startInstant =
    submittedOrder?.timeIn ||
    submittedOrder?.rentalStartDate ||
    presetDates?.startDate;
  const endInstant =
    submittedOrder?.timeOut ||
    submittedOrder?.rentalEndDate ||
    presetDates?.endDate;

  const titleCopy = message
    ? message
    : isMarketplace
      ? t("bookMesssages.bookRequestSent", {
          defaultValue:
            "Request sent. The rental company will review availability.",
        })
      : t("bookMesssages.bookOK");

  const numberOfDays = getOrderNumberOfDaysOrZero(submittedOrder);
  const totalPriceLabel = `€${formatEuroAmount(submittedOrder?.totalPrice)}`;

  return (
    <Root>
      <Hero>
        <SuccessIconBadge aria-hidden>
          <SuccessIcon />
        </SuccessIconBadge>
        <SuccessTitle variant="h6" component="h2">
          {titleCopy}
        </SuccessTitle>
      </Hero>

      <LeadText variant="body1">
        {t("bookMesssages.bookReceive")}{" "}
        <Highlight>{submittedOrder?.carModel}</Highlight> {t("basic.from")}{" "}
        <Highlight>
          {dayjs(startInstant).tz(displayTz).format("DD.MM.YY")}(
          {dayjs(startInstant).tz(displayTz).format("HH:mm")})
        </Highlight>{" "}
        {t("basic.to")}{" "}
        <Highlight>
          {dayjs(endInstant).tz(displayTz).format("DD.MM.YY")}(
          {dayjs(endInstant).tz(displayTz).format("HH:mm")})
        </Highlight>
        .
      </LeadText>

      <SummaryCard variant="outlined">
        <Stack spacing={0}>
          <SummaryRow>
            <SummaryLabel variant="body2">
              {t("bookMesssages.bookDays")}
            </SummaryLabel>
            <SummaryValue variant="body1">{numberOfDays}</SummaryValue>
          </SummaryRow>
          <SummaryDivider />
          <SummaryRow>
            <SummaryLabel variant="body2">
              {t("bookMesssages.bookPrice")}
            </SummaryLabel>
            <SummaryValue variant="body1">{totalPriceLabel}</SummaryValue>
          </SummaryRow>
        </Stack>
      </SummaryCard>

      {emailSent && (
        <NoteText variant="body2">{t("bookMesssages.bookFinalize")}</NoteText>
      )}

      {paymentUrl ? (
        <PaymentActionRow>
          <Button
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            color="primary"
          >
            {t("bookMesssages.payPrepayment", {
              defaultValue: "Pay prepayment",
            })}
          </Button>
        </PaymentActionRow>
      ) : showPaymentMissing ? (
        <WarningNote variant="body2">
          {t("bookMesssages.paymentLinkNotConfigured", {
            defaultValue:
              "Payment link is not configured. We will send it when online payment is available.",
          })}
        </WarningNote>
      ) : null}

      <NoteText variant="body2">
        {isMarketplace
          ? t("bookMesssages.bookCompanyReview", {
              defaultValue:
                "The company that owns this car will review your dates and confirm if the vehicle is available. You will only be asked to pay after they confirm.",
            })
          : t("order.weContact")}
      </NoteText>

      <ActionsRow>
        <PrimaryAction
          variant="contained"
          color="primary"
          onClick={onClose}
          size="large"
        >
          OK
        </PrimaryAction>
      </ActionsRow>
    </Root>
  );
};

export default SuccessMessage;
