"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Divider,
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
import { ALL_UI_LOCALES } from "@/domain/platform/uiLocales";
import { resolveCompanyOffices } from "@/domain/company/companyOffices";
import AdminSettingsSection, {
  adminCardSx,
  adminFieldSx,
  adminReadableTextSx,
} from "@/app/admin/shared/components/AdminSettingsSection";
import CompanyOfficesEditor from "@/app/admin/shared/components/CompanyOfficesEditor";

const bookingNumberFieldSx = {
  ...adminFieldSx,
  "& .MuiOutlinedInput-input": {
    ...adminReadableTextSx,
    paddingRight: 4,
    minWidth: 0,
  },
};

function SettingToggle({ checked, onChange, disabled, title, help }) {
  return (
    <FormControlLabel
      sx={{ m: 0, alignItems: "flex-start", gap: 1 }}
      control={
        <Switch
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          sx={{ mt: 0.15 }}
        />
      }
      label={
        <Box sx={{ pt: 0.6 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ ...adminReadableTextSx, lineHeight: 1.35 }}
          >
            {title}
          </Typography>
          {help ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ ...adminReadableTextSx, mt: 0.25, lineHeight: 1.45 }}
            >
              {help}
            </Typography>
          ) : null}
        </Box>
      }
    />
  );
}

export default function CompanyStorefrontCard({
  company,
  onSaved,
  disabled = false,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(company?.name || "");
  const [email, setEmail] = useState(company?.email || "");
  const [tel, setTel] = useState(company?.tel || "");
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
  const [offices, setOffices] = useState(() => resolveCompanyOffices(company));
  const [langAdmin, setLangAdmin] = useState(company?.langAdmin || "en");

  useEffect(() => {
    setName(company?.name || "");
    setEmail(company?.email || "");
    setTel(company?.tel || "");
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
    setOffices(resolveCompanyOffices(company));
  }, [company]);

  const save = useCallback(async () => {
    if (!company?._id) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/company/${company._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          tel,
          slug,
          storefrontEnabled,
          listedOnMarketplace,
          useSeasons,
          bufferTime: Number(bufferTime),
          minRentalDuration: Number(minRentalDuration),
          defaultStart,
          defaultEnd,
          workingHours: { start: workStart, end: workEnd },
          offices,
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
    company,
    name,
    email,
    tel,
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
    offices,
    langAdmin,
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
          ...adminReadableTextSx,
        }}
      >
        {t("companyProfile.storefrontTitle")}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2.5, whiteSpace: "normal", lineHeight: 1.5, ...adminReadableTextSx }}
      >
        {t("companyProfile.storefrontHelp")}
      </Typography>

      <Stack gap={3} divider={<Divider sx={{ borderColor: "divider" }} />}>
        <AdminSettingsSection title={t("companyProfile.identityTitle")}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <TextField
              size="small"
              label={t("companyProfile.companyName")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={disabled}
              sx={adminFieldSx}
            />
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
            <TextField
              size="small"
              label={t("companyProfile.email")}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={disabled}
              sx={adminFieldSx}
            />
            <TextField
              size="small"
              label={t("companyProfile.phone")}
              value={tel}
              onChange={(e) => setTel(e.target.value)}
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
                sx={{
                  mt: 0.75,
                  display: "block",
                  whiteSpace: "normal",
                  ...adminReadableTextSx,
                }}
              >
                {t("companyProfile.emailLangHelp")}
              </Typography>
            </FormControl>
          </Box>
        </AdminSettingsSection>

        <AdminSettingsSection title={t("companyProfile.visibilityTitle")}>
          <Stack gap={1.75}>
            <SettingToggle
              checked={storefrontEnabled}
              onChange={(e) => setStorefrontEnabled(e.target.checked)}
              disabled={disabled}
              title={t("companyProfile.storefrontEnabled")}
              help={t("companyProfile.storefrontEnabledHelp")}
            />
            <SettingToggle
              checked={listedOnMarketplace}
              onChange={(e) => setListedOnMarketplace(e.target.checked)}
              disabled={disabled}
              title={t("companyProfile.listedOnMarketplace")}
              help={t("companyProfile.listedOnMarketplaceHelp")}
            />
            <SettingToggle
              checked={useSeasons}
              onChange={(e) => setUseSeasons(e.target.checked)}
              disabled={disabled}
              title={t("companyProfile.useSeasons")}
              help={t("companyProfile.useSeasonsHelp")}
            />
          </Stack>
        </AdminSettingsSection>

        <AdminSettingsSection title={t("companyProfile.bookingRules")}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
              },
              gap: 2,
              alignItems: "start",
            }}
          >
            <TextField
              size="small"
              type="number"
              label={t("companyProfile.bufferHours")}
              value={bufferTime}
              onChange={(e) => setBufferTime(e.target.value)}
              inputProps={{ min: 0, max: 24, step: 1 }}
              disabled={disabled}
              sx={bookingNumberFieldSx}
            />
            <TextField
              size="small"
              type="number"
              label={t("companyProfile.minRentalHours")}
              value={minRentalDuration}
              onChange={(e) => setMinRentalDuration(e.target.value)}
              inputProps={{ min: 1, step: 1 }}
              disabled={disabled}
              sx={bookingNumberFieldSx}
            />
            <TextField
              size="small"
              type="time"
              label={t("companyProfile.defaultStart")}
              value={defaultStart}
              onChange={(e) => setDefaultStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 60 }}
              disabled={disabled}
              sx={adminFieldSx}
            />
            <TextField
              size="small"
              type="time"
              label={t("companyProfile.defaultEnd")}
              value={defaultEnd}
              onChange={(e) => setDefaultEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 60 }}
              disabled={disabled}
              sx={adminFieldSx}
            />
            <TextField
              size="small"
              type="time"
              label={t("companyProfile.workingHoursStart")}
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 60 }}
              disabled={disabled}
              sx={adminFieldSx}
            />
            <TextField
              size="small"
              type="time"
              label={t("companyProfile.workingHoursEnd")}
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 60 }}
              disabled={disabled}
              sx={adminFieldSx}
            />
          </Box>
        </AdminSettingsSection>

        <AdminSettingsSection
          title={t("companyProfile.officesTitle")}
          description={t("companyProfile.officesHelp")}
        >
          <CompanyOfficesEditor
            offices={offices}
            onChange={setOffices}
            country={company?.country}
            disabled={disabled}
          />
        </AdminSettingsSection>
      </Stack>

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
        {t("companyProfile.saveStorefront")}
      </Button>
    </Box>
  );
}
