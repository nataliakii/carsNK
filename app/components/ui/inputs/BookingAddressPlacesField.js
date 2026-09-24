"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

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
 * Typing never disables the field. Only a selected suggestion is verified.
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
  allowManualFallback,
  onBlur,
}) {
  const { t, i18n } = useTranslation();
  const [inputValue, setInputValue] = useState(String(value || ""));
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const [touched, setTouched] = useState(false);
  const sessionTokenRef = useRef(newSessionToken());
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const lastQueryRef = useRef("");
  const fetchPredictionsRef = useRef(null);

  const manualFallbackAllowed =
    allowManualFallback !== undefined
      ? Boolean(allowManualFallback)
      : !requireVerifiedPlace;

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
        if (body.configured === false || body.unavailable || body.success === false) {
          console.warn("[places-ui] autocomplete unavailable", {
            reason: body.reason || null,
            configured: body.configured,
          });
          setSearchUnavailable(true);
          setOptions([]);
          return;
        }
        setSearchUnavailable(false);
        setOptions(Array.isArray(body.predictions) ? body.predictions : []);
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.warn("[places-ui] autocomplete network error");
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
      if (!requireVerifiedPlace || !onResolved) return;
      onResolved({
        success: false,
        placeId: "",
        address: address || "",
        clearedWhileTyping: true,
      });
    },
    [onResolved, requireVerifiedPlace]
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
        if (body?.success && body.selectable !== false && body.address) {
          setInputValue(body.address);
          setSearchUnavailable(false);
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
          return;
        }
        if (prediction.description && !requireVerifiedPlace) {
          setInputValue(prediction.description);
          if (onChange) onChange(prediction.description);
        }
      } catch {
        if (prediction.description && !requireVerifiedPlace) {
          setInputValue(prediction.description);
          if (onChange) onChange(prediction.description);
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
      requireVerifiedPlace,
    ]
  );

  const retrySearch = () => {
    setSearchUnavailable(false);
    const q = lastQueryRef.current || inputValue;
    fetchPredictionsRef.current?.(q);
  };

  const calmUnavailable =
    "We could not verify this address automatically. You can try again or choose an office.";

  const showUnavailableNotice = searchUnavailable && String(inputValue || "").trim().length >= MIN_QUERY_LENGTH;
  const fieldError = Boolean(error) && (touched || Boolean(helperText));
  const shownHelper = helperText || "";

  return (
    <Box sx={{ width: "100%", minWidth: 0, ...sx }}>
      <Autocomplete
        freeSolo={!requireVerifiedPlace && manualFallbackAllowed}
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
          } else if (typeof newValue === "string" && !requireVerifiedPlace) {
            setInputValue(newValue);
            if (onChange) onChange(newValue);
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
      {showUnavailableNotice ? (
        <Box sx={{ mt: 0.5, display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, lineHeight: 1.4 }}>
            {calmUnavailable}
          </Typography>
          <Button size="small" onClick={retrySearch} sx={{ mt: 0, flexShrink: 0, fontSize: "0.75rem" }}>
            Try again
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
