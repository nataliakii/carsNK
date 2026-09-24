"use client";

import { useEffect, useRef } from "react";
import { Box, Tab, Tabs, Typography } from "@mui/material";
import { adminReadableTextSx } from "@/app/admin/shared/components/AdminSettingsSection";
import {
  COMPANY_SETTINGS_SHELL,
  COMPANY_SETTINGS_TAB_BAR,
  COMPANY_SETTINGS_TAB_CONTENT,
} from "@/domain/admin/companySettingsLayout";

const companyTabsSx = {
  position: { xs: "relative", md: COMPANY_SETTINGS_TAB_BAR.desktopPosition },
  top: { md: COMPANY_SETTINGS_TAB_BAR.top },
  zIndex: COMPANY_SETTINGS_TAB_BAR.zIndex,
  bgcolor: COMPANY_SETTINGS_TAB_BAR.background,
  borderBottom: COMPANY_SETTINGS_TAB_BAR.borderBottom,
  borderColor: "divider",
  mb: 0,
  minHeight: COMPANY_SETTINGS_TAB_BAR.tabMinHeight,
  width: "100%",
  px: 0,
  boxShadow: "none",
  /* Hide scrollbar visually; keep overflow for keyboard / focus a11y */
  "& .MuiTabs-scroller": {
    overflowX: "auto !important",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    "&::-webkit-scrollbar": {
      display: "none",
      width: 0,
      height: 0,
    },
  },
  "& .MuiTabs-flexContainer": {
    gap: COMPANY_SETTINGS_TAB_BAR.gap,
    px: COMPANY_SETTINGS_TAB_BAR.paddingInline,
  },
  "& .MuiTabs-indicator": {
    backgroundColor: COMPANY_SETTINGS_TAB_BAR.indicatorColor,
    height: 3,
  },
  "& .MuiTab-root": {
    textTransform: "none",
    minHeight: COMPANY_SETTINGS_TAB_BAR.tabMinHeight,
    minWidth: COMPANY_SETTINGS_TAB_BAR.tabMinWidth,
    px: COMPANY_SETTINGS_TAB_BAR.tabHorizontalPadding,
    fontWeight: 600,
    fontSize: "0.95rem",
    letterSpacing: "normal",
    wordSpacing: "normal",
    whiteSpace: COMPANY_SETTINGS_TAB_BAR.tabWhiteSpace,
    overflow: "visible",
    textOverflow: "clip",
    flexShrink: 0,
    flexGrow: 0,
    color: "text.secondary",
    bgcolor: "transparent",
    "&.Mui-selected": {
      color: COMPANY_SETTINGS_TAB_BAR.indicatorColor,
      bgcolor: "transparent",
      fontWeight: 600,
    },
    "&:hover": {
      bgcolor: "transparent",
    },
  },
};

/**
 * Stable Company hub shell. Header, setup status, and tabs stay mounted;
 * only `children` (ActiveTabContent) swap when the tab changes.
 */
export default function CompanySettingsLayout({
  title,
  subtitle,
  setupStatus = null,
  tabs = [],
  tabValue = 0,
  onTabChange,
  alerts = null,
  children,
}) {
  const tabsRef = useRef(null);
  const activeTabId = tabs[tabValue]?.id;

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
  }, [activeTabId]);

  return (
    <Box
      data-testid="company-settings-page"
      sx={{
        width: COMPANY_SETTINGS_SHELL.width,
        maxWidth: COMPANY_SETTINGS_SHELL.maxWidth,
        mx: "auto",
        px: COMPANY_SETTINGS_SHELL.paddingInline,
        pb: 6,
        pt: { xs: 2, md: 2 },
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      <Box data-testid="company-settings-header" sx={{ mb: 2 }}>
        <Typography
          variant="h4"
          fontWeight={700}
          sx={{ mb: 1, ...adminReadableTextSx }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ ...adminReadableTextSx }}
          >
            {subtitle}
          </Typography>
        ) : null}
      </Box>

      {setupStatus ? (
        <Box data-testid="company-settings-setup-status" sx={{ mb: 0 }}>
          {setupStatus}
        </Box>
      ) : null}

      <Tabs
        ref={tabsRef}
        data-testid="company-settings-tabs"
        value={tabValue}
        onChange={onTabChange}
        variant="scrollable"
        scrollButtons={false}
        allowScrollButtonsMobile
        sx={companyTabsSx}
      >
        {tabs.map((item) => (
          <Tab
            key={item.id}
            label={item.label}
            data-testid={`company-tab-${item.id}`}
            id={`company-tab-${item.id}`}
            aria-controls={`company-panel-${item.id}`}
          />
        ))}
      </Tabs>

      {alerts}

      <Box
        data-testid="company-settings-tab-content"
        id={activeTabId ? `company-panel-${activeTabId}` : undefined}
        role="tabpanel"
        aria-labelledby={
          activeTabId ? `company-tab-${activeTabId}` : undefined
        }
        sx={{
          width: "100%",
          mt: COMPANY_SETTINGS_TAB_CONTENT.marginTop,
          p: COMPANY_SETTINGS_TAB_CONTENT.padding,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: COMPANY_SETTINGS_TAB_CONTENT.borderRadius,
          bgcolor: COMPANY_SETTINGS_TAB_CONTENT.background,
          boxSizing: "border-box",
          ...adminReadableTextSx,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
