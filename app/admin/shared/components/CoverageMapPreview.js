"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Link as MuiLink, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import "leaflet/dist/leaflet.css";
import { googleMapsSearchUrl } from "@/domain/orders/carOffices";
import { parseLatLon } from "@/domain/geo/haversineKm";
import { SPAIN_CITY_COORDS } from "@/domain/geo/spainCityCoords";
import {
  ROVARO_COVERAGE_MAGENTA,
  coverageMapBounds,
  featureDisplayName,
  featureKind,
  featuresForServiceAreas,
  loadSpainCoverageGeo,
  resolveCoverageCityPoints,
} from "@/domain/geo/spainCoverageGeo";
import { adminReadableTextSx } from "@/app/admin/shared/components/AdminSettingsSection";

const CITY_COLOR = ROVARO_COVERAGE_MAGENTA;
const OFFICE_COLOR = "#1F2A37";
const RADIUS_COLOR = "#3B6B8C";

function officeQuery(office) {
  if (!office) return null;
  return {
    name: office.name,
    address: office.address,
    lat: office.lat,
    lon: office.lon ?? office.lng,
  };
}

function primaryOffice(offices = []) {
  return (
    (offices || []).find(
      (office) =>
        String(office?.address || "").trim() ||
        (String(office?.lat || "").trim() &&
          String(office?.lon || office?.lng || "").trim())
    ) || offices[0]
  );
}

function legendItem(color, label, shape = "box") {
  return (
    <Stack direction="row" alignItems="center" gap={0.6} key={label}>
      <Box
        aria-hidden
        sx={{
          width: shape === "circle" ? 8 : 12,
          height: shape === "circle" ? 8 : 8,
          borderRadius: shape === "circle" ? "50%" : shape === "ring" ? "50%" : 0.4,
          bgcolor: shape === "ring" ? "transparent" : color,
          border: `2px solid ${color}`,
          opacity: shape === "box" ? 0.85 : 1,
          flexShrink: 0,
        }}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ lineHeight: 1.2, ...adminReadableTextSx }}
      >
        {label}
      </Typography>
    </Stack>
  );
}

export default function CoverageMapPreview({
  offices = [],
  radiusKm = null,
  cities = [],
  communityCodes = [],
  provinceCodes = [],
  catalog = [],
  compact = false,
}) {
  const { t } = useTranslation();
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);
  const leafletRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [geo, setGeo] = useState(null);

  const office = primaryOffice(offices);
  const officePoint = useMemo(
    () =>
      parseLatLon({
        lat: office?.lat,
        lon: office?.lon ?? office?.lng,
      }),
    [office?.lat, office?.lon, office?.lng]
  );
  const query = officeQuery(office);
  const mapsUrl = query ? googleMapsSearchUrl(query) : "";
  const radius =
    radiusKm === "" || radiusKm == null ? null : Number(radiusKm);
  const hasRadius = Number.isFinite(radius) && radius >= 0;
  const cityPoints = useMemo(
    () => resolveCoverageCityPoints(cities, catalog, SPAIN_CITY_COORDS),
    [cities, catalog]
  );

  useEffect(() => {
    let cancelled = false;
    loadSpainCoverageGeo()
      .then((loaded) => {
        if (!cancelled) {
          setGeo(loaded);
          setStatus((prev) => (prev === "error" ? prev : "ready"));
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return undefined;

    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || mapRef.current) return;
      const L = leaflet.default || leaflet;
      leafletRef.current = L;
      const map = L.map(host, {
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);
      const layers = L.layerGroup().addTo(map);
      mapRef.current = map;
      layersRef.current = layers;
      setStatus((prev) => (prev === "error" ? prev : "ready"));
      setTimeout(() => map.invalidateSize(), 80);
    })().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layersRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    const L = leafletRef.current;
    if (!map || !layers || !L) return;

    layers.clearLayers();
    const { communityFeatures, provinceFeatures } = featuresForServiceAreas(
      { communityCodes, provinceCodes },
      geo
    );

    const bindFeature = (feature, style) => {
      const layer = L.geoJSON(feature, { style, interactive: true });
      const name = featureDisplayName(feature);
      const kind =
        featureKind(feature) === "province"
          ? t("companyProfile.coverageMapKindProvince")
          : t("companyProfile.coverageMapKindCommunity");
      const label = name ? `${name} · ${kind}` : kind;
      layer.bindTooltip(label, { sticky: true });
      layer.bindPopup(label);
      layer.addTo(layers);
    };

    communityFeatures.forEach((feature) =>
      bindFeature(feature, {
        color: ROVARO_COVERAGE_MAGENTA,
        weight: 2,
        opacity: 0.9,
        fillColor: ROVARO_COVERAGE_MAGENTA,
        fillOpacity: 0.16,
      })
    );
    provinceFeatures.forEach((feature) =>
      bindFeature(feature, {
        color: "#C10042",
        weight: 2.4,
        opacity: 0.95,
        fillColor: ROVARO_COVERAGE_MAGENTA,
        fillOpacity: 0.28,
      })
    );

    if (hasRadius && officePoint) {
      L.circle([officePoint.lat, officePoint.lon], {
        radius: radius * 1000,
        color: RADIUS_COLOR,
        weight: 1.5,
        dashArray: "6 5",
        fillColor: RADIUS_COLOR,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(layers);
    }

    cityPoints.forEach((point) => {
      L.circleMarker([point.lat, point.lon], {
        radius: 6,
        color: "#fff",
        weight: 1.5,
        fillColor: CITY_COLOR,
        fillOpacity: 1,
      })
        .bindTooltip(point.name, { direction: "top" })
        .addTo(layers);
    });

    if (officePoint) {
      const icon = L.divIcon({
        className: "rovaro-office-marker",
        html: `<div style="width:16px;height:16px;border-radius:3px;background:${OFFICE_COLOR};border:2px solid #fff;box-shadow:0 0 0 1px ${OFFICE_COLOR}"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([officePoint.lat, officePoint.lon], { icon })
        .bindTooltip(t("companyProfile.coverageMapLegendOffice"), {
          direction: "top",
        })
        .addTo(layers);
    }

    const view = coverageMapBounds({
      communityCodes,
      provinceCodes,
      cityPoints,
      office: officePoint,
      radiusKm: hasRadius ? radius : null,
      geo,
    });
    if (view.bounds) {
      map.fitBounds(view.bounds, { padding: [28, 28], maxZoom: 11 });
    } else if (view.center) {
      map.setView([view.center.lat, view.center.lon], view.zoom || 11);
    }
    setTimeout(() => map.invalidateSize(), 50);
  }, [
    geo,
    communityCodes,
    provinceCodes,
    cityPoints,
    officePoint,
    hasRadius,
    radius,
    t,
  ]);

  const empty =
    !officePoint &&
    !cityPoints.length &&
    !communityCodes.length &&
    !provinceCodes.length;

  if (status === "error") {
    return (
      <Typography
        variant="body2"
        color="error"
        sx={{ ...adminReadableTextSx, lineHeight: 1.45 }}
      >
        {t("companyProfile.coverageMapError")}
      </Typography>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: compact ? 220 : 320,
          borderRadius: 1.5,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "grey.100",
        }}
      >
        {status === "loading" || !geo ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
              ...adminReadableTextSx,
            }}
          >
            {t("companyProfile.coverageMapLoading")}
          </Typography>
        ) : null}
        <Box ref={hostRef} sx={{ width: "100%", height: "100%" }} />
      </Box>
      {empty ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, ...adminReadableTextSx, lineHeight: 1.45 }}
        >
          {t("companyProfile.coverageMapUnavailable")}
        </Typography>
      ) : null}

      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1.25}
        alignItems="center"
        sx={{ mt: 1 }}
      >
        {legendItem(
          ROVARO_COVERAGE_MAGENTA,
          t("companyProfile.coverageMapLegendCovered")
        )}
        {legendItem(CITY_COLOR, t("companyProfile.coverageMapLegendCity"), "circle")}
        {legendItem(
          RADIUS_COLOR,
          t("companyProfile.coverageMapLegendRadius"),
          "ring"
        )}
        {legendItem(
          OFFICE_COLOR,
          t("companyProfile.coverageMapLegendOffice")
        )}
        {mapsUrl ? (
          <MuiLink
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              ml: { sm: "auto" },
              fontSize: "0.75rem",
              color: "text.secondary",
              fontWeight: 500,
              ...adminReadableTextSx,
            }}
          >
            {t("order.openInGoogleMaps")}
          </MuiLink>
        ) : null}
      </Stack>
    </Box>
  );
}
