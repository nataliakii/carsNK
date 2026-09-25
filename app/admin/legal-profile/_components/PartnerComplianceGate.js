"use client";

import Link from "next/link";
import { Alert, AlertTitle, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { PARTNER_GATE_STEP } from "@/domain/legal/partnerGate";

const STEP_HREF = {
  [PARTNER_GATE_STEP.PROFILE]: "/admin/company/setup?step=details",
  [PARTNER_GATE_STEP.AGREEMENT]: "/admin/company/setup?step=details",
};

/**
 * What is stopping this partner from trading.
 *
 * The list comes from the server (`/api/partner/legal/status`), which
 * composes the verification and agreement rules. This component only renders
 * it and links to the screen that clears each blocker — it never decides on
 * its own whether the gate is open.
 */
export default function PartnerComplianceGate({
  gate,
  hideWhenOpen = false,
  omitSteps = [],
  listedOnMarketplace = true,
}) {
  const { t } = useTranslation();

  if (!gate) return null;

  if (gate.canOperate) {
    if (listedOnMarketplace === false) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>{t("partnerLegal.gate.blockedTitle")}</AlertTitle>
          {t("partnerLegal.gate.listingPending")}
        </Alert>
      );
    }
    if (hideWhenOpen) return null;
    return (
      <Alert severity="success" sx={{ mb: 2 }}>
        <AlertTitle>{t("partnerLegal.gate.okTitle")}</AlertTitle>
        {t("partnerLegal.gate.okBody")}
      </Alert>
    );
  }

  const blockers = (gate.blockers || []).filter(
    (blocker) => !omitSteps.includes(blocker.step)
  );
  if (!blockers.length) return null;

  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      <AlertTitle>{t("partnerLegal.gate.blockedTitle")}</AlertTitle>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {t("partnerLegal.gate.blockedBody")}
      </Typography>
      <Stack spacing={1}>
        {blockers.map((blocker) => {
          const href = STEP_HREF[blocker.step];
          return (
            <Stack
              key={blocker.code}
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ sm: "center" }}
            >
              <Typography variant="body2" sx={{ flex: 1 }}>
                {t(`partnerLegal.gate.blocker.${blocker.code}`)}
              </Typography>
              {href ? (
                <Button
                  size="small"
                  variant="outlined"
                  component={Link}
                  href={href}
                >
                  {blocker.step === PARTNER_GATE_STEP.AGREEMENT
                    ? t("partnerLegal.gate.goToAgreement")
                    : t("partnerLegal.gate.goToProfile")}
                </Button>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {t("partnerLegal.gate.operatorAction")}
                </Typography>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Alert>
  );
}
