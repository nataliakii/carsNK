"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { useTranslation } from "react-i18next";

export default function TransferRequestModal({
  open,
  onClose,
  initialFrom = "",
  initialTo = "",
}) {
  const { t, i18n } = useTranslation();
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [passengers, setPassengers] = useState("1");
  const [datetime, setDatetime] = useState("");
  const [notes, setNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [distanceKm, setDistanceKm] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState(null);
  const [distanceApproximate, setDistanceApproximate] = useState(false);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successQuote, setSuccessQuote] = useState({
    god: "Hermes",
    greek: "Καλή οδό!",
    line: "Safe travels!",
  });

  const pickSuccessQuote = useCallback(() => {
    const quotes = t("transfer.successQuotes", { returnObjects: true });
    const list = Array.isArray(quotes) ? quotes : [];
    if (list.length === 0) {
      return {
        god: "Hermes",
        greek: "Καλή οδό!",
        line: t("transfer.success"),
      };
    }
    return list[Math.floor(Math.random() * list.length)];
  }, [t]);

  const reset = useCallback(() => {
    setFrom("");
    setTo("");
    setPassengers("1");
    setDatetime("");
    setNotes("");
    setCustomerName("");
    setPhone("");
    setEmail("");
    setDistanceKm(null);
    setDurationMinutes(null);
    setDistanceApproximate(false);
    setDistanceError("");
    setError("");
    setSuccess(false);
  }, []);

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose?.();
  };

  useEffect(() => {
    if (!open) return;
    setFrom(String(initialFrom || "").trim());
    setTo(String(initialTo || "").trim());
    setSuccess(false);
    setError("");
  }, [open, initialFrom, initialTo]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLocationsLoading(true);
      try {
        const res = await fetch("/api/transfers/locations");
        const body = await res.json();
        if (!cancelled && body.success) {
          setLocations((body.items || []).map((item) => item.name));
        }
      } catch {
        /* keep empty — freeSolo still works */
      } finally {
        if (!cancelled) setLocationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const fetchDistance = useCallback(
    async (origin, destination) => {
      if (!origin || !destination) {
        setDistanceKm(null);
        setDurationMinutes(null);
        setDistanceApproximate(false);
        setDistanceError("");
        return;
      }
      setDistanceLoading(true);
      setDistanceError("");
      try {
        const res = await fetch("/api/transfers/distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: origin, to: destination }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.success) {
          setDistanceKm(null);
          setDurationMinutes(null);
          setDistanceApproximate(false);
          setDistanceError(body.message || t("transfer.distanceError"));
          return;
        }
        setDistanceKm(body.distanceKm);
        setDurationMinutes(body.durationMinutes ?? null);
        setDistanceApproximate(Boolean(body.approximate));
      } catch {
        setDistanceKm(null);
        setDurationMinutes(null);
        setDistanceApproximate(false);
        setDistanceError(t("transfer.distanceError"));
      } finally {
        setDistanceLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!open || !from || !to) return;
    const timer = setTimeout(() => {
      fetchDistance(from, to);
    }, 350);
    return () => clearTimeout(timer);
  }, [open, from, to, fetchDistance]);

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          passengers: Number(passengers),
          datetime,
          notes,
          customerName,
          phone,
          email,
          locale: i18n.language || "",
          distanceKm,
          durationMinutes,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.success) {
        throw new Error(body.message || t("transfer.submitError"));
      }
      setSuccessQuote(pickSuccessQuote());
      setSuccess(true);
    } catch (err) {
      setError(err.message || t("transfer.submitError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {success ? t("transfer.successTitle") : t("transfer.title")}
      </DialogTitle>
      <DialogContent>
        {success ? (
          <Box
            sx={{
              py: 2,
              px: { xs: 0.5, sm: 1 },
              textAlign: "center",
            }}
          >
            <Typography
              sx={{
                fontSize: "2rem",
                lineHeight: 1,
                mb: 1.5,
                letterSpacing: "0.08em",
                color: "primary.main",
              }}
              aria-hidden
            >
              ✦
            </Typography>
            <Typography
              sx={{
                color: "text.secondary",
                mb: 2.5,
                maxWidth: 420,
                mx: "auto",
              }}
            >
              {t("transfer.success")}
            </Typography>
            <Box
              sx={{
                mx: "auto",
                maxWidth: 440,
                px: 2.5,
                py: 2,
                borderRadius: 2,
                background:
                  "linear-gradient(160deg, rgba(0,137,137,0.08) 0%, rgba(11,31,58,0.06) 100%)",
                border: "1px solid",
                borderColor: "rgba(0,137,137,0.22)",
              }}
            >
              <Typography
                sx={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontStyle: "italic",
                  fontSize: { xs: "1.05rem", sm: "1.15rem" },
                  color: "text.primary",
                  lineHeight: 1.5,
                  mb: 1,
                }}
              >
                «{successQuote.greek}»
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.95rem",
                  color: "text.secondary",
                  mb: 1.25,
                  lineHeight: 1.45,
                }}
              >
                {successQuote.line}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "primary.main",
                  fontWeight: 600,
                }}
              >
                — {successQuote.god}
              </Typography>
            </Box>
            <Typography
              sx={{
                mt: 2,
                fontSize: "0.85rem",
                color: "text.secondary",
              }}
            >
              {t("transfer.successBlessing")}
            </Typography>
          </Box>
        ) : (
          <Box
            component="form"
            id="transfer-request-form"
            onSubmit={handleSubmit}
            sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 1 }}
          >
            <Autocomplete
              freeSolo
              options={locations}
              loading={locationsLoading}
              value={from}
              onChange={(_e, value) => setFrom(value || "")}
              onInputChange={(_e, value) => setFrom(value || "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label={t("transfer.from")}
                  placeholder={t("transfer.cityPlaceholder")}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {locationsLoading ? (
                          <CircularProgress color="inherit" size={18} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            <Box sx={{ display: "flex", justifyContent: "center", my: -0.5 }}>
              <Tooltip title={t("transfer.swap")}>
                <IconButton
                  type="button"
                  onClick={handleSwap}
                  aria-label={t("transfer.swap")}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                  }}
                >
                  <SwapVertIcon />
                </IconButton>
              </Tooltip>
            </Box>

            <Autocomplete
              freeSolo
              options={locations}
              loading={locationsLoading}
              value={to}
              onChange={(_e, value) => setTo(value || "")}
              onInputChange={(_e, value) => setTo(value || "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label={t("transfer.to")}
                  placeholder={t("transfer.cityPlaceholder")}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {locationsLoading ? (
                          <CircularProgress color="inherit" size={18} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            <Box
              sx={{
                minHeight: 28,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              {distanceLoading && <CircularProgress size={18} />}
              {!distanceLoading && distanceKm != null && (
                <Typography variant="body2" color="text.secondary">
                  {distanceApproximate
                    ? t("transfer.distanceApprox", {
                        km: distanceKm,
                        minutes: durationMinutes ?? "—",
                      })
                    : t("transfer.distance", {
                        km: distanceKm,
                        minutes: durationMinutes ?? "—",
                      })}
                </Typography>
              )}
              {!distanceLoading && distanceError && (
                <Typography variant="body2" color="warning.main">
                  {t("transfer.distanceUnavailable")}
                </Typography>
              )}
            </Box>

            <TextField
              required
              type="number"
              inputProps={{ min: 1, max: 50 }}
              label={t("transfer.passengers")}
              value={passengers}
              onChange={(e) => setPassengers(e.target.value)}
              fullWidth
            />
            <TextField
              required
              type="datetime-local"
              label={t("transfer.datetime")}
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label={t("transfer.customerName")}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              fullWidth
            />
            <TextField
              label={t("transfer.phone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              fullWidth
            />
            <TextField
              required
              type="email"
              label={t("transfer.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label={t("transfer.notes")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          {success ? t("transfer.close") : t("transfer.cancel")}
        </Button>
        {!success && (
          <Button
            type="submit"
            form="transfer-request-form"
            variant="contained"
            disabled={loading}
          >
            {loading ? t("transfer.sending") : t("transfer.submit")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
