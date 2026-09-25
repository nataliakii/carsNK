"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { parseLatLon } from "@/domain/geo/haversineKm";
import { normalizeOperatingCities } from "@/domain/delivery/cityDeliveryPricing";
import {
  citiesWithinRadiusOfOrigins,
  cityNamesFromCityIds,
  selectedCityIdsFromCatalog,
} from "@/domain/geo/operatingCityCatalog";
import { mergeCityNames } from "@/domain/geo/spainCoverageRegions";
import { serviceAreasFromCompany } from "@/domain/geo/coverageNormalization";
import { compactServiceAreas } from "@/domain/geo/spainAdminDivisions";
import {
  officeOrigins,
  resolveCompanyOffices,
} from "@/domain/company/companyOffices";
import useOperatingCityCatalog from "@/app/admin/shared/hooks/useOperatingCityCatalog";
import AdminSettingsSection, {
  adminFieldSx,
  adminReadableTextSx,
  adminSurfaceSx,
} from "@/app/admin/shared/components/AdminSettingsSection";
import OperatingCitiesPicker from "@/app/admin/shared/components/OperatingCitiesPicker";
import ServiceAreasPicker from "@/app/admin/shared/components/ServiceAreasPicker";
import CoverageMapPreview from "@/app/admin/shared/components/CoverageMapPreview";
import { policyFromCompany } from "@/app/admin/shared/components/companyDeliveryPolicy";

/**
 * Service areas editor (communities, provinces, cities, optional radius, map).
 * Partners Coverage tab can mount this:
 *   import CompanyServiceAreasPanel from "@/app/admin/shared/components/CompanyServiceAreasPanel";
 */
export default function CompanyServiceAreasPanel({
  company,
  onSaved,
  disabled = false,
  embedded = false,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [offices, setOffices] = useState(() => resolveCompanyOffices(company));
  const initial = serviceAreasFromCompany(company);
  const [operatingCities, setOperatingCities] = useState(
    () => initial.cities
  );
  const [serviceAreas, setServiceAreas] = useState(() =>
    compactServiceAreas(initial)
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
    const normalized = serviceAreasFromCompany({
      ...company,
      deliveryPricing: {
        ...company?.deliveryPricing,
        operatingCities:
          normalizeOperatingCities(company?.deliveryPricing?.operatingCities)
            .length
            ? company?.deliveryPricing?.operatingCities
            : cityNamesFromCityIds(company?.cityIds, catalog),
      },
    });
    setOperatingCities(normalized.cities);
    setServiceAreas(compactServiceAreas(normalized));
  }, [company, catalog]);

  const selectCitiesWithinRadius = () => {
    const radius = Number(orderRadiusKm);
    if (!officePoints.length) {
      setError(t("companyProfile.setOfficeFirst"));
      setSaved(false);
      return;
    }
    if (!Number.isFinite(radius) || radius < 0) {
      setError(t("companyProfile.setOfficeFirst"));
      setSaved(false);
      return;
    }
    const found = citiesWithinRadiusOfOrigins(
      catalog,
      officePoints,
      radius
    ).map((city) => city.name);
    if (!found.length) {
      setError(t("companyProfile.orderRadiusNoCities"));
      setSaved(false);
      return;
    }
    setError("");
    setSaved(false);
    setOperatingCities(mergeCityNames(operatingCities, found));
  };

  const save = useCallback(async () => {
    if (!company?._id) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const names = normalizeOperatingCities(operatingCities);
      const existing = policyFromCompany(company);
      const radiusValue =
        orderRadiusKm === "" || orderRadiusKm == null
          ? null
          : Number(orderRadiusKm);
      const areas = compactServiceAreas(serviceAreas);
      const res = await fetch(`/api/company/${company._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityIds: selectedCityIdsFromCatalog(names, catalog),
          orderRadiusKm: radiusValue,
          serviceAreas: areas,
          deliveryPricing: {
            strategy: names.length ? "cities" : existing.strategy || "radius",
            radiusKm: radiusValue,
            operatingCities: names,
            maxDistanceKm: existing.maxDistanceKm,
            inside: existing.inside,
            outside: existing.outside,
            // Omit afterHoursSurcharge — server keeps the persisted surcharge.
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || body.message || "Failed");
      setSaved(true);
      onSaved?.(body);
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  }, [company, operatingCities, orderRadiusKm, catalog, onSaved, serviceAreas]);

  if (!company) return null;

  return (
    <Box sx={adminSurfaceSx(embedded)}>
      <AdminSettingsSection
        title={t("companyProfile.coverageTitle")}
        description={t("companyProfile.coverageHelp")}
      >
        <Alert severity="info" sx={{ mb: 2, ...adminReadableTextSx }}>
          {t("companyProfile.coverageVsPricingNote", {
            defaultValue:
              "This screen only controls WHERE bookings are allowed. Delivery prices are set under Delivery / Pricing for the same company.",
          })}
        </Alert>
        <ServiceAreasPicker
          country={company?.country}
          value={serviceAreas}
          onChange={(next) => {
            setSaved(false);
            setServiceAreas(compactServiceAreas(next));
          }}
          disabled={disabled}
        />

        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ mt: 2.5, mb: 1, ...adminReadableTextSx }}
        >
          {t("companyProfile.extraCitiesTitle")}
        </Typography>
        <OperatingCitiesPicker
          value={operatingCities}
          onChange={(next) => {
            setSaved(false);
            setOperatingCities(next);
          }}
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

        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ mt: 2.5, mb: 1, ...adminReadableTextSx }}
        >
          {t("companyProfile.radiusComplementTitle")}
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
            onChange={(e) => {
              setSaved(false);
              setOrderRadiusKm(e.target.value);
            }}
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
          communityCodes={serviceAreas.communityCodes}
          provinceCodes={serviceAreas.provinceCodes}
          catalog={catalog}
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
      {saved && !error ? (
        <Typography
          color="success.main"
          variant="body2"
          sx={{ mt: 2, whiteSpace: "normal", ...adminReadableTextSx }}
        >
          {t("companyProfile.coverageSaved")}
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
        {busy ? t("companyProfile.coverageSaving") : t("companyProfile.saveCoverage")}
      </Button>
    </Box>
  );
}
