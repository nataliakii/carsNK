"use client";

import Link from "next/link";
import { Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import usePartnerLegalStatus from "@/app/admin/legal-profile/_components/usePartnerLegalStatus";

const COPY = {
  COMPANY_DETAILS_INCOMPLETE: {
    label: "setup",
    title: "completeDetailsTitle",
    body: "completeDetailsBody",
  },
  DOCUMENTS_MISSING: {
    label: "setup",
    title: "uploadTitle",
    body: "uploadBody",
  },
  DOCUMENTS_UNDER_REVIEW: {
    label: "almost",
    title: "reviewTitle",
    body: "reviewBody",
  },
  TERMS_NOT_PUBLISHED: {
    label: "almost",
    title: "termsPreparingTitle",
    body: "termsPreparingBody",
  },
  TERMS_READY_TO_ACCEPT: {
    label: "setup",
    title: "termsReadyTitle",
    body: "termsReadyBody",
  },
  TERMS_UPDATE_REQUIRED: {
    label: "setup",
    title: "termsUpdateTitle",
    body: "termsUpdateBody",
  },
  READY_BUT_LISTING_DISABLED: {
    label: "almost",
    title: "listingTitle",
    body: "listingBody",
  },
  READY_TO_TRADE: {
    label: "ready",
    title: "readyTitle",
    body: "readyBody",
  },
  SUSPENDED: {
    label: "almost",
    title: "suspendedTitle",
    body: "suspendedBody",
  },
};

export default function PartnerComplianceCard() {
  const { t } = useTranslation();
  const { loading, payload } = usePartnerLegalStatus();
  const readiness = payload?.readiness;

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <CircularProgress size={20} />
      </Paper>
    );
  }
  if (!readiness) return null;

  const copy = COPY[readiness.state] || COPY.COMPANY_DETAILS_INCOMPLETE;
  const action = readiness.nextAction;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
      <Stack spacing={1}>
        <Chip
          size="small"
          sx={{ alignSelf: "flex-start" }}
          color={copy.label === "ready" ? "success" : "default"}
          label={t(`partnerLegal.card.labels.${copy.label}`)}
        />
        <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 700 }}>
          {t(`partnerLegal.card.states.${copy.title}`)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(`partnerLegal.card.states.${copy.body}`)}
        </Typography>
        {action ? (
          <Button
            size="small"
            variant="contained"
            component={Link}
            href={action.href}
            sx={{ alignSelf: "flex-start" }}
          >
            {t(`partnerLegal.card.actions.${action.labelKey}`)}
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}
