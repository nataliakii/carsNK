"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, CircularProgress, TextField } from "@mui/material";
import { useTranslation } from "react-i18next";
import { adminFieldSx } from "@/app/admin/shared/components/AdminSettingsSection";

function newSessionToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Street-address autocomplete via Places (`types=address`).
 * Falls back to a plain text field when the server key cannot call Places.
 */
export default function AddressPlacesAutocomplete({
  value = "",
  onChange,
  onResolved,
  country,
  disabled = false,
  label,
  placeholder,
  helperText,
}) {
  const { t, i18n } = useTranslation();
  const [inputValue, setInputValue] = useState(value || "");
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [placesConfigured, setPlacesConfigured] = useState(true);
  const sessionTokenRef = useRef(newSessionToken());
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const lang = (i18n.language || "en").split("-")[0];

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const fetchPredictions = useCallback(
    async (text) => {
      const q = String(text || "").trim();
      if (q.length < 3 || !placesConfigured) {
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
            types: "address",
            country: country || undefined,
            language: lang,
            sessionToken: sessionTokenRef.current,
          }),
          signal: abort.signal,
        });
        const body = await res.json().catch(() => ({}));
        if (body.configured === false) {
          setPlacesConfigured(false);
          setPredictions([]);
          return;
        }
        setPredictions(Array.isArray(body.predictions) ? body.predictions : []);
      } catch (err) {
        if (err?.name === "AbortError") return;
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

  const resolvePlace = async (option) => {
    if (!option?.placeId) return;
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
      if (body?.success && body.address) {
        onResolved?.({
          address: body.address,
          lat: body.lat != null ? String(body.lat) : "",
          lon: body.lon != null ? String(body.lon) : "",
        });
        return;
      }
      onChange?.(option.description || inputValue);
    } catch {
      onChange?.(option.description || inputValue);
    } finally {
      setResolving(false);
    }
  };

  const options = predictions.map((p) => ({
    id: p.placeId,
    placeId: p.placeId,
    description: p.description || p.mainText || "",
    secondaryText: p.secondaryText || "",
  }));

  return (
    <Autocomplete
      freeSolo
      options={options}
      value={null}
      inputValue={inputValue}
      disabled={disabled}
      loading={searching || resolving}
      filterOptions={(opts) => opts}
      getOptionLabel={(option) =>
        typeof option === "string" ? option : option.description || ""
      }
      isOptionEqualToValue={(a, b) => a?.placeId === b?.placeId}
      onInputChange={(_event, next, reason) => {
        if (reason === "reset") return;
        setInputValue(next);
        onChange?.(next);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchPredictions(next), 280);
      }}
      onChange={(_event, next) => {
        if (!next) return;
        if (typeof next === "string") {
          onChange?.(next);
          return;
        }
        setInputValue(next.description || "");
        resolvePlace(next);
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <li key={key || option.id} {...rest}>
            {option.description}
            {option.secondaryText ? ` · ${option.secondaryText}` : ""}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          helperText={
            helperText ||
            (!placesConfigured
              ? t("companyProfile.officePlacesOffline")
              : t("companyProfile.officeAddressHelp"))
          }
          sx={adminFieldSx}
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
      noOptionsText={
        searching
          ? t("companyProfile.baseCitySearching")
          : t("companyProfile.officeAddressNoMatches")
      }
      slotProps={{ popper: { style: { zIndex: 1400 } } }}
    />
  );
}
