"use client";

import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { googleMapsSearchUrl } from "@/domain/orders/carOffices";
import { emptyCompanyOffice } from "@/domain/company/companyOffices";
import AddressPlacesAutocomplete from "@/app/components/ui/inputs/AddressPlacesAutocomplete";
import {
  adminFieldSx,
  adminReadableTextSx,
} from "@/app/admin/shared/components/AdminSettingsSection";

/**
 * Company offices editor. When `companyId` is set, mutations go through
 * /api/admin/offices (authoritative path). freePickup/freeReturn toggles are
 * removed — official office legs are always EUR 0.
 */
export default function CompanyOfficesEditor({
  offices = [],
  onChange,
  companyId,
  country,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list =
    Array.isArray(offices) && offices.length ? offices : [emptyCompanyOffice()];
  const useAdminApi = Boolean(companyId);

  const persistLocal = useCallback(
    (next) => {
      onChange?.(next);
    },
    [onChange]
  );

  const updateAt = (index, patch) => {
    const next = list.map((office, i) =>
      i === index ? { ...office, ...patch } : office
    );
    persistLocal(next);
  };

  const addOffice = async () => {
    if (!useAdminApi) {
      persistLocal([...list, emptyCompanyOffice()]);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: "Office",
          country: country || "",
          status: "active",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || body.error || "Failed");
      const created = body.office || {};
      persistLocal([
        ...list.filter((row) => row.name || row.address || row._id),
        {
          ...created,
          _id: created._id || created.id,
          id: created.id || created._id,
        },
      ]);
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const saveOffice = async (index) => {
    if (!useAdminApi) return;
    const office = list[index];
    const officeId = office?._id || office?.id;
    // Never POST/PATCH an unsaved empty draft from onBlur.
    if (!officeId) return;
    const name = String(office?.name || "").trim();
    const address = String(office?.address || "").trim();
    if (!name && !address) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/offices/${officeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...office,
          // Official office pickup/return is always free — ignore legacy flags.
          freePickup: true,
          freeReturn: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || body.error || "Failed");
      const saved = body.office || office;
      updateAt(index, { ...saved, _id: saved._id || officeId });
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const removeOffice = async (index) => {
    const office = list[index];
    const officeId = office?._id || office?.id;
    if (useAdminApi && officeId) {
      setBusy(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/offices/${officeId}`, {
          method: "DELETE",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || body.error || "Failed");
        const next = list.filter((_, i) => i !== index);
        persistLocal(next.length ? next : [emptyCompanyOffice()]);
      } catch (err) {
        setError(err.message || "Failed");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (list.length <= 1) {
      persistLocal([emptyCompanyOffice()]);
      return;
    }
    persistLocal(list.filter((_, i) => i !== index));
  };

  return (
    <Stack gap={2}>
      {error ? (
        <Typography color="error" variant="body2" sx={adminReadableTextSx}>
          {error}
        </Typography>
      ) : null}
      {list.map((office, index) => {
        const mapsUrl = googleMapsSearchUrl(office);
        const officeKey = office._id || office.id || `${office.name}-${index}`;
        return (
          <Box
            key={officeKey}
            sx={{
              p: 1.75,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              bgcolor: "grey.50",
              overflow: "visible",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              gap={1.5}
              alignItems={{ sm: "flex-start" }}
            >
              <TextField
                size="small"
                label={t("companyProfile.officeName")}
                value={office.name || ""}
                onChange={(e) => updateAt(index, { name: e.target.value })}
                onBlur={() => saveOffice(index)}
                disabled={disabled || busy}
                sx={adminFieldSx}
              />
              <TextField
                size="small"
                select
                label={t("companyProfile.officeLocationType")}
                value={office.locationType || "office"}
                onChange={(e) =>
                  updateAt(index, { locationType: e.target.value })
                }
                onBlur={() => saveOffice(index)}
                disabled={disabled || busy}
                sx={adminFieldSx}
              >
                <MenuItem value="office">{t("order.officeTypeOffice")}</MenuItem>
                <MenuItem value="airport">{t("order.officeTypeAirport")}</MenuItem>
                <MenuItem value="train_station">
                  {t("order.officeTypeStation")}
                </MenuItem>
                <MenuItem value="port">{t("order.officeTypePort")}</MenuItem>
                <MenuItem value="hotel">{t("order.officeTypeHotel")}</MenuItem>
                <MenuItem value="other">{t("order.officeTypeOther")}</MenuItem>
              </TextField>
              {list.length > 1 || office.address || office.lat || office._id ? (
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => removeOffice(index)}
                  disabled={disabled || busy}
                  sx={{
                    textTransform: "none",
                    mt: { sm: 0.5 },
                    ...adminReadableTextSx,
                  }}
                >
                  {t("companyProfile.removeOffice")}
                </Button>
              ) : null}
            </Stack>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 1, ...adminReadableTextSx }}
            >
              {t("companyProfile.officeAlwaysFree", {
                defaultValue: "Official office pickup and return are always free (EUR 0).",
              })}
            </Typography>

            <Box sx={{ mt: 1.5 }}>
              <AddressPlacesAutocomplete
                value={office.address || ""}
                country={country}
                disabled={disabled || busy}
                label={t("companyProfile.officeAddress")}
                placeholder={t("companyProfile.officeAddressPlaceholder")}
                onChange={(address) => updateAt(index, { address })}
                onResolved={({ address, lat, lon, placeId, locality }) => {
                  updateAt(index, {
                    address,
                    lat: lat || office.lat,
                    lon: lon || office.lon,
                    placeId: placeId || office.placeId,
                    city: locality || office.city,
                  });
                  // Persist after Places resolve when using admin API.
                  if (useAdminApi && (office._id || office.id)) {
                    setTimeout(() => saveOffice(index), 0);
                  }
                }}
              />
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
                mt: 1.5,
              }}
            >
              <TextField
                size="small"
                label={t("companyProfile.officeCity")}
                value={office.city || ""}
                onChange={(e) => updateAt(index, { city: e.target.value })}
                onBlur={() => saveOffice(index)}
                disabled={disabled || busy}
                sx={adminFieldSx}
              />
              <TextField
                size="small"
                label={t("companyProfile.officeCountry")}
                value={office.country || country || ""}
                onChange={(e) => updateAt(index, { country: e.target.value })}
                onBlur={() => saveOffice(index)}
                disabled={disabled || busy}
                sx={adminFieldSx}
              />
            </Box>
            <TextField
              size="small"
              multiline
              minRows={2}
              label={t("companyProfile.officeCollectionInstructions")}
              value={office.collectionInstructions || ""}
              onChange={(e) =>
                updateAt(index, { collectionInstructions: e.target.value })
              }
              onBlur={() => saveOffice(index)}
              disabled={disabled || busy}
              sx={{ ...adminFieldSx, mt: 1.5 }}
            />
            <Stack direction={{ xs: "column", sm: "row" }} gap={1} mt={1}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={office.status !== "archived"}
                    onChange={(e) => {
                      updateAt(index, {
                        status: e.target.checked ? "active" : "archived",
                      });
                      if (useAdminApi) {
                        setTimeout(() => saveOffice(index), 0);
                      }
                    }}
                    disabled={disabled || busy}
                  />
                }
                label={t("companyProfile.officeActive")}
              />
            </Stack>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                mt: 1.25,
                mb: 0.75,
                ...adminReadableTextSx,
              }}
            >
              {t("companyProfile.officeCoordsFallback")}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              <TextField
                size="small"
                label={t("companyProfile.officeLat")}
                value={office.lat || ""}
                onChange={(e) => updateAt(index, { lat: e.target.value })}
                onBlur={() => saveOffice(index)}
                disabled={disabled || busy}
                sx={adminFieldSx}
              />
              <TextField
                size="small"
                label={t("companyProfile.officeLng")}
                value={office.lon || office.lng || ""}
                onChange={(e) => updateAt(index, { lon: e.target.value })}
                onBlur={() => saveOffice(index)}
                disabled={disabled || busy}
                sx={adminFieldSx}
              />
            </Box>

            {mapsUrl ? (
              <Chip
                component="a"
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                clickable
                size="small"
                label={t("order.openInGoogleMaps")}
                sx={{ mt: 1.5, textTransform: "none" }}
              />
            ) : null}
          </Box>
        );
      })}

      <Button
        size="small"
        variant="outlined"
        onClick={addOffice}
        disabled={disabled || busy}
        sx={{
          alignSelf: "flex-start",
          textTransform: "none",
          ...adminReadableTextSx,
        }}
      >
        {t("companyProfile.addOffice")}
      </Button>
    </Stack>
  );
}
