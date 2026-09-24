"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import PartnerLegalProfileSection from "@/app/admin/legal-profile/PartnerLegalProfileSection";
import { adminSectionTabsSx } from "@app/admin/shared/components/AdminSectionTabs";
import {
  COMPANY_LEGAL_TABS,
  companyTermsPublication,
} from "@/domain/legal/companyLegalPage";

import CompanyTermsPanel from "./CompanyTermsPanel";

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
  const [publication, setPublication] = useState("NOT_PUBLISHED");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/partner/legal/agreement?lang=en", { cache: "no-store" })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled || !body?.success) return;
        const view = companyTermsPublication({
          documents: body.documents || [],
          containsDrafts: Boolean(body.containsDrafts),
          activeChecksum: body.activeAgreement?.packageChecksum || "",
          currentChecksum: body.packageChecksum || "",
        });
        setPublication(view.publication);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ fontWeight: 800, mb: 1, px: { xs: 1, md: 2 }, pt: 2 }}>
        {t("partnerLegal.companyPage.title")}
      </Typography>
      <Tabs
        value={value}
        onChange={(_, next) => setTab(COMPANY_LEGAL_TABS[next] || "details")}
        sx={adminSectionTabsSx}
      >
        <Tab label={t("partnerLegal.companyPage.details")} />
        <Tab label={t("partnerLegal.companyPage.documents")} />
        <Tab label={t("partnerLegal.companyPage.terms")} />
      </Tabs>
      {tab === "documents" ? (
        <PartnerLegalProfileSection
          variant="company"
          panel="documents"
          viewMode={viewMode}
          termsPublication={publication}
        />
      ) : tab === "terms" ? (
        <CompanyTermsPanel viewMode={viewMode} />
      ) : (
        <PartnerLegalProfileSection
          variant="company"
          panel="details"
          viewMode={viewMode}
          termsPublication={publication}
        />
      )}
    </Box>
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
