"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { parseLatLon } from "@/domain/geo/haversineKm";
import { ALL_UI_LOCALES } from "@/domain/platform/uiLocales";
import { normalizeOperatingCities } from "@/domain/delivery/cityDeliveryPricing";
import { defaultDeliveryPricing } from "@/domain/delivery/deliveryPricingPolicy";
import {
  citiesWithinRadius,
  cityNamesFromCityIds,
  selectedCityIdsFromCatalog,
} from "@/domain/geo/operatingCityCatalog";
import useOperatingCityCatalog from "@/app/admin/shared/hooks/useOperatingCityCatalog";
import AdminSettingsSection, {
  adminCardSx,
  adminFieldSx,
} from "@/app/admin/shared/components/AdminSettingsSection";
import OperatingCitiesPicker from "@/app/admin/shared/components/OperatingCitiesPicker";

const pricingToggleSx = {
  flexWrap: "wrap",
  width: "100%",
  "& .MuiToggleButton-root": {
    textTransform: "none",
    px: 1.5,
    whiteSpace: "normal",
    lineHeight: 1.3,
    flex: { xs: "1 1 auto", sm: "0 1 auto" },
  },
};

function policyFromCompany(company) {
  const fallback = defaultDeliveryPricing(company?.deliveryPricePerKm ?? 1);
  const dp = company?.deliveryPricing;
  if (!dp || typeof dp !== "object") return fallback;
  return {
    strategy: dp.strategy || (dp.operatingCities?.length ? "cities" : fallback.strategy),
    radiusKm: dp.radiusKm ?? null,
    operatingCities: normalizeOperatingCities(dp.operatingCities),
    maxDistanceKm: dp.maxDistanceKm ?? null,
    inside: {
      mode: dp.inside?.mode || fallback.inside.mode,
      amount:
        dp.inside?.amount != null
          ? Number(dp.inside.amount)
          : fallback.inside.amount,
    },
    outside: {
      mode: dp.outside?.mode || fallback.outside.mode,
      amount:
        dp.outside?.amount != null
          ? Number(dp.outside.amount)
          : fallback.outside.amount,
    },
    afterHoursSurcharge: Number(dp.afterHoursSurcharge) || 0,
  };
}

export default function CompanyStorefrontCard({
  company,
  onSaved,
  onEditBaseLocation,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slug, setSlug] = useState(company?.slug || "");
  const [storefrontEnabled, setStorefrontEnabled] = useState(
    company?.storefrontEnabled !== false
  );
  const [listedOnMarketplace, setListedOnMarketplace] = useState(
    company?.listedOnMarketplace !== false
  );
  const [useSeasons, setUseSeasons] = useState(company?.useSeasons !== false);
  const [bufferTime, setBufferTime] = useState(company?.bufferTime ?? 2);
  const [minRentalDuration, setMinRentalDuration] = useState(
    company?.minRentalDuration ?? 1
  );
  const [defaultStart, setDefaultStart] = useState(company?.defaultStart || "14:00");
  const [defaultEnd, setDefaultEnd] = useState(company?.defaultEnd || "12:00");
  const [workStart, setWorkStart] = useState(company?.workingHours?.start || "08:00");
  const [workEnd, setWorkEnd] = useState(company?.workingHours?.end || "22:00");
  const [operatingCities, setOperatingCities] = useState(() =>
    normalizeOperatingCities(company?.deliveryPricing?.operatingCities)
  );
  const [orderRadiusKm, setOrderRadiusKm] = useState(
    company?.orderRadiusKm == null && company?.deliveryPricing?.radiusKm == null
      ? ""
      : String(company?.orderRadiusKm ?? company?.deliveryPricing?.radiusKm ?? "")
  );
  const [langAdmin, setLangAdmin] = useState(company?.langAdmin || "en");
  const [insideMode, setInsideMode] = useState(
    () => policyFromCompany(company).inside.mode
  );
  const [insideAmount, setInsideAmount] = useState(
    () => policyFromCompany(company).inside.amount
  );
  const [outsideMode, setOutsideMode] = useState(
    () => policyFromCompany(company).outside.mode
  );
  const [outsideAmount, setOutsideAmount] = useState(
    () => policyFromCompany(company).outside.amount
  );

  const { catalog } = useOperatingCityCatalog(company?.country);
  const base = parseLatLon(company?.coords);

  useEffect(() => {
    setSlug(company?.slug || "");
    setStorefrontEnabled(company?.storefrontEnabled !== false);
    setListedOnMarketplace(company?.listedOnMarketplace !== false);
    setUseSeasons(company?.useSeasons !== false);
    setBufferTime(company?.bufferTime ?? 2);
    setMinRentalDuration(company?.minRentalDuration ?? 1);
    setDefaultStart(company?.defaultStart || "14:00");
    setDefaultEnd(company?.defaultEnd || "12:00");
    setWorkStart(company?.workingHours?.start || "08:00");
    setWorkEnd(company?.workingHours?.end || "22:00");
    setLangAdmin(company?.langAdmin || "en");
    const policy = policyFromCompany(company);
    setInsideMode(policy.inside.mode);
    setInsideAmount(policy.inside.amount);
    setOutsideMode(policy.outside.mode);
    setOutsideAmount(policy.outside.amount);
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
    if (!base) {
      setError(t("companyProfile.setBaseLocationFirst"));
      return;
    }
    if (!Number.isFinite(radius) || radius < 0) {
      setError(t("companyProfile.setBaseLocationFirst"));
      return;
    }
    const next = citiesWithinRadius(catalog, base, radius).map((city) => city.name);
    if (!next.length) {
      setError(t("companyProfile.orderRadiusNoCities"));
      return;
    }
    setError("");
    setOperatingCities(next);
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
          slug,
          storefrontEnabled,
          listedOnMarketplace,
          useSeasons,
          bufferTime: Number(bufferTime),
          minRentalDuration: Number(minRentalDuration),
          defaultStart,
          defaultEnd,
          workingHours: { start: workStart, end: workEnd },
          cityIds: selectedCityIdsFromCatalog(names, catalog),
          orderRadiusKm: radiusValue,
          langAdmin,
          deliveryPricing: {
            strategy: names.length ? "cities" : existing.strategy || "radius",
            radiusKm: radiusValue,
            operatingCities: names,
            maxDistanceKm: existing.maxDistanceKm,
            inside: {
              mode: insideMode,
              amount:
                insideMode === "free" ? 0 : Number(insideAmount) || 0,
            },
            outside: {
              mode: outsideMode,
              amount: Number(outsideAmount) || 0,
            },
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
  }, [
    company,
    slug,
    storefrontEnabled,
    listedOnMarketplace,
    useSeasons,
    bufferTime,
    minRentalDuration,
    defaultStart,
    defaultEnd,
    workStart,
    workEnd,
    operatingCities,
    orderRadiusKm,
    langAdmin,
    catalog,
    insideMode,
    insideAmount,
    outsideMode,
    outsideAmount,
    onSaved,
  ]);

  if (!company) return null;

  return (
    <Box sx={adminCardSx}>
      <Typography
        variant="h6"
        fontWeight={700}
        sx={{
          mb: 0.5,
          fontSize: { xs: "1.1rem", sm: "1.25rem" },
          letterSpacing: "normal",
        }}
      >
        {t("companyProfile.storefrontTitle")}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2.5, whiteSpace: "normal", lineHeight: 1.5 }}
      >
        {t("companyProfile.storefrontHelp")}
      </Typography>

      <Stack gap={2.5}>
        <AdminSettingsSection title={t("companyProfile.identityTitle")}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1.4fr 1fr" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <TextField
              size="small"
              label={t("companyProfile.slug")}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              helperText={
                slug
                  ? t("companyProfile.slugPreview", { slug })
                  : t("companyProfile.slugHelp")
              }
              disabled={disabled}
              sx={adminFieldSx}
            />
            <FormControl size="small" sx={adminFieldSx} disabled={disabled}>
              <InputLabel id="company-email-lang">
                {t("companyProfile.emailLang")}
              </InputLabel>
              <Select
                labelId="company-email-lang"
                label={t("companyProfile.emailLang")}
                value={langAdmin}
                onChange={(e) => setLangAdmin(e.target.value)}
              >
                {ALL_UI_LOCALES.map((loc) => (
                  <MenuItem key={loc.code} value={loc.code}>
                    {loc.label}
                  </MenuItem>
                ))}
              </Select>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.75, display: "block", whiteSpace: "normal" }}
              >
                {t("companyProfile.emailLangHelp")}
              </Typography>
            </FormControl>
          </Box>
        </AdminSettingsSection>

        <AdminSettingsSection title={t("companyProfile.visibilityTitle")}>
          <Stack gap={1.25}>
            <FormControlLabel
              sx={{ m: 0, alignItems: "flex-start" }}
              control={
                <Switch
                  checked={storefrontEnabled}
                  onChange={(e) => setStorefrontEnabled(e.target.checked)}
                  disabled={disabled}
                />
              }
              label={
                <Typography variant="body2" sx={{ pt: 0.75, whiteSpace: "normal" }}>
                  {t("companyProfile.storefrontEnabled")}
                </Typography>
              }
            />
            <FormControlLabel
              sx={{ m: 0, alignItems: "flex-start" }}
              control={
                <Switch
                  checked={listedOnMarketplace}
                  onChange={(e) => setListedOnMarketplace(e.target.checked)}
                  disabled={disabled}
                />
              }
              label={
                <Typography variant="body2" sx={{ pt: 0.75, whiteSpace: "normal" }}>
                  {t("companyProfile.listedOnMarketplace")}
                </Typography>
              }
            />
            <FormControlLabel
              sx={{ m: 0, alignItems: "flex-start" }}
              control={
                <Switch
                  checked={useSeasons}
                  onChange={(e) => setUseSeasons(e.target.checked)}
                  disabled={disabled}
                />
              }
              label={
                <Box sx={{ pt: 0.75 }}>
                  <Typography variant="body2" sx={{ whiteSpace: "normal" }}>
                    {t("companyProfile.useSeasons")}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                    sx={{ whiteSpace: "normal", lineHeight: 1.45 }}
                  >
                    {t("companyProfile.useSeasonsHelp")}
                  </Typography>
                </Box>
              }
            />
          </Stack>
        </AdminSettingsSection>

        <AdminSettingsSection title={t("companyProfile.bookingRules")}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
                md: "repeat(3, minmax(0, 1fr))",
              },
              gap: 1.5,
            }}
          >
            <TextField
              size="small"
              type="number"
              label={t("companyProfile.bufferHours")}
              value={bufferTime}
              onChange={(e) => setBufferTime(e.target.value)}
              inputProps={{ min: 0, max: 24 }}
              disabled={disabled}
              sx={adminFieldSx}
            />
            <TextField
              size="small"
              type="number"
              label={t("companyProfile.minRentalHours")}
              value={minRentalDuration}
              onChange={(e) => setMinRentalDuration(e.target.value)}
              inputProps={{ min: 1 }}
              disabled={disabled}
              sx={adminFieldSx}
            />
            <TextField
              size="small"
              label={t("companyProfile.defaultStart")}
              value={defaultStart}
              onChange={(e) => setDefaultStart(e.target.value)}
              disabled={disabled}
              sx={adminFieldSx}
            />
            <TextField
              size="small"
              label={t("companyProfile.defaultEnd")}
              value={defaultEnd}
              onChange={(e) => setDefaultEnd(e.target.value)}
              disabled={disabled}
              sx={adminFieldSx}
            />
            <TextField
              size="small"
              label={t("companyProfile.workingHoursStart")}
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
              disabled={disabled}
              sx={adminFieldSx}
            />
            <TextField
              size="small"
              label={t("companyProfile.workingHoursEnd")}
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
              disabled={disabled}
              sx={adminFieldSx}
            />
          </Box>
        </AdminSettingsSection>

        <AdminSettingsSection
          title={t("companyProfile.baseLocationTitle")}
          description={t("companyProfile.baseLocationHelp")}
        >
          {base ? (
            <Typography variant="body2" sx={{ letterSpacing: "normal" }}>
              {t("companyProfile.baseLocationCoords", {
                lat: Number(base.lat).toFixed(4),
                lon: Number(base.lon).toFixed(4),
              })}
            </Typography>
          ) : (
            <Typography variant="body2" color="warning.main">
              {t("companyProfile.baseLocationMissing")}
            </Typography>
          )}
          {typeof onEditBaseLocation === "function" ? (
            <Button
              size="small"
              variant="outlined"
              onClick={onEditBaseLocation}
              disabled={disabled}
              sx={{ mt: 1.5, textTransform: "none" }}
            >
              {t("companyProfile.editBaseLocation")}
            </Button>
          ) : null}
        </AdminSettingsSection>

        <AdminSettingsSection
          title={t("companyProfile.operatingCitiesTitle")}
          description={t("companyProfile.operatingCitiesHelp")}
        >
          <OperatingCitiesPicker
            value={operatingCities}
            onChange={setOperatingCities}
            catalog={catalog}
            country={company?.country}
            baseCoords={company?.coords}
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
            sx={{ mt: 2.5, mb: 0.5, letterSpacing: "normal" }}
          >
            {t("companyProfile.radiusShortcutTitle")}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 1.5, whiteSpace: "normal", lineHeight: 1.5 }}
          >
            {t("companyProfile.radiusShortcutHelp")}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) auto" },
              gap: 1.5,
              alignItems: "start",
            }}
          >
            <TextField
              size="small"
              type="number"
              label={t("companyProfile.orderRadiusKm")}
              value={orderRadiusKm}
              onChange={(e) => setOrderRadiusKm(e.target.value)}
              helperText={t("companyProfile.orderRadiusHelp")}
              inputProps={{ min: 0, max: 5000, step: 1 }}
              disabled={disabled}
              sx={adminFieldSx}
            />
            <Button
              size="medium"
              variant="outlined"
              onClick={selectCitiesWithinRadius}
              disabled={disabled || !base || orderRadiusKm === ""}
              sx={{
                textTransform: "none",
                whiteSpace: "normal",
                minHeight: 40,
                px: 2,
                justifySelf: { xs: "stretch", sm: "start" },
              }}
            >
              {t("companyProfile.selectWithinRadius")}
            </Button>
          </Box>
          {!base ? (
            <Typography
              variant="body2"
              color="warning.main"
              sx={{ mt: 1.25, display: "block", whiteSpace: "normal" }}
            >
              {t("companyProfile.setBaseLocationFirst")}{" "}
              {typeof onEditBaseLocation === "function" ? (
                <Button
                  size="small"
                  variant="text"
                  onClick={onEditBaseLocation}
                  sx={{ textTransform: "none", p: 0, minWidth: 0, verticalAlign: "baseline" }}
                >
                  {t("companyProfile.setBaseLocationLink")}
                </Button>
              ) : null}
            </Typography>
          ) : null}
        </AdminSettingsSection>

        <AdminSettingsSection
          title={t("companyProfile.deliveryRulesTitle")}
          description={t("companyProfile.deliveryRulesHelp")}
        >
          <Stack gap={2.5}>
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                {t("companyProfile.insideCityPrice")}
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", sm: "flex-start" }}
              >
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  color="primary"
                  value={insideMode === "free" || insideMode === "fixed" || insideMode === "perKm" ? insideMode : "free"}
                  onChange={(_e, next) => {
                    if (next == null) return;
                    setInsideMode(next);
                    if (next === "free") setInsideAmount(0);
                  }}
                  sx={pricingToggleSx}
                >
                  <ToggleButton value="free">{t("companyProfile.insideFree")}</ToggleButton>
                  <ToggleButton value="fixed">{t("companyProfile.insideFixed")}</ToggleButton>
                  <ToggleButton value="perKm">{t("companyProfile.insidePerKm")}</ToggleButton>
                </ToggleButtonGroup>
                {insideMode !== "free" ? (
                  <TextField
                    size="small"
                    type="number"
                    label={
                      insideMode === "fixed"
                        ? t("companyProfile.insideFixed")
                        : t("companyProfile.insidePerKm")
                    }
                    value={insideAmount}
                    onChange={(e) => setInsideAmount(e.target.value)}
                    inputProps={{ min: 0, step: 0.1 }}
                    disabled={disabled}
                    sx={{ ...adminFieldSx, maxWidth: { sm: 200 } }}
                  />
                ) : null}
              </Stack>
            </Box>

            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                {t("companyProfile.outsideCityPrice")}
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", sm: "flex-start" }}
              >
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  color="primary"
                  value={
                    ["perKm", "fixed", "blocked"].includes(outsideMode)
                      ? outsideMode
                      : "perKm"
                  }
                  onChange={(_e, next) => {
                    if (next == null) return;
                    setOutsideMode(next);
                  }}
                  sx={pricingToggleSx}
                >
                  <ToggleButton value="perKm">{t("companyProfile.outsidePerKm")}</ToggleButton>
                  <ToggleButton value="fixed">{t("companyProfile.outsideFixed")}</ToggleButton>
                  <ToggleButton value="blocked">{t("companyProfile.outsideBlocked")}</ToggleButton>
                </ToggleButtonGroup>
                {outsideMode !== "blocked" ? (
                  <TextField
                    size="small"
                    type="number"
                    label={
                      outsideMode === "fixed"
                        ? t("companyProfile.outsideFixed")
                        : t("companyProfile.outsidePerKm")
                    }
                    value={outsideAmount}
                    onChange={(e) => setOutsideAmount(e.target.value)}
                    inputProps={{ min: 0, step: 0.1 }}
                    disabled={disabled}
                    sx={{ ...adminFieldSx, maxWidth: { sm: 200 } }}
                  />
                ) : null}
              </Stack>
            </Box>

            <TextField
              size="small"
              type="number"
              label={t("companyProfile.optionalRadiusLabel")}
              value={orderRadiusKm}
              onChange={(e) => setOrderRadiusKm(e.target.value)}
              helperText={t("companyProfile.optionalRadiusHelp")}
              inputProps={{ min: 0, max: 5000, step: 1 }}
              disabled={disabled}
              sx={{ ...adminFieldSx, maxWidth: { sm: 320 } }}
            />
          </Stack>
        </AdminSettingsSection>

        {error ? (
          <Typography color="error" variant="body2" sx={{ whiteSpace: "normal" }}>
            {error}
          </Typography>
        ) : null}

        <Button
          variant="contained"
          onClick={save}
          disabled={disabled || busy}
          sx={{
            textTransform: "none",
            alignSelf: { xs: "stretch", sm: "flex-start" },
            minWidth: { sm: 220 },
            px: 2.5,
            py: 1,
          }}
        >
          {t("companyProfile.saveStorefront")}
        </Button>
      </Stack>
    </Box>
  );
}
