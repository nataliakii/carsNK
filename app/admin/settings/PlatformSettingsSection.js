"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Box,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { adminReadableTextSx } from "@/app/admin/shared/components/AdminSettingsSection";
import {
  PLATFORM_SETTINGS_TABS,
  SETTINGS_NAVBAR_HEIGHT_PX,
  SETTINGS_TAB_BAR,
  platformSettingsHref,
  resolvePlatformSettingsTab,
} from "@/domain/admin/platformSettingsNav";
import {
  SettingsDirtyProvider,
  useSettingsDirty,
} from "./SettingsDirtyGuard";

function TabLoader() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
      <CircularProgress />
    </Box>
  );
}

const PlatformMyBusinessCard = dynamic(
  () => import("@/app/admin/shared/components/PlatformMyBusinessCard"),
  { ssr: false, loading: TabLoader }
);
const PlatformCatalogSection = dynamic(
  () => import("@/app/admin/platform/PlatformCatalogSection"),
  { ssr: false, loading: TabLoader }
);
const PlatformBookingFeeCard = dynamic(
  () => import("@/app/admin/shared/components/PlatformBookingFeeCard"),
  { ssr: false, loading: TabLoader }
);
const TransferPricingSection = dynamic(
  () => import("@/app/admin/platform/TransferPricingSection"),
  { ssr: false, loading: TabLoader }
);
const DeliveryZonesSection = dynamic(
  () => import("@/app/admin/delivery-zones/DeliveryZonesSection"),
  { ssr: false, loading: TabLoader }
);
const TransferVouchersSection = dynamic(
  () => import("@app/admin/vouchers/TransferVouchersSection"),
  { ssr: false, loading: TabLoader }
);
const LegalHubSection = dynamic(
  () => import("@/app/admin/legal/LegalHubSection"),
  { ssr: false, loading: TabLoader }
);
const AccessTokensSection = dynamic(
  () => import("@/app/admin/access-tokens/AccessTokensSection"),
  { ssr: false, loading: TabLoader }
);

const settingsTabsSx = {
  position: { xs: "relative", md: SETTINGS_TAB_BAR.desktopPosition },
  top: { md: SETTINGS_TAB_BAR.top },
  zIndex: SETTINGS_TAB_BAR.zIndex,
  bgcolor: SETTINGS_TAB_BAR.background,
  borderBottom: SETTINGS_TAB_BAR.borderBottom,
  borderColor: "divider",
  mb: 2,
  minHeight: SETTINGS_TAB_BAR.tabMinHeight,
  mx: { xs: -1, md: -2 },
  px: { xs: 1, md: 2 },
  /* Keep sticky bar flush under the fixed navbar without covering content. */
  boxShadow: "none",
  "& .MuiTabs-scroller": {
    overflowX: "auto !important",
  },
  "& .MuiTabs-flexContainer": {
    gap: 0.5,
  },
  "& .MuiTabs-indicator": {
    backgroundColor: SETTINGS_TAB_BAR.indicatorColor,
    height: 3,
  },
  "& .MuiTab-root": {
    textTransform: "none",
    minHeight: SETTINGS_TAB_BAR.tabMinHeight,
    minWidth: "auto",
    px: { xs: 1.5, md: 2 },
    fontWeight: 600,
    fontSize: "0.95rem",
    letterSpacing: "normal",
    wordSpacing: "normal",
    whiteSpace: SETTINGS_TAB_BAR.tabWhiteSpace,
    overflow: "visible",
    textOverflow: "clip",
    flexShrink: 0,
    color: "text.secondary",
    "&.Mui-selected": {
      color: "text.primary",
    },
  },
};

function TabHeading({ title, description }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        variant="h6"
        fontWeight={700}
        sx={{ mb: description ? 0.5 : 0, ...adminReadableTextSx }}
      >
        {title}
      </Typography>
      {description ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ ...adminReadableTextSx }}
        >
          {description}
        </Typography>
      ) : null}
    </Box>
  );
}

function SettingsTabsInner({ voucherHub }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { confirmLeave } = useSettingsDirty();
  const tabsRef = useRef(null);

  const tab = resolvePlatformSettingsTab(searchParams?.get("tab"));
  const tabIndex = Math.max(
    PLATFORM_SETTINGS_TABS.findIndex((item) => item.id === tab),
    0
  );

  const setTab = useCallback(
    (nextId) => {
      const next = resolvePlatformSettingsTab(nextId);
      if (next === tab) return;
      if (!confirmLeave()) return;
      const href = platformSettingsHref(next);
      router.push(href);
    },
    [confirmLeave, router, tab]
  );

  // Keep URL canonical (unknown / empty → general) without dropping section=.
  useEffect(() => {
    const requested = searchParams?.get("tab");
    const resolved = resolvePlatformSettingsTab(requested);
    if (requested === resolved) return;
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("tab", resolved);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, searchParams]);

  // Scroll the active tab into view on mobile.
  useEffect(() => {
    const root = tabsRef.current;
    if (!root) return;
    const selected = root.querySelector(".Mui-selected");
    if (selected?.scrollIntoView) {
      selected.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [tab]);

  const tabLabels = useMemo(
    () =>
      PLATFORM_SETTINGS_TABS.map((item) => ({
        ...item,
        label:
          item.id === "general"
            ? t("settings.tabGeneral", { defaultValue: item.label })
            : item.id === "locations"
              ? t("settings.tabLocations", { defaultValue: item.label })
              : item.id === "pricing"
                ? t("settings.tabPricing", { defaultValue: item.label })
                : item.id === "delivery"
                  ? t("settings.tabDelivery", { defaultValue: item.label })
                  : item.id === "vouchers"
                    ? t("settings.tabVouchers", { defaultValue: item.label })
                    : item.id === "legal"
                      ? t("settings.tabLegal", { defaultValue: item.label })
                      : t("settings.tabAccess", { defaultValue: item.label }),
      })),
    [t]
  );

  return (
    <Box
      data-testid="platform-settings-page"
      sx={{
        px: { xs: 1, md: 2 },
        pb: 6,
        pt: { xs: 2, md: 2 },
        maxWidth: { xs: "100%", md: 1200 },
        mx: "auto",
        overflowX: "hidden",
      }}
    >
      <Box data-testid="platform-settings-header" sx={{ mb: 1.5 }}>
        <Typography
          variant="h4"
          fontWeight={700}
          sx={{ ...adminReadableTextSx }}
        >
          {t("header.settings", { defaultValue: "Settings" })}
        </Typography>
      </Box>

      <Tabs
        ref={tabsRef}
        data-testid="platform-settings-tabs"
        value={tabIndex}
        onChange={(_, index) =>
          setTab(PLATFORM_SETTINGS_TABS[index]?.id || "general")
        }
        variant="scrollable"
        scrollButtons={false}
        allowScrollButtonsMobile
        sx={settingsTabsSx}
      >
        {tabLabels.map((item) => (
          <Tab
            key={item.id}
            label={item.label}
            data-testid={`settings-tab-${item.id}`}
            id={`settings-tab-${item.id}`}
            aria-controls={`settings-panel-${item.id}`}
          />
        ))}
      </Tabs>

      <Box
        data-testid="platform-settings-content"
        id={`settings-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`settings-tab-${tab}`}
        sx={{
          /* Clear sticky tab bar: navbar (64) + tab row (~48) already sticky;
             content starts below the tab strip in normal flow. */
          pt: 0.5,
        }}
      >
        {tab === "general" ? (
          <Box>
            <TabHeading
              title={t("settings.generalHeading", {
                defaultValue: "General",
              })}
              description={t("settings.generalDescription", {
                defaultValue:
                  "Operator business details used in contracts and official communications.",
              })}
            />
            <PlatformMyBusinessCard embedded />
          </Box>
        ) : null}

        {tab === "locations" ? (
          <Box>
            <TabHeading
              title={t("settings.locationsHeading", {
                defaultValue: "Locations & coverage",
              })}
              description={t("settings.locationsDescription", {
                defaultValue:
                  "Countries, languages, cities and coverage catalog for this deployment.",
              })}
            />
            <PlatformCatalogSection embedded />
          </Box>
        ) : null}

        {tab === "pricing" ? (
          <Box>
            <TabHeading
              title={t("settings.pricingHeading", {
                defaultValue: "Pricing",
              })}
              description={t("settings.pricingDescription", {
                defaultValue:
                  "Platform booking fee and transfer pricing rules.",
              })}
            />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <PlatformBookingFeeCard embedded />
              <TransferPricingSection embedded />
            </Box>
          </Box>
        ) : null}

        {tab === "delivery" ? (
          <Box>
            <TabHeading
              title={t("settings.deliveryHeading", {
                defaultValue: "Delivery",
              })}
              description={t("settings.deliveryDescription", {
                defaultValue: "Delivery coverage rules and charges.",
              })}
            />
            <DeliveryZonesSection variant="all" embedded />
          </Box>
        ) : null}

        {tab === "vouchers" ? (
          <Box>
            <TabHeading
              title={t("settings.vouchersHeading", {
                defaultValue: "Vouchers",
              })}
              description={t("settings.vouchersDescription", {
                defaultValue: "Discounts and transfer vouchers.",
              })}
            />
            <TransferVouchersSection
              company={voucherHub?.company}
              companies={voucherHub?.companies}
              canPickCompany={voucherHub?.canPickCompany}
              initialDefaults={voucherHub?.initialDefaults}
            />
          </Box>
        ) : null}

        {tab === "legal" ? (
          <Box>
            <TabHeading
              title={t("settings.legalHeading", {
                defaultValue: "Legal documents",
              })}
              description={t("settings.legalDescription", {
                defaultValue:
                  "Platform agreements, customer terms, and privacy documents.",
              })}
            />
            <LegalHubSection embedded />
          </Box>
        ) : null}

        {tab === "access" ? (
          <Box>
            <TabHeading
              title={t("settings.accessHeading", {
                defaultValue: "Access",
              })}
              description={t("settings.accessDescription", {
                defaultValue:
                  "Staff access links and account-related platform access.",
              })}
            />
            <AccessTokensSection />
          </Box>
        ) : null}
      </Box>

      {/* Expose sticky offset for tests / layout debugging */}
      <Box
        aria-hidden
        data-testid="settings-sticky-offset"
        data-navbar-height={SETTINGS_NAVBAR_HEIGHT_PX}
        sx={{ display: "none" }}
      />
    </Box>
  );
}

export default function PlatformSettingsSection({ voucherHub = null } = {}) {
  return (
    <SettingsDirtyProvider>
      <Suspense
        fallback={
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        }
      >
        <SettingsTabsInner voucherHub={voucherHub} />
      </Suspense>
    </SettingsDirtyProvider>
  );
}
