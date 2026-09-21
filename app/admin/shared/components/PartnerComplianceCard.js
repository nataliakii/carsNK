"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import PartnerComplianceGate from "@/app/admin/legal-profile/_components/PartnerComplianceGate";
import usePartnerLegalStatus from "@/app/admin/legal-profile/_components/usePartnerLegalStatus";

/**
 * Compliance summary on the company profile, so a partner sees what is
 * blocking them from trading without having to know the legal screens exist.
 *
 * The verdict comes from `/api/partner/legal/status`; nothing is decided here.
 */
export default function PartnerComplianceCard() {
  const { t } = useTranslation();
  const { loading, payload, gate } = usePartnerLegalStatus();

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <CircularProgress size={20} />
      </Paper>
    );
  }
  if (!payload || !gate) return null;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ sm: "center" }}
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontSize: "1rem", fontWeight: 700 }}>
            {t("partnerLegal.card.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("partnerLegal.card.subtitle")}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={gate.canOperate ? "success" : "warning"}
          label={
            gate.canOperate
              ? t("partnerLegal.card.open")
              : t("partnerLegal.card.blocked")
          }
        />
      </Stack>

      <PartnerComplianceGate gate={gate} hideWhenOpen />

      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button
          size="small"
          variant="outlined"
          component={Link}
          href="/admin/legal-profile"
        >
          {t("partnerLegal.card.openProfile")}
        </Button>
        <Button
          size="small"
          component={Link}
          href="/admin/legal-profile?tab=agreement"
        >
          {t("partnerLegal.card.openAgreement")}
        </Button>
      </Stack>
    </Paper>
  );
}
