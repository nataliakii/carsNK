"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { parseLatLon } from "@/domain/geo/haversineKm";
import { normalizeOperatingCities } from "@/domain/delivery/cityDeliveryPricing";
import {
  citiesWithinRadiusOfOrigins,
  cityNamesFromCityIds,
  selectedCityIdsFromCatalog,
} from "@/domain/geo/operatingCityCatalog";
import { mergeCityNames } from "@/domain/geo/spainCoverageRegions";
import {
  officeOrigins,
  resolveCompanyOffices,
} from "@/domain/company/companyOffices";
import useOperatingCityCatalog from "@/app/admin/shared/hooks/useOperatingCityCatalog";
import AdminSettingsSection, {
  adminCardSx,
  adminFieldSx,
  adminReadableTextSx,
} from "@/app/admin/shared/components/AdminSettingsSection";
import OperatingCitiesPicker from "@/app/admin/shared/components/OperatingCitiesPicker";
import CoverageRegionsPicker from "@/app/admin/shared/components/CoverageRegionsPicker";
import CoverageMapPreview from "@/app/admin/shared/components/CoverageMapPreview";
import { policyFromCompany } from "@/app/admin/shared/components/companyDeliveryPolicy";

export default function CompanyCoverageCard({
  company,
  onSaved,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offices, setOffices] = useState(() => resolveCompanyOffices(company));
  const [operatingCities, setOperatingCities] = useState(() =>
    normalizeOperatingCities(company?.deliveryPricing?.operatingCities)
  );
  const [orderRadiusKm, setOrderRadiusKm] = useState(
    company?.orderRadiusKm == null && company?.deliveryPricing?.radiusKm == null
      ? ""
      : String(company?.orderRadiusKm ?? company?.deliveryPricing?.radiusKm ?? "")
  );

  const { catalog } = useOperatingCityCatalog(company?.country);
  const officePoints = officeOrigins(offices, company?.coords);
  const base = officePoints[0] || parseLatLon(company?.coords);

  useEffect(() => {
    setOffices(resolveCompanyOffices(company));
    setOrderRadiusKm(
      company?.orderRadiusKm == null && company?.deliveryPricing?.radiusKm == null
        ? ""
        : String(company?.orderRadiusKm ?? company?.deliveryPricing?.radiusKm ?? "")
    );
    const fromPolicy = normalizeOperatingCities(
      company?.deliveryPricing?.operatingCities
    );
    if (fromPolicy.length) {
      setOperatingCities(fromPolicy);
    } else {
      setOperatingCities(cityNamesFromCityIds(company?.cityIds, catalog));
    }
  }, [company, catalog]);

  const selectCitiesWithinRadius = () => {
    const radius = Number(orderRadiusKm);
    if (!officePoints.length) {
      setError(t("companyProfile.setOfficeFirst"));
      return;
    }
    if (!Number.isFinite(radius) || radius < 0) {
      setError(t("companyProfile.setOfficeFirst"));
      return;
    }
    const found = citiesWithinRadiusOfOrigins(
      catalog,
      officePoints,
      radius
    ).map((city) => city.name);
    if (!found.length) {
      setError(t("companyProfile.orderRadiusNoCities"));
      return;
    }
    setError("");
    setOperatingCities(mergeCityNames(operatingCities, found));
  };

  const save = useCallback(async () => {
    if (!company?._id) return;
    setBusy(true);
    setError("");
    try {
      const names = normalizeOperatingCities(operatingCities);
      const existing = policyFromCompany(company);
      const radiusValue =
        orderRadiusKm === "" || orderRadiusKm == null
          ? null
          : Number(orderRadiusKm);
      const res = await fetch(`/api/company/${company._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityIds: selectedCityIdsFromCatalog(names, catalog),
          orderRadiusKm: radiusValue,
          deliveryPricing: {
            strategy: names.length ? "cities" : existing.strategy || "radius",
            radiusKm: radiusValue,
            operatingCities: names,
            maxDistanceKm: existing.maxDistanceKm,
            inside: existing.inside,
            outside: existing.outside,
            afterHoursSurcharge: existing.afterHoursSurcharge,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || body.message || "Failed");
      onSaved?.(body);
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  }, [company, operatingCities, orderRadiusKm, catalog, onSaved]);

  if (!company) return null;

  return (
    <Box sx={adminCardSx}>
      <AdminSettingsSection
        title={t("companyProfile.coverageTitle")}
        description={t("companyProfile.coverageHelp")}
      >
        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ mb: 0.5, ...adminReadableTextSx }}
        >
          {t("companyProfile.extraCitiesTitle")}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1.5, whiteSpace: "normal", lineHeight: 1.5, ...adminReadableTextSx }}
        >
          {t("companyProfile.extraCitiesHelp")}
        </Typography>
        <OperatingCitiesPicker
          value={operatingCities}
          onChange={setOperatingCities}
          catalog={catalog}
          country={company?.country}
          baseCoords={base}
          disabled={disabled}
          label={t("companyProfile.operatingCitiesTitle")}
          placeholder={t("companyProfile.operatingCitiesPlaceholder")}
          helperText={t("companyProfile.selectedCitiesCount", {
            count: operatingCities.length,
          })}
        />

        <Box sx={{ mt: 2.5 }}>
          <CoverageRegionsPicker
            country={company?.country}
            value={operatingCities}
            onChange={setOperatingCities}
            disabled={disabled}
          />
        </Box>

        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ mt: 2.5, mb: 0.5, ...adminReadableTextSx }}
        >
          {t("companyProfile.radiusComplementTitle")}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1.5, whiteSpace: "normal", lineHeight: 1.5, ...adminReadableTextSx }}
        >
          {t("companyProfile.radiusComplementHelp")}
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1.5,
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <TextField
            size="small"
            type="number"
            label={t("companyProfile.orderRadiusKm")}
            value={orderRadiusKm}
            onChange={(e) => setOrderRadiusKm(e.target.value)}
            inputProps={{ min: 0, max: 5000, step: 1 }}
            disabled={disabled}
            sx={{ ...adminFieldSx, maxWidth: { sm: 220 } }}
          />
          <Button
            size="medium"
            variant="outlined"
            onClick={selectCitiesWithinRadius}
            disabled={disabled || !officePoints.length || orderRadiusKm === ""}
            sx={{
              textTransform: "none",
              whiteSpace: "nowrap",
              minHeight: 40,
              px: 2,
              flexShrink: 0,
              ...adminReadableTextSx,
            }}
          >
            {t("companyProfile.selectWithinRadius")}
          </Button>
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, whiteSpace: "normal", lineHeight: 1.45, ...adminReadableTextSx }}
        >
          {t("companyProfile.radiusSelectHelp")}
        </Typography>
        {!officePoints.length ? (
          <Typography
            variant="body2"
            color="warning.main"
            sx={{ mt: 1.25, display: "block", whiteSpace: "normal", ...adminReadableTextSx }}
          >
            {t("companyProfile.setOfficeFirst")}
          </Typography>
        ) : null}

        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ mt: 2.5, mb: 1, ...adminReadableTextSx }}
        >
          {t("companyProfile.coverageMapTitle")}
        </Typography>
        <CoverageMapPreview
          offices={offices}
          radiusKm={orderRadiusKm}
          cities={operatingCities}
        />
      </AdminSettingsSection>

      {error ? (
        <Typography
          color="error"
          variant="body2"
          sx={{ mt: 2, whiteSpace: "normal", ...adminReadableTextSx }}
        >
          {error}
        </Typography>
      ) : null}

      <Button
        variant="contained"
        onClick={save}
        disabled={disabled || busy}
        sx={{
          mt: 3,
          textTransform: "none",
          minWidth: { sm: 220 },
          px: 2.5,
          py: 1,
          ...adminReadableTextSx,
        }}
      >
        {t("companyProfile.saveCoverage")}
      </Button>
    </Box>
  );
}
