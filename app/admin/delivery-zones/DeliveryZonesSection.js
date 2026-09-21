"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  IconButton,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Chip,
  Stack,
  Tooltip,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { useTranslation, Trans } from "react-i18next";
import { useSession } from "next-auth/react";
import { computeZoneDeliveryPrice } from "@/domain/delivery/deliveryPriceFormula";
import {
  computeRuleDeliveryPrice,
  defaultDeliveryPricing,
  hasActiveDeliveryPricing,
} from "@/domain/delivery/deliveryPricingPolicy";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";
import { useAdminViewAs } from "@app/hooks/useAdminViewAs";
import { ROLE } from "@/domain/orders/admin-rbac";
import { COMPANY_ID } from "@config/company";
import DeliveryPricingExplainer from "./DeliveryPricingExplainer";
import OperatingCitiesPicker from "@/app/admin/shared/components/OperatingCitiesPicker";
import useOperatingCityCatalog from "@/app/admin/shared/hooks/useOperatingCityCatalog";
import { citiesWithinRadius } from "@/domain/geo/operatingCityCatalog";

const EMPTY_FORM = {
  name: "",
  distanceKm: "",
  fixedPrice: "",
  isFreeDelivery: false,
};

const pricingModeToggleSx = {
  flexWrap: "wrap",
  "& .MuiToggleButton-root": {
    textTransform: "none",
    px: 1.5,
  },
};

function formatDistanceFormula(distanceKm, rate) {
  return `${distanceKm} × €${rate}`;
}

function buildDistanceHelperText(t, distanceKmValue, rateValue) {
  if (!String(distanceKmValue ?? "").trim()) return undefined;
  if (!String(rateValue ?? "").trim()) return undefined;

  const distanceKm = Number(distanceKmValue);
  const rate = Number(rateValue);
  const price = computeZoneDeliveryPrice({ distanceKm }, rate);

  return t("deliveryZonesPage.distanceHelper", {
    price,
    formula: formatDistanceFormula(distanceKmValue, rateValue),
  });
}

function hasFixedPrice(zone) {
  if (zone?.fixedPrice == null) return false;
  return Number.isFinite(Number(zone.fixedPrice));
}

export default function DeliveryZonesSection({ variant = "all" } = {}) {
  const { t } = useTranslation();
  const showInnerTabs = variant === "all";
  const showCoverage = variant !== "pricing";
  const showPricing = variant !== "coverage";
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === ROLE.SUPERADMIN;
  const { active: viewAsActive, company: viewAsCompany } = useAdminViewAs();
  const showCompanyPicker = isSuperAdmin && !viewAsActive;
  const { country: adminCountry } = useAdminCountryFilter();

  const [tab, setTab] = useState(0);
  const [companies, setCompanies] = useState([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notification, setNotification] = useState(null);
  const [pricePerKm, setPricePerKm] = useState("");
  const [pricePerKmSaved, setPricePerKmSaved] = useState("");
  const [baseLat, setBaseLat] = useState("");
  const [baseLon, setBaseLon] = useState("");
  const [locating, setLocating] = useState(false);
  const [savingBase, setSavingBase] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [workStart, setWorkStart] = useState("08:00");
  const [workEnd, setWorkEnd] = useState("22:00");
  const [previewKm, setPreviewKm] = useState("10");
  const [previewAfterHours, setPreviewAfterHours] = useState(false);

  const [policy, setPolicy] = useState(() => defaultDeliveryPricing(1));
  const [companyCountry, setCompanyCountry] = useState("");
  const { catalog: cityCatalog } = useOperatingCityCatalog(companyCountry);

  const companyIdForSession = useCallback(() => {
    if (viewAsActive && viewAsCompany?._id) {
      return String(viewAsCompany._id);
    }
    if (showCompanyPicker) {
      return selectedOwnerId || String(COMPANY_ID);
    }
    return session?.user?.ownerId
      ? String(session.user.ownerId)
      : String(COMPANY_ID);
  }, [
    viewAsActive,
    viewAsCompany,
    showCompanyPicker,
    selectedOwnerId,
    session,
  ]);

  // Load companies for superadmin (country-scoped); skip while viewing as a company
  useEffect(() => {
    if (!showCompanyPicker) {
      const oid =
        viewAsActive && viewAsCompany?._id
          ? String(viewAsCompany._id)
          : session?.user?.ownerId
            ? String(session.user.ownerId)
            : String(COMPANY_ID);
      setSelectedOwnerId(oid);
      setCompanies([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const qs =
          adminCountry === "ALL"
            ? "country=ALL"
            : `country=${encodeURIComponent(adminCountry)}`;
        const res = await fetch(`/api/admin/owners?${qs}`);
        const body = await res.json();
        if (cancelled || !body?.success) return;
        const list = Array.isArray(body.companies) ? body.companies : [];
        setCompanies(list);
        setSelectedOwnerId((prev) => {
          if (prev && list.some((c) => String(c._id) === prev)) return prev;
          return list[0] ? String(list[0]._id) : String(COMPANY_ID);
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    showCompanyPicker,
    adminCountry,
    session?.user?.ownerId,
    viewAsActive,
    viewAsCompany,
  ]);

  const fetchZones = useCallback(async () => {
    const ownerId = companyIdForSession();
    if (!ownerId) return;
    try {
      const res = await fetch(
        `/api/admin/delivery-zones?ownerId=${encodeURIComponent(ownerId)}`
      );
      const data = await res.json();
      if (data.success) setZones(data.data);
    } catch (err) {
      console.error("Failed to fetch zones:", err);
    } finally {
      setLoading(false);
    }
  }, [companyIdForSession]);

  const fetchCompany = useCallback(async () => {
    const id = companyIdForSession();
    if (!id) return;
    try {
      const res = await fetch(`/api/company/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (data && !data.error) {
        const val = data.deliveryPricePerKm ?? 0;
        setPricePerKm(String(val));
        setPricePerKmSaved(String(val));
        const lat = data?.coords?.lat != null ? String(data.coords.lat) : "";
        const lon = data?.coords?.lon != null ? String(data.coords.lon) : "";
        setBaseLat(lat);
        setBaseLon(lon);
        setCompanyCountry(String(data?.country || "").trim());
        setWorkStart(data?.workingHours?.start || "08:00");
        setWorkEnd(data?.workingHours?.end || "22:00");
        const dp = data.deliveryPricing;
        if (dp && typeof dp === "object") {
          setPolicy({
            strategy: dp.strategy || (dp.operatingCities?.length ? "cities" : "radius"),
            radiusKm: dp.radiusKm ?? null,
            operatingCities: Array.isArray(dp.operatingCities)
              ? dp.operatingCities
              : [],
            maxDistanceKm: dp.maxDistanceKm ?? null,
            inside: {
              mode: dp.inside?.mode || "perKm",
              amount:
                dp.inside?.amount != null
                  ? Number(dp.inside.amount)
                  : Number(val) || 0,
            },
            outside: {
              mode: dp.outside?.mode || "perKm",
              amount:
                dp.outside?.amount != null
                  ? Number(dp.outside.amount)
                  : Number(val) || 0,
            },
            afterHoursSurcharge: Number(dp.afterHoursSurcharge) || 0,
          });
        } else {
          setPolicy(defaultDeliveryPricing(val));
        }
      }
    } catch (err) {
      console.error("Failed to fetch company:", err);
    }
  }, [companyIdForSession]);

  useEffect(() => {
    setLoading(true);
    fetchZones();
    fetchCompany();
  }, [fetchZones, fetchCompany]);

  const selectedCompanyName = useMemo(() => {
    if (viewAsActive && viewAsCompany?.name) return viewAsCompany.name;
    const c = companies.find((x) => String(x._id) === selectedOwnerId);
    return c?.name || "";
  }, [companies, selectedOwnerId, viewAsActive, viewAsCompany]);

  const summaryText = useMemo(() => {
    const r =
      policy.radiusKm != null && policy.radiusKm !== ""
        ? Number(policy.radiusKm)
        : null;
    const insideLabel =
      policy.inside.mode === "free"
        ? t("deliveryZonesPage.free")
        : policy.inside.mode === "fixed"
          ? `€${policy.inside.amount} (${t("deliveryZonesPage.fixed")})`
          : `€${policy.inside.amount}/${t("deliveryZonesPage.perKmShort")}`;
    const outsideLabel =
      policy.outside.mode === "blocked"
        ? t("deliveryZonesPage.outsideBlocked")
        : policy.outside.mode === "fixed"
          ? `€${policy.outside.amount} (${t("deliveryZonesPage.fixed")})`
          : `€${policy.outside.amount}/${t("deliveryZonesPage.perKmShort")} ${t("deliveryZonesPage.beyondArea")}`;
    const radiusLabel =
      r != null && Number.isFinite(r)
        ? t("deliveryZonesPage.summaryInside", { km: r, price: insideLabel })
        : t("deliveryZonesPage.summaryInsideNoRadius", { price: insideLabel });
    return {
      inside: radiusLabel,
      outside: t("deliveryZonesPage.summaryOutside", { price: outsideLabel }),
      afterHours: t("deliveryZonesPage.summaryAfterHours", {
        amount: policy.afterHoursSurcharge || 0,
      }),
    };
  }, [policy, t]);

  const previewResult = useMemo(() => {
    const km = Number(previewKm);
    if (!Number.isFinite(km) || km < 0) return null;

    const oneSide = (afterHours) => {
      if (!hasActiveDeliveryPricing(policy)) {
        return {
          price: computeZoneDeliveryPrice(
            { distanceKm: km },
            Number(pricePerKmSaved) || 0
          ),
          region: "legacy",
          blocked: false,
        };
      }
      return computeRuleDeliveryPrice({
        distanceKm: km,
        policy,
        isAfterHours: afterHours,
      });
    };

    // Same sample km for delivery (placeIn) and return (placeOut)
    const delivery = oneSide(previewAfterHours);
    const ret = oneSide(previewAfterHours);
    const blocked = Boolean(delivery.blocked || ret.blocked);
    const oneWay = delivery.price;
    const roundTrip = blocked ? 0 : delivery.price + ret.price;

    return {
      blocked,
      region: delivery.region || ret.region || "—",
      oneWay,
      delivery: delivery.price,
      return: ret.price,
      roundTrip,
    };
  }, [previewKm, previewAfterHours, policy, pricePerKmSaved]);

  const openAddDialog = () => {
    setEditingZone(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (zone) => {
    setEditingZone(zone);
    setForm({
      name: zone.name,
      distanceKm: String(zone.distanceKm),
      fixedPrice: zone.fixedPrice != null ? String(zone.fixedPrice) : "",
      isFreeDelivery: zone.isFreeDelivery,
    });
    setDialogOpen(true);
  };

  const handleSaveZone = async () => {
    const trimmedFixedPrice = String(form.fixedPrice ?? "").trim();
    const payload = {
      name: form.name.trim(),
      distanceKm: Number(form.distanceKm) || 0,
      fixedPrice: trimmedFixedPrice === "" ? null : Number(trimmedFixedPrice),
      isFreeDelivery: form.isFreeDelivery,
      ownerId: companyIdForSession(),
    };

    try {
      let res;
      if (editingZone) {
        res = await fetch(`/api/admin/delivery-zones/${editingZone._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/delivery-zones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        setNotification({
          severity: "success",
          message: editingZone
            ? t("deliveryZonesPage.zoneUpdated")
            : t("deliveryZonesPage.zoneCreated"),
        });
        setDialogOpen(false);
        fetchZones();
      } else {
        setNotification({ severity: "error", message: data.message });
      }
    } catch (err) {
      setNotification({ severity: "error", message: err.message });
    }
  };

  const handleDelete = async (zone) => {
    if (!confirm(t("deliveryZonesPage.confirmDelete", { name: zone.name })))
      return;
    try {
      const res = await fetch(`/api/admin/delivery-zones/${zone._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          severity: "success",
          message: t("deliveryZonesPage.zoneDeleted"),
        });
        fetchZones();
      } else {
        setNotification({ severity: "error", message: data.message });
      }
    } catch (err) {
      setNotification({ severity: "error", message: err.message });
    }
  };

  const handleSavePolicy = async () => {
    setSavingPolicy(true);
    try {
      const id = companyIdForSession();
      const radiusRaw = policy.radiusKm;
      const body = {
        deliveryPricing: {
          strategy: policy.strategy || "radius",
          radiusKm:
            radiusRaw === "" || radiusRaw == null ? null : Number(radiusRaw),
          operatingCities: Array.isArray(policy.operatingCities)
            ? policy.operatingCities
            : [],
          maxDistanceKm:
            policy.maxDistanceKm === "" || policy.maxDistanceKm == null
              ? null
              : Number(policy.maxDistanceKm),
          inside: {
            mode: policy.inside.mode,
            amount: Number(policy.inside.amount) || 0,
          },
          outside: {
            mode: policy.outside.mode,
            amount: Number(policy.outside.amount) || 0,
          },
          afterHoursSurcharge: Number(policy.afterHoursSurcharge) || 0,
        },
        workingHours: { start: workStart, end: workEnd },
        deliveryPricePerKm:
          policy.outside.mode === "perKm"
            ? Number(policy.outside.amount) || 0
            : policy.inside.mode === "perKm"
              ? Number(policy.inside.amount) || 0
              : Number(pricePerKm) || 0,
      };
      const res = await fetch(`/api/company/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotification({
          severity: "error",
          message: data.error || data.message || t("deliveryZonesPage.saveFailed"),
        });
        return;
      }
      setPricePerKm(String(body.deliveryPricePerKm));
      setPricePerKmSaved(String(body.deliveryPricePerKm));
      setNotification({
        severity: "success",
        message: t("deliveryZonesPage.policySaved"),
      });
      fetchCompany();
    } catch (err) {
      setNotification({ severity: "error", message: err.message });
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleUseMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNotification({
        severity: "error",
        message: t("deliveryZonesPage.locationUnavailable"),
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBaseLat(String(pos.coords.latitude));
        setBaseLon(String(pos.coords.longitude));
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setNotification({
          severity: "error",
          message:
            err?.code === 1
              ? t("deliveryZonesPage.locationDenied")
              : t("deliveryZonesPage.locationUnavailable"),
        });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSaveBaseAndRecalculate = async () => {
    setSavingBase(true);
    try {
      const res = await fetch("/api/admin/delivery-zones/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: baseLat,
          lon: baseLon,
          ownerId: companyIdForSession(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setNotification({
          severity: "error",
          message: data.message || t("deliveryZonesPage.saveFailed"),
        });
        return;
      }
      if (Array.isArray(data.data)) setZones(data.data);
      else fetchZones();
      const failedCount = Number(data.failedCount || 0);
      setNotification({
        severity: failedCount > 0 ? "warning" : "success",
        message:
          failedCount > 0
            ? t("deliveryZonesPage.distancesPartial", {
                updated: data.updatedCount || 0,
                failed: failedCount,
              })
            : t("deliveryZonesPage.distancesRecalculated", {
                count: data.updatedCount || 0,
              }),
      });
    } catch (err) {
      setNotification({ severity: "error", message: err.message });
    } finally {
      setSavingBase(false);
    }
  };

  const renderPrice = (zone) => {
    if (zone.isFreeDelivery) {
      return (
        <Typography variant="body2">{t("deliveryZonesPage.free")}</Typography>
      );
    }
    if (hasFixedPrice(zone)) {
      return (
        <Typography variant="body2">
          {`€${Number(zone.fixedPrice)}`}
          <Box
            component="span"
            sx={{ color: "success.main", fontWeight: 600, ml: 0.5 }}
          >
            ({t("deliveryZonesPage.fixed")})
          </Box>
        </Typography>
      );
    }
    const rate = Number(pricePerKmSaved) || 0;
    return (
      <Typography variant="body2">
        {`€${computeZoneDeliveryPrice(zone, rate)}`}
      </Typography>
    );
  };

  return (
    <Box sx={{ p: 3, maxWidth: 960, mx: "auto" }}>
      {variant === "all" ? (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <LocalShippingIcon sx={{ fontSize: 28 }} />
        <Typography variant="h5" fontWeight={700}>
          {t("deliveryZonesPage.title")}
        </Typography>
      </Stack>
      ) : null}

      {showCompanyPicker && (
        <FormControl size="small" sx={{ mb: 2, minWidth: 260 }}>
          <InputLabel>{t("deliveryZonesPage.company")}</InputLabel>
          <Select
            label={t("deliveryZonesPage.company")}
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
          >
            {companies.map((c) => (
              <MenuItem key={String(c._id)} value={String(c._id)}>
                {c.name || String(c._id)}
                {c.country ? ` (${c.country})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      {showPricing ? (
      <Paper sx={{ p: 2, mb: 2, bgcolor: "grey.50" }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t("deliveryZonesPage.summaryTitle")}
          {selectedCompanyName ? ` — ${selectedCompanyName}` : ""}
        </Typography>
        <Typography variant="body2">{summaryText.inside}</Typography>
        <Typography variant="body2">{summaryText.outside}</Typography>
        <Typography variant="body2">{summaryText.afterHours}</Typography>
      </Paper>
      ) : null}

      {showInnerTabs ? (
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: 1, borderColor: "divider", mb: 1 }}
      >
        <Tab label={t("deliveryZonesPage.tabArea")} />
        <Tab label={t("deliveryZonesPage.tabOutsideZones")} />
        <Tab label={t("deliveryZonesPage.tabAfterHours")} />
      </Tabs>
      ) : null}

      {(showInnerTabs ? tab === 0 : showCoverage || showPricing) ? (
      <Box sx={{ pt: showInnerTabs ? 2 : 0 }}>
        <Paper sx={{ p: 2, mb: 2 }}>
          {showCoverage ? (
          <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t("deliveryZonesPage.baseSection")}
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ mb: 2 }}
            flexWrap="wrap"
            useFlexGap
          >
            <TextField
              label={t("deliveryZonesPage.baseLat")}
              size="small"
              type="number"
              value={baseLat}
              onChange={(e) => setBaseLat(e.target.value)}
              sx={{ width: 180 }}
              inputProps={{ step: "any" }}
            />
            <TextField
              label={t("deliveryZonesPage.baseLon")}
              size="small"
              type="number"
              value={baseLon}
              onChange={(e) => setBaseLon(e.target.value)}
              sx={{ width: 180 }}
              inputProps={{ step: "any" }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<MyLocationIcon />}
              onClick={handleUseMyLocation}
              disabled={locating || savingBase}
              sx={{ textTransform: "none" }}
            >
              {locating
                ? t("deliveryZonesPage.locating")
                : t("deliveryZonesPage.useMyLocation")}
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleSaveBaseAndRecalculate}
              disabled={
                savingBase || !String(baseLat).trim() || !String(baseLon).trim()
              }
              sx={{ textTransform: "none" }}
            >
              {savingBase
                ? t("deliveryZonesPage.recalculating")
                : t("deliveryZonesPage.saveBaseAndRecalculate")}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 2 }}>
            {t("deliveryZonesPage.baseHelper")}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t("deliveryZonesPage.areaRules")}
          </Typography>
          </>
          ) : null}

          {showPricing ? (
          <DeliveryPricingExplainer
            insideMode={policy.inside.mode}
            radiusKm={policy.radiusKm}
          />
          ) : null}

          <Stack spacing={2}>
            {showCoverage ? (
            <>
            <FormControl size="small" sx={{ maxWidth: 360 }}>
              <InputLabel id="delivery-strategy-label">
                {t("deliveryZonesPage.strategyTitle")}
              </InputLabel>
              <Select
                labelId="delivery-strategy-label"
                label={t("deliveryZonesPage.strategyTitle")}
                value={policy.strategy || "radius"}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, strategy: e.target.value }))
                }
              >
                <MenuItem value="zones">
                  {t("deliveryZonesPage.strategyZones")}
                </MenuItem>
                <MenuItem value="radius">
                  {t("deliveryZonesPage.strategyRadius")}
                </MenuItem>
                <MenuItem value="cities">
                  {t("deliveryZonesPage.strategyCities")}
                </MenuItem>
              </Select>
            </FormControl>

            {policy.strategy === "cities" ? (
              <Stack spacing={1.5}>
                <OperatingCitiesPicker
                  value={policy.operatingCities || []}
                  onChange={(next) =>
                    setPolicy((p) => ({
                      ...p,
                      operatingCities: next,
                    }))
                  }
                  catalog={cityCatalog}
                  country={companyCountry}
                  baseCoords={
                    String(baseLat).trim() && String(baseLon).trim()
                      ? { lat: baseLat, lon: baseLon }
                      : null
                  }
                  label={t("deliveryZonesPage.operatingCities")}
                  placeholder={t("companyProfile.operatingCitiesPlaceholder")}
                  helperText={t("deliveryZonesPage.operatingCitiesHelp")}
                />
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={
                      !String(baseLat).trim() ||
                      !String(baseLon).trim() ||
                      policy.radiusKm === "" ||
                      policy.radiusKm == null
                    }
                    onClick={() => {
                      const next = citiesWithinRadius(
                        cityCatalog,
                        { lat: baseLat, lon: baseLon },
                        policy.radiusKm
                      ).map((city) => city.name);
                      if (!next.length) {
                        setNotification({
                          severity: "error",
                          message: t("companyProfile.orderRadiusNoCities"),
                        });
                        return;
                      }
                      setPolicy((p) => ({ ...p, operatingCities: next }));
                    }}
                    sx={{ textTransform: "none", alignSelf: { sm: "flex-start" } }}
                  >
                    {t("companyProfile.selectWithinRadius")}
                  </Button>
                  {!String(baseLat).trim() || !String(baseLon).trim() ? (
                    <Typography variant="body2" color="warning.main">
                      {t("companyProfile.setBaseLocationFirst")}
                    </Typography>
                  ) : null}
                </Stack>
              </Stack>
            ) : null}

            <TextField
              label={
                policy.strategy === "cities"
                  ? t("deliveryZonesPage.freeRadiusOptional")
                  : t("deliveryZonesPage.radiusKm")
              }
              size="small"
              type="number"
              value={policy.radiusKm ?? ""}
              onChange={(e) =>
                setPolicy((p) => ({
                  ...p,
                  radiusKm: e.target.value === "" ? "" : e.target.value,
                }))
              }
              helperText={t("deliveryZonesPage.radiusHelp")}
              sx={{ maxWidth: 280 }}
              inputProps={{ min: 0, step: 0.1 }}
            />

            {policy.strategy === "cities" ? (
              <TextField
                label={t("deliveryZonesPage.maxDistanceKm")}
                size="small"
                type="number"
                value={policy.maxDistanceKm ?? ""}
                onChange={(e) =>
                  setPolicy((p) => ({
                    ...p,
                    maxDistanceKm: e.target.value === "" ? "" : e.target.value,
                  }))
                }
                helperText={t("deliveryZonesPage.maxDistanceHelp")}
                sx={{ maxWidth: 280 }}
                inputProps={{ min: 0, step: 1 }}
              />
            ) : null}
            </>
            ) : null}

            {showPricing ? (
            <>
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>
                {t("deliveryZonesPage.insideMode")}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                component="div"
                sx={{ mb: 1 }}
              >
                {t("deliveryZonesPage.insideModeHelp")}
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", sm: "flex-start" }}
              >
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  color="primary"
                  value={
                    policy.inside.mode === "free"
                      ? "fixed"
                      : policy.inside.mode === "fixed" ||
                          policy.inside.mode === "perKm"
                        ? policy.inside.mode
                        : "perKm"
                  }
                  onChange={(_e, next) => {
                    if (next == null) return;
                    setPolicy((p) => ({
                      ...p,
                      inside: { ...p.inside, mode: next },
                    }));
                  }}
                  sx={pricingModeToggleSx}
                >
                  <ToggleButton value="fixed">
                    {t("deliveryZonesPage.modeFixedStable")}
                  </ToggleButton>
                  <ToggleButton value="perKm">
                    {t("deliveryZonesPage.modePerKm")}
                  </ToggleButton>
                </ToggleButtonGroup>
                <TextField
                  label={
                    policy.inside.mode === "fixed" ||
                    policy.inside.mode === "free"
                      ? t("deliveryZonesPage.insideFixedAmount")
                      : t("deliveryZonesPage.pricePerKm")
                  }
                  size="small"
                  type="number"
                  value={
                    policy.inside.mode === "free" ? 0 : policy.inside.amount
                  }
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      inside: {
                        ...p.inside,
                        mode:
                          p.inside.mode === "free" ? "fixed" : p.inside.mode,
                        amount: e.target.value,
                      },
                    }))
                  }
                  sx={{ width: 180 }}
                  inputProps={{ min: 0, step: 0.1 }}
                  helperText={
                    policy.inside.mode === "fixed" ||
                    policy.inside.mode === "free"
                      ? t("deliveryZonesPage.insideFixedHelp")
                      : t("deliveryZonesPage.insidePerKmHelp")
                  }
                />
              </Stack>
            </Box>

            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>
                {t("deliveryZonesPage.outsideMode")}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                component="div"
                sx={{ mb: 1 }}
              >
                {t("deliveryZonesPage.outsideModeHelp")}
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", sm: "flex-start" }}
              >
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  color="primary"
                  value={
                    ["perKm", "fixed", "blocked"].includes(policy.outside.mode)
                      ? policy.outside.mode
                      : "perKm"
                  }
                  onChange={(_e, next) => {
                    if (next == null) return;
                    setPolicy((p) => ({
                      ...p,
                      outside: { ...p.outside, mode: next },
                    }));
                  }}
                  sx={pricingModeToggleSx}
                >
                  <ToggleButton value="perKm">
                    {t("deliveryZonesPage.modePerKm")}
                  </ToggleButton>
                  <ToggleButton value="fixed">
                    {t("deliveryZonesPage.modeFixedStable")}
                  </ToggleButton>
                  <ToggleButton value="blocked">
                    {t("deliveryZonesPage.modeBlocked")}
                  </ToggleButton>
                </ToggleButtonGroup>
                {policy.outside.mode !== "blocked" && (
                  <TextField
                    label={
                      policy.outside.mode === "fixed"
                        ? t("deliveryZonesPage.outsideFixedAmount")
                        : t("deliveryZonesPage.outsidePerKm")
                    }
                    size="small"
                    type="number"
                    value={policy.outside.amount}
                    onChange={(e) =>
                      setPolicy((p) => ({
                        ...p,
                        outside: { ...p.outside, amount: e.target.value },
                      }))
                    }
                    sx={{ width: 180 }}
                    inputProps={{ min: 0, step: 0.1 }}
                    helperText={
                      policy.outside.mode === "perKm"
                        ? t("deliveryZonesPage.outsidePerKmHelp")
                        : t("deliveryZonesPage.outsideFixedHelp")
                    }
                  />
                )}
              </Stack>
            </Box>
            <Button
              variant="contained"
              size="small"
              onClick={handleSavePolicy}
              disabled={savingPolicy}
              sx={{ alignSelf: "flex-start", textTransform: "none" }}
            >
              {t("deliveryZonesPage.saveRules")}
            </Button>
            </>
            ) : null}
          </Stack>

          {showPricing ? (
          <>
          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t("deliveryZonesPage.previewTitle")}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              label={t("deliveryZonesPage.previewKm")}
              size="small"
              type="number"
              value={previewKm}
              onChange={(e) => setPreviewKm(e.target.value)}
              sx={{ width: 140 }}
              inputProps={{ min: 0, step: 0.1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={previewAfterHours}
                  onChange={(e) => setPreviewAfterHours(e.target.checked)}
                  size="small"
                />
              }
              label={t("deliveryZonesPage.previewAfterHours")}
            />
            {previewResult && (
              <Stack spacing={0.25}>
                {previewResult.blocked ? (
                  <Typography variant="body2" fontWeight={600}>
                    {t("deliveryZonesPage.previewBlocked")}
                  </Typography>
                ) : (
                  <>
                    <Typography variant="body2">
                      {t("deliveryZonesPage.previewDelivery", {
                        price: previewResult.delivery,
                        region: previewResult.region,
                      })}
                    </Typography>
                    <Typography variant="body2">
                      {t("deliveryZonesPage.previewReturn", {
                        price: previewResult.return,
                        region: previewResult.region,
                      })}
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {t("deliveryZonesPage.previewRoundTrip", {
                        price: previewResult.roundTrip,
                      })}
                    </Typography>
                  </>
                )}
              </Stack>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            {t("deliveryZonesPage.bothSidesHint")}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
            <Trans
              i18nKey="deliveryZonesPage.formulaHint"
              components={{ bold: <b /> }}
            />
          </Typography>
          </>
          ) : null}
        </Paper>
      </Box>
      ) : null}

      {(showInnerTabs ? tab === 1 : showPricing) ? (
      <Box sx={{ pt: showInnerTabs ? 2 : 0 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("deliveryZonesPage.outsideZonesHelp")}
        </Alert>
        <Paper>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ p: 2 }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              {t("deliveryZonesPage.citiesTitle", { count: zones.length })}
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={openAddDialog}
            >
              {t("deliveryZonesPage.add")}
            </Button>
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("deliveryZonesPage.colCity")}</TableCell>
                  <TableCell align="right">
                    {t("deliveryZonesPage.colDistance")}
                  </TableCell>
                  <TableCell align="right">
                    {t("deliveryZonesPage.colCost")}
                  </TableCell>
                  <TableCell align="center">
                    {t("deliveryZonesPage.colStatus")}
                  </TableCell>
                  <TableCell align="right">
                    {t("deliveryZonesPage.colActions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {t("deliveryZonesPage.loading")}
                    </TableCell>
                  </TableRow>
                ) : zones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {t("deliveryZonesPage.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  zones.map((zone) => (
                    <TableRow key={zone._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {zone.name}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{zone.distanceKm} km</TableCell>
                      <TableCell align="right">
                        {renderPrice(zone)}
                        {!zone.isFreeDelivery && !hasFixedPrice(zone) && (
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceFormula(
                              zone.distanceKm,
                              Number(pricePerKmSaved) || 0
                            )}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {zone.isFreeDelivery ? (
                          <Chip
                            label={t("deliveryZonesPage.statusFree")}
                            size="small"
                            color="success"
                          />
                        ) : !zone.isActive ? (
                          <Chip
                            label={t("deliveryZonesPage.statusInactive")}
                            size="small"
                            color="default"
                          />
                        ) : (
                          <Chip
                            label={t("deliveryZonesPage.statusActive")}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title={t("deliveryZonesPage.edit")}>
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(zone)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t("deliveryZonesPage.delete")}>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(zone)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
      ) : null}

      {(showInnerTabs ? tab === 2 : showPricing) ? (
      <Box sx={{ pt: showInnerTabs ? 2 : 0 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t("deliveryZonesPage.afterHoursSection")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("deliveryZonesPage.afterHoursHelp")}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label={t("deliveryZonesPage.workStart")}
              size="small"
              type="time"
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
            <TextField
              label={t("deliveryZonesPage.workEnd")}
              size="small"
              type="time"
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
            <TextField
              label={t("deliveryZonesPage.afterHoursSurcharge")}
              size="small"
              type="number"
              value={policy.afterHoursSurcharge}
              onChange={(e) =>
                setPolicy((p) => ({
                  ...p,
                  afterHoursSurcharge: e.target.value,
                }))
              }
              sx={{ width: 180 }}
              inputProps={{ min: 0, step: 1 }}
            />
          </Stack>
          <Button
            variant="contained"
            size="small"
            onClick={handleSavePolicy}
            disabled={savingPolicy}
            sx={{ textTransform: "none" }}
          >
            {t("deliveryZonesPage.saveRules")}
          </Button>
        </Paper>
      </Box>
      ) : null}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {editingZone
            ? t("deliveryZonesPage.dialogEdit")
            : t("deliveryZonesPage.dialogAdd")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("deliveryZonesPage.fieldName")}
              fullWidth
              size="small"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder={t("deliveryZonesPage.fieldNamePlaceholder")}
            />
            <TextField
              label={t("deliveryZonesPage.fieldDistance")}
              fullWidth
              size="small"
              type="number"
              value={form.distanceKm}
              onChange={(e) =>
                setForm((f) => ({ ...f, distanceKm: e.target.value }))
              }
              inputProps={{ min: 0 }}
              helperText={buildDistanceHelperText(
                t,
                form.distanceKm,
                pricePerKmSaved
              )}
            />
            <TextField
              label={t("deliveryZonesPage.fieldFixedPrice")}
              fullWidth
              size="small"
              type="number"
              value={form.fixedPrice}
              onChange={(e) =>
                setForm((f) => ({ ...f, fixedPrice: e.target.value }))
              }
              helperText={t("deliveryZonesPage.fixedPriceHelper")}
              inputProps={{ min: 0 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isFreeDelivery}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      isFreeDelivery: e.target.checked,
                    }))
                  }
                />
              }
              label={t("deliveryZonesPage.freeDelivery")}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t("deliveryZonesPage.cancel")}
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveZone}
            disabled={!form.name.trim() || !form.distanceKm}
          >
            {editingZone
              ? t("deliveryZonesPage.save")
              : t("deliveryZonesPage.create")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!notification}
        autoHideDuration={3000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {notification && (
          <Alert
            severity={notification.severity}
            onClose={() => setNotification(null)}
          >
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </Box>
  );
}
