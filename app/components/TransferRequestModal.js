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
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import { useTranslation } from "react-i18next";
import { formatMinor } from "@/domain/money/minorUnits";

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
  const [pickupCity, setPickupCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [adults, setAdults] = useState("2");
  const [childrenAges, setChildrenAges] = useState("");
  const [standardSuitcases, setStandardSuitcases] = useState("2");
  const [cabinBags, setCabinBags] = useState("2");
  const [oversizedLuggage, setOversizedLuggage] = useState("0");
  const [childSeats, setChildSeats] = useState("0");
  const [boosterSeats, setBoosterSeats] = useState("0");
  const [specialLuggage, setSpecialLuggage] = useState("");
  const [datetime, setDatetime] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [flightArrivalTime, setFlightArrivalTime] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [signText, setSignText] = useState("");
  const [notes, setNotes] = useState("");
  const [accessibilityRequirements, setAccessibilityRequirements] =
    useState("");
  const [returnRequested, setReturnRequested] = useState(false);
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+30");
  const [email, setEmail] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [distanceKm, setDistanceKm] = useState(null);
  const [durationMinutes, setDurationMinutes] = useState(null);
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
    setPickupCity("");
    setDestinationCity("");
    setAdults("2");
    setChildrenAges("");
    setStandardSuitcases("2");
    setCabinBags("2");
    setOversizedLuggage("0");
    setChildSeats("0");
    setBoosterSeats("0");
    setSpecialLuggage("");
    setDatetime("");
    setFlightNumber("");
    setFlightArrivalTime("");
    setHotelName("");
    setSignText("");
    setNotes("");
    setAccessibilityRequirements("");
    setReturnRequested(false);
    setCustomerFirstName("");
    setCustomerLastName("");
    setPhone("");
    setEmail("");
    setQuote(null);
    setDistanceKm(null);
    setDurationMinutes(null);
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
        /* freeSolo still works */
      } finally {
        if (!cancelled) setLocationsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const buildChildren = () =>
    String(childrenAges || "")
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((age) => ({ age: Number(age) }))
      .filter((c) => Number.isFinite(c.age));

  const buildSpecialLuggage = () =>
    String(specialLuggage || "")
      .split(/[,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .map((type) => ({
        type: ["wheelchair", "pushchair", "bicycle", "skis", "golf_bags", "oversized"].includes(
          type.replace(/\s+/g, "_")
        )
          ? type.replace(/\s+/g, "_")
          : "other",
        quantity: 1,
        notes: type,
      }));

  const fetchQuote = useCallback(async () => {
    if (!from || !to || !datetime) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const res = await fetch("/api/transfers/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          pickupCity,
          destinationCity,
          origin: {
            placeName: from,
            city: pickupCity,
            hotelName: hotelName || undefined,
            locationType: /airport/i.test(from) || flightNumber ? "airport" : undefined,
          },
          destination: {
            placeName: to,
            city: destinationCity,
            hotelName: hotelName || undefined,
          },
          datetime,
          adults: Number(adults) || 1,
          children: buildChildren(),
          standardSuitcases: Number(standardSuitcases) || 0,
          cabinBags: Number(cabinBags) || 0,
          oversizedLuggage: Number(oversizedLuggage) || 0,
          childSeats: Number(childSeats) || 0,
          boosterSeats: Number(boosterSeats) || 0,
          specialLuggage: buildSpecialLuggage(),
          flightNumber,
          accessibilityRequirements,
          returnRequested,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.success) {
        setQuote(null);
        setError(body.message || t("transfer.submitError"));
        return;
      }
      setError("");
      setQuote(body.quote);
      setDistanceKm(body.route?.distanceKm ?? body.quote?.distanceKm ?? null);
      setDurationMinutes(
        body.route?.durationMinutes ?? body.quote?.durationMinutes ?? null
      );
    } catch {
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    from,
    to,
    pickupCity,
    destinationCity,
    datetime,
    adults,
    childrenAges,
    standardSuitcases,
    cabinBags,
    oversizedLuggage,
    childSeats,
    boosterSeats,
    specialLuggage,
    flightNumber,
    hotelName,
    accessibilityRequirements,
    returnRequested,
    t,
  ]);

  useEffect(() => {
    if (!open || !from || !to || !datetime) return;
    const timer = setTimeout(() => {
      fetchQuote();
    }, 450);
    return () => clearTimeout(timer);
  }, [open, from, to, datetime, fetchQuote]);

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
    setPickupCity(destinationCity);
    setDestinationCity(pickupCity);
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
          pickupCity,
          destinationCity,
          origin: {
            placeName: from,
            city: pickupCity,
            hotelName: hotelName || undefined,
            locationType:
              /airport/i.test(from) || flightNumber ? "airport" : "address",
          },
          destination: {
            placeName: to,
            city: destinationCity,
            hotelName: hotelName || undefined,
          },
          adults: Number(adults) || 1,
          children: buildChildren(),
          standardSuitcases: Number(standardSuitcases) || 0,
          cabinBags: Number(cabinBags) || 0,
          oversizedLuggage: Number(oversizedLuggage) || 0,
          childSeats: Number(childSeats) || 0,
          boosterSeats: Number(boosterSeats) || 0,
          specialLuggage: buildSpecialLuggage(),
          datetime,
          flightNumber,
          flightArrivalTime,
          hotelName,
          signText,
          notes,
          accessibilityRequirements,
          returnRequested,
          customerFirstName,
          customerLastName,
          customerName: [customerFirstName, customerLastName]
            .filter(Boolean)
            .join(" "),
          phone,
          phoneCountryCode,
          email,
          preferredLanguage: i18n.language || "",
          locale: i18n.language || "",
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
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>
        {success ? t("transfer.successTitle") : t("transfer.title")}
      </DialogTitle>
      <DialogContent>
        {success ? (
          <Box sx={{ py: 2, textAlign: "center" }}>
            <Typography sx={{ color: "text.secondary", mb: 2 }}>
              {t("transfer.success")}
            </Typography>
            <Typography sx={{ fontStyle: "italic", mb: 1 }}>
              «{successQuote.greek}»
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {successQuote.line}
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
                />
              )}
            />
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Tooltip title={t("transfer.swap")}>
                <IconButton type="button" onClick={handleSwap}>
                  <SwapVertIcon />
                </IconButton>
              </Tooltip>
            </Box>
            <Autocomplete
              freeSolo
              options={locations}
              value={to}
              onChange={(_e, value) => setTo(value || "")}
              onInputChange={(_e, value) => setTo(value || "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label={t("transfer.to")}
                  placeholder={t("transfer.cityPlaceholder")}
                />
              )}
            />
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField
                label={t("transfer.pickupCity", { defaultValue: "Pickup city" })}
                value={pickupCity}
                onChange={(e) => setPickupCity(e.target.value)}
              />
              <TextField
                label={t("transfer.destinationCity", {
                  defaultValue: "Destination city",
                })}
                value={destinationCity}
                onChange={(e) => setDestinationCity(e.target.value)}
              />
            </Box>

            <Box sx={{ minHeight: 36 }}>
              {quoteLoading && <CircularProgress size={18} />}
              {!quoteLoading && quote && (
                <Box>
                  {quote.requiresManualQuote || quote.isProvisional ? (
                    <Typography variant="body2" color="warning.main">
                      {t("transfer.manualQuote", {
                        defaultValue:
                          "Price on request — we will confirm shortly.",
                      })}
                    </Typography>
                  ) : (
                    <Typography variant="body1" fontWeight={600}>
                      {t("transfer.price", { defaultValue: "Price" })}:{" "}
                      {formatMinor(
                        quote.customerPriceMinor,
                        quote.currency || "EUR",
                        i18n.language
                      )}
                    </Typography>
                  )}
                  {distanceKm != null && (
                    <Typography variant="body2" color="text.secondary">
                      {t("transfer.distance", {
                        km: distanceKm,
                        minutes: durationMinutes ?? "—",
                      })}
                    </Typography>
                  )}
                  {quote.vehicleCategory && (
                    <Typography variant="body2" color="text.secondary">
                      {t("transfer.vehicle", { defaultValue: "Vehicle" })}:{" "}
                      {quote.vehicleCategory}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
              <TextField
                required
                type="number"
                inputProps={{ min: 1, max: 50 }}
                label={t("transfer.adults", { defaultValue: "Adults" })}
                value={adults}
                onChange={(e) => setAdults(e.target.value)}
              />
              <TextField
                label={t("transfer.childrenAges", {
                  defaultValue: "Children ages (e.g. 3,7)",
                })}
                value={childrenAges}
                onChange={(e) => setChildrenAges(e.target.value)}
              />
              <TextField
                required
                type="datetime-local"
                label={t("transfer.datetime")}
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1.5 }}>
              <TextField
                type="number"
                label={t("transfer.suitcases", { defaultValue: "Suitcases" })}
                value={standardSuitcases}
                onChange={(e) => setStandardSuitcases(e.target.value)}
                inputProps={{ min: 0 }}
              />
              <TextField
                type="number"
                label={t("transfer.cabinBags", { defaultValue: "Cabin bags" })}
                value={cabinBags}
                onChange={(e) => setCabinBags(e.target.value)}
                inputProps={{ min: 0 }}
              />
              <TextField
                type="number"
                label={t("transfer.oversized", { defaultValue: "Oversized" })}
                value={oversizedLuggage}
                onChange={(e) => setOversizedLuggage(e.target.value)}
                inputProps={{ min: 0 }}
              />
              <TextField
                label={t("transfer.specialLuggage", {
                  defaultValue: "Special (wheelchair, skis…)",
                })}
                value={specialLuggage}
                onChange={(e) => setSpecialLuggage(e.target.value)}
              />
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField
                type="number"
                label={t("transfer.childSeats", { defaultValue: "Child seats" })}
                value={childSeats}
                onChange={(e) => setChildSeats(e.target.value)}
                inputProps={{ min: 0 }}
              />
              <TextField
                type="number"
                label={t("transfer.boosterSeats", {
                  defaultValue: "Booster seats",
                })}
                value={boosterSeats}
                onChange={(e) => setBoosterSeats(e.target.value)}
                inputProps={{ min: 0 }}
              />
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
              <TextField
                label={t("transfer.flightNumber", {
                  defaultValue: "Flight number",
                })}
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
              />
              <TextField
                label={t("transfer.flightArrival", {
                  defaultValue: "Flight arrival time",
                })}
                value={flightArrivalTime}
                onChange={(e) => setFlightArrivalTime(e.target.value)}
              />
              <TextField
                label={t("transfer.hotelName", { defaultValue: "Hotel name" })}
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
              />
            </Box>

            <TextField
              label={t("transfer.signText", {
                defaultValue: "Airport sign text (optional)",
              })}
              value={signText}
              onChange={(e) => setSignText(e.target.value)}
            />

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField
                required
                label={t("transfer.firstName", { defaultValue: "First name" })}
                value={customerFirstName}
                onChange={(e) => setCustomerFirstName(e.target.value)}
              />
              <TextField
                required
                label={t("transfer.lastName", { defaultValue: "Last name" })}
                value={customerLastName}
                onChange={(e) => setCustomerLastName(e.target.value)}
              />
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 1.5 }}>
              <TextField
                select
                label={t("transfer.phoneCode", { defaultValue: "Code" })}
                value={phoneCountryCode}
                onChange={(e) => setPhoneCountryCode(e.target.value)}
              >
                {["+30", "+34", "+49", "+44", "+1", "+7", "+380"].map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t("transfer.phone")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <TextField
                required
                type="email"
                label={t("transfer.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Box>

            <TextField
              label={t("transfer.accessibility", {
                defaultValue: "Accessibility requirements",
              })}
              value={accessibilityRequirements}
              onChange={(e) => setAccessibilityRequirements(e.target.value)}
              multiline
              minRows={1}
            />
            <TextField
              label={t("transfer.notes")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={returnRequested}
                  onChange={(e) => setReturnRequested(e.target.checked)}
                />
              }
              label={t("transfer.returnRequested", {
                defaultValue: "Also need a return transfer",
              })}
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
