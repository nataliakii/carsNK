"use client";

import { Alert, Box, Chip, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import PartnerReviewActions from "@/app/admin/legal-profile/_components/PartnerReviewActions";
import PartnerDocumentsCard from "@/app/admin/legal-profile/_components/PartnerDocumentsCard";
import { buildPartnerReviewCompliance } from "@/domain/legal/partnerReviewWorkspace";

const AGREEMENT_LABEL = {
  not_accepted: "Not accepted",
  current: "Current",
  outdated: "Outdated",
  terminated: "Terminated",
};

export function partnerStatusColor(status) {
  if (status === "VERIFIED") return "success";
  if (status === "PENDING_VERIFICATION") return "warning";
  if (status === "REJECTED" || status === "SUSPENDED") return "error";
  return "default";
}

export function formatPartnerDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function Field({ label, value }) {
  if (!value) return null;
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ py: 0.5 }}
      justifyContent="space-between"
    >
      <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, textAlign: "right" }}>
        {value}
      </Typography>
    </Stack>
  );
}

/**
 * KYB detail for one partner: compliance summary, review actions, profile
 * fields, signed agreement and uploaded documents.
 *
 * Shared by the Partners → Needs review queue and the partner Legal tab, so
 * both surfaces show and do exactly the same thing.
 */
export default function PartnerReviewDetail({ row, onChanged, viewMode }) {
  const { t } = useTranslation();
  const v = row.verification;
  const recommended = [
    ...(v?.completeness?.missingRecommendedFields || []),
    ...(v?.completeness?.missingRecommendedDocuments || []),
  ];
  const agreement = row.agreement;
  const compliance =
    row.compliance ||
    buildPartnerReviewCompliance({
      verificationStatus: v?.status || null,
      documentCount: (v?.documents || []).length,
      listedOnMarketplace: row.listedOnMarketplace,
      activeAgreement: agreement,
      agreementHistory: row.agreementHistory || [],
      completeness: v?.completeness || null,
    });
  const verificationLabel = compliance.verificationStatus
    ? t(`partnerLegal.status.${compliance.verificationStatus}.label`, {
        defaultValue: compliance.verificationStatus,
      })
    : t("admin.legalHub.queueNoProfile", { defaultValue: "No profile" });

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {row.companyName}
        </Typography>
        {row.country ? <Chip size="small" label={row.country} /> : null}
        {row.listedOnMarketplace === false ? (
          <Chip
            size="small"
            color="default"
            variant="outlined"
            label={t("admin.legalHub.queueUnlisted", {
              defaultValue: "Not listed yet",
            })}
          />
        ) : null}
      </Stack>

      <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <Field
          label={t("admin.legalHub.queueDocsStatus", { defaultValue: "Documents" })}
          value={t("admin.legalHub.queueDocsUploaded", {
            defaultValue: "{{count}} uploaded",
            count: compliance.documentCount,
          })}
        />
        <Field
          label={t("admin.legalHub.queueVerification", { defaultValue: "Verification" })}
          value={verificationLabel}
        />
        {v?.submittedAt ? (
          <Field
            label={t("admin.legalHub.queueSubmittedLabel", { defaultValue: "Submitted" })}
            value={formatPartnerDate(v.submittedAt)}
          />
        ) : null}
        <Field
          label={t("admin.legalHub.queueAgreementStatus", {
            defaultValue: "Partner agreement",
          })}
          value={t(`admin.legalHub.agreement.${compliance.agreementStatus}`, {
            defaultValue: AGREEMENT_LABEL[compliance.agreementStatus] || compliance.agreementStatus,
          })}
        />
        <Field
          label={t("admin.legalHub.queueListing", { defaultValue: "Marketplace listing" })}
          value={
            compliance.listingOn
              ? t("admin.legalHub.queueListingOn", { defaultValue: "On" })
              : t("admin.legalHub.queueListingOff", { defaultValue: "Off" })
          }
        />
        <Field
          label={t("admin.legalHub.queueOperating", { defaultValue: "Operating status" })}
          value={
            compliance.operating === "ready"
              ? t("admin.legalHub.queueOperatingReady", { defaultValue: "Ready" })
              : t("admin.legalHub.queueOperatingBlocked", { defaultValue: "Blocked" })
          }
        />
        {compliance.operating !== "ready" ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {t("admin.legalHub.queueOperatingHint", {
              defaultValue:
                "Verification alone does not let this company operate. It also needs the current partner agreement and marketplace listing, and it must not be rejected or suspended.",
            })}
          </Typography>
        ) : null}
      </Box>

      <PartnerReviewActions
        profile={
          v
            ? {
                companyId: row.companyId,
                verificationStatus: v.status,
              }
            : null
        }
        companyId={row.companyId}
        onChanged={onChanged}
        viewMode={viewMode}
      />

      {recommended.length ? (
        <Alert severity="info">
          {t("admin.legalHub.queueIncompleteHint", {
            defaultValue: "Some recommended fields or documents are still missing.",
          })}
        </Alert>
      ) : null}

      {v ? (
        <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
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
            value={[v.insuranceProvider, v.insurancePolicyReference]
              .filter(Boolean)
              .join(" · ")}
          />
        </Box>
      ) : (
        <Alert severity="info">
          {t("partnerLegal.review.noProfile", {
            defaultValue: "This company has not started a legal profile yet.",
          })}
        </Alert>
      )}

      {agreement ? (
        <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1, fontSize: "0.9rem" }}>
            {t("admin.legalHub.queueAgreement", {
              defaultValue: "Accepted agreement",
            })}
          </Typography>
          <Field
            label={t("admin.legalHub.queueAgreementVersion", {
              defaultValue: "Agreement",
            })}
            value={agreement.agreementId}
          />
          <Field
            label={t("admin.legalHub.queueAgreementSigner", {
              defaultValue: "Signer",
            })}
            value={[agreement.signerName, agreement.signerRole, agreement.signerEmail]
              .filter(Boolean)
              .join(" · ")}
          />
          <Field
            label={t("admin.legalHub.queueAgreementAt", {
              defaultValue: "Accepted",
            })}
            value={formatPartnerDate(agreement.acceptedAt)}
          />
          <Field
            label={t("admin.legalHub.queueAgreementChecksum", {
              defaultValue: "Checksum",
            })}
            value={agreement.packageChecksum}
          />
        </Box>
      ) : null}

      <PartnerDocumentsCard
        documents={v?.documents || []}
        editable={false}
        companyId={row.companyId}
      />
    </Stack>
  );
}
