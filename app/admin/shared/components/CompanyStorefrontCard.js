"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  haversineKm,
  isWithinOrderRadius,
  parseLatLon,
} from "@/domain/geo/haversineKm";
import { ALL_UI_LOCALES } from "@/domain/platform/uiLocales";

export default function CompanyStorefrontCard({
  company,
  onSaved,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState([]);
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
  const [cityIds, setCityIds] = useState(
    (company?.cityIds || []).map((id) => String(id))
  );
  const [orderRadiusKm, setOrderRadiusKm] = useState(
    company?.orderRadiusKm == null ? "" : String(company.orderRadiusKm)
  );
  const [langAdmin, setLangAdmin] = useState(company?.langAdmin || "en");

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
    setCityIds((company?.cityIds || []).map((id) => String(id)));
    setOrderRadiusKm(
      company?.orderRadiusKm == null ? "" : String(company.orderRadiusKm)
    );
    setLangAdmin(company?.langAdmin || "en");
  }, [company]);

  useEffect(() => {
    let cancelled = false;
    const companyCountry = String(company?.country || "")
      .trim()
      .toUpperCase();

    (async () => {
      let list = [];
      try {
        const qs = companyCountry
          ? `country=${encodeURIComponent(companyCountry)}`
          : "country=ALL";
        const adminRes = await fetch(`/api/admin/platform/cities?${qs}`, {
          cache: "no-store",
        });
        if (adminRes.ok) {
          const body = await adminRes.json();
          if (body?.success && Array.isArray(body.cities)) {
            list = body.cities;
          }
        }
      } catch {
        /* company admin may not access admin cities */
      }
      if (!list.length) {
        try {
          const res = await fetch("/api/platform/public", { cache: "no-store" });
          if (res.ok) {
            const body = await res.json();
            if (body?.success && Array.isArray(body.cities)) {
              list = body.cities;
              if (companyCountry) {
                list = list.filter(
                  (c) =>
                    String(c.country || "").toUpperCase() === companyCountry
                );
              }
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setCatalog(list);
    })();

    return () => {
      cancelled = true;
    };
  }, [company?.country]);

  const toggleCity = (id) => {
    const sid = String(id);
    setCityIds((prev) =>
      prev.includes(sid) ? prev.filter((item) => item !== sid) : [...prev, sid]
    );
  };

  const selectCitiesWithinRadius = () => {
    const radius = Number(orderRadiusKm);
    const base = parseLatLon(company?.coords);
    if (!base || !Number.isFinite(radius) || radius < 0) {
      setError(t("companyProfile.orderRadiusNeedsBase"));
      return;
    }
    const next = catalog
      .filter((city) => {
        const point = parseLatLon(city.coords);
        if (!point) return false;
        return isWithinOrderRadius(radius, haversineKm(base, point));
      })
      .map((city) => String(city._id));
    if (!next.length) {
      setError(t("companyProfile.orderRadiusNoCities"));
      return;
    }
    setError("");
    setCityIds(next);
  };

  const save = useCallback(async () => {
    if (!company?._id) return;
    setBusy(true);
    setError("");
    try {
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
          cityIds,
          orderRadiusKm:
            orderRadiusKm === "" || orderRadiusKm == null
              ? null
              : Number(orderRadiusKm),
          langAdmin,
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
    company?._id,
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
    cityIds,
    orderRadiusKm,
    langAdmin,
    onSaved,
  ]);

  if (!company) return null;

  const base = parseLatLon(company.coords);
  const fieldSx = {
    width: "100%",
    minWidth: 0,
  };

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2 },
        mt: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
        maxWidth: "100%",
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5, fontSize: { xs: "1.05rem", sm: "1.25rem" } }}>
        {t("companyProfile.storefrontTitle")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t("companyProfile.storefrontHelp")}
      </Typography>

      <Stack gap={1.5}>
        {/* Storefront identity + notifications */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1.4fr 1fr" },
            gap: 1.5,
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
            sx={fieldSx}
          />
          <FormControl size="small" sx={fieldSx} disabled={disabled}>
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
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              {t("companyProfile.emailLangHelp")}
            </Typography>
          </FormControl>
        </Box>

        {/* Visibility — one row on phone+ */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: { xs: 0.25, sm: 1 },
            px: 0.5,
            py: 0.5,
            borderRadius: 1,
            bgcolor: "action.hover",
          }}
        >
          <FormControlLabel
            sx={{ m: 0, alignItems: "flex-start", mr: 0 }}
            control={
              <Switch
                checked={storefrontEnabled}
                onChange={(e) => setStorefrontEnabled(e.target.checked)}
                disabled={disabled}
                size="small"
              />
            }
            label={
              <Typography variant="body2" sx={{ pt: 0.75 }}>
                {t("companyProfile.storefrontEnabled")}
              </Typography>
            }
          />
          <FormControlLabel
            sx={{ m: 0, alignItems: "flex-start", mr: 0 }}
            control={
              <Switch
                checked={listedOnMarketplace}
                onChange={(e) => setListedOnMarketplace(e.target.checked)}
                disabled={disabled}
                size="small"
              />
            }
            label={
              <Typography variant="body2" sx={{ pt: 0.75 }}>
                {t("companyProfile.listedOnMarketplace")}
              </Typography>
            }
          />
          <FormControlLabel
            sx={{ m: 0, alignItems: "flex-start", mr: 0, gridColumn: { sm: "1 / -1" } }}
            control={
              <Switch
                checked={useSeasons}
                onChange={(e) => setUseSeasons(e.target.checked)}
                disabled={disabled}
                size="small"
              />
            }
            label={
              <Box sx={{ pt: 0.75 }}>
                <Typography variant="body2">
                  {t("companyProfile.useSeasons")}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t("companyProfile.useSeasonsHelp")}
                </Typography>
              </Box>
            }
          />
        </Box>

        {/* Booking rules */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            {t("companyProfile.bookingRules")}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr 1fr",
                sm: "repeat(3, minmax(0, 1fr))",
              },
              gap: 1,
            }}
          >
            <TextField
              size="small"
              type="number"
              label={t("companyProfile.bufferHoursShort")}
              value={bufferTime}
              onChange={(e) => setBufferTime(e.target.value)}
              inputProps={{ min: 0, max: 24 }}
              disabled={disabled}
              sx={fieldSx}
            />
            <TextField
              size="small"
              type="number"
              label={t("companyProfile.minRentalHoursShort")}
              value={minRentalDuration}
              onChange={(e) => setMinRentalDuration(e.target.value)}
              inputProps={{ min: 1 }}
              disabled={disabled}
              sx={fieldSx}
            />
            <TextField
              size="small"
              label={t("companyProfile.defaultStart")}
              value={defaultStart}
              onChange={(e) => setDefaultStart(e.target.value)}
              disabled={disabled}
              sx={fieldSx}
            />
            <TextField
              size="small"
              label={t("companyProfile.defaultEnd")}
              value={defaultEnd}
              onChange={(e) => setDefaultEnd(e.target.value)}
              disabled={disabled}
              sx={fieldSx}
            />
            <TextField
              size="small"
              label={t("companyProfile.workingHoursStart")}
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
              disabled={disabled}
              sx={fieldSx}
            />
            <TextField
              size="small"
              label={t("companyProfile.workingHoursEnd")}
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
              disabled={disabled}
              sx={fieldSx}
            />
          </Box>
        </Box>

        {/* Inside cities (primary) + optional radius helper */}
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            {t("companyProfile.insideCitiesTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t("companyProfile.insideCitiesHelp")}
          </Typography>

          <Stack
            direction="row"
            gap={1}
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 1 }}
          >
            <Button
              size="small"
              variant="outlined"
              disabled={disabled || catalog.length === 0}
              onClick={() => setCityIds(catalog.map((c) => String(c._id)))}
              sx={{ textTransform: "none" }}
            >
              {t("companyProfile.selectAllCities")}
            </Button>
            <Button
              size="small"
              variant="text"
              disabled={disabled || cityIds.length === 0}
              onClick={() => setCityIds([])}
              sx={{ textTransform: "none" }}
            >
              {t("companyProfile.clearCities")}
            </Button>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ alignSelf: "center" }}
            >
              {t("companyProfile.selectedCitiesCount", {
                count: cityIds.length,
              })}
            </Typography>
          </Stack>

          <Box
            sx={{
              maxHeight: { xs: 220, sm: 280 },
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              p: 1,
              mb: 1.5,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
                md: "1fr 1fr 1fr",
              },
              gap: 0.25,
            }}
          >
            {catalog.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t("companyProfile.noCatalogCities")}
              </Typography>
            ) : (
              catalog.map((city) => {
                const point = parseLatLon(city.coords);
                const km = base && point ? haversineKm(base, point) : null;
                const selected = cityIds.includes(String(city._id));
                return (
                  <FormControlLabel
                    key={city._id}
                    control={
                      <Checkbox
                        size="small"
                        checked={selected}
                        onChange={() => toggleCity(city._id)}
                        disabled={disabled}
                      />
                    }
                    label={
                      <Typography variant="body2" component="span">
                        {city.name}
                        {km != null ? ` · ${Math.round(km)} km` : ""}
                      </Typography>
                    }
                    sx={{ m: 0, mr: 0, alignItems: "center" }}
                  />
                );
              })
            )}
          </Box>

          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            {t("companyProfile.radiusHelperTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t("companyProfile.radiusHelperHelp")}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 220px) auto" },
              gap: 1,
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
              sx={fieldSx}
            />
            <Button
              size="small"
              variant="outlined"
              onClick={selectCitiesWithinRadius}
              disabled={disabled || !base || orderRadiusKm === ""}
              sx={{
                textTransform: "none",
                whiteSpace: "nowrap",
                height: 40,
                justifySelf: { xs: "stretch", sm: "start" },
              }}
            >
              {t("companyProfile.selectWithinRadius")}
            </Button>
          </Box>
          {!base ? (
            <Typography
              variant="caption"
              color="warning.main"
              sx={{ mt: 0.5, display: "block" }}
            >
              {t("companyProfile.orderRadiusNeedsBase")}
            </Typography>
          ) : null}
        </Box>

        {error ? (
          <Typography color="error" variant="body2">
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
          }}
        >
          {t("companyProfile.saveStorefront")}
        </Button>
      </Stack>
    </Box>
  );
}
