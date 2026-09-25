"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  Stack,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import CompanyStorefrontCard from "@/app/admin/shared/components/CompanyStorefrontCard";
import CompanyOfficesCard from "@/app/admin/shared/components/CompanyOfficesCard";
import CompanyCoverageCard from "@/app/admin/shared/components/CompanyCoverageCard";
import CompanyDeliveryPricingCard from "@/app/admin/shared/components/CompanyDeliveryPricingCard";
import CompanyTransferServicesCard from "@/app/admin/shared/components/CompanyTransferServicesCard";
import CompanyRentalPaymentsCard from "@/app/admin/shared/components/CompanyRentalPaymentsCard";
import CompanyAdminsCard from "@/app/admin/shared/components/CompanyAdminsCard";
import CompanyMeetingContactsCard from "@/app/admin/shared/components/CompanyMeetingContactsCard";
import PartnerComplianceCard from "@/app/admin/shared/components/PartnerComplianceCard";
import CompanySettingsLayout from "@/app/admin/company/CompanySettingsLayout";
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

const TAB_STOREFRONT = "storefront";
const TAB_OFFICES = "offices";
const TAB_PEOPLE = "people";
const TAB_DELIVERY = "delivery";
const TAB_PRICING = "pricing";
const TAB_VOUCHERS = "vouchers";
const TAB_TRANSFER = "transfer";

function companyTabDefs({ hasCompanyContext, t }) {
  const labels = {
    [TAB_STOREFRONT]: t("companyProfile.tabStorefront", {
      defaultValue: "Storefront & booking",
    }),
    [TAB_OFFICES]: t("companyProfile.tabOffices", {
      defaultValue: "Offices",
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
  };
  return getCompanyHubTabIds({
    hasCompanyContext,
    showSuperAdminTabs: false,
  }).map((id) => ({ id, label: labels[id] || id }));
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

  const tabs = useMemo(
    () => companyTabDefs({ hasCompanyContext, t }),
    [hasCompanyContext, t]
  );
  const tabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);
  const requested = searchParams?.get("tab");
  const fallbackTab = tabIds[0] || TAB_STOREFRONT;
  const tab = resolveCompanyHubTab(requested, tabIds) || fallbackTab;
  const tabValue = Math.max(tabIds.indexOf(tab), 0);

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
    tab === TAB_OFFICES ||
    tab === TAB_PEOPLE ||
    tab === TAB_DELIVERY ||
    tab === TAB_PRICING;

  let activeTabContent = null;
  if (needsCompany && hasCompanyContext && loading) {
    activeTabContent = (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  } else if (tab === TAB_STOREFRONT && !loading) {
    activeTabContent = (
      <CompanyStorefrontCard
        company={company}
        onSaved={handleCompanySaved}
        embedded
      />
    );
  } else if (tab === TAB_OFFICES && !loading) {
    activeTabContent = (
      <CompanyOfficesCard
        company={company}
        onSaved={handleCompanySaved}
        embedded
      />
    );
  } else if (tab === TAB_PEOPLE && !loading) {
    activeTabContent = (
      <Stack gap={3} divider={<Divider sx={{ borderColor: "divider" }} />}>
        <CompanyAdminsCard
          companyId={ownerId}
          companyName={company?.name || ""}
          embedded
        />
        <CompanyMeetingContactsCard
          company={company}
          onSaved={handleCompanySaved}
          embedded
        />
      </Stack>
    );
  } else if (tab === TAB_DELIVERY) {
    activeTabContent =
      hasCompanyContext && !loading ? (
        <CompanyCoverageCard
          company={company}
          onSaved={handleCompanySaved}
          embedded
        />
      ) : (
        <DeliveryZonesSection variant="coverage" embedded />
      );
  } else if (tab === TAB_PRICING) {
    activeTabContent =
      hasCompanyContext && !loading ? (
        <Stack gap={3} divider={<Divider sx={{ borderColor: "divider" }} />}>
          <CompanyDeliveryPricingCard
            company={company}
            onSaved={handleCompanySaved}
            embedded
          />
          <CompanyRentalPaymentsCard
            company={company}
            onSaved={handleCompanySaved}
            embedded
          />
          {isGreeceCompany(company) ? (
            <DeliveryZonesSection variant="pricing" embedded />
          ) : null}
        </Stack>
      ) : (
        <DeliveryZonesSection variant="pricing" embedded />
      );
  } else if (tab === TAB_VOUCHERS) {
    activeTabContent = (
      <TransferVouchersSection
        company={voucherHub?.company}
        companies={voucherHub?.companies}
        canPickCompany={voucherHub?.canPickCompany}
        initialDefaults={voucherHub?.initialDefaults}
        embedded
      />
    );
  } else if (tab === TAB_TRANSFER) {
    activeTabContent = (
      <CompanyTransferServicesCard companyId={ownerId} embedded />
    );
  }

  const alerts = (
    <>
      {error ? (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      {ok ? (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setOk("")}>
          {ok}
        </Alert>
      ) : null}
    </>
  );

  return (
    <CompanySettingsLayout
      title={t("companyProfile.hubTitle", {
        defaultValue: t("header.companyProfile"),
      })}
      subtitle={t("companyProfile.hubSubtitle", {
        defaultValue: t("companyProfile.subtitle"),
      })}
      setupStatus={hasCompanyContext ? <PartnerComplianceCard /> : null}
      tabs={tabs}
      tabValue={tabValue}
      onTabChange={(_, v) => setTab(tabIds[v] || fallbackTab)}
      alerts={alerts}
    >
      {activeTabContent}
    </CompanySettingsLayout>
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
