"use client";

import { useCallback, useMemo, useState } from "react";
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
import {
  addOfficeToList,
  createDefaultOffice,
  ensureOfficeIdentities,
  getOfficeKey,
  removeOfficeByKey,
  updateOfficeByKey,
} from "@/domain/company/companyOffices";
import AddressPlacesAutocomplete from "@/app/components/ui/inputs/AddressPlacesAutocomplete";
import {
  adminFieldSx,
  adminReadableTextSx,
} from "@/app/admin/shared/components/AdminSettingsSection";

/**
 * Company offices editor. When `companyId` is set, mutations go through
 * /api/admin/offices (authoritative path). freePickup/freeReturn toggles are
 * removed — official office legs are always EUR 0.
 *
 * Each card is keyed and updated by a stable office id (database id or
 * one-shot clientId). Cards never share object references or HTML ids.
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
  const list = useMemo(() => {
    const rows = ensureOfficeIdentities(Array.isArray(offices) ? offices : []);
    return rows.length ? rows : [createDefaultOffice()];
  }, [offices]);
  const useAdminApi = Boolean(companyId);

  const persistLocal = useCallback(
    (next) => {
      onChange?.(next);
    },
    [onChange]
  );

  const updateOffice = (officeId, changes) => {
    persistLocal(updateOfficeByKey(list, officeId, changes));
  };

  const addOffice = async () => {
    if (!useAdminApi) {
      persistLocal(addOfficeToList(list));
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
      const createdId = created._id || created.id;
      persistLocal([
        ...list,
        {
          ...createDefaultOffice(),
          ...created,
          _id: createdId,
          id: createdId,
        },
      ]);
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const saveOffice = async (officeId) => {
    if (!useAdminApi) return;
    const office = list.find((row) => getOfficeKey(row) === String(officeId));
    const persistedId = office?._id || office?.id;
    // Never POST/PATCH an unsaved empty draft from onBlur.
    if (!persistedId) return;
    const name = String(office?.name || "").trim();
    const address = String(office?.address || "").trim();
    if (!name && !address) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/offices/${persistedId}`, {
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
      updateOffice(officeId, { ...saved, _id: saved._id || persistedId, id: saved.id || persistedId });
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const removeOffice = async (officeId) => {
    const office = list.find((row) => getOfficeKey(row) === String(officeId));
    const persistedId = office?._id || office?.id;
    if (useAdminApi && persistedId) {
      setBusy(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/offices/${persistedId}`, {
          method: "DELETE",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || body.error || "Failed");
        persistLocal(removeOfficeByKey(list, officeId));
      } catch (err) {
        setError(err.message || "Failed");
      } finally {
        setBusy(false);
      }
      return;
    }
    persistLocal(removeOfficeByKey(list, officeId));
  };

  return (
    <Stack gap={2}>
      {error ? (
        <Typography color="error" variant="body2" sx={adminReadableTextSx}>
          {error}
        </Typography>
      ) : null}
      {list.map((office) => {
        const officeId = getOfficeKey(office);
        const fieldId = (name) => `office-${officeId}-${name}`;
        const mapsUrl = googleMapsSearchUrl(office);
        const isActive =
          office.active != null
            ? Boolean(office.active)
            : office.status !== "archived";
        return (
          <Box
            key={office.id || office.clientId || office._id}
            data-office-key={officeId}
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
                id={fieldId("name")}
                name={fieldId("name")}
                size="small"
                label={t("companyProfile.officeName")}
                value={office.name || ""}
                onChange={(e) => updateOffice(officeId, { name: e.target.value })}
                onBlur={() => saveOffice(officeId)}
                disabled={disabled || busy}
                sx={adminFieldSx}
              />
              <TextField
                id={fieldId("locationType")}
                name={fieldId("locationType")}
                size="small"
                select
                label={t("companyProfile.officeLocationType")}
                value={office.locationType || "office"}
                onChange={(e) =>
                  updateOffice(officeId, { locationType: e.target.value })
                }
                onBlur={() => saveOffice(officeId)}
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
                  onClick={() => removeOffice(officeId)}
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
                id={fieldId("address")}
                name={fieldId("address")}
                value={office.address || ""}
                country={country}
                disabled={disabled || busy}
                label={t("companyProfile.officeAddress")}
                placeholder={t("companyProfile.officeAddressPlaceholder")}
                onChange={(address) => updateOffice(officeId, { address })}
                onResolved={({ address, lat, lon, placeId, locality }) => {
                  updateOffice(officeId, {
                    address,
                    lat: lat || office.lat,
                    lon: lon || office.lon,
                    placeId: placeId || office.placeId,
                    city: locality || office.city,
                  });
                  if (useAdminApi && (office._id || office.id)) {
                    setTimeout(() => saveOffice(officeId), 0);
                  }
                }}
              />
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: { xs: 2.5, md: 3 },
                mt: 1.5,
              }}
            >
              <TextField
                id={fieldId("city")}
                name={fieldId("city")}
                size="small"
                label={t("companyProfile.officeCity")}
                value={office.city || ""}
                onChange={(e) => updateOffice(officeId, { city: e.target.value })}
                onBlur={() => saveOffice(officeId)}
                disabled={disabled || busy}
                sx={adminFieldSx}
              />
              <TextField
                id={fieldId("country")}
                name={fieldId("country")}
                size="small"
                label={t("companyProfile.officeCountry")}
                value={office.country || country || ""}
                onChange={(e) => updateOffice(officeId, { country: e.target.value })}
                onBlur={() => saveOffice(officeId)}
                disabled={disabled || busy}
                sx={adminFieldSx}
              />
            </Box>
            <TextField
              id={fieldId("collectionInstructions")}
              name={fieldId("collectionInstructions")}
              size="small"
              multiline
              minRows={2}
              label={t("companyProfile.officeCollectionInstructions")}
              value={office.collectionInstructions || ""}
              onChange={(e) =>
                updateOffice(officeId, {
                  collectionInstructions: e.target.value,
                })
              }
              onBlur={() => saveOffice(officeId)}
              disabled={disabled || busy}
              sx={{ ...adminFieldSx, mt: 1.5 }}
            />
            <Stack direction={{ xs: "column", sm: "row" }} gap={1} mt={1}>
              <FormControlLabel
                htmlFor={fieldId("active")}
                control={
                  <Switch
                    id={fieldId("active")}
                    name={fieldId("active")}
                    size="small"
                    checked={Boolean(isActive)}
                    onChange={(e) => {
                      updateOffice(officeId, {
                        active: e.target.checked,
                        status: e.target.checked ? "active" : "archived",
                      });
                      if (useAdminApi) {
                        setTimeout(() => saveOffice(officeId), 0);
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
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: { xs: 2.5, md: 3 },
              }}
            >
              <TextField
                id={fieldId("lat")}
                name={fieldId("lat")}
                size="small"
                label={t("companyProfile.officeLat")}
                value={office.lat || ""}
                onChange={(e) => updateOffice(officeId, { lat: e.target.value })}
                onBlur={() => saveOffice(officeId)}
                disabled={disabled || busy}
                sx={adminFieldSx}
              />
              <TextField
                id={fieldId("lng")}
                name={fieldId("lng")}
                size="small"
                label={t("companyProfile.officeLng")}
                value={office.lon || office.lng || ""}
                onChange={(e) => updateOffice(officeId, { lon: e.target.value })}
                onBlur={() => saveOffice(officeId)}
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
