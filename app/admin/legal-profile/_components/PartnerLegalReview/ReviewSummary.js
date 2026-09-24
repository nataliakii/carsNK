"use client";

import { Alert, Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { buildPartnerReviewReadiness } from "@/domain/legal/partnerReviewReadiness";

function SummaryRow({ label, value }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={0.5}
      justifyContent="space-between"
      sx={{ py: 0.4 }}
    >
      <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontSize: "0.88rem", fontWeight: 600, textAlign: { sm: "right" } }}>
        {value}
      </Typography>
    </Stack>
  );
}

export default function ReviewSummary({ row }) {
  const { t } = useTranslation();
  const readiness =
    row?.readiness ||
    buildPartnerReviewReadiness({
      profile: row?.verification
        ? {
            ...row.verification,
            documents: row.verification.documents || [],
            verificationStatus: row.verification.status,
            customAgreement: row.verification.customAgreement,
          }
        : null,
      country: row?.country || "",
      activeAgreement: row?.agreement || null,
      agreementHistory: row?.agreementHistory || [],
      listedOnMarketplace: row?.listedOnMarketplace,
    });

  const requiredValue = readiness.requiredDocuments.noneRequired
    ? t("partnerLegal.review.readiness.requiredNone", {
        defaultValue: "None",
      })
    : readiness.requiredDocuments.complete
      ? t("partnerLegal.review.readiness.complete", { defaultValue: "Complete" })
      : t("partnerLegal.review.readiness.nMissing", {
          defaultValue: "{{count}} missing",
          count: readiness.requiredDocuments.missingCount,
        });

  const agreementValue =
    readiness.platformAgreement === "accepted"
      ? t("partnerLegal.review.readiness.agreementAccepted", {
          defaultValue: "Accepted",
        })
      : readiness.platformAgreement === "not_accepted"
        ? t("partnerLegal.review.readiness.agreementNotAccepted", {
            defaultValue: "Not accepted",
          })
        : t("partnerLegal.review.readiness.agreementNotAvailable", {
            defaultValue: "Not available yet",
          });

  const rentalValue =
    readiness.rentalTerms === "added"
      ? t("partnerLegal.review.readiness.rentalAdded", { defaultValue: "Added" })
      : t("partnerLegal.review.readiness.rentalStandard", {
          defaultValue: "Rovaro standard terms apply",
        });

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
        {t("partnerLegal.review.readiness.title", {
          defaultValue: "Review readiness",
        })}
      </Typography>

      <SummaryRow
        label={t("partnerLegal.review.readiness.companyDetails", {
          defaultValue: "Company details",
        })}
        value={
          readiness.companyDetails.complete
            ? t("partnerLegal.review.readiness.complete", { defaultValue: "Complete" })
            : t("partnerLegal.review.readiness.missingInfo", {
                defaultValue: "Missing information",
              })
        }
      />
      <SummaryRow
        label={t("partnerLegal.review.readiness.requiredDocs", {
          defaultValue: "Required documents",
        })}
        value={requiredValue}
      />
      <SummaryRow
        label={t("partnerLegal.review.readiness.optionalDocs", {
          defaultValue: "Optional documents",
        })}
        value={t("partnerLegal.review.readiness.optionalUploaded", {
          defaultValue: "{{count}} uploaded",
          count: readiness.optionalDocuments.uploadedCount,
        })}
      />
      <SummaryRow
        label={t("partnerLegal.review.readiness.platformAgreement", {
          defaultValue: "Platform agreement",
        })}
        value={agreementValue}
      />
      <SummaryRow
        label={t("partnerLegal.review.readiness.rentalTerms", {
          defaultValue: "Company rental terms",
        })}
        value={rentalValue}
      />

      {readiness.canApprove ? (
        <Alert severity="success" sx={{ mt: 1.5 }}>
          {t("partnerLegal.review.readiness.ready", {
            defaultValue: "Ready for your decision.",
          })}
          {readiness.requiredDocuments.noneRequired ? (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {t("partnerLegal.review.readiness.noRequiredMissing", {
                defaultValue: "No required documents are missing.",
              })}
            </Typography>
          ) : null}
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem" }}>
            {t("partnerLegal.review.readiness.notReady", {
              defaultValue:
                "Cannot be approved yet. The company still needs to provide:",
            })}
          </Typography>
          <Stack component="ul" sx={{ m: 0, pl: 2, mt: 0.5 }}>
            {(readiness.missingItems || []).map((item) => (
              <Typography component="li" key={`${item.type}-${item.key}`} variant="body2">
                {item.label}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}
    </Box>
  );
}
