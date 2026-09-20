"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";

const MIN_QUERY_LENGTH = 3;
const CLIENT_FETCH_TIMEOUT_MS = 6000;

function newSessionToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Hotel/street address field with Google Places Autocomplete (server proxy).
 * Falls back to plain text when Places is not configured or the server key
 * is referer-restricted (REQUEST_DENIED).
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
}) {
  const { t, i18n } = useTranslation();
  const [inputValue, setInputValue] = useState(String(value || ""));
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [placesConfigured, setPlacesConfigured] = useState(true);
  const sessionTokenRef = useRef(newSessionToken());
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

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
      if (q.length < MIN_QUERY_LENGTH || !placesConfigured) {
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
            language: lang,
            sessionToken: sessionTokenRef.current,
          }),
          signal: abort.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (
          body.configured === false ||
          body.unavailable === true ||
          body.success === false
        ) {
          setPlacesConfigured(false);
          setOptions([]);
          return;
        }
        setOptions(Array.isArray(body.predictions) ? body.predictions : []);
      } catch (err) {
        if (err?.name === "AbortError") {
          if (abortRef.current === abort) {
            setPlacesConfigured(false);
            setOptions([]);
          }
          return;
        }
        setPlacesConfigured(false);
        setOptions([]);
      } finally {
        clearTimeout(timeoutId);
        if (abortRef.current === abort) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [country, lang, placesConfigured, stopInFlight]
  );

  const scheduleFetch = useCallback(
    (text) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const q = String(text || "").trim();
      if (q.length < MIN_QUERY_LENGTH) {
        stopInFlight();
        setOptions([]);
        return;
      }
      debounceRef.current = setTimeout(() => fetchPredictions(text), 280);
    },
    [fetchPredictions, stopInFlight]
  );

  useEffect(() => {
    return () => {
      stopInFlight();
    };
  }, [stopInFlight]);

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
        if (body?.success && body.address) {
          setInputValue(body.address);
          if (onChange) onChange(body.address);
          if (onResolved) onResolved(body);
        } else if (prediction.description) {
          setInputValue(prediction.description);
          if (onChange) onChange(prediction.description);
          if (onResolved) {
            onResolved({
              success: false,
              address: prediction.description,
              outsideCity: null,
            });
          }
        }
      } catch {
        if (prediction.description) {
          setInputValue(prediction.description);
          if (onChange) onChange(prediction.description);
        }
      }
    },
    [lang, cityBias, country, companyId, carId, onChange, onResolved]
  );

  const fallbackHelper = useMemo(() => {
    if (helperText) return helperText;
    if (!placesConfigured) {
      return t("order.placesSearchUnavailable", {
        defaultValue: t("order.placesFallbackManual"),
      });
    }
    return "";
  }, [helperText, placesConfigured, t]);

  const manualField = (
    <TextField
      label={label}
      value={inputValue}
      onChange={(e) => {
        setInputValue(e.target.value);
        if (onChange) onChange(e.target.value);
      }}
      error={error}
      helperText={fallbackHelper}
      FormHelperTextProps={FormHelperTextProps}
      disabled={disabled}
      fullWidth
      size="small"
      variant="outlined"
      InputLabelProps={{ shrink: true }}
      sx={sx}
    />
  );

  if (!placesConfigured) {
    return manualField;
  }

  return (
    <Autocomplete
      freeSolo
      options={options}
      filterOptions={(x) => x}
      getOptionLabel={(opt) =>
        typeof opt === "string" ? opt : opt?.description || ""
      }
      inputValue={inputValue}
      value={null}
      loading={loading}
      disabled={disabled}
      onInputChange={(_, newInput, reason) => {
        if (reason === "reset") return;
        setInputValue(newInput);
        if (onChange) onChange(newInput);
        scheduleFetch(newInput);
      }}
      onChange={(_, newValue) => {
        if (newValue && typeof newValue === "object" && newValue.placeId) {
          resolvePlace(newValue);
        } else if (typeof newValue === "string") {
          setInputValue(newValue);
          if (onChange) onChange(newValue);
        }
      }}
      loadingText={t("order.placesSearching", { defaultValue: "Searching…" })}
      noOptionsText={
        String(inputValue || "").trim().length < MIN_QUERY_LENGTH
          ? t("order.placesKeepTyping", {
              defaultValue: "Type at least 3 characters.",
            })
          : t("order.placesNoMatches", {
              defaultValue: "No suggestions — type the address.",
            })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={fallbackHelper}
          FormHelperTextProps={FormHelperTextProps}
          InputLabelProps={{ shrink: true }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? (
                  <CircularProgress color="inherit" size={16} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      sx={sx}
      slotProps={{
        popper: { style: { zIndex: 1400 } },
      }}
    />
  );
}
