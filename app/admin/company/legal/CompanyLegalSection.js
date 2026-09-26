"use client";

import { Suspense, useCallback, useMemo } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
} from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import CompanySettingsLayout from "@/app/admin/company/CompanySettingsLayout";
import { COMPANY_SETTINGS_FORM_MAX_WIDTH } from "@/domain/admin/companySettingsLayout";
import PartnerLegalProfileSection from "@/app/admin/legal-profile/PartnerLegalProfileSection";
import usePartnerLegalStatus from "@/app/admin/legal-profile/_components/usePartnerLegalStatus";
import {
  COMPANY_LEGAL_TABS,
  COMPANY_TERMS_PUBLICATION,
} from "@/domain/legal/companyLegalPage";

import CompanyTermsPanel from "./CompanyTermsPanel";
import CompanyRentalTermsPanel from "./CompanyRentalTermsPanel";

const TAB_LABEL_KEY = {
  details: "details",
  documents: "documents",
  terms: "rentalTermsTab",
};

function CompanyLegalNextStep({ publication }) {
  const { t } = useTranslation();
  if (publication === COMPANY_TERMS_PUBLICATION.READY_TO_ACCEPT) {
    return (
      <Alert
        severity="warning"
        sx={{ mb: 2 }}
        data-testid="company-legal-next-step"
      >
        <AlertTitle>
          {t("partnerLegal.companyPage.nextStep.signTitle")}
        </AlertTitle>
        {t("partnerLegal.companyPage.nextStep.signBody")}
      </Alert>
    );
  }
  if (publication === COMPANY_TERMS_PUBLICATION.UPDATE_REQUIRED) {
    return (
      <Alert
        severity="warning"
        sx={{ mb: 2 }}
        data-testid="company-legal-next-step"
      >
        <AlertTitle>
          {t("partnerLegal.companyPage.termsReacceptTitle", {
            defaultValue:
              "Updated Rovaro partner terms require your acceptance",
          })}
        </AlertTitle>
        {t("partnerLegal.companyPage.termsReacceptBody", {
          defaultValue:
            "Rovaro has published an updated version of the partner terms. Please review the current Partner Agreement, Partner Operating Rules and Data Protection Schedule and accept the updated package on behalf of your company.",
        })}
      </Alert>
    );
  }
  if (publication === COMPANY_TERMS_PUBLICATION.ACCEPTED) {
    return (
      <Alert
        severity="success"
        sx={{ mb: 2 }}
        data-testid="company-legal-next-step"
      >
        <AlertTitle>{t("partnerLegal.companyPage.termsAccepted")}</AlertTitle>
        {t("partnerLegal.companyPage.nextStep.doneBody")}
      </Alert>
    );
  }
  return (
    <Alert severity="info" sx={{ mb: 2 }} data-testid="company-legal-next-step">
      <AlertTitle>
        {t("partnerLegal.companyPage.nextStep.preparingTitle")}
      </AlertTitle>
      {t("partnerLegal.companyPage.nextStep.preparingBody")}
    </Alert>
  );
}

function tabFromSearch(searchParams) {
  const tab = searchParams?.get("step") || searchParams?.get("tab");
  return COMPANY_LEGAL_TABS.includes(tab) ? tab : "details";
}

function CompanyLegalInner({ viewMode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams);

  // One server-resolved publication state, shared by Documents and Terms.
  // Neither tab re-derives it from the agreement package.
  const {
    loading,
    error,
    payload,
    termsPublication,
    terms,
    legalState,
    legalActionCount,
    agreementPackage,
    changedDocumentTypes,
    missingDocumentTypes,
    reload,
  } = usePartnerLegalStatus();
  const publication = termsPublication || "";

  const setTab = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.delete("tab");
      if (next === "details") params.delete("step");
      else params.set("step", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const value = useMemo(
    () => Math.max(0, COMPANY_LEGAL_TABS.indexOf(tab)),
    [tab]
  );

  const tabs = useMemo(
    () =>
      COMPANY_LEGAL_TABS.map((id) => ({
        id,
        label: t(`partnerLegal.companyPage.${TAB_LABEL_KEY[id] || id}`),
      })),
    [t]
  );

  return (
    <CompanySettingsLayout
      title={t("partnerLegal.companyPage.title")}
      tabs={tabs}
      tabValue={value}
      onTabChange={(_, next) => setTab(COMPANY_LEGAL_TABS[next] || "details")}
    >
      {!loading && error ? (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={reload}>
              {t("common.retry", { defaultValue: "Retry" })}
            </Button>
          }
        >
          {t("partnerLegal.companyPage.loadFailed", {
            defaultValue:
              "Could not load the current published partner package. Please retry.",
          })}
        </Alert>
      ) : null}
      {tab === "documents" ? (
        <PartnerLegalProfileSection
          variant="company"
          panel="documents"
          viewMode={viewMode}
          termsPublication={publication}
          legalState={legalState}
        />
      ) : tab === "terms" ? (
        <Box
          data-testid="company-legal-terms"
          sx={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            overflow: "visible",
          }}
        >
          <CompanyRentalTermsPanel />
        </Box>
      ) : (
        <Stack
          data-testid="company-legal-details"
          spacing={0}
          divider={<Divider sx={{ my: 3 }} />}
          sx={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            overflow: "visible",
          }}
        >
          {loading ? (
            <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
              <CircularProgress size={24} />
            </Box>
          ) : !error && payload ? (
            <CompanyLegalNextStep publication={publication} />
          ) : null}
          <Box
            data-testid="company-legal-terms-form"
            sx={{
              width: "100%",
              maxWidth: COMPANY_SETTINGS_FORM_MAX_WIDTH,
              minWidth: 0,
            }}
          >
            {!loading && !error && payload ? (
              <CompanyTermsPanel
                termsPublication={publication}
                terms={terms}
                legalState={legalState}
                packageData={agreementPackage}
                legalActionCount={legalActionCount}
                changedDocumentTypes={changedDocumentTypes}
                missingDocumentTypes={missingDocumentTypes}
                onAccepted={reload}
              />
            ) : null}
          </Box>
          <PartnerLegalProfileSection
            variant="company"
            panel="details"
            viewMode={viewMode}
            termsPublication={publication}
            legalState={legalState}
          />
        </Stack>
      )}
    </CompanySettingsLayout>
  );
}

export default function CompanyLegalSection({ viewMode }) {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      }
    >
      <CompanyLegalInner viewMode={viewMode} />
    </Suspense>
  );
}
