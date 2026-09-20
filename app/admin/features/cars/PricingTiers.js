import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Grid,
  Typography,
  CircularProgress,
  Box,
  Stack,
  TextField,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import debounce from "lodash/debounce";
import { seasons as fallbackSeasons } from "@utils/companyData";
import { updateCar } from "@utils/action";
import { useTranslation } from "react-i18next";
import {
  applyFlatDailyRateToPricingTiers,
  getFlatDailyRateFromPricingTiers,
} from "@/domain/orders/flatDailyRate";

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
  /** true, если в MongoDB company.useSeasons === false: одна цена / день */
  mirrorAllSeasonsFromNoSeason = false,
}) => {
  const [pendingUpdates, setPendingUpdates] = useState({});
  const [flatRateDraft, setFlatRateDraft] = useState("");
  const prices = isAddcar ? car?.pricingTiers || defaultPrices : car?.pricingTiers;
  const seasons = fallbackSeasons;
  const flatDailyRate = useMemo(
    () => getFlatDailyRateFromPricingTiers(prices),
    [prices]
  );

  /** При useSeasons=false в UI только одна цена; в car.pricingTiers все сезоны = копии */
  const rows = useMemo(() => buildRows(prices, seasons), [prices, seasons]);
  const dayKeys = useMemo(() => {
    const firstSeasonKey = Object.keys(prices || {})[0];
    if (!firstSeasonKey) return [];
    return Object.keys(prices?.[firstSeasonKey]?.days || {});
  }, [prices]);

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
    if (!mirrorAllSeasonsFromNoSeason) return;
    setFlatRateDraft(flatDailyRate ? String(flatDailyRate) : "");
  }, [mirrorAllSeasonsFromNoSeason, flatDailyRate, car?._id, open]);

  useEffect(() => {
    if (!open || !mirrorAllSeasonsFromNoSeason) return;
    const pt = isAddcar ? car?.pricingTiers || defaultPrices : car?.pricingTiers;
    if (!pt?.NoSeason?.days) return;
    const rate = getFlatDailyRateFromPricingTiers(pt);
    const normalized = applyFlatDailyRateToPricingTiers(pt, rate);
    if (JSON.stringify(pt) === JSON.stringify(normalized)) return;
    handleChange({
      target: {
        name: "pricingTiers",
        value: normalized,
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

  const handleFlatDailyRateChange = useCallback(
    (rawValue) => {
      setFlatRateDraft(rawValue);
      const parsed = parseFloat(rawValue);
      if (!Number.isFinite(parsed) || parsed < 0) return;

      setPendingUpdates((prev) => ({ ...prev, flatDaily: true }));

      const baseTiers = isAddcar
        ? car?.pricingTiers || defaultPrices
        : car?.pricingTiers || {};
      const nextTiers = applyFlatDailyRateToPricingTiers(baseTiers, parsed);
      const updatedCarData = {
        ...car,
        pricingTiers: nextTiers,
      };

      handleChange({
        target: { name: "pricingTiers", value: nextTiers },
      });
      if (!isAddcar) {
        debouncedUpdate(updatedCarData);
      } else {
        setPendingUpdates({});
      }
    },
    [car, debouncedUpdate, defaultPrices, handleChange, isAddcar]
  );

  const handlePricingTierChange = useCallback(
    (season, day, newPrice) => {
      setPendingUpdates((prev) => ({
        ...prev,
        [`${season}-${day}`]: true,
      }));

      const baseTiers = isAddcar ? car?.pricingTiers || defaultPrices : car?.pricingTiers || {};
      const prevSeasonBlock = baseTiers[season] || { days: {} };

      const nextTiers = {
        ...baseTiers,
        [season]: {
          ...prevSeasonBlock,
          days: {
            ...(prevSeasonBlock.days || {}),
            [day]: parseFloat(newPrice),
          },
        },
      };

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
    [car, debouncedUpdate, defaultPrices, handleChange, isAddcar]
  );

  const { t } = useTranslation();

  const columns = useMemo(() => {
    const seasonCols = [
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
  }, [dayKeys, pendingUpdates, t]);

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

  if (mirrorAllSeasonsFromNoSeason) {
    return (
      <Grid item xs={12}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ width: "100%" }}
        >
          <Typography
            variant="h6"
            component="span"
            sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {t("carPark.pricePerDay")}
          </Typography>
          <Box sx={{ position: "relative", maxWidth: 200, width: "100%" }}>
            <TextField
              type="number"
              size="small"
              fullWidth
              value={flatRateDraft}
              onChange={(e) => handleFlatDailyRateChange(e.target.value)}
              disabled={disabled}
              inputProps={{ min: 0, step: 1 }}
              InputProps={{
                endAdornment: pendingUpdates.flatDaily ? (
                  <CircularProgress size={18} />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    €
                  </Typography>
                ),
              }}
            />
          </Box>
        </Stack>
      </Grid>
    );
  }

  return (
    <Grid item xs={12}>
      <Typography variant="h6" gutterBottom>
        {t("carPark.prices")}
      </Typography>
      <DataGrid
        rows={rows}
        columns={columns}
        processRowUpdate={handleRowUpdate}
        disableRowSelectionOnClick
        loading={disabled}
        hideFooter
      />
    </Grid>
  );
};

export default PricingTiersTable;
