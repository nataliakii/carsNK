"use client";

import { Suspense, useCallback, useMemo } from "react";
import { Box, CircularProgress, Tab, Tabs } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import PartnerLegalProfileSection from "./PartnerLegalProfileSection";
import PartnerAgreementSection from "./agreement/PartnerAgreementSection";
import { adminSectionTabsSx } from "@app/admin/shared/components/AdminSectionTabs";

const PROFILE = "profile";
const AGREEMENT = "agreement";

function LegalProfileHubInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab =
    searchParams?.get("tab") === AGREEMENT ? AGREEMENT : PROFILE;

  const setTab = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (next === AGREEMENT) params.set("tab", AGREEMENT);
      else params.delete("tab");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const value = useMemo(() => (tab === AGREEMENT ? 1 : 0), [tab]);

  return (
    <Box>
      <Tabs
        value={value}
        onChange={(_, v) => setTab(v === 1 ? AGREEMENT : PROFILE)}
        sx={adminSectionTabsSx}
      >
        <Tab
          label={t("header.legalTabProfile", { defaultValue: "Profile" })}
        />
        <Tab
          label={t("header.legalTabAgreement", { defaultValue: "Agreement" })}
        />
      </Tabs>
      {tab === AGREEMENT ? (
        <PartnerAgreementSection />
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
