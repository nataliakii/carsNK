"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { ROLE } from "@/domain/orders/admin-rbac";
import {
  DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
  MARKETPLACE_BOOKING_FEE_SOURCE,
  formatMarketplaceFeePercent,
  parseMarketplaceBookingFeePercent,
  resolveMarketplaceBookingFeeBps,
} from "@/domain/orders/marketplaceBookingFee";

function isSpainMarketplaceCompany(company) {
  return String(company?.country || "").trim().toUpperCase() === "ES";
}

/**
 * Per-company rental Stripe / on-site payment settings.
 * Spain marketplace: compact Commercial terms (SUPERADMIN only).
 */
export default function CompanyRentalPaymentsCard({ company, onSaved }) {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const sessionReady = status !== "loading";
  const canEdit = Number(session?.user?.role) === ROLE.SUPERADMIN;
  const spainMarketplace = isSpainMarketplaceCompany(company);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [timing, setTiming] = useState("after_confirm");
  const [prepaymentPercent, setPrepaymentPercent] = useState("");
  const [feeMode, setFeeMode] = useState("default");
  const [feePercentInput, setFeePercentInput] = useState("10");
  const [platformDefaultLabel, setPlatformDefaultLabel] = useState("10");
  const [platformSettings, setPlatformSettings] = useState(null);

  useEffect(() => {
    if (!spainMarketplace) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/platform/booking-fee", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json.success || cancelled) return;
        const bps =
          json.marketplaceBookingFeeBps == null
            ? DEFAULT_MARKETPLACE_BOOKING_FEE_BPS
            : json.marketplaceBookingFeeBps;
        setPlatformDefaultLabel(
          json.percentLabel || formatMarketplaceFeePercent(bps)
        );
        setPlatformSettings({ marketplaceBookingFeeBps: bps });
      } catch {
        /* keep 10% label */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spainMarketplace]);

  const resolvedFee = useMemo(
    () => resolveMarketplaceBookingFeeBps(company, platformSettings),
    [company, platformSettings]
  );

  useEffect(() => {
    if (!company) return;
    setStripeEnabled(Boolean(company.rentalPayments?.stripeEnabled));
    setTiming(
      company.rentalPayments?.timing === "before_confirm"
        ? "before_confirm"
        : "after_confirm"
    );
    setPrepaymentPercent(
      company.prepaymentPercent == null || company.prepaymentPercent === ""
        ? ""
        : String(company.prepaymentPercent)
    );
    const hasOverride =
      company.marketplaceBookingFeeBps != null &&
      company.marketplaceBookingFeeBps !== "";
    setFeeMode(hasOverride ? "custom" : "default");
    setFeePercentInput(
      hasOverride
        ? formatMarketplaceFeePercent(company.marketplaceBookingFeeBps)
        : resolvedFee.percentLabel
    );
  }, [company, resolvedFee.percentLabel]);

  if (!company?._id) return null;

  const effectiveLabel =
    feeMode === "custom"
      ? feePercentInput || "—"
      : platformDefaultLabel;

  const saveRentalPayments = async () => {
    if (!canEdit) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const payload = {
        rentalPayments: {
          stripeEnabled,
          timing,
        },
        prepaymentPercent:
          prepaymentPercent === "" ? null : Number(prepaymentPercent),
      };
      const res = await fetch(`/api/company/${company._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || body.message || "Failed");
      setOk("Rental payment settings saved");
      if (typeof onSaved === "function") onSaved(body);
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const saveCommercialTerms = async () => {
    if (!canEdit) return;
    let payload;
    if (feeMode === "default") {
      const confirmed = window.confirm(
        `Use platform default (${platformDefaultLabel}%) for this partner? Existing bookings stay the same.`
      );
      if (!confirmed) return;
      payload = {
        marketplaceBookingFeeBps: null,
        marketplaceBookingFeeReason: "Use platform default",
      };
    } else {
      const parsed = parseMarketplaceBookingFeePercent(feePercentInput);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      const confirmed = window.confirm(
        `Set custom booking fee to ${formatMarketplaceFeePercent(parsed.bps)}%? Existing bookings stay the same.`
      );
      if (!confirmed) return;
      payload = {
        marketplaceBookingFeeBps: parsed.bps,
        marketplaceBookingFeeReason: "Set company override",
      };
    }
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/company/${company._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || body.message || "Failed");
      setOk("Commercial terms saved.");
      if (typeof onSaved === "function") onSaved(body);
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, "&:last-child": { pb: { xs: 2, sm: 2.5 } } }}>
        {spainMarketplace ? (
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
            Commercial terms
          </Typography>
        ) : (
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
            Rental payments
          </Typography>
        )}
        {spainMarketplace ? null : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose whether this company collects rental money on site, or charges an online prepayment via Stripe — and when that link is created.
          </Typography>
        )}

        <Stack spacing={1.5}>
          {error && <Alert severity="error">{error}</Alert>}
          {ok && <Alert severity="success">{ok}</Alert>}
          {sessionReady && !canEdit ? (
            <Alert severity="info">
              {t("companyProfile.rentalPaymentsLockedNote", {
                defaultValue: "Only the platform superadmin can change these settings.",
              })}
            </Alert>
          ) : null}

          {spainMarketplace ? (
            <Box>
              <FormControl disabled={!canEdit}>
                <FormLabel sx={{ mb: 0.5, fontSize: "0.85rem" }}>Booking fee</FormLabel>
                <RadioGroup
                  value={feeMode}
                  onChange={(e) => setFeeMode(e.target.value)}
                >
                  <FormControlLabel
                    value="default"
                    control={<Radio size="small" />}
                    label={`Use platform default: ${platformDefaultLabel}%`}
                  />
                  <FormControlLabel
                    value="custom"
                    control={<Radio size="small" />}
                    label="Custom rate"
                  />
                </RadioGroup>
              </FormControl>
              {feeMode === "custom" ? (
                <TextField
                  size="small"
                  label="Custom booking fee"
                  type="number"
                  value={feePercentInput}
                  onChange={(e) => setFeePercentInput(e.target.value)}
                  disabled={!canEdit || busy}
                  inputProps={{ min: 1, max: 30, step: 0.01, "aria-label": "Custom booking fee" }}
                  InputProps={{ endAdornment: <Typography sx={{ pr: 1 }}>%</Typography> }}
                  sx={{ maxWidth: 200, mt: 1, mb: 1 }}
                />
              ) : null}
              <Typography variant="body2" sx={{ mt: 0.5, mb: 1 }}>
                Effective rate: {effectiveLabel}%
              </Typography>
              {canEdit ? (
                <Button
                  variant="contained"
                  onClick={saveCommercialTerms}
                  disabled={busy}
                >
                  Save commercial terms
                </Button>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {resolvedFee.source === MARKETPLACE_BOOKING_FEE_SOURCE.OVERRIDE
                    ? "Custom rate"
                    : "Platform default"}
                </Typography>
              )}
            </Box>
          ) : null}

          {spainMarketplace ? null : (
            <FormControlLabel
              control={
                <Switch
                  checked={stripeEnabled}
                  onChange={(e) => setStripeEnabled(e.target.checked)}
                  disabled={!canEdit}
                />
              }
              label="Stripe — charge rental prepayment online"
            />
          )}

          {spainMarketplace ? null : (
            <TextField
              size="small"
              label="Prepayment %"
              type="number"
              value={prepaymentPercent}
              onChange={(e) => setPrepaymentPercent(e.target.value)}
              helperText="Empty = platform default (e.g. 0% calendar). Required for Stripe amounts."
              inputProps={{ min: 0, max: 100, readOnly: !canEdit }}
              disabled={!canEdit}
              sx={{ maxWidth: 280 }}
            />
          )}

          {spainMarketplace ? null : (
            <FormControl disabled={!canEdit || !stripeEnabled}>
              <FormLabel>When to create the Stripe pay link</FormLabel>
              <RadioGroup
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
              >
                <FormControlLabel
                  value="before_confirm"
                  control={<Radio size="small" />}
                  label="Before confirmation — link on booking; confirm blocked until paid"
                />
                <FormControlLabel
                  value="after_confirm"
                  control={<Radio size="small" />}
                  label="After confirmation — link when admin confirms the order"
                />
              </RadioGroup>
            </FormControl>
          )}

          {spainMarketplace ? null : (
            <Box
              sx={{
                p: 1.25,
                borderRadius: 1,
                bgcolor: "action.hover",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {!stripeEnabled
                  ? "Mode: on site / by fact — no online charge."
                  : timing === "before_confirm"
                    ? "Mode: Stripe prepayment on booking create; admin cannot confirm until paid."
                    : "Mode: Stripe prepayment after admin confirms; remainder on site at pickup."}
              </Typography>
            </Box>
          )}

          {sessionReady && canEdit && !spainMarketplace ? (
            <Button variant="contained" onClick={saveRentalPayments} disabled={busy}>
              Save rental payment settings
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
