"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { useTranslation } from "react-i18next";
import { emptyMeetingContact } from "@/domain/company/meetingContacts";
import CityPlacesAutocomplete from "@/app/components/ui/inputs/CityPlacesAutocomplete";
import { mergeOperatingCityCatalog } from "@/domain/geo/operatingCityCatalog";

export default function EditCompanyContactsDialog({
  open,
  busy = false,
  name,
  email,
  tel,
  baseLat = "",
  baseLon = "",
  meetingContacts = null,
  meetingContactPhone = "",
  meetingContactName = "",
  meetingContactChannel = "WhatsApp",
  lockName = false,
  onNameChange,
  onEmailChange,
  onTelChange,
  onBaseLatChange,
  onBaseLonChange,
  onMeetingContactsChange,
  onMeetingContactPhoneChange,
  onMeetingContactNameChange,
  onMeetingContactChannelChange,
  onClose,
  onSave,
}) {
  const { t } = useTranslation();
  const [cities, setCities] = useState([]);
  const [cityFieldKey, setCityFieldKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [coordsHint, setCoordsHint] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setCityFieldKey((k) => k + 1);
    setCoordsHint("");
    (async () => {
      let list = [];
      try {
        const adminRes = await fetch(
          "/api/admin/platform/cities?country=ALL",
          { cache: "no-store" }
        );
        if (adminRes.ok) {
          const body = await adminRes.json();
          if (body?.success && Array.isArray(body.cities)) {
            list = body.cities;
          }
        }
      } catch {
        /* company admin cannot call this — fall through */
      }
      if (!list.length) {
        try {
          const res = await fetch("/api/platform/public", { cache: "no-store" });
          if (res.ok) {
            const body = await res.json();
            if (body?.success && Array.isArray(body.cities)) {
              list = body.cities;
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) {
        setCities(mergeOperatingCityCatalog(list, { country: "ALL" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const contacts =
    Array.isArray(meetingContacts) && meetingContacts.length > 0
      ? meetingContacts
      : [
          {
            name: meetingContactName || "",
            phone: meetingContactPhone || "",
            channel: meetingContactChannel || "WhatsApp",
          },
        ];

  const applyCoords = (lat, lon, hint) => {
    onBaseLatChange?.(String(lat));
    onBaseLonChange?.(String(lon));
    setCoordsHint(hint || "");
  };

  const handleCityPick = useCallback(
    (picked) => {
      if (!picked) {
        setCoordsHint("");
        return;
      }
      onBaseLatChange?.(String(picked.lat));
      onBaseLonChange?.(String(picked.lon));
      setCoordsHint(
        t("companyProfile.baseCoordsFromCity", { city: picked.name })
      );
    },
    [onBaseLatChange, onBaseLonChange, t]
  );

  const handleCityError = useCallback((message) => {
    setCoordsHint(message || "");
  }, []);

  const handleUseMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setCoordsHint(t("companyProfile.locationUnavailable"));
      return;
    }
    setLocating(true);
    setCoordsHint("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setCityFieldKey((k) => k + 1);
        applyCoords(
          Number(pos.coords.latitude.toFixed(6)),
          Number(pos.coords.longitude.toFixed(6)),
          t("companyProfile.baseCoordsFromGps")
        );
      },
      (err) => {
        setLocating(false);
        setCoordsHint(
          err?.code === 1
            ? t("companyProfile.locationDenied")
            : t("companyProfile.locationUnavailable")
        );
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const updateContact = (index, field, value) => {
    if (typeof onMeetingContactsChange === "function") {
      const next = contacts.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      );
      onMeetingContactsChange(next);
      return;
    }
    if (field === "name") onMeetingContactNameChange?.(value);
    if (field === "phone") onMeetingContactPhoneChange?.(value);
    if (field === "channel") onMeetingContactChannelChange?.(value);
  };

  const addContact = () => {
    if (typeof onMeetingContactsChange !== "function") return;
    if (contacts.length >= 10) return;
    onMeetingContactsChange([...contacts, emptyMeetingContact()]);
  };

  const removeContact = (index) => {
    if (typeof onMeetingContactsChange !== "function") return;
    if (contacts.length <= 1) {
      onMeetingContactsChange([emptyMeetingContact()]);
      return;
    }
    onMeetingContactsChange(contacts.filter((_, i) => i !== index));
  };

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>{t("companyProfile.editDialogTitle")}</DialogTitle>
      <DialogContent>
        <Stack gap={1.5} sx={{ pt: 1 }}>
          <TextField
            label={t("companyProfile.companyName")}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            autoFocus={!lockName}
            fullWidth
            disabled={lockName}
            helperText={lockName ? t("companyProfile.mainBrandLocked") : undefined}
          />
          <TextField
            label={t("companyProfile.email")}
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            fullWidth
          />
          <TextField
            label={t("companyProfile.phone")}
            value={tel}
            onChange={(e) => onTelChange(e.target.value)}
            fullWidth
          />

          <Divider sx={{ my: 0.5 }} />
          <Typography variant="subtitle2" fontWeight={700}>
            {t("companyProfile.baseLocationTitle")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("companyProfile.baseCoordsHelper")}
          </Typography>

          <CityPlacesAutocomplete
            key={cityFieldKey}
            label={t("companyProfile.baseCityLookup")}
            placeholder={t("companyProfile.baseCityLookupPlaceholder")}
            helperText={t("companyProfile.baseCityLookupHelp")}
            catalogCities={cities}
            disabled={busy}
            onSelect={handleCityPick}
            onError={handleCityError}
          />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            gap={1}
            alignItems={{ sm: "flex-start" }}
          >
            <TextField
              size="small"
              label={t("companyProfile.baseLat")}
              type="number"
              value={baseLat}
              onChange={(e) => {
                setCoordsHint("");
                onBaseLatChange(e.target.value);
              }}
              fullWidth
              inputProps={{ step: "any" }}
              disabled={busy}
            />
            <TextField
              size="small"
              label={t("companyProfile.baseLon")}
              type="number"
              value={baseLon}
              onChange={(e) => {
                setCoordsHint("");
                onBaseLonChange(e.target.value);
              }}
              fullWidth
              inputProps={{ step: "any" }}
              disabled={busy}
            />
          </Stack>

          <Button
            size="small"
            variant="outlined"
            startIcon={<MyLocationIcon />}
            onClick={handleUseMyLocation}
            disabled={busy || locating}
            sx={{ textTransform: "none", alignSelf: "flex-start" }}
          >
            {locating
              ? t("companyProfile.locating")
              : t("companyProfile.useMyLocation")}
          </Button>
          {coordsHint ? (
            <Typography variant="caption" color="text.secondary">
              {coordsHint}
            </Typography>
          ) : null}

          <Divider sx={{ my: 0.5 }} />
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            flexWrap="wrap"
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {t("companyProfile.meetingContactTitle")}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("companyProfile.meetingContactsHelp")}
              </Typography>
            </Box>
            {typeof onMeetingContactsChange === "function" ? (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={addContact}
                disabled={busy || contacts.length >= 10}
                sx={{ textTransform: "none", flexShrink: 0 }}
              >
                {t("companyProfile.addMeetingContact")}
              </Button>
            ) : null}
          </Stack>

          {contacts.map((contact, index) => (
            <Box
              key={`meeting-contact-${index}`}
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "action.hover",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  {t("companyProfile.meetingContactN", { n: index + 1 })}
                </Typography>
                {typeof onMeetingContactsChange === "function" ? (
                  <IconButton
                    size="small"
                    aria-label={t("companyProfile.removeMeetingContact")}
                    onClick={() => removeContact(index)}
                    disabled={busy}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Stack>
              <Stack gap={1}>
                <TextField
                  size="small"
                  label={t("companyProfile.meetingContactName")}
                  value={contact.name || ""}
                  onChange={(e) => updateContact(index, "name", e.target.value)}
                  fullWidth
                />
                <TextField
                  size="small"
                  label={t("companyProfile.meetingContactPhone")}
                  value={contact.phone || ""}
                  onChange={(e) => updateContact(index, "phone", e.target.value)}
                  fullWidth
                />
                <TextField
                  size="small"
                  label={t("companyProfile.meetingContactChannel")}
                  value={contact.channel || ""}
                  onChange={(e) =>
                    updateContact(index, "channel", e.target.value)
                  }
                  fullWidth
                  placeholder="WhatsApp"
                  helperText={
                    index === contacts.length - 1
                      ? t("companyProfile.meetingContactChannelHelp")
                      : undefined
                  }
                />
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          {t("basic.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={busy || !name.trim()}
          sx={{ textTransform: "none" }}
        >
          {t("basic.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
