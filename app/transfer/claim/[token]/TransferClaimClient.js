"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";

export default function TransferClaimClient({ token }) {
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/transfers/claim/${encodeURIComponent(token)}`,
        { cache: "no-store" }
      );
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.message || "Could not load transfer");
      }
      setData(body);
    } catch (err) {
      setError(err.message || "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const claim = async () => {
    setClaiming(true);
    setError("");
    try {
      const res = await fetch(
        `/api/transfers/claim/${encodeURIComponent(token)}`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok || !body.success) {
        setData((prev) =>
          body.transfer
            ? {
                ...(prev || {}),
                available: false,
                transfer: body.transfer,
                reason:
                  body.message ||
                  "Sorry, this transfer has already been accepted by another company.",
              }
            : prev
        );
        throw new Error(
          body.message ||
            "Sorry, this transfer has already been accepted by another company."
        );
      }
      setData(body);
    } catch (err) {
      setError(err.message || "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const t = data?.transfer;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
      <Paper sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
          Transfer offer
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Review the operational summary and payout. Confirming acceptance
          assigns this transfer to your company. Opening this page does not
          claim it.
        </Typography>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error && !t ? (
          <Alert severity="error">{error}</Alert>
        ) : t ? (
          <Stack spacing={1.5}>
            {data?.companyName && (
              <Typography variant="body2">
                Offered to: <strong>{data.companyName}</strong>
              </Typography>
            )}
            <Typography>
              <strong>
                {t.from} → {t.to}
              </strong>
            </Typography>
            <Typography variant="body2">
              When: {dayjs(t.datetime).format("DD MMM YYYY, HH:mm")}
            </Typography>
            <Typography variant="body2">Passengers: {t.passengers}</Typography>
            {t.vehicleCategory && (
              <Typography variant="body2">
                Vehicle: {t.vehicleCategory}
              </Typography>
            )}
            {t.distanceKm != null && (
              <Typography variant="body2">
                Distance: {t.distanceKm} km
                {t.durationMinutes != null ? ` · ~${t.durationMinutes} min` : ""}
              </Typography>
            )}
            {t.supplierPayoutFormatted && (
              <Typography variant="body2">
                Supplier payout: <strong>{t.supplierPayoutFormatted}</strong>
              </Typography>
            )}

            {data.available ? (
              <Alert severity="success">
                Still available — confirm below to accept this transfer.
              </Alert>
            ) : (
              <Alert severity={data.claimed ? "info" : "warning"}>
                {data.message ||
                  data.reason ||
                  "Sorry, this transfer has already been accepted by another company."}
              </Alert>
            )}

            {data.claimed && (
              <Alert severity="success">
                The transfer has been assigned to your company.
                <br />
                Customer contact:
                <br />
                {t.customerName || "—"}
                <br />
                {t.phone || ""}
                <br />
                {t.email || ""}
                {t.flightNumber ? (
                  <>
                    <br />
                    Flight: {t.flightNumber}
                  </>
                ) : null}
              </Alert>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                onClick={refresh}
                disabled={loading || claiming}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                onClick={claim}
                disabled={!data.available || claiming}
              >
                {claiming ? "Confirming…" : "Confirm acceptance"}
              </Button>
            </Stack>
          </Stack>
        ) : null}
      </Paper>
    </Container>
  );
}
