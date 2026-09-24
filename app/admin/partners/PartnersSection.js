"use client";

import { useCallback } from "react";
import { Box, Tab, Tabs } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import OwnersSection from "@app/admin/owners/OwnersSection";
import PartnerReviewQueue from "@app/admin/legal/PartnerReviewQueue";
import { adminSectionTabsSx } from "@app/admin/shared/components/AdminSectionTabs";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";
import { usePendingPartnerReviews } from "@app/hooks/usePendingPartnerReviews";

export default function PartnersSection({ viewMode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { country } = useAdminCountryFilter();
  const pending = usePendingPartnerReviews({ enabled: true, country });
  const tab = searchParams?.get("tab") === "review" ? "review" : "all";

  const setTab = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("tab", next);
      if (next === "review") {
        // Partner detail tabs belong to the list view only.
        params.delete("section");
      } else {
        params.delete("filter");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

      const reviewLabel = t("admin.partners.reviews", {
        defaultValue: "Needs review",
      });

  return (
    <Box sx={{ px: { xs: 1, md: 2 }, pt: 2 }}>
      <Tabs
        value={tab}
        onChange={(_, next) => setTab(next)}
        sx={adminSectionTabsSx}
      >
        <Tab
          value="all"
              label={t("admin.partners.companies", { defaultValue: "All partners" })}
        />
        <Tab
          value="review"
          label={pending > 0 ? `${reviewLabel} (${pending})` : reviewLabel}
        />
      </Tabs>
      {tab === "review" ? (
        <PartnerReviewQueue viewMode={viewMode} />
      ) : (
        <OwnersSection viewMode={viewMode} />
      )}
    </Box>
  );
}
