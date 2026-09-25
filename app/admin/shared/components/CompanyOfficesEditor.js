"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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

const LOCATION_TYPE_LABEL = {
  office: "order.officeTypeOffice",
  airport: "order.officeTypeAirport",
  train_station: "order.officeTypeStation",
  port: "order.officeTypePort",
  hotel: "order.officeTypeHotel",
  other: "order.officeTypeOther",
};

/**
 * Company offices editor. When `companyId` is set, mutations go through
 * /api/admin/offices (authoritative path). freePickup/freeReturn toggles are
 * removed — official office legs are always EUR 0.
 *
 * Drafts without a database `_id` are created via POST on first Save / blur
 * (previously they were silently skipped — that was the “won’t save” bug).
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
  onPersisted,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const list = useMemo(() => {
    const rows = ensureOfficeIdentities(Array.isArray(offices) ? offices : []);
    return rows.length ? rows : [createDefaultOffice()];
  }, [offices]);
  const useAdminApi = Boolean(companyId);
  const companyIdStr = companyId ? String(companyId) : "";

  const persistLocal = useCallback(
    (next) => {
      onChange?.(next);
      return next;
    },
    [onChange]
  );

  const notifyPersisted = useCallback(
    (next) => {
      onPersisted?.(next);
    },
    [onPersisted]
  );

  const updateOffice = (officeId, changes) => {
    persistLocal(updateOfficeByKey(list, officeId, changes));
  };

  const addOffice = async () => {
    if (!useAdminApi) {
      const next = addOfficeToList(list);
      persistLocal(next);
      const added = next[next.length - 1];
      setExpandedId(getOfficeKey(added));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: companyIdStr,
          name: "Office",
          country: country || "",
          status: "active",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || body.error || "Failed");
      const created = body.office || {};
      const createdId = created._id || created.id;
      const next = [
        ...list,
        {
          ...createDefaultOffice(),
          ...created,
          _id: createdId,
          id: createdId,
        },
      ];
      persistLocal(next);
      notifyPersisted(next);
      setExpandedId(String(createdId));
    } catch (err) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Persist one office. `overrides` must be passed for the same tick as a
   * local state update — otherwise React still holds the previous list.
   * Drafts without `_id` are created via POST.
   */
  const saveOffice = async (officeId, overrides = {}) => {
    if (!useAdminApi) return;
    const current = list.find((row) => getOfficeKey(row) === String(officeId));
    if (!current) return;
    const office = { ...current, ...overrides };
    const name = String(office?.name || "").trim();
    const address = String(office?.address || "").trim();
    // Skip empty drafts on blur; explicit Save still needs a name.
    if (!name && !address) return;
    if (!name) {
      setError(
        t("companyProfile.officeNameRequired", {
          defaultValue: "Office name is required to save.",
        })
      );
      return;
    }
    setBusy(true);
    setError("");
    setSavedId("");
    try {
      let persistedId = office?._id || office?.id;
      let saved = office;

      if (!persistedId) {
        const res = await fetch("/api/admin/offices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: companyIdStr,
            ...office,
            freePickup: true,
            freeReturn: true,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || body.error || "Failed");
        saved = body.office || office;
        persistedId = saved._id || saved.id;
      } else {
        const res = await fetch(`/api/admin/offices/${persistedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...office,
            freePickup: true,
            freeReturn: true,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || body.error || "Failed");
        saved = body.office || office;
      }

      const nextFields = {
        ...saved,
        _id: saved._id || persistedId,
        id: saved.id || persistedId,
        active: saved.status !== "archived",
      };
      const next = updateOfficeByKey(list, officeId, {
        ...overrides,
        ...nextFields,
      });
      persistLocal(next);
      notifyPersisted(next);
      setSavedId(String(persistedId || officeId));
      if (String(expandedId) === String(officeId) && persistedId) {
        setExpandedId(String(persistedId));
      }
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
        const next = removeOfficeByKey(list, officeId);
        persistLocal(next);
        notifyPersisted(next);
        if (String(expandedId) === String(officeId)) setExpandedId(null);
      } catch (err) {
        setError(err.message || "Failed");
      } finally {
        setBusy(false);
      }
      return;
    }
    const next = removeOfficeByKey(list, officeId);
    persistLocal(next);
    if (String(expandedId) === String(officeId)) setExpandedId(null);
  };

  // Expand first office by default once we have a stable key.
  const effectiveExpanded =
    expandedId != null
      ? expandedId
      : list.length
        ? getOfficeKey(list[0])
        : false;

  return (
    <Stack gap={1.5}>
      {error ? (
        <Typography color="error" variant="body2" sx={adminReadableTextSx}>
          {error}
        </Typography>
      ) : null}

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ ...adminReadableTextSx, mb: 0.5 }}
      >
        {t("companyProfile.officeAlwaysFree", {
          defaultValue: "Official office pickup and return are always free (EUR 0).",
        })}
      </Typography>

      {list.map((office) => {
        const officeId = getOfficeKey(office);
        const fieldId = (name) => `office-${officeId}-${name}`;
        const mapsUrl = googleMapsSearchUrl(office);
        const isActive =
          office.active != null
            ? Boolean(office.active)
            : office.status !== "archived";
        const typeKey =
          LOCATION_TYPE_LABEL[office.locationType] || LOCATION_TYPE_LABEL.office;
        const title =
          String(office.name || "").trim() ||
          t("companyProfile.officeUntitled", { defaultValue: "Untitled office" });
        const isExpanded = String(effectiveExpanded) === String(officeId);
        const isSaved =
          savedId === String(officeId) ||
          savedId === String(office._id || "") ||
          savedId === String(office.id || "");

        return (
          <Accordion
            key={office.id || office.clientId || office._id}
            disableGutters
            elevation={0}
            expanded={isExpanded}
            onChange={(_, open) => setExpandedId(open ? officeId : false)}
            data-office-key={officeId}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "8px !important",
              bgcolor: "background.paper",
              "&:before": { display: "none" },
              overflow: "hidden",
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                px: 1.75,
                minHeight: 56,
                "& .MuiAccordionSummary-content": {
                  my: 1,
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                },
              }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={600}
                sx={{ ...adminReadableTextSx, mr: 0.5 }}
              >
                {title}
              </Typography>
              <Chip
                size="small"
                label={t(typeKey)}
                variant="outlined"
                sx={{ height: 22, ...adminReadableTextSx }}
              />
              <Chip
                size="small"
                label={
                  isActive
                    ? t("companyProfile.officeActiveShort", {
                        defaultValue: "Active",
                      })
                    : t("companyProfile.officeInactiveShort", {
                        defaultValue: "Hidden",
                      })
                }
                color={isActive ? "success" : "default"}
                variant={isActive ? "filled" : "outlined"}
                sx={{ height: 22, ...adminReadableTextSx }}
              />
              {office.city || office.address ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    ...adminReadableTextSx,
                    flex: "1 1 120px",
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {[office.address, office.city].filter(Boolean).join(", ")}
                </Typography>
              ) : null}
            </AccordionSummary>

            <AccordionDetails sx={{ px: 1.75, pb: 2, pt: 0 }}>
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
                  onChange={(e) =>
                    updateOffice(officeId, { name: e.target.value })
                  }
                  onBlur={(e) => saveOffice(officeId, { name: e.target.value })}
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
                  onChange={(e) => {
                    const locationType = e.target.value;
                    updateOffice(officeId, { locationType });
                    saveOffice(officeId, { locationType });
                  }}
                  disabled={disabled || busy}
                  sx={adminFieldSx}
                >
                  <MenuItem value="office">{t("order.officeTypeOffice")}</MenuItem>
                  <MenuItem value="airport">
                    {t("order.officeTypeAirport")}
                  </MenuItem>
                  <MenuItem value="train_station">
                    {t("order.officeTypeStation")}
                  </MenuItem>
                  <MenuItem value="port">{t("order.officeTypePort")}</MenuItem>
                  <MenuItem value="hotel">{t("order.officeTypeHotel")}</MenuItem>
                  <MenuItem value="other">{t("order.officeTypeOther")}</MenuItem>
                </TextField>
                {list.length > 1 ||
                office.address ||
                office.lat ||
                office._id ? (
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

              <Box sx={{ mt: 1.5 }}>
                <AddressPlacesAutocomplete
                  id={fieldId("address")}
                  name={fieldId("address")}
                  value={office.address || ""}
                  country={country}
                  disabled={disabled || busy}
                  label={t("companyProfile.officeAddress")}
                  placeholder={t("companyProfile.officeAddressPlaceholder")}
                  helperText={t("companyProfile.officeAddressHelp")}
                  onChange={(address) => updateOffice(officeId, { address })}
                  onResolved={({ address, lat, lon, placeId, locality }) => {
                    const changes = {
                      address,
                      lat: lat || office.lat,
                      lon: lon || office.lon,
                      placeId: placeId || office.placeId,
                      city: locality || office.city,
                    };
                    updateOffice(officeId, changes);
                    if (useAdminApi) {
                      saveOffice(officeId, changes);
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
                  onChange={(e) =>
                    updateOffice(officeId, { city: e.target.value })
                  }
                  onBlur={(e) =>
                    saveOffice(officeId, { city: e.target.value })
                  }
                  disabled={disabled || busy}
                  sx={adminFieldSx}
                />
                <TextField
                  id={fieldId("country")}
                  name={fieldId("country")}
                  size="small"
                  label={t("companyProfile.officeCountry")}
                  value={office.country || country || ""}
                  onChange={(e) =>
                    updateOffice(officeId, { country: e.target.value })
                  }
                  onBlur={(e) =>
                    saveOffice(officeId, { country: e.target.value })
                  }
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
                onBlur={(e) =>
                  saveOffice(officeId, {
                    collectionInstructions: e.target.value,
                  })
                }
                disabled={disabled || busy}
                sx={{ ...adminFieldSx, mt: 1.5 }}
              />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                gap={1}
                mt={1.5}
                alignItems={{ sm: "center" }}
              >
                <FormControlLabel
                  htmlFor={fieldId("active")}
                  control={
                    <Switch
                      id={fieldId("active")}
                      name={fieldId("active")}
                      size="small"
                      checked={Boolean(isActive)}
                      onChange={(e) => {
                        const changes = {
                          active: e.target.checked,
                          status: e.target.checked ? "active" : "archived",
                        };
                        updateOffice(officeId, changes);
                        if (useAdminApi) {
                          saveOffice(officeId, changes);
                        }
                      }}
                      disabled={disabled || busy}
                    />
                  }
                  label={t("companyProfile.officeActive")}
                />
                {useAdminApi ? (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => saveOffice(officeId)}
                    disabled={disabled || busy}
                    sx={{ textTransform: "none", ...adminReadableTextSx }}
                  >
                    {t("companyProfile.saveOffice", {
                      defaultValue: "Save office",
                    })}
                  </Button>
                ) : null}
                {isSaved ? (
                  <Typography
                    variant="caption"
                    color="success.main"
                    sx={adminReadableTextSx}
                  >
                    {t("companyProfile.officeSaved", {
                      defaultValue: "Saved",
                    })}
                  </Typography>
                ) : null}
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: { xs: 2.5, md: 3 },
                  mt: 1.5,
                }}
              >
                <TextField
                  id={fieldId("lat")}
                  name={fieldId("lat")}
                  size="small"
                  label={t("companyProfile.officeLat")}
                  value={office.lat || ""}
                  onChange={(e) =>
                    updateOffice(officeId, { lat: e.target.value })
                  }
                  onBlur={(e) => saveOffice(officeId, { lat: e.target.value })}
                  disabled={disabled || busy}
                  helperText={t("companyProfile.officeCoordsFallback")}
                  sx={adminFieldSx}
                />
                <TextField
                  id={fieldId("lng")}
                  name={fieldId("lng")}
                  size="small"
                  label={t("companyProfile.officeLng")}
                  value={office.lon || office.lng || ""}
                  onChange={(e) =>
                    updateOffice(officeId, { lon: e.target.value })
                  }
                  onBlur={(e) => saveOffice(officeId, { lon: e.target.value })}
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
            </AccordionDetails>
          </Accordion>
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
