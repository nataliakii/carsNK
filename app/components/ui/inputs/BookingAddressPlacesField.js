"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  MANUAL_ADDRESS_MIN_LENGTH,
  buildManualPlaceId,
} from "@/domain/orders/bookingLocationSelection";

const MIN_QUERY_LENGTH = 3;
const CLIENT_FETCH_TIMEOUT_MS = 12000;

function newSessionToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Hotel/street address field with Google Places Autocomplete (server proxy).
 * When suggestions fail (rate limit / Places down), the customer can confirm
 * a typed address manually and continue booking.
 */
export default function BookingAddressPlacesField({
  label,
  value,
  onChange,
  onResolved,
  country,
  language,
  cityBias,
  companyId,
  carId,
  error = false,
  helperText = "",
  FormHelperTextProps,
  disabled = false,
  sx,
  requireVerifiedPlace = false,
  allowManualFallback = true,
  onBlur,
}) {
  const { t, i18n } = useTranslation();
  const [inputValue, setInputValue] = useState(String(value || ""));
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const [touched, setTouched] = useState(false);
  const [manualAccepted, setManualAccepted] = useState(false);
  const sessionTokenRef = useRef(newSessionToken());
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const lastQueryRef = useRef("");
  const fetchPredictionsRef = useRef(null);

  const canUseManual =
    Boolean(allowManualFallback) || searchUnavailable || !requireVerifiedPlace;
  const freeSolo = canUseManual;

  useEffect(() => {
    setInputValue(String(value || ""));
  }, [value]);

  const lang = language || (i18n.language || "en").split("-")[0];

  const stopInFlight = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setLoading(false);
  }, []);

  const fetchPredictions = useCallback(
    async (text) => {
      const q = String(text || "").trim();
      lastQueryRef.current = q;
      if (q.length < MIN_QUERY_LENGTH) {
        stopInFlight();
        setOptions([]);
        return;
      }
      if (abortRef.current) abortRef.current.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      const timeoutId = setTimeout(() => abort.abort(), CLIENT_FETCH_TIMEOUT_MS);
      setLoading(true);
      try {
        const res = await fetch("/api/public/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: q,
            country: country || undefined,
            city: cityBias || undefined,
            language: lang,
            sessionToken: sessionTokenRef.current,
          }),
          signal: abort.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (
          res.status === 429 ||
          body?.code === "RATE_LIMIT" ||
          body.configured === false ||
          body.unavailable ||
          body.success === false
        ) {
          setSearchUnavailable(true);
          setOptions([]);
          return;
        }
        setSearchUnavailable(false);
        setOptions(Array.isArray(body.predictions) ? body.predictions : []);
      } catch (err) {
        if (err?.name === "AbortError") return;
        setSearchUnavailable(true);
        setOptions([]);
      } finally {
        clearTimeout(timeoutId);
        if (abortRef.current === abort) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [country, cityBias, lang, stopInFlight]
  );
  fetchPredictionsRef.current = fetchPredictions;

  const scheduleFetch = useCallback(
    (text) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const q = String(text || "").trim();
      if (q.length < MIN_QUERY_LENGTH) {
        stopInFlight();
        setOptions([]);
        setSearchUnavailable(false);
        return;
      }
      debounceRef.current = setTimeout(() => fetchPredictions(text), 280);
    },
    [fetchPredictions, stopInFlight]
  );

  useEffect(() => () => stopInFlight(), [stopInFlight]);

  const clearVerifiedQuietly = useCallback(
    (address) => {
      setManualAccepted(false);
      if (!onResolved) return;
      onResolved({
        success: false,
        placeId: "",
        address: address || "",
        clearedWhileTyping: true,
      });
    },
    [onResolved]
  );

  const acceptManualAddress = useCallback(
    (raw) => {
      const address = String(raw || inputValue || "").trim();
      if (address.length < MANUAL_ADDRESS_MIN_LENGTH) return;
      const placeId = buildManualPlaceId(address);
      setInputValue(address);
      setManualAccepted(true);
      setSearchUnavailable(false);
      if (onChange) onChange(address);
      if (onResolved) {
        onResolved({
          success: true,
          manual: true,
          pendingConfirmation: true,
          selectable: true,
          placeId,
          address,
          lat: null,
          lon: null,
          locality: cityBias || "",
          country: country || "",
        });
      }
    },
    [inputValue, onChange, onResolved, cityBias, country]
  );

  const resolvePlace = useCallback(
    async (prediction) => {
      if (!prediction?.placeId) return;
      try {
        const res = await fetch("/api/public/places/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placeId: prediction.placeId,
            language: lang,
            sessionToken: sessionTokenRef.current,
            cityName: cityBias || undefined,
            country: country || undefined,
            companyId: companyId || undefined,
            carId: carId || undefined,
          }),
        });
        const body = await res.json().catch(() => ({}));
        sessionTokenRef.current = newSessionToken();
        if (res.status === 429 || body?.code === "RATE_LIMIT") {
          setSearchUnavailable(true);
          if (prediction.description && canUseManual) {
            acceptManualAddress(prediction.description);
          }
          return;
        }
        if (body?.success && body.selectable !== false && body.address) {
          setInputValue(body.address);
          setSearchUnavailable(false);
          setManualAccepted(false);
          if (onChange) onChange(body.address);
          if (onResolved) onResolved(body);
          return;
        }
        if (body?.code && body?.message) {
          if (onResolved) {
            onResolved({
              success: false,
              selectable: false,
              code: body.code,
              message: body.message,
            });
          }
          if (canUseManual && prediction.description) {
            setSearchUnavailable(true);
          }
          return;
        }
        if (prediction.description && canUseManual) {
          acceptManualAddress(prediction.description);
        }
      } catch {
        setSearchUnavailable(true);
        if (prediction.description && canUseManual) {
          acceptManualAddress(prediction.description);
        }
      }
    },
    [
      lang,
      cityBias,
      country,
      companyId,
      carId,
      onChange,
      onResolved,
      canUseManual,
      acceptManualAddress,
    ]
  );

  const retrySearch = () => {
    setSearchUnavailable(false);
    const q = lastQueryRef.current || inputValue;
    fetchPredictionsRef.current?.(q);
  };

  const typedReady =
    String(inputValue || "").trim().length >= MANUAL_ADDRESS_MIN_LENGTH;
  const showManualConfirm =
    canUseManual && typedReady && !manualAccepted && (searchUnavailable || requireVerifiedPlace);
  const calmUnavailable =
    "We could not verify this address automatically. You can enter it manually, try again, or choose an office.";

  const showUnavailableNotice =
    searchUnavailable && String(inputValue || "").trim().length >= MIN_QUERY_LENGTH;
  const fieldError = Boolean(error) && (touched || Boolean(helperText));
  const shownHelper = helperText || "";

  return (
    <Box sx={{ width: "100%", minWidth: 0, ...sx }}>
      <Autocomplete
        freeSolo={freeSolo}
        options={options}
        filterOptions={(x) => x}
        getOptionLabel={(opt) =>
          typeof opt === "string" ? opt : opt?.description || ""
        }
        inputValue={inputValue}
        value={null}
        loading={loading}
        disabled={disabled}
        clearOnBlur={false}
        onInputChange={(_, newInput, reason) => {
          if (reason === "reset") return;
          setInputValue(newInput);
          if (onChange) onChange(newInput);
          clearVerifiedQuietly(newInput);
          scheduleFetch(newInput);
        }}
        onChange={(_, newValue) => {
          if (newValue && typeof newValue === "object" && newValue.placeId) {
            resolvePlace(newValue);
          } else if (typeof newValue === "string" && canUseManual) {
            acceptManualAddress(newValue);
          }
        }}
        onBlur={() => {
          setTouched(true);
          onBlur?.();
        }}
        loadingText={t("order.placesSearching", { defaultValue: "Searching…" })}
        noOptionsText={
          showUnavailableNotice
            ? calmUnavailable
            : String(inputValue || "").trim().length < MIN_QUERY_LENGTH
              ? t("order.placesKeepTyping", {
                  defaultValue: "Type at least 3 characters.",
                })
              : t("order.placesNoMatches", {
                  defaultValue: "No suggestions — try another address.",
                })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            error={fieldError}
            helperText={shownHelper}
            FormHelperTextProps={FormHelperTextProps}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        slotProps={{
          popper: { style: { zIndex: 1400 } },
        }}
      />
      {showUnavailableNotice || showManualConfirm ? (
        <Box
          sx={{
            mt: 0.5,
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flex: "1 1 180px", lineHeight: 1.4 }}
          >
            {showUnavailableNotice
              ? calmUnavailable
              : "Address suggestions are optional — confirm the typed address to continue."}
          </Typography>
          {showManualConfirm ? (
            <Button
              size="small"
              variant="outlined"
              onClick={() => acceptManualAddress(inputValue)}
              sx={{ flexShrink: 0, fontSize: "0.75rem" }}
            >
              Use this address
            </Button>
          ) : null}
          {showUnavailableNotice ? (
            <Button
              size="small"
              onClick={retrySearch}
              sx={{ flexShrink: 0, fontSize: "0.75rem" }}
            >
              Try again
            </Button>
          ) : null}
        </Box>
      ) : null}
      {manualAccepted ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 0.35, lineHeight: 1.35 }}
        >
          Address saved. Delivery fee may be confirmed by the supplier.
        </Typography>
      ) : null}
    </Box>
  );
}
