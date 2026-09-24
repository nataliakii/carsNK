"use client";

import { Alert, Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { Field, formatPartnerDate } from "@/app/admin/legal-profile/_components/PartnerLegalReview/reviewField";

export default function CompanyDetails({ row }) {
  const { t } = useTranslation();
  const v = row?.verification;

  if (!v) {
    return (
      <Alert severity="info">
        {t("partnerLegal.review.noProfile", {
          defaultValue: "This company has not started a legal profile yet.",
        })}
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Typography sx={{ fontWeight: 800, mb: 1, fontSize: "0.95rem" }}>
        {t("partnerLegal.review.companyDetailsTitle", {
          defaultValue: "Company details",
        })}
      </Typography>
      <Stack>
        <Field label={t("partnerLegal.form.fields.legalName.label")} value={v.legalName} />
        <Field label={t("partnerLegal.form.fields.tradingName.label")} value={v.tradingName} />
        <Field label={t("partnerLegal.form.fields.nifCif.label")} value={v.nifCif} />
        <Field
          label={t("partnerLegal.form.fields.registrationNumber.label")}
          value={v.registrationNumber}
        />
        <Field
          label={t("partnerLegal.form.fields.signatoryName.label")}
          value={[v.signatoryName, v.signatoryRole].filter(Boolean).join(" · ")}
        />
        <Field
          label={t("partnerLegal.form.fields.businessEmail.label")}
          value={v.businessEmail || row.companyEmail}
        />
        <Field label={t("partnerLegal.form.fields.businessPhone.label")} value={v.businessPhone} />
        <Field
          label={t("partnerLegal.form.fields.registeredAddress.label")}
          value={v.registeredAddress}
        />
        <Field
          label={t("partnerLegal.form.fields.insuranceProvider.label")}
          value={[v.insuranceProvider, v.insurancePolicyReference].filter(Boolean).join(" · ")}
        />
        {v.submittedAt ? (
          <Field
            label={t("admin.legalHub.queueSubmittedLabel", { defaultValue: "Submitted" })}
            value={formatPartnerDate(v.submittedAt)}
          />
        ) : null}
      </Stack>
    </Box>
  );
}
