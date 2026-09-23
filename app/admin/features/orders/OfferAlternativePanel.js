"use client";

import { useCallback, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { isMarketplaceRequestMode } from "@/domain/booking/bookingMode";
import { formatMarketplaceEuro, marketplaceFeeNotice, marketplaceSplitLabels } from "@/domain/orders/marketplaceFinancialSplit";

function money(minor, currency = "EUR") {
  if (minor == null) return "—";
  return `${String(currency).toUpperCase()} ${(Number(minor) / 100).toFixed(2)}`;
}

function when(value) {
  if (!value) return "—";
  try {
    return new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  } catch {
    return "—";
  }
}

export default function OfferAlternativePanel({ order }) {
  const orderId = order?._id ? String(order._id) : "";
  const marketplace = isMarketplaceRequestMode(order?.bookingMode);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [carId, setCarId] = useState("");
  const [reason, setReason] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/legal/alternative-offers?orderId=${encodeURIComponent(orderId)}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Could not load alternative offers");
      }
      setData(json);
      if (!carId && json.eligibleCars?.[0]?.carId) {
        setCarId(json.eligibleCars[0].carId);
      }
    } catch (err) {
      setError(err.message || "Could not load alternative offers");
    } finally {
      setLoading(false);
    }
  }, [orderId, carId]);

  if (!marketplace || !orderId) return null;

  const selected = (data?.eligibleCars || []).find((row) => row.carId === carId);
  const active = (data?.offers || []).find((row) => row.status === "OFFERED");

  const submit = async () => {
    if (!carId || busy) return;
    setBusy("create");
    setError("");
    try {
      const res = await fetch("/api/admin/legal/alternative-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          proposedCarId: carId,
          reasonForReplacement: reason,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Could not create offer");
      }
      setReason("");
      await load();
    } catch (err) {
      setError(err.message || "Could not create offer");
    } finally {
      setBusy("");
    }
  };

  const withdraw = async () => {
    if (!active || busy) return;
    setBusy("withdraw");
    setError("");
    try {
      const res = await fetch("/api/admin/legal/alternative-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "withdraw",
          orderId,
          offerId: active.offerId,
          reason: withdrawReason,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Could not withdraw offer");
      }
      setWithdrawReason("");
      await load();
    } catch (err) {
      setError(err.message || "Could not withdraw offer");
    } finally {
      setBusy("");
    }
  };

  return (
    <Box sx={{ mt: 1.5, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Offer alternative vehicle
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Choose a replacement from this fleet. The total cannot exceed the original price.
      </Typography>

      <Button size="small" onClick={load} disabled={loading} sx={{ mb: 1 }}>
        {loading ? "Loading…" : data ? "Refresh" : "Load eligible cars"}
      </Button>

      {error ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      ) : null}

      {data?.paidOrderBlocked ? (
        <Alert severity="warning">
          This booking is already paid. Automatic car replacement is blocked. Use SUPERADMIN/manual resolution.
        </Alert>
      ) : null}

      {data?.eligibilityError && !data.paidOrderBlocked ? (
        <Alert severity="info">{data.eligibilityError.message}</Alert>
      ) : null}

      {active ? (
        <Alert severity="info" sx={{ mb: 1 }}>
          Active offer {active.offerId} expires {when(active.expiresAt)}. Withdraw it before offering another car.
        </Alert>
      ) : null}

      {Array.isArray(data?.offers) && data.offers.length > 0 ? (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            History
          </Typography>
          {data.offers.map((row) => (
            <Typography key={row.offerId} variant="caption" sx={{ display: "block" }}>
              {row.offerId} · {row.status} · {row.vehicle?.model || "—"} ·{" "}
              {money(row.offeredGrossMinor ?? row.priceMinor, row.currency)} ·{" "}
              {row.reasonForReplacement}
            </Typography>
          ))}
        </Box>
      ) : null}

      {data && !data.paidOrderBlocked && !active ? (
        <Stack spacing={1.25}>
          <FormControl size="small" fullWidth>
            <InputLabel id="alt-car">Stored replacement car</InputLabel>
            <Select
              labelId="alt-car"
              label="Stored replacement car"
              value={carId}
              onChange={(event) => setCarId(event.target.value)}
            >
              {(data.eligibleCars || []).map((car) => (
                <MenuItem key={car.carId} value={car.carId}>
                  {car.unpublished ? "(internal) " : ""}
                  {car.name} · {car.category} · {money(car.cap?.offeredGrossMinor)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selected ? (
            <Typography variant="body2">
              {marketplaceSplitLabels("en").total}: {formatMarketplaceEuro(selected.cap?.offeredGrossMinor)}
              {" · "}
              {marketplaceSplitLabels("en").paidToRovaro}: {formatMarketplaceEuro(selected.cap?.prepaymentMinor)}
              {" · "}
              {marketplaceSplitLabels("en").collectFromCustomer}: {formatMarketplaceEuro(selected.cap?.balanceMinor)}
              <Box component="span" sx={{ display: "block", color: "text.secondary", fontSize: "0.8rem" }}>
                {marketplaceFeeNotice("en", selected.cap?.prepaymentMinor)}
              </Box>
            </Typography>
          ) : null}
          {(data.excludedCars || []).length > 0 ? (
            <Typography variant="caption" color="text.secondary" component="div">
              Not offerable:
              {(data.excludedCars || []).slice(0, 12).map((row) => (
                <Box key={row.carId} component="span" sx={{ display: "block" }}>
                  {row.name}: {row.message}
                </Box>
              ))}
            </Typography>
          ) : null}
          <TextField
            size="small"
            label="Reason shown to the customer"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
          />
          <Button
            variant="contained"
            onClick={submit}
            disabled={!carId || !reason.trim() || Boolean(busy)}
          >
            {busy === "create" ? "Submitting…" : "Submit offer"}
          </Button>
        </Stack>
      ) : null}

      {active ? (
        <Stack spacing={1} sx={{ mt: 1 }}>
          <TextField
            size="small"
            label="Withdrawal reason (required)"
            value={withdrawReason}
            onChange={(event) => setWithdrawReason(event.target.value)}
          />
          <Button
            color="warning"
            variant="outlined"
            onClick={withdraw}
            disabled={!withdrawReason.trim() || Boolean(busy)}
          >
            {busy === "withdraw" ? "Withdrawing…" : "Withdraw offer"}
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
}
