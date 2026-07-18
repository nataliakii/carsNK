import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Grid, Typography, CircularProgress, Box, Stack } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import debounce from "lodash/debounce";
import { seasons as fallbackSeasons } from "@utils/companyData";
import { updateCar } from "@utils/action";
import { useTranslation } from "react-i18next";

/** Сезоны, которые при отключённых сезонах в компании копируют цены из NoSeason */
const OTHER_SEASON_KEYS = ["LowSeason", "LowUpSeason", "MiddleSeason", "HighSeason"];

function copyNoSeasonDaysToAll(pricingTiers) {
  const pt = pricingTiers && typeof pricingTiers === "object" ? { ...pricingTiers } : {};
  const noDays = pt.NoSeason?.days;
  if (!noDays || typeof noDays !== "object") return pt;
  const daysCopy = {};
  for (const [k, v] of Object.entries(noDays)) {
    daysCopy[k] = typeof v === "number" ? v : parseFloat(v) || 0;
  }
  for (const s of OTHER_SEASON_KEYS) {
    pt[s] = { ...(pt[s] || {}), days: { ...daysCopy } };
  }
  return pt;
}

function otherSeasonsMatchNoSeason(pricingTiers) {
  if (!pricingTiers?.NoSeason?.days) return true;
  const ref = JSON.stringify(pricingTiers.NoSeason.days);
  return OTHER_SEASON_KEYS.every((s) => JSON.stringify(pricingTiers[s]?.days) === ref);
}

const getSeasonDates = (season, seasons) => {
  const dates = seasons[season];
  return dates
    ? `${dates.start} - ${dates.end}`
    : `Season "${season}" not found`;
};

const buildRows = (prices, seasons) => {
  if (!prices) return [];

  return Object.entries(prices).map(([season, pricing]) => {
    const row = {
      id: season,
      season,
      seasonDates: getSeasonDates(season, seasons),
    };

    for (const [day, value] of Object.entries(pricing?.days || {})) {
      row[`days${day}`] = value || 0;
    }

    return row;
  });
};

const PricingTiersTable = ({
  car = {},
  handleChange,
  disabled,
  isAddcar = false,
  defaultPrices = {},
  /** Modal open — для однократной синхронизации при открытии */
  open = true,
  /** true, если в MongoDB company.useSeasons === false: все сезоны = NoSeason */
  mirrorAllSeasonsFromNoSeason = false,
}) => {
  const [pendingUpdates, setPendingUpdates] = useState({});
  const prices = isAddcar ? car?.pricingTiers || defaultPrices : car?.pricingTiers;
  const seasons = fallbackSeasons;
  /** При useSeasons=false в UI только NoSeason; в car.pricingTiers по-прежнему все сезоны (копии) */
  const rows = useMemo(() => {
    if (mirrorAllSeasonsFromNoSeason && prices?.NoSeason) {
      return buildRows({ NoSeason: prices.NoSeason }, seasons);
    }
    return buildRows(prices, seasons);
  }, [prices, seasons, mirrorAllSeasonsFromNoSeason]);
  const dayKeys = useMemo(() => {
    if (mirrorAllSeasonsFromNoSeason && prices?.NoSeason?.days) {
      return Object.keys(prices.NoSeason.days);
    }
    const firstSeasonKey = Object.keys(prices || {})[0];
    if (!firstSeasonKey) return [];
    return Object.keys(prices?.[firstSeasonKey]?.days || {});
  }, [prices, mirrorAllSeasonsFromNoSeason]);

  const debouncedUpdate = useMemo(
    () =>
      debounce(async (updatedCarData) => {
        try {
          await updateCar(updatedCarData);
          setPendingUpdates({});
        } catch (error) {
          console.error("Failed to update car:", error);
        }
      }, 1000),
    []
  );
  useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);

  useEffect(() => {
    if (!open || !mirrorAllSeasonsFromNoSeason) return;
    const pt = isAddcar ? car?.pricingTiers || defaultPrices : car?.pricingTiers;
    if (!pt?.NoSeason?.days) return;
    if (otherSeasonsMatchNoSeason(pt)) return;
    handleChange({
      target: {
        name: "pricingTiers",
        value: copyNoSeasonDaysToAll(pt),
      },
    });
  }, [
    open,
    mirrorAllSeasonsFromNoSeason,
    isAddcar,
    car?._id,
    car?.pricingTiers,
    defaultPrices,
    handleChange,
  ]);

  const handlePricingTierChange = useCallback(
    (season, day, newPrice) => {
      if (mirrorAllSeasonsFromNoSeason && season !== "NoSeason") {
        return;
      }

      setPendingUpdates((prev) => ({
        ...prev,
        [`${season}-${day}`]: true,
      }));

      const baseTiers = isAddcar ? car?.pricingTiers || defaultPrices : car?.pricingTiers || {};
      const prevSeasonBlock = baseTiers[season] || { days: {} };

      let nextTiers = {
        ...baseTiers,
        [season]: {
          ...prevSeasonBlock,
          days: {
            ...(prevSeasonBlock.days || {}),
            [day]: parseFloat(newPrice),
          },
        },
      };

      if (mirrorAllSeasonsFromNoSeason && season === "NoSeason") {
        nextTiers = copyNoSeasonDaysToAll(nextTiers);
      }

      const updatedCarData = {
        ...car,
        pricingTiers: nextTiers,
      };

      handleChange({
        target: { name: "pricingTiers", value: updatedCarData.pricingTiers },
      });
      if (!isAddcar) {
        debouncedUpdate(updatedCarData);
      } else {
        setPendingUpdates({});
      }
    },
    [
      car,
      debouncedUpdate,
      defaultPrices,
      handleChange,
      isAddcar,
      mirrorAllSeasonsFromNoSeason,
    ]
  );

  const { t } = useTranslation();

  const columns = useMemo(() => {
    const seasonCols = mirrorAllSeasonsFromNoSeason
      ? []
      : [
          { field: "season", headerName: t("carPark.season"), width: 150 },
          {
            field: "seasonDates",
            headerName: t("carPark.seasonDat"),
            width: 200,
          },
        ];
    const dayCols = dayKeys.map((dayKey) => {
      const dayNumber = Number(dayKey);
      return {
        field: `days${dayKey}`,
        headerName:
          dayNumber <= 5
            ? t("carPark.1-4days")
            : dayNumber <= 7
            ? t("carPark.5-14days")
            : t("carPark.14+days"),
        type: "number",
        width: 120,
        flex: mirrorAllSeasonsFromNoSeason ? 1 : undefined,
        minWidth: 100,
        editable: true,
        renderCell: (params) => {
          const isUpdating = pendingUpdates[`${params.row.season}-${dayKey}`];
          return (
            <Box sx={{ position: "relative", opacity: isUpdating ? 0.5 : 1 }}>
              {params.value}
              {isUpdating && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CircularProgress size={20} />
                </Box>
              )}
            </Box>
          );
        },
      };
    });
    return [...seasonCols, ...dayCols];
  }, [dayKeys, mirrorAllSeasonsFromNoSeason, pendingUpdates, t]);

  const handleRowUpdate = useCallback(
    (newRow, oldRow) => {
      for (const dayKey of dayKeys) {
        const field = `days${dayKey}`;
        if (newRow[field] !== oldRow[field]) {
          handlePricingTierChange(newRow.season, dayKey, newRow[field]);
        }
      }
      return newRow;
    },
    [dayKeys, handlePricingTierChange]
  );

  /** Компактный режим: высота строк данных −25% (типичный rowHeight DataGrid ≈ 52px) */
  const compactRowHeight = Math.round(52 * 0.75);

  const dataGrid = (
    <DataGrid
      rows={rows}
      columns={columns}
      processRowUpdate={handleRowUpdate}
      isCellEditable={(params) => {
        if (!mirrorAllSeasonsFromNoSeason) return true;
        return String(params.field || "").startsWith("days");
      }}
      disableRowSelectionOnClick
      loading={disabled}
      hideFooter
      autoHeight={mirrorAllSeasonsFromNoSeason}
      rowHeight={mirrorAllSeasonsFromNoSeason ? compactRowHeight : undefined}
      sx={mirrorAllSeasonsFromNoSeason ? { width: "100%" } : undefined}
    />
  );

  return (
    <Grid item xs={12}>
      {mirrorAllSeasonsFromNoSeason ? (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "flex-start" }}
          sx={{ width: "100%" }}
        >
          <Typography
            variant="h6"
            component="span"
            sx={{ flexShrink: 0, pt: { sm: 0.5 }, whiteSpace: "nowrap" }}
          >
            {t("carPark.prices")}
          </Typography>
          <Box
            sx={{
              flex: { sm: "0 0 27.5%" },
              width: { xs: "100%", sm: "27.5%" },
              maxWidth: { sm: "27.5%" },
              minWidth: 0,
            }}
          >
            {dataGrid}
          </Box>
        </Stack>
      ) : (
        <>
          <Typography variant="h6" gutterBottom>
            {t("carPark.prices")}
          </Typography>
          {dataGrid}
        </>
      )}
    </Grid>
  );
};

export default PricingTiersTable;
