"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  Chip,
  CircularProgress,
  TextField,
  Tooltip,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  catalogCityOption,
  foldCityText,
  matchesCityQuery,
  mergeCityLookupOptions,
} from "@/domain/geo/cityLookupOptions";
import { parseLatLon, haversineKm } from "@/domain/geo/haversineKm";
import { findCatalogCityByName } from "@/domain/geo/operatingCityCatalog";
import { insertComunaSearchOptions } from "@/domain/geo/spainCityComunas";
import { adminFieldSx } from "./AdminSettingsSection";

function newSessionToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function optionName(option) {
  if (!option) return "";
  if (typeof option === "string") return option.trim();
  return String(option.name || "").trim();
}

function optionIdentity(option) {
  if (option?.source === "comuna") {
    return String(option.id || `comuna:${foldCityText(optionName(option))}`);
  }
  return foldCityText(optionName(option));
}

function comunaOptionLabel(t, option) {
  const label = option?.labelKey
    ? t(`companyProfile.${option.labelKey}`)
    : t("companyProfile.comunaLabelGeneric");
  return t("companyProfile.comunaSearchRow", {
    city: optionName(option),
    label,
  });
}

/**
 * Searchable multi-select: platform catalog + Spain curated list + Places.
 * Value is a list of city name strings (deliveryPricing.operatingCities).
 */
export default function OperatingCitiesPicker({
  value = [],
  onChange,
  catalog = [],
  country,
  baseCoords = null,
  disabled = false,
  label,
  placeholder,
  helperText,
}) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [placesConfigured, setPlacesConfigured] = useState(true);
  const sessionTokenRef = useRef(newSessionToken());
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const lang = (i18n.language || "en").split("-")[0];

  const catalogOptions = useMemo(
    () =>
      (Array.isArray(catalog) ? catalog : [])
        .map((city) => {
          const withCoords = catalogCityOption(city);
          if (withCoords) return withCoords;
          const name = String(city?.name || "").trim();
          if (!name) return null;
          return {
            source: "catalog",
            id: String(city?._id || city?.slug || name),
            name,
            country: String(city?.country || "").trim(),
            secondaryText: String(city?.country || "").trim(),
            searchText: String(city?.searchText || "").trim(),
          };
        })
        .filter(Boolean),
    [catalog]
  );

  const options = useMemo(
    () =>
      insertComunaSearchOptions(
        mergeCityLookupOptions({
          catalogOptions,
          predictions,
          query,
          limit: 40,
        }),
        { query, country }
      ),
    [catalogOptions, predictions, query, country]
  );

  const selected = useMemo(() => {
    return (Array.isArray(value) ? value : [])
      .map((name) => {
        const match =
          catalogOptions.find(
            (option) =>
              option.source !== "comuna" &&
              foldCityText(option.name) === foldCityText(name)
          ) ||
          options.find(
            (option) =>
              option.source !== "comuna" &&
              foldCityText(option.name) === foldCityText(name)
          );
        return match || { source: "custom", id: name, name };
      })
      .filter((option) => optionName(option));
  }, [value, catalogOptions, options]);

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
        if (res.status === 429) return;
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

  const emitNames = (next) => {
    const seen = new Set();
    const names = [];
    for (const item of next || []) {
      const extras =
        item?.source === "comuna"
          ? [optionName(item), ...(item.towns || [])]
          : [optionName(item)];
      for (const name of extras) {
        const trimmed = String(name || "").trim();
        const key = foldCityText(trimmed);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        names.push(trimmed);
      }
    }
    onChange?.(names);
  };

  const origin = parseLatLon(baseCoords);

  return (
    <Autocomplete
      multiple
      freeSolo
      filterSelectedOptions
      options={options}
      value={selected}
      disabled={disabled}
      loading={searching}
      filterOptions={(opts, state) => {
        const needle = state.inputValue;
        return opts.filter(
          (option) =>
            option.source === "places" || matchesCityQuery(option, needle)
        );
      }}
      getOptionLabel={(option) =>
        option?.source === "comuna"
          ? comunaOptionLabel(t, option)
          : optionName(option)
      }
      isOptionEqualToValue={(a, b) => optionIdentity(a) === optionIdentity(b)}
      onInputChange={(_event, next, reason) => {
        if (reason === "reset") return;
        setQuery(next);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchPredictions(next), 280);
      }}
      onChange={(_event, next) => {
        setQuery("");
        emitNames(next);
      }}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => {
          const name = optionName(option);
          const city = findCatalogCityByName(catalog, name);
          const point = parseLatLon(city?.coords);
          const km = origin && point ? haversineKm(origin, point) : null;
          const { key, ...tagProps } = getTagProps({ index });
          const chip = (
            <Chip
              {...tagProps}
              size="small"
              label={name}
              sx={{ textTransform: "none" }}
            />
          );
          if (km == null) {
            return <span key={key}>{chip}</span>;
          }
          return (
            <Tooltip
              key={key}
              title={t("companyProfile.cityKmFromBase", { km: Math.round(km) })}
            >
              {chip}
            </Tooltip>
          );
        })
      }
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        if (option.source === "comuna") {
          return (
            <li key={key || option.id} {...rest}>
              {comunaOptionLabel(t, option)}
            </li>
          );
        }
        const point = parseLatLon(option.coords);
        const km = origin && point ? haversineKm(origin, point) : null;
        const extra =
          km != null
            ? `${Math.round(km)} km`
            : option.secondaryText || option.country || "";
        return (
          <li key={key || option.id} {...rest}>
            {option.name}
            {extra ? ` · ${extra}` : ""}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          helperText={helperText}
          sx={adminFieldSx}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {searching ? (
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
          : t("companyProfile.baseCityNoMatches")
      }
      slotProps={{ popper: { style: { zIndex: 1400 } } }}
    />
  );
}
