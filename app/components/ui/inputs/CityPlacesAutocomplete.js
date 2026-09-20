"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, CircularProgress, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  catalogCityOption,
  cityOptionLabel,
  mergeCityLookupOptions,
} from "@/domain/geo/cityLookupOptions";

function newSessionToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * City picker backed by the local city catalog plus Google Places
 * (`types=(cities)`), so any city worldwide resolves to lat/lon.
 *
 * `onSelect` receives `{ name, lat, lon, source }`, or `null` when cleared.
 */
export default function CityPlacesAutocomplete({
  label,
  placeholder,
  helperText,
  catalogCities = [],
  country,
  disabled = false,
  size = "small",
  onSelect,
  onError,
}) {
  const { t, i18n } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  // Typed text drives filtering/fetching; `inputValue` also holds the label of
  // the picked city, which must not narrow the list down to nothing.
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [placesConfigured, setPlacesConfigured] = useState(true);
  const [placesDown, setPlacesDown] = useState(false);
  const sessionTokenRef = useRef(newSessionToken());
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  const lang = (i18n.language || "en").split("-")[0];

  const catalogOptions = useMemo(
    () =>
      (Array.isArray(catalogCities) ? catalogCities : [])
        .map(catalogCityOption)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [catalogCities]
  );

  const options = useMemo(
    () =>
      mergeCityLookupOptions({ catalogOptions, predictions, query }),
    [catalogOptions, predictions, query]
  );

  const fetchPredictions = useCallback(
    async (text) => {
      const q = String(text || "").trim();
      if (q.length < 2 || !placesConfigured) {
        setPredictions([]);
        return;
      }
      if (abortRef.current) abortRef.current.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      setSearching(true);
      try {
        const res = await fetch("/api/public/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: q,
            types: "(cities)",
            country: country || undefined,
            language: lang,
            sessionToken: sessionTokenRef.current,
          }),
          signal: abort.signal,
        });
        if (res.status === 429) {
          // Keep whatever is on screen rather than flashing an empty state.
          setPlacesDown(true);
          return;
        }
        const body = await res.json().catch(() => ({}));
        if (body.configured === false) {
          setPlacesConfigured(false);
          setPlacesDown(true);
          setPredictions([]);
          return;
        }
        // A misconfigured / restricted key answers with success:false, which
        // must read as "search unavailable", not "no such city".
        setPlacesDown(body.success === false);
        setPredictions(Array.isArray(body.predictions) ? body.predictions : []);
      } catch (err) {
        if (err?.name === "AbortError") return;
        setPlacesDown(true);
        setPredictions([]);
      } finally {
        setSearching(false);
      }
    },
    [country, lang, placesConfigured]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const resolvePlace = useCallback(
    async (option) => {
      setResolving(true);
      try {
        const res = await fetch("/api/public/places/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            placeId: option.placeId,
            coordsOnly: true,
            language: lang,
            sessionToken: sessionTokenRef.current,
          }),
        });
        const body = await res.json().catch(() => ({}));
        sessionTokenRef.current = newSessionToken();
        if (body?.success && body.lat != null && body.lon != null) {
          onSelect?.({
            name: option.name,
            lat: body.lat,
            lon: body.lon,
            source: "places",
          });
          return;
        }
        onError?.(t("companyProfile.baseCityResolveFailed"));
      } catch {
        onError?.(t("companyProfile.baseCityResolveFailed"));
      } finally {
        setResolving(false);
      }
    },
    [lang, onSelect, onError, t]
  );

  const handleChange = (_event, value) => {
    setSelected(value);
    setInputValue(cityOptionLabel(value));
    setQuery("");
    if (!value) {
      onSelect?.(null);
      return;
    }
    if (value.source === "catalog") {
      onSelect?.({
        name: value.name,
        lat: value.coords.lat,
        lon: value.coords.lon,
        source: "catalog",
      });
      return;
    }
    resolvePlace(value);
  };

  const noOptionsText = searching
    ? t("companyProfile.baseCitySearching")
    : placesDown && query.trim().length >= 2
      ? t("companyProfile.baseCityPlacesOffline")
      : t("companyProfile.baseCityNoMatches");

  const busy = disabled || resolving;

  return (
    <Autocomplete
      size={size}
      options={options}
      value={selected}
      inputValue={inputValue}
      onInputChange={(_event, next, reason) => {
        if (reason === "reset") return;
        setInputValue(next);
        setQuery(next);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchPredictions(next), 280);
      }}
      onChange={handleChange}
      filterOptions={(x) => x}
      getOptionLabel={cityOptionLabel}
      isOptionEqualToValue={(a, b) => String(a?.id) === String(b?.id)}
      loading={searching}
      noOptionsText={noOptionsText}
      disabled={busy}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {searching || resolving ? (
                  <CircularProgress color="inherit" size={16} />
                ) : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      slotProps={{ popper: { style: { zIndex: 1400 } } }}
    />
  );
}
