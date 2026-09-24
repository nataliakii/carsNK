"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import CompanyStorefrontCard from "@/app/admin/shared/components/CompanyStorefrontCard";
import CompanyCoverageCard from "@/app/admin/shared/components/CompanyCoverageCard";
import CompanyDeliveryPricingCard from "@/app/admin/shared/components/CompanyDeliveryPricingCard";
import CompanyTransferServicesCard from "@/app/admin/shared/components/CompanyTransferServicesCard";
import CompanyRentalPaymentsCard from "@/app/admin/shared/components/CompanyRentalPaymentsCard";
import CompanyAdminsCard from "@/app/admin/shared/components/CompanyAdminsCard";
import CompanyMeetingContactsCard from "@/app/admin/shared/components/CompanyMeetingContactsCard";
import PartnerComplianceCard from "@/app/admin/shared/components/PartnerComplianceCard";
import { adminReadableTextSx } from "@/app/admin/shared/components/AdminSettingsSection";
import { adminSectionTabsSx } from "@app/admin/shared/components/AdminSectionTabs";
import {
  getCompanyHubTabIds,
  resolveCompanyHubTab,
} from "@app/admin/shared/adminNav";
import { useAdminViewAs } from "@app/hooks/useAdminViewAs";
import { useMainContext } from "@app/Context";

function TabLoader() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
      <CircularProgress />
    </Box>
  );
}

const DeliveryZonesSection = dynamic(
  () => import("@/app/admin/delivery-zones/DeliveryZonesSection"),
  { ssr: false, loading: TabLoader }
);
const TransferVouchersSection = dynamic(
  () => import("@app/admin/vouchers/TransferVouchersSection"),
  { ssr: false, loading: TabLoader }
);
const AccessTokensSection = dynamic(
  () => import("@app/admin/access-tokens/AccessTokensSection"),
  { ssr: false, loading: TabLoader }
);
const PlatformCatalogSection = dynamic(
  () => import("@app/admin/platform/PlatformCatalogSection"),
  { ssr: false, loading: TabLoader }
);
const TransferPricingSection = dynamic(
  () => import("@app/admin/platform/TransferPricingSection"),
  { ssr: false, loading: TabLoader }
);
const PlatformMyBusinessCard = dynamic(
  () => import("@/app/admin/shared/components/PlatformMyBusinessCard"),
  { ssr: false, loading: TabLoader }
);
const PlatformBookingFeeCard = dynamic(
  () => import("@/app/admin/shared/components/PlatformBookingFeeCard"),
  { ssr: false, loading: TabLoader }
);

const TAB_STOREFRONT = "storefront";
const TAB_PEOPLE = "people";
const TAB_DELIVERY = "delivery";
const TAB_PRICING = "pricing";
const TAB_VOUCHERS = "vouchers";
const TAB_TRANSFER = "transfer";
const TAB_ACCESS = "access-links";
const TAB_PLATFORM = "platform";

function companyTabDefs({ hasCompanyContext, showSuperAdminTabs, t }) {
  const labels = {
    [TAB_STOREFRONT]: t("companyProfile.tabStorefront", {
      defaultValue: "Storefront & booking",
    }),
    [TAB_PEOPLE]: t("companyProfile.tabPeople", {
      defaultValue: "People",
    }),
    [TAB_DELIVERY]: t("companyProfile.tabDelivery", {
      defaultValue: "Delivery",
    }),
    [TAB_PRICING]: t("companyProfile.tabPricing", {
      defaultValue: "Pricing",
    }),
    [TAB_TRANSFER]: t("companyProfile.tabTransfer", {
      defaultValue: "Transfer",
    }),
    [TAB_VOUCHERS]: t("companyProfile.tabVouchers", {
      defaultValue: "Vouchers",
    }),
    [TAB_ACCESS]: t("header.accessLinks", { defaultValue: "Access links" }),
    [TAB_PLATFORM]: t("header.platform", { defaultValue: "Platform" }),
  };
  return getCompanyHubTabIds({ hasCompanyContext, showSuperAdminTabs }).map(
    (id) => ({ id, label: labels[id] || id })
  );
}

function isGreeceCompany(company) {
  return String(company?.country || "").toUpperCase() === "GR";
}

function CompanyHubInner({
  companyId: companyIdProp,
  hasCompanyContext = true,
  voucherHub = null,
} = {}) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { updateCompanyInContext } = useMainContext();
  const { active: viewAsActive, company: viewAsCompany } = useAdminViewAs();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ownerId =
    (companyIdProp && String(companyIdProp)) ||
    (viewAsActive && viewAsCompany?._id
      ? String(viewAsCompany._id)
      : session?.user?.ownerId
        ? String(session.user.ownerId)
        : "");

  const showSuperAdminTabs = Boolean(voucherHub?.showSuperAdminTabs);
  const tabs = useMemo(
    () => companyTabDefs({ hasCompanyContext, showSuperAdminTabs, t }),
    [hasCompanyContext, showSuperAdminTabs, t]
  );
  const tabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);
  const requested = searchParams?.get("tab");
  const fallbackTab = tabIds[0] || (hasCompanyContext ? TAB_STOREFRONT : TAB_ACCESS);
  const tab = resolveCompanyHubTab(requested, tabIds) || fallbackTab;

  const setTab = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (next === fallbackTab) params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [fallbackTab, pathname, router, searchParams]
  );

  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(hasCompanyContext);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    if (!ownerId || !hasCompanyContext) {
      setCompany(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/company/${ownerId}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || t("companyProfile.loadFailed"));
      setCompany(body);
    } catch (err) {
      setError(err.message || t("companyProfile.loadFailed"));
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [hasCompanyContext, ownerId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCompanySaved = useCallback(
    (updated) => {
      setCompany(updated);
      setOk(t("companyProfile.updated", { name: updated.name }));
      if (updated?._id) {
        updateCompanyInContext(String(updated._id), updated);
      }
    },
    [t, updateCompanyInContext]
  );

  const needsCompany =
    tab === TAB_STOREFRONT ||
    tab === TAB_PEOPLE ||
    tab === TAB_DELIVERY ||
    tab === TAB_PRICING;

  const wideTab =
    tab === TAB_DELIVERY ||
    tab === TAB_PRICING ||
    tab === TAB_VOUCHERS ||
    tab === TAB_PLATFORM;

  const platformHub = !hasCompanyContext && showSuperAdminTabs;

  return (
    <Box
      sx={{
        px: { xs: 1, md: 2 },
        pb: 6,
        pt: { xs: 2, md: 2 },
        maxWidth: wideTab ? { xs: "100%", md: 1200 } : { xs: "100%", md: 960 },
        mx: "auto",
        overflowX: "hidden",
      }}
    >
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1, ...adminReadableTextSx }}>
        {platformHub
          ? t("header.settings", { defaultValue: "Settings" })
          : t("companyProfile.hubTitle", { defaultValue: t("header.companyProfile") })}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ...adminReadableTextSx }}>
        {platformHub
          ? t("companyProfile.platformHubSubtitle", {
              defaultValue:
                "My business details, default booking fee, catalogue, delivery and tools.",
            })
          : t("companyProfile.hubSubtitle", {
              defaultValue: t("companyProfile.subtitle"),
            })}
      </Typography>

      {platformHub ? (
        <Stack gap={2.5} sx={{ mb: 3 }}>
          <PlatformMyBusinessCard />
          <PlatformBookingFeeCard />
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
              Legal documents
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Publish Rovaro agreement, terms and privacy documents.
            </Typography>
            <Typography
              component="a"
              href="/admin/legal?tab=documents"
              variant="body2"
              sx={{ fontWeight: 600 }}
            >
              Open legal documents →
            </Typography>
          </Box>
        </Stack>
      ) : null}

      {hasCompanyContext ? <PartnerComplianceCard /> : null}

      <Tabs
        value={Math.max(tabIds.indexOf(tab), 0)}
        onChange={(_, v) => setTab(tabIds[v] || fallbackTab)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ ...adminSectionTabsSx, px: 0 }}
      >
        {tabs.map((item) => (
          <Tab key={item.id} label={item.label} />
        ))}
      </Tabs>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {ok ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOk("")}>
          {ok}
        </Alert>
      ) : null}

      {needsCompany && hasCompanyContext && loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {tab === TAB_STOREFRONT && !loading ? (
        <CompanyStorefrontCard company={company} onSaved={handleCompanySaved} />
      ) : null}

      {tab === TAB_PEOPLE && !loading ? (
        <Stack gap={2.5} sx={{ mt: 1 }}>
          <CompanyAdminsCard
            companyId={ownerId}
            companyName={company?.name || ""}
          />
          <CompanyMeetingContactsCard
            company={company}
            onSaved={handleCompanySaved}
          />
        </Stack>
      ) : null}

      {tab === TAB_DELIVERY ? (
        hasCompanyContext && !loading ? (
          <CompanyCoverageCard company={company} onSaved={handleCompanySaved} />
        ) : (
          <DeliveryZonesSection variant="coverage" />
        )
      ) : null}

      {tab === TAB_PRICING ? (
        hasCompanyContext && !loading ? (
          <Stack gap={2.5} sx={{ mt: 1 }}>
            <CompanyDeliveryPricingCard
              company={company}
              onSaved={handleCompanySaved}
            />
            <CompanyRentalPaymentsCard
              company={company}
              onSaved={handleCompanySaved}
            />
            {isGreeceCompany(company) ? (
              <DeliveryZonesSection variant="pricing" />
            ) : null}
          </Stack>
        ) : (
          <DeliveryZonesSection variant="pricing" />
        )
      ) : null}

      {tab === TAB_VOUCHERS ? (
        <TransferVouchersSection
          company={voucherHub?.company}
          companies={voucherHub?.companies}
          canPickCompany={voucherHub?.canPickCompany}
          initialDefaults={voucherHub?.initialDefaults}
        />
      ) : null}

      {tab === TAB_TRANSFER ? (
        <CompanyTransferServicesCard companyId={ownerId} />
      ) : null}

      {tab === TAB_ACCESS ? <AccessTokensSection /> : null}

      {tab === TAB_PLATFORM ? (
        <>
          <PlatformCatalogSection />
          <TransferPricingSection />
        </>
      ) : null}
    </Box>
  );
}

export default function CompanyProfileSection(props) {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      }
    >
      <CompanyHubInner {...props} />
    </Suspense>
  );
}
