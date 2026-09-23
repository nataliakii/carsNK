"use client";

import { Suspense, useCallback, useMemo } from "react";
import { Box, CircularProgress, Tab, Tabs } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import PartnerLegalProfileSection from "./PartnerLegalProfileSection";
import PartnerAgreementSection from "./agreement/PartnerAgreementSection";
import PartnerCustomerRulesSection from "./PartnerCustomerRulesSection";
import { adminSectionTabsSx } from "@app/admin/shared/components/AdminSectionTabs";

const PROFILE = "profile";
const AGREEMENT = "agreement";
const RULES = "rules";

function tabFromSearch(searchParams) {
  const tab = searchParams?.get("tab");
  if (tab === AGREEMENT) return AGREEMENT;
  if (tab === RULES) return RULES;
  return PROFILE;
}

function LegalProfileHubInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams);

  const setTab = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (next === AGREEMENT || next === RULES) params.set("tab", next);
      else params.delete("tab");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const value = useMemo(() => {
    if (tab === AGREEMENT) return 1;
    if (tab === RULES) return 2;
    return 0;
  }, [tab]);

  return (
    <Box>
      <Tabs
        value={value}
        onChange={(_, v) =>
          setTab(v === 1 ? AGREEMENT : v === 2 ? RULES : PROFILE)
        }
        sx={adminSectionTabsSx}
      >
        <Tab
          label={t("header.legalTabProfile", { defaultValue: "Profile" })}
        />
        <Tab
          label={t("header.legalTabAgreement", { defaultValue: "Agreement" })}
        />
        <Tab
          label={t("header.legalTabRules", { defaultValue: "Rental rules" })}
        />
      </Tabs>
      {tab === AGREEMENT ? (
        <PartnerAgreementSection />
      ) : tab === RULES ? (
        <PartnerCustomerRulesSection />
      ) : (
        <PartnerLegalProfileSection />
      )}
    </Box>
  );
}

export default function LegalProfileHubSection() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      }
    >
      <LegalProfileHubInner />
    </Suspense>
  );
}
