"use client";

import { Suspense, useCallback, useMemo } from "react";
import { Box, CircularProgress, Tab, Tabs } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import TransferVouchersSection from "@app/admin/vouchers/TransferVouchersSection";
import AccessTokensSection from "@app/admin/access-tokens/AccessTokensSection";
import PlatformCatalogSection from "@app/admin/platform/PlatformCatalogSection";
import TransferPricingSection from "@app/admin/platform/TransferPricingSection";

const VOUCHERS_TAB = "vouchers";
const ACCESS_LINKS_TAB = "access-links";
const PLATFORM_TAB = "platform";
const TAB_ORDER = [VOUCHERS_TAB, ACCESS_LINKS_TAB, PLATFORM_TAB];
const SUPERADMIN_TABS = [ACCESS_LINKS_TAB, PLATFORM_TAB];

function VouchersHubInner({
  company,
  companies,
  canPickCompany,
  initialDefaults,
  showSuperAdminTabs,
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requested = searchParams?.get("tab");
  // Non-superadmins never get the superadmin tabs, even with an explicit ?tab=.
  const tab =
    showSuperAdminTabs && SUPERADMIN_TABS.includes(requested)
      ? requested
      : VOUCHERS_TAB;

  const setTab = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (next === VOUCHERS_TAB) params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const value = useMemo(() => Math.max(TAB_ORDER.indexOf(tab), 0), [tab]);

  const vouchers = (
    <TransferVouchersSection
      company={company}
      companies={companies}
      canPickCompany={canPickCompany}
      initialDefaults={initialDefaults}
    />
  );

  if (!showSuperAdminTabs) return vouchers;

  return (
    <Box>
      <Tabs
        value={value}
        onChange={(_, v) => setTab(TAB_ORDER[v] || VOUCHERS_TAB)}
        sx={{
          px: { xs: 1, md: 2 },
          borderBottom: 1,
          borderColor: "divider",
          mb: 1,
        }}
      >
        <Tab label={t("header.vouchers", { defaultValue: "Vouchers" })} />
        <Tab
          label={t("header.accessLinks", { defaultValue: "Access links" })}
        />
        <Tab label={t("header.platform", { defaultValue: "Platform" })} />
      </Tabs>
      {tab === ACCESS_LINKS_TAB ? <AccessTokensSection /> : null}
      {tab === PLATFORM_TAB ? (
        <>
          <PlatformCatalogSection />
          <TransferPricingSection />
        </>
      ) : null}
      {tab === VOUCHERS_TAB ? vouchers : null}
    </Box>
  );
}

export default function VouchersHubSection(props) {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      }
    >
      <VouchersHubInner {...props} />
    </Suspense>
  );
}
