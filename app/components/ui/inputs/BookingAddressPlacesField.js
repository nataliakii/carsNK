"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";

const MIN_QUERY_LENGTH = 3;
const CLIENT_FETCH_TIMEOUT_MS = 12000;
/** Keep in sync with PLACES_DENIED_COOLDOWN_MS on the server. */
const PLACES_RETRY_MS = 15 * 1000;

function newSessionToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Hotel/street address field with Google Places Autocomplete (server proxy).
 *
 * Spain marketplace (`requireVerifiedPlace`): typed free-text is never enough.
 * When Places is missing or unavailable, show a clear recoverable message and
 * do not present a manual address path that looks bookable.
 *
 * Legacy Greece / admin flows may keep `allowManualFallback` (default true when
 * `requireVerifiedPlace` is false) for plain-text entry if the key is absent.
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
}) {
  const { t, i18n } = useTranslation();
  const [inputValue, setInputValue] = useState(String(value || ""));
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [placesConfigured, setPlacesConfigured] = useState(true);
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const [failReason, setFailReason] = useState("");
  const sessionTokenRef = useRef(newSessionToken());
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const retryRef = useRef(null);
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
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
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
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
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
        // Missing key → optional plain text only for legacy/manual flows.
        if (body.configured === false) {
          setPlacesConfigured(false);
          setSearchUnavailable(true);
          setFailReason(body.reason || "not_configured");
          setOptions([]);
          return;
        }
        if (body.unavailable || body.success === false) {
          setSearchUnavailable(true);
          setFailReason(String(body.reason || ""));
          setOptions([]);
          if (retryRef.current) clearTimeout(retryRef.current);
          retryRef.current = setTimeout(() => {
            retryRef.current = null;
            fetchPredictionsRef.current?.(q);
          }, PLACES_RETRY_MS);
          return;
        }
        setSearchUnavailable(false);
        setFailReason("");
        if (retryRef.current) {
          clearTimeout(retryRef.current);
          retryRef.current = null;
        }
        setOptions(Array.isArray(body.predictions) ? body.predictions : []);
      } catch (err) {
        if (err?.name === "AbortError") return;
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
  fetchPredictionsRef.current = fetchPredictions;

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
        } else if (prediction.description && !requireVerifiedPlace) {
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

  const unavailableMessage = useMemo(() => {
    if (
      process.env.NODE_ENV === "development" &&
      failReason === "referer_restricted"
    ) {
      return t("order.placesSearchRefererHint", {
        defaultValue:
          "Google blocked the server key (HTTP referrer restrictions do not work here). Use a server key with no referrer restriction, Places API enabled, and billing on.",
      });
    }
    return t("order.placesSearchUnavailable", {
      defaultValue:
        "Address search is temporarily unavailable. Please choose a company office or try again later.",
    });
  }, [failReason, t]);

  const fallbackHelper = useMemo(() => {
    if (helperText) return helperText;
    if (!placesConfigured || searchUnavailable) {
      if (requireVerifiedPlace || !manualFallbackAllowed) {
        return unavailableMessage;
      }
      if (
        process.env.NODE_ENV === "development" &&
        failReason === "referer_restricted"
      ) {
        return unavailableMessage;
      }
      return t("order.placesSearchUnavailable", {
        defaultValue: t("order.placesFallbackManual"),
      });
    }
    return "";
  }, [
    helperText,
    placesConfigured,
    searchUnavailable,
    requireVerifiedPlace,
    manualFallbackAllowed,
    unavailableMessage,
    failReason,
    t,
  ]);

  const blockedField = (
    <TextField
      label={label}
      value={inputValue}
      onChange={() => {}}
      error={error || requireVerifiedPlace}
      helperText={fallbackHelper}
      FormHelperTextProps={FormHelperTextProps}
      disabled
      fullWidth
      size="small"
      variant="outlined"
      InputLabelProps={{ shrink: true }}
      sx={sx}
    />
  );

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
    if (requireVerifiedPlace || !manualFallbackAllowed) {
      return blockedField;
    }
    return manualField;
  }

  if (requireVerifiedPlace && searchUnavailable) {
    return blockedField;
  }

  return (
    <Autocomplete
      freeSolo={!requireVerifiedPlace}
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
        // Typing without selecting a suggestion clears verified place binding.
        if (requireVerifiedPlace && onResolved) {
          onResolved({ success: false, placeId: "", address: newInput });
        }
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
      loadingText={t("order.placesSearching", { defaultValue: "Searching…" })}
      noOptionsText={
        String(inputValue || "").trim().length < MIN_QUERY_LENGTH
          ? t("order.placesKeepTyping", {
              defaultValue: "Type at least 3 characters.",
            })
          : t("order.placesNoMatches", {
              defaultValue: requireVerifiedPlace
                ? "No suggestions — choose a company office or try another address."
                : "No suggestions — type the address.",
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
