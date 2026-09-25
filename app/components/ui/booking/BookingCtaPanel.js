"use client";

/**
 * The one booking CTA plus its compact summary.
 *
 * States, in order: `Select dates` (disabled) → `Calculating price…`
 * (disabled) → `BOOK` / `Approx. €105`. Copy comes from the view model as
 * i18n keys, so the button can never show a raw literal, an exclamation mark
 * or a question mark.
 */

import React from "react";
import { Box, Typography, styled } from "@mui/material";
import { useTranslation } from "react-i18next";
import GradientBookButton from "@/app/components/ui/buttons/GradientBookButton";

const Root = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: theme.spacing(1),
  width: "100%",
  minWidth: 0,
}));

const DisabledCta = styled("button")(({ theme }) => ({
  width: "100%",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: Number(theme.shape.borderRadius) * 2,
  backgroundColor: theme.palette.action.disabledBackground,
  color: theme.palette.text.disabled,
  paddingBlock: theme.spacing(1.25),
  paddingInline: theme.spacing(2),
  fontFamily: theme.typography.button.fontFamily,
  fontSize: theme.typography.button.fontSize,
  fontWeight: theme.typography.fontWeightBold,
  letterSpacing: theme.typography.button.letterSpacing,
  lineHeight: theme.typography.button.lineHeight,
  textTransform: "uppercase",
  cursor: "not-allowed",
}));

const CtaFace = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing(0.25),
  lineHeight: theme.typography.button.lineHeight,
}));

const CtaWord = styled("span")(({ theme }) => ({
  fontFamily: theme.typography.button.fontFamily,
  fontWeight: theme.typography.fontWeightBold,
  fontSize: theme.typography.button.fontSize,
  letterSpacing: theme.typography.button.letterSpacing,
}));

const CtaPrice = styled("span")(({ theme }) => ({
  fontWeight: theme.typography.fontWeightMedium,
  fontSize: theme.typography.caption.fontSize,
  letterSpacing: theme.typography.caption.letterSpacing,
}));

const Summary = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: "baseline",
  columnGap: theme.spacing(1),
  rowGap: theme.spacing(0.25),
  paddingInline: theme.spacing(0.5),
}));

const SummaryItem = styled(Typography)(({ theme }) => ({
  fontSize: theme.typography.caption.fontSize,
  lineHeight: theme.typography.caption.lineHeight,
  color: theme.palette.text.secondary,
}));

const SummaryPrice = styled(SummaryItem)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  color: theme.palette.text.primary,
}));

const StatusLine = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "tone",
})(({ theme, tone }) => ({
  textAlign: "center",
  fontSize: theme.typography.caption.fontSize,
  lineHeight: theme.typography.caption.lineHeight,
  fontWeight: theme.typography.fontWeightMedium,
  color:
    tone === "error" ? theme.palette.error.main : theme.palette.text.secondary,
}));

export default function BookingCtaPanel({ view, onBook, onRetry, testIdPrefix = "" }) {
  const { t } = useTranslation();
  const prefix = testIdPrefix ? `${testIdPrefix}-` : "";
  const { cta, summary, statusMessage } = view;

  const label = t(cta.labelKey, { defaultValue: cta.labelFallback });
  const priceLabel = cta.showPrice
    ? t(cta.priceKey, {
        defaultValue: cta.showApprox
          ? `Approx. ${cta.priceText}`
          : cta.priceText,
        price: cta.priceText,
      })
    : "";

  return (
    <Root data-testid={`${prefix}booking-cta-panel`}>
      {cta.disabled ? (
        <DisabledCta
          type="button"
          disabled
          aria-disabled="true"
          data-testid={`${prefix}booking-cta`}
          data-state={view.status}
        >
          <span data-testid={`${prefix}book-label`}>{label}</span>
        </DisabledCta>
      ) : (
        <GradientBookButton
          data-testid={`${prefix}booking-cta`}
          data-state={view.status}
          data-car-start={view.canonicalStart || ""}
          data-car-end={view.canonicalEnd || ""}
          onClick={onBook}
        >
          <CtaFace>
            <CtaWord data-testid={`${prefix}book-label`}>{label}</CtaWord>
            {cta.showPrice ? (
              <CtaPrice data-testid={`${prefix}booking-price`}>{priceLabel}</CtaPrice>
            ) : null}
          </CtaFace>
        </GradientBookButton>
      )}

      {summary.show ? (
        <Summary data-testid={`${prefix}booking-summary`}>
          <SummaryItem component="span" data-testid={`${prefix}summary-range`}>
            {summary.rangeText}
          </SummaryItem>
          <SummaryItem component="span" data-testid={`${prefix}summary-days`}>
            {t(summary.daysKey, {
              days: summary.days,
              defaultValue:
                summary.days === 1
                  ? "1 rental day"
                  : `${summary.days} rental days`,
            })}
          </SummaryItem>
          <SummaryPrice component="span" data-testid={`${prefix}summary-price`}>
            {priceLabel}
          </SummaryPrice>
        </Summary>
      ) : null}

      {statusMessage ? (
        <StatusLine
          tone="error"
          role="status"
          data-testid={`${prefix}booking-status`}
        >
          {t(statusMessage.key, { defaultValue: statusMessage.fallback })}
        </StatusLine>
      ) : null}

      {view.status === "error" && onRetry ? (
        <StatusLine
          component="button"
          type="button"
          onClick={onRetry}
          data-testid={`${prefix}booking-retry`}
        >
          {t("catalog.booking.retry", { defaultValue: "Try again" })}
        </StatusLine>
      ) : null}
    </Root>
  );
}
