"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  formatMarketplaceFeePercent,
  parseMarketplaceBookingFeePercent,
  DEFAULT_MARKETPLACE_BOOKING_FEE_BPS,
} from "@/domain/orders/marketplaceBookingFee";
import { useRegisterSettingsDirty } from "@/app/admin/settings/SettingsDirtyGuard";

/**
 * SUPERADMIN: platform default Rovaro booking fee for Spain marketplace.
 */
export default function PlatformBookingFeeCard({ embedded = false } = {}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [percentInput, setPercentInput] = useState("10");
  const [savedPercent, setSavedPercent] = useState("10");
  const [effectiveLabel, setEffectiveLabel] = useState("10");
  const [overrideCount, setOverrideCount] = useState(0);
  const [defaultCount, setDefaultCount] = useState(0);

  const dirty = useMemo(
    () => !loading && String(percentInput) !== String(savedPercent),
    [loading, percentInput, savedPercent]
  );
  useRegisterSettingsDirty("platform-booking-fee", dirty);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/platform?includeFee=1", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load");
      }
      const bps =
        json.marketplaceBookingFeeBps == null
          ? DEFAULT_MARKETPLACE_BOOKING_FEE_BPS
          : json.marketplaceBookingFeeBps;
      const label = formatMarketplaceFeePercent(bps);
      setPercentInput(label);
      setSavedPercent(label);
      setEffectiveLabel(label);
      setOverrideCount(Number(json.feeStats?.customOverrideCount) || 0);
      setDefaultCount(Number(json.feeStats?.platformDefaultCount) || 0);
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const parsed = parseMarketplaceBookingFeePercent(percentInput);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const confirmed = window.confirm(
      `Set platform default booking fee to ${formatMarketplaceFeePercent(parsed.bps)}%? Existing bookings stay the same.`
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/platform", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplaceBookingFeeBps: parsed.bps }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Save failed");
      }
      setOk("Default booking fee saved.");
      await load();
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        {embedded ? null : (
          <>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
              Default booking fee
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Used for partners without a custom rate.
            </Typography>
          </>
        )}
        {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}
        {ok ? <Alert severity="success" sx={{ mb: 1.5 }}>{ok}</Alert> : null}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            label="Default booking fee"
            type="number"
            value={percentInput}
            onChange={(e) => setPercentInput(e.target.value)}
            disabled={loading || busy}
            inputProps={{ min: 1, max: 30, step: 0.01 }}
            InputProps={{ endAdornment: <Typography sx={{ pr: 1 }}>%</Typography> }}
            sx={{ maxWidth: 220 }}
          />
          <Button variant="contained" onClick={save} disabled={loading || busy}>
            Save
          </Button>
        </Stack>
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Effective default: {effectiveLabel}%
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Partners on default: {defaultCount} · Custom rates: {overrideCount}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
