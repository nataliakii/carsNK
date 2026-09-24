"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import { useRegisterSettingsDirty } from "@/app/admin/settings/SettingsDirtyGuard";

export default function PlatformCatalogSection({ embedded = false } = {}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [country, setCountry] = useState(null);
  const [availableLocales, setAvailableLocales] = useState([]);
  const [enabledLocales, setEnabledLocales] = useState(["en"]);
  const [cities, setCities] = useState([]);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("city");
  const [newDetail, setNewDetail] = useState(false);
  const [newLat, setNewLat] = useState("");
  const [newLon, setNewLon] = useState("");

  const draftDirty = useMemo(
    () =>
      Boolean(
        newName.trim() ||
          newLat.trim() ||
          newLon.trim() ||
          newDetail ||
          newKind !== "city"
      ),
    [newDetail, newKind, newLat, newLon, newName]
  );
  useRegisterSettingsDirty("platform-catalog", draftDirty);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settingsRes, citiesRes] = await Promise.all([
        fetch("/api/admin/platform", { cache: "no-store" }),
        fetch("/api/admin/platform/cities?all=1", { cache: "no-store" }),
      ]);
      const settingsBody = await settingsRes.json();
      const citiesBody = await citiesRes.json();
      if (!settingsRes.ok || !settingsBody.success) {
        throw new Error(settingsBody.message || t("platform.loadFailed"));
      }
      if (!citiesRes.ok || !citiesBody.success) {
        throw new Error(citiesBody.message || t("platform.loadFailed"));
      }
      setCountry(settingsBody.country || null);
      setAvailableLocales(settingsBody.availableLocales || []);
      setEnabledLocales(settingsBody.settings?.enabledLocales || ["en"]);
      setCities(citiesBody.cities || []);
    } catch (err) {
      setError(err.message || t("platform.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const saveLocales = async (next) => {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/platform", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledLocales: next }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setEnabledLocales(body.settings?.enabledLocales || next);
      setOk(t("platform.localesSaved"));
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleLocale = (code) => {
    const next = enabledLocales.includes(code)
      ? enabledLocales.filter((item) => item !== code)
      : [...enabledLocales, code];
    if (!next.includes("en")) next.unshift("en");
    saveLocales(next);
  };

  const addCity = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/platform/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind: newKind,
          requiresAddressDetail: newDetail,
          sort: (cities[cities.length - 1]?.sort || 0) + 10,
          ...(newLat.trim() && newLon.trim()
            ? { coords: { lat: newLat.trim(), lon: newLon.trim() } }
            : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setNewName("");
      setNewKind("city");
      setNewDetail(false);
      setNewLat("");
      setNewLon("");
      setCities((prev) => [...prev, body.city].sort((a, b) => (a.sort || 0) - (b.sort || 0)));
      setOk(t("platform.cityAdded", { name: body.city.name }));
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const patchCity = async (cityId, updates) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/platform/cities/${cityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setCities((prev) =>
        prev.map((city) => (city._id === cityId ? body.city : city))
      );
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteCity = async (city) => {
    if (!window.confirm(t("platform.deleteCityConfirm", { name: city.name }))) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/platform/cities/${city._id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || "Failed");
      setCities((prev) => prev.filter((item) => item._id !== city._id));
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        px: embedded ? 0 : { xs: 1, md: 2 },
        pb: embedded ? 0 : 6,
        pt: embedded ? 0 : 2,
        maxWidth: embedded ? "100%" : 960,
      }}
    >
      {embedded ? null : (
        <>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
            {t("platform.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t("platform.subtitle", {
              country: country?.countryName || country?.country || "—",
              timezone: country?.timezone || "—",
            })}
          </Typography>
        </>
      )}
      {embedded ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("platform.subtitle", {
            country: country?.countryName || country?.country || "—",
            timezone: country?.timezone || "—",
          })}
        </Typography>
      ) : null}

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

      <Box
        sx={{
          p: 2,
          mb: 3,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          {t("platform.languages")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("platform.languagesHelp")}
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {availableLocales.map((item) => (
            <FormControlLabel
              key={item.code}
              control={
                <Checkbox
                  checked={enabledLocales.includes(item.code)}
                  onChange={() => toggleLocale(item.code)}
                  disabled={busy || item.code === "en"}
                />
              }
              label={`${item.label} (${item.code})`}
            />
          ))}
        </Stack>
      </Box>

      <Box
        sx={{
          p: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          {t("platform.cities")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("platform.citiesHelp")}
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} gap={1} sx={{ mb: 1 }} flexWrap="wrap">
          <TextField
            size="small"
            label={t("platform.cityName")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <TextField
            size="small"
            select
            label={t("platform.cityKind")}
            value={newKind}
            onChange={(e) => setNewKind(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="city">{t("platform.kindCity")}</MenuItem>
            <MenuItem value="airport">{t("platform.kindAirport")}</MenuItem>
            <MenuItem value="region">{t("platform.kindRegion")}</MenuItem>
          </TextField>
          <TextField
            size="small"
            label={t("platform.cityLat")}
            value={newLat}
            onChange={(e) => setNewLat(e.target.value)}
            sx={{ width: 120 }}
          />
          <TextField
            size="small"
            label={t("platform.cityLon")}
            value={newLon}
            onChange={(e) => setNewLon(e.target.value)}
            sx={{ width: 120 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={newDetail}
                onChange={(e) => setNewDetail(e.target.checked)}
              />
            }
            label={t("platform.requiresAddress")}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={addCity}
            disabled={busy || !newName.trim()}
            sx={{ textTransform: "none" }}
          >
            {t("platform.addCity")}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
          {t("platform.cityCoordsHelp")}
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("platform.cityName")}</TableCell>
              <TableCell>{t("platform.cityKind")}</TableCell>
              <TableCell>{t("platform.cityLat")}</TableCell>
              <TableCell>{t("platform.cityLon")}</TableCell>
              <TableCell>{t("platform.active")}</TableCell>
              <TableCell>{t("platform.requiresAddress")}</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {cities.map((city) => (
              <TableRow key={city._id}>
                <TableCell>
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography fontWeight={600}>{city.name}</Typography>
                    <Chip size="small" label={city.slug} />
                  </Stack>
                </TableCell>
                <TableCell>
                  <FormControl size="small">
                    <TextField
                      select
                      size="small"
                      value={city.kind || "city"}
                      onChange={(e) => patchCity(city._id, { kind: e.target.value })}
                    >
                      <MenuItem value="city">{t("platform.kindCity")}</MenuItem>
                      <MenuItem value="airport">{t("platform.kindAirport")}</MenuItem>
                      <MenuItem value="region">{t("platform.kindRegion")}</MenuItem>
                    </TextField>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    defaultValue={city.coords?.lat || ""}
                    key={`${city._id}-lat-${city.coords?.lat || ""}`}
                    onBlur={(e) => {
                      const lat = e.target.value.trim();
                      const lon = String(city.coords?.lon || "").trim();
                      if (lat === String(city.coords?.lat || "") && lon === String(city.coords?.lon || "")) {
                        return;
                      }
                      patchCity(city._id, {
                        coords: lat || lon ? { lat, lon } : { lat: "", lon: "" },
                      });
                    }}
                    sx={{ width: 110 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    defaultValue={city.coords?.lon || ""}
                    key={`${city._id}-lon-${city.coords?.lon || ""}`}
                    onBlur={(e) => {
                      const lon = e.target.value.trim();
                      const lat = String(city.coords?.lat || "").trim();
                      if (lon === String(city.coords?.lon || "") && lat === String(city.coords?.lat || "")) {
                        return;
                      }
                      patchCity(city._id, {
                        coords: lat || lon ? { lat, lon } : { lat: "", lon: "" },
                      });
                    }}
                    sx={{ width: 110 }}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={city.isActive !== false}
                    onChange={(e) =>
                      patchCity(city._id, { isActive: e.target.checked })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={Boolean(city.requiresAddressDetail)}
                    onChange={(e) =>
                      patchCity(city._id, {
                        requiresAddressDetail: e.target.checked,
                      })
                    }
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => deleteCity(city)}
                    disabled={busy}
                    aria-label={t("platform.deleteCity")}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
