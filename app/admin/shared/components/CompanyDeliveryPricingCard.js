"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import AdminSettingsSection, {
  adminFieldSx,
  adminReadableTextSx,
  adminSurfaceSx,
} from "@/app/admin/shared/components/AdminSettingsSection";
import { policyFromCompany } from "@/app/admin/shared/components/companyDeliveryPolicy";

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

export default function CompanyDeliveryPricingCard({
  company,
  onSaved,
  disabled = false,
  embedded = false,
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const initial = policyFromCompany(company);
  const [insideMode, setInsideMode] = useState(initial.inside.mode);
  const [insideAmount, setInsideAmount] = useState(initial.inside.amount);
  const [outsideMode, setOutsideMode] = useState(initial.outside.mode);
  const [outsideAmount, setOutsideAmount] = useState(initial.outside.amount);

  useEffect(() => {
    const policy = policyFromCompany(company);
    setInsideMode(policy.inside.mode);
    setInsideAmount(policy.inside.amount);
    setOutsideMode(policy.outside.mode);
    setOutsideAmount(policy.outside.amount);
  }, [company]);

  const save = useCallback(async () => {
    if (!company?._id) return;
    setBusy(true);
    setError("");
    try {
      const existing = policyFromCompany(company);
      const res = await fetch(`/api/company/${company._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryPricing: {
            strategy: existing.strategy,
            radiusKm: existing.radiusKm,
            operatingCities: existing.operatingCities,
            maxDistanceKm: existing.maxDistanceKm,
            inside: {
              mode: insideMode,
              amount: insideMode === "free" ? 0 : Number(insideAmount) || 0,
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
    insideMode,
    insideAmount,
    outsideMode,
    outsideAmount,
    onSaved,
  ]);

  if (!company) return null;

  return (
    <Box sx={adminSurfaceSx(embedded)}>
      <AdminSettingsSection
        title={t("companyProfile.deliveryRulesTitle")}
        description={t("companyProfile.deliveryRulesHelp")}
      >
        <Stack gap={2.5}>
          <Box>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ mb: 1, ...adminReadableTextSx }}
            >
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
                value={
                  insideMode === "free" ||
                  insideMode === "fixed" ||
                  insideMode === "perKm"
                    ? insideMode
                    : "free"
                }
                onChange={(_e, next) => {
                  if (next == null) return;
                  setInsideMode(next);
                  if (next === "free") setInsideAmount(0);
                }}
                sx={pricingToggleSx}
              >
                <ToggleButton value="free">
                  {t("companyProfile.insideFree")}
                </ToggleButton>
                <ToggleButton value="fixed">
                  {t("companyProfile.insideFixed")}
                </ToggleButton>
                <ToggleButton value="perKm">
                  {t("companyProfile.insidePerKm")}
                </ToggleButton>
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
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ mb: 1, ...adminReadableTextSx }}
            >
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
                <ToggleButton value="perKm">
                  {t("companyProfile.outsidePerKm")}
                </ToggleButton>
                <ToggleButton value="fixed">
                  {t("companyProfile.outsideFixed")}
                </ToggleButton>
                <ToggleButton value="blocked">
                  {t("companyProfile.outsideBlocked")}
                </ToggleButton>
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
        </Stack>
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
        {t("companyProfile.savePricing")}
      </Button>
    </Box>
  );
}
