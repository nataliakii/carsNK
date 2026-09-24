"use client";

import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { Field, formatPartnerDate } from "@/app/admin/legal-profile/_components/PartnerLegalReview/reviewField";

export default function RentalTermsSummary({ row }) {
  const { t } = useTranslation();
  const readiness = row?.readiness;
  const agreement = row?.agreement;
  const rental =
    readiness?.rentalTerms === "added"
      ? t("partnerLegal.review.readiness.rentalAdded", { defaultValue: "Added" })
      : t("partnerLegal.review.readiness.rentalStandard", {
          defaultValue: "Rovaro standard terms apply",
        });
  const platform =
    readiness?.platformAgreement === "accepted"
      ? t("partnerLegal.review.readiness.agreementAccepted", {
          defaultValue: "Accepted",
        })
      : readiness?.platformAgreement === "not_accepted"
        ? t("partnerLegal.review.readiness.agreementNotAccepted", {
            defaultValue: "Not accepted",
          })
        : t("partnerLegal.review.readiness.agreementNotAvailable", {
            defaultValue: "Not available yet",
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
        {t("partnerLegal.review.termsTitle", {
          defaultValue: "Agreement and rental terms",
        })}
      </Typography>
      <Field
        label={t("partnerLegal.review.readiness.platformAgreement", {
          defaultValue: "Platform agreement",
        })}
        value={platform}
      />
      {agreement ? (
        <>
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
        </>
      ) : null}
      <Field
        label={t("partnerLegal.review.readiness.rentalTerms", {
          defaultValue: "Company rental terms",
        })}
        value={rental}
      />
      <Field
        label={t("admin.legalHub.queueListing", { defaultValue: "Marketplace listing" })}
        value={
          readiness?.listedOnMarketplace !== false
            ? t("admin.legalHub.queueListingOn", { defaultValue: "On" })
            : t("admin.legalHub.queueListingOff", { defaultValue: "Off" })
        }
      />
    </Box>
  );
}
