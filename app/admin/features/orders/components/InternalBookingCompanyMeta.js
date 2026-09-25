"use client";

import { useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Chip,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  COMPANY_NOTES_MAX_LENGTH,
  COMPANY_TAGS_MAX_COUNT,
  normalizeCompanyTags,
} from "@/domain/orders/companyInternalMeta";
import { isInternalBooking } from "@/domain/admin/rovaroContractorAdmin";

/**
 * Company-only notes + freeform tags for INTERNAL bookings.
 */
export default function InternalBookingCompanyMeta({
  order,
  disabled = false,
  onNotesChange,
  onTagsChange,
}) {
  const { t } = useTranslation();
  const [tagDraft, setTagDraft] = useState("");

  const visible = isInternalBooking(order);
  const tags = useMemo(
    () => normalizeCompanyTags(order?.companyTags),
    [order?.companyTags]
  );

  if (!visible) return null;

  return (
    <Box sx={{ mt: 1.25, mb: 0.5 }}>
      <Typography
        variant="caption"
        sx={{
          display: "block",
          fontWeight: 700,
          color: "text.secondary",
          mb: 0.75,
        }}
      >
        {t("order.companyMetaTitle")}
      </Typography>
      <Autocomplete
        multiple
        freeSolo
        options={[]}
        value={tags}
        inputValue={tagDraft}
        disabled={disabled}
        onInputChange={(_e, value) => setTagDraft(value)}
        onChange={(_e, value) => {
          onTagsChange?.(normalizeCompanyTags(value));
          setTagDraft("");
        }}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return (
              <Chip
                key={key}
                size="small"
                label={option}
                {...tagProps}
                sx={{ height: 22, fontSize: "0.7rem" }}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            label={t("order.companyTags")}
            placeholder={
              tags.length >= COMPANY_TAGS_MAX_COUNT
                ? ""
                : t("order.companyTagsPlaceholder")
            }
            helperText={t("order.companyTagsHelp")}
          />
        )}
        sx={{ mb: 1.25 }}
      />
      <TextField
        label={t("order.companyNotes")}
        value={order?.companyNotes ?? ""}
        onChange={(e) => onNotesChange?.(e.target.value)}
        disabled={disabled}
        multiline
        minRows={2}
        maxRows={6}
        fullWidth
        size="small"
        inputProps={{ maxLength: COMPANY_NOTES_MAX_LENGTH }}
        helperText={t("order.companyNotesHelp")}
      />
    </Box>
  );
}
