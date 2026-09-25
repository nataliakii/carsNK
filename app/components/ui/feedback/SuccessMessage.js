"use client";

import React from "react";
import { Typography, Box, Button, Paper } from "@mui/material";
import { styled, alpha, keyframes } from "@mui/material/styles";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
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

const popIn = keyframes`
  0% { transform: scale(0.72); opacity: 0; }
  70% { transform: scale(1.06); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;

const haloPulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.55; }
  50% { transform: scale(1.18); opacity: 0.18; }
`;

const Root = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: theme.spacing(2.25),
  paddingTop: theme.spacing(0.5),
  paddingBottom: theme.spacing(0.5),
  paddingInline: theme.spacing(0.5),
  [theme.breakpoints.up("sm")]: {
    paddingInline: theme.spacing(1),
    gap: theme.spacing(2.75),
  },
}));

const Hero = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: theme.spacing(1.25),
  position: "relative",
  paddingBlock: theme.spacing(1),
  "&::before": {
    content: '""',
    position: "absolute",
    inset: `${theme.spacing(-1.5)} ${theme.spacing(-1)} auto`,
    height: theme.spacing(16),
    borderRadius: theme.spacing(4),
    background: `radial-gradient(ellipse at center, ${alpha(
      theme.palette.primary.main,
      0.16
    )} 0%, ${alpha(theme.palette.primary.main, 0)} 70%)`,
    pointerEvents: "none",
    zIndex: 0,
  },
  "& > *": {
    position: "relative",
    zIndex: 1,
  },
}));

const IconWrap = styled(Box)(({ theme }) => ({
  position: "relative",
  width: theme.spacing(9),
  height: theme.spacing(9),
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  [theme.breakpoints.up("sm")]: {
    width: theme.spacing(10),
    height: theme.spacing(10),
  },
}));

const IconHalo = styled(Box)(({ theme }) => ({
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  border: `2px solid ${alpha(theme.palette.primary.main, 0.28)}`,
  animation: `${haloPulse} 2.4s ease-in-out infinite`,
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
}));

const SuccessIconBadge = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: theme.spacing(7),
  height: theme.spacing(7),
  borderRadius: "50%",
  background: `linear-gradient(160deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
  color: theme.palette.primary.contrastText,
  boxShadow: `0 10px 24px ${alpha(theme.palette.primary.main, 0.35)}`,
  animation: `${popIn} 520ms cubic-bezier(0.22, 1, 0.36, 1)`,
  [theme.breakpoints.up("sm")]: {
    width: theme.spacing(8),
    height: theme.spacing(8),
  },
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
  },
}));

const SuccessIcon = styled(CheckRoundedIcon)(({ theme }) => ({
  fontSize: theme.typography.h4.fontSize,
  [theme.breakpoints.up("sm")]: {
    fontSize: theme.typography.h3.fontSize,
  },
}));

const StatusChip = styled("span")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.75),
  paddingInline: theme.spacing(1.5),
  paddingBlock: theme.spacing(0.4),
  borderRadius: theme.spacing(3),
  fontSize: theme.typography.caption.fontSize,
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
  "&::before": {
    content: '""',
    width: 7,
    height: 7,
    borderRadius: "50%",
    backgroundColor: theme.palette.primary.main,
    boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.18)}`,
  },
}));

const SuccessTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: 1.25,
  maxWidth: theme.spacing(46),
  [theme.breakpoints.up("sm")]: {
    maxWidth: theme.spacing(54),
  },
}));

const CarName = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: "-0.02em",
  lineHeight: 1.15,
}));

const LeadText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textAlign: "center",
  lineHeight: theme.typography.body1.lineHeight,
  maxWidth: theme.spacing(48),
  marginInline: "auto",
  [theme.breakpoints.up("sm")]: {
    maxWidth: theme.spacing(56),
  },
}));

const TimelineCard = styled(Paper)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(1.75, 2),
  borderRadius: Number(theme.shape.borderRadius) * 2,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
  boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, 0.04)}`,
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(2, 2.5),
    gap: theme.spacing(1.5),
  },
}));

const TimePoint = styled(Box)({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
});

const TimeLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: theme.typography.fontWeightBold,
  fontSize: theme.typography.caption.fontSize,
  marginBottom: theme.spacing(0.4),
}));

const TimeDate = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: 1.2,
}));

const TimeClock = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: theme.typography.fontWeightBold,
  marginTop: theme.spacing(0.25),
}));

const TimelineRail = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  minWidth: theme.spacing(4),
  "&::before, &::after": {
    content: '""',
    flex: 1,
    height: 2,
    background: `linear-gradient(90deg, ${alpha(
      theme.palette.primary.main,
      0.08
    )}, ${theme.palette.primary.main})`,
  },
  "&::after": {
    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${alpha(
      theme.palette.primary.main,
      0.08
    )})`,
  },
}));

const TimelineDot = styled(Box)(({ theme }) => ({
  width: 10,
  height: 10,
  borderRadius: "50%",
  marginInline: theme.spacing(0.5),
  backgroundColor: theme.palette.primary.main,
  boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.16)}`,
  flexShrink: 0,
}));

const MetricsRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: theme.spacing(1.25),
}));

const MetricCard = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(0.4),
  padding: theme.spacing(1.5, 1),
  borderRadius: Number(theme.shape.borderRadius) * 1.75,
  backgroundColor: theme.palette.background.subtle,
  border: `1px solid ${theme.palette.divider}`,
}));

const MetricLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: theme.typography.fontWeightBold,
  fontSize: theme.typography.caption.fontSize,
}));

const MetricValue = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightBold,
  lineHeight: 1.1,
}));

const NoteCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderRadius: Number(theme.shape.borderRadius) * 1.75,
  backgroundColor: alpha(theme.palette.primary.main, 0.06),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
}));

const NoteText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textAlign: "center",
  lineHeight: 1.55,
}));

const WarningNote = styled(NoteText)(({ theme }) => ({
  color: theme.palette.warning.main,
  fontWeight: theme.typography.fontWeightMedium,
}));

const ActionsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  paddingTop: theme.spacing(0.25),
}));

const PrimaryAction = styled(Button)(({ theme }) => ({
  minWidth: theme.spacing(18),
  fontWeight: theme.typography.fontWeightBold,
  paddingInline: theme.spacing(5),
  borderRadius: Number(theme.shape.borderRadius) * 2,
  boxShadow: `0 10px 22px ${alpha(theme.palette.primary.main, 0.28)}`,
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
            "Almost yours. The rental company is checking availability.",
        })
      : t("bookMesssages.bookOK");

  const numberOfDays = getOrderNumberOfDaysOrZero(submittedOrder);
  const totalPriceLabel = `€${formatEuroAmount(submittedOrder?.totalPrice)}`;
  const carModel = submittedOrder?.carModel || "";
  const startDate = dayjs(startInstant).tz(displayTz);
  const endDate = dayjs(endInstant).tz(displayTz);

  return (
    <Root>
      <Hero>
        <IconWrap aria-hidden>
          <IconHalo />
          <SuccessIconBadge>
            <SuccessIcon />
          </SuccessIconBadge>
        </IconWrap>
        <StatusChip>
          {isMarketplace
            ? t("bookMesssages.bookAwaiting", {
                defaultValue: "Awaiting a yes",
              })
            : t("bookMesssages.bookConfirmedBadge", {
                defaultValue: "Confirmed",
              })}
        </StatusChip>
        <SuccessTitle variant="h6" component="h2">
          {titleCopy}
        </SuccessTitle>
        {carModel ? (
          <CarName variant="h5" component="p">
            {carModel}
          </CarName>
        ) : null}
      </Hero>

      <LeadText variant="body1">
        {isMarketplace
          ? t("bookMesssages.bookRequestLead", {
              defaultValue:
                "Fingers crossed — they are looking at those dates right now.",
            })
          : t("bookMesssages.bookReceive")}
      </LeadText>

      <TimelineCard variant="outlined">
        <TimePoint sx={{ textAlign: "left" }}>
          <TimeLabel variant="caption">
            {t("bookMesssages.bookPickup", { defaultValue: "Pickup" })}
          </TimeLabel>
          <TimeDate variant="body1">{startDate.format("DD.MM.YY")}</TimeDate>
          <TimeClock variant="body2">{startDate.format("HH:mm")}</TimeClock>
        </TimePoint>
        <TimelineRail>
          <TimelineDot />
        </TimelineRail>
        <TimePoint sx={{ textAlign: "right" }}>
          <TimeLabel variant="caption">
            {t("bookMesssages.bookReturn", { defaultValue: "Return" })}
          </TimeLabel>
          <TimeDate variant="body1">{endDate.format("DD.MM.YY")}</TimeDate>
          <TimeClock variant="body2">{endDate.format("HH:mm")}</TimeClock>
        </TimePoint>
      </TimelineCard>

      <MetricsRow>
        <MetricCard>
          <MetricLabel variant="caption">
            {t("bookMesssages.bookDays")}
          </MetricLabel>
          <MetricValue variant="h5">{numberOfDays}</MetricValue>
        </MetricCard>
        <MetricCard>
          <MetricLabel variant="caption">
            {t("bookMesssages.bookPrice")}
          </MetricLabel>
          <MetricValue variant="h5">{totalPriceLabel}</MetricValue>
        </MetricCard>
      </MetricsRow>

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

      <NoteCard>
        <NoteText variant="body2">
          {isMarketplace
            ? t("bookMesssages.bookCompanyReview", {
                defaultValue:
                  "They're reviewing your dates now. You'll only pay if they confirm.",
              })
            : t("order.weContact")}
        </NoteText>
      </NoteCard>

      <ActionsRow>
        <PrimaryAction
          variant="contained"
          color="primary"
          onClick={onClose}
          size="large"
        >
          {t("bookMesssages.bookDismiss", { defaultValue: "Got it" })}
        </PrimaryAction>
      </ActionsRow>
    </Root>
  );
};

export default SuccessMessage;
