"use client";

/**
 * Orders SEARCH_FIRST results by the quoted total for the requested range.
 * Changing it is an explicit customer action — the only thing besides a new
 * search that is allowed to reorder the list.
 */

import React from "react";
import { MenuItem, TextField, styled } from "@mui/material";
import { useTranslation } from "react-i18next";
import { SORT_OPTION } from "@/domain/booking/carResultSorting";

const SortField = styled(TextField)(({ theme }) => ({
  minWidth: theme.spacing(24),
  "& .MuiInputBase-input": {
    fontSize: theme.typography.body2.fontSize,
  },
}));

export default function CatalogSortControl({ value, onChange }) {
  const { t } = useTranslation();

  return (
    <SortField
      select
      size="small"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      label={t("catalog.booking.sortLabel", { defaultValue: "Sort by" })}
      inputProps={{ "data-testid": "catalog-sort" }}
    >
      <MenuItem value={SORT_OPTION.PRICE_ASC}>
        {t("catalog.booking.sortPriceAsc", {
          defaultValue: "Price: low to high",
        })}
      </MenuItem>
      <MenuItem value={SORT_OPTION.PRICE_DESC}>
        {t("catalog.booking.sortPriceDesc", {
          defaultValue: "Price: high to low",
        })}
      </MenuItem>
    </SortField>
  );
}
