"use client";

import React from "react";
import {
  Button,
  Box,
  Typography,
  Slider,
  CircularProgress,
  Divider,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import DialogLayout from "@/app/components/ui/modals/DialogLayout";

/**
 * DiscountModal - Admin-only component for setting discount dates
 * Heavy date picker libraries are lazy-loaded only when modal opens
 * 
 * Location: admin/features/settings/ (admin-only bundle)
 * 
 * NOTE: DialogLayout.loading используется ТОЛЬКО для UX-действий (сохранение).
 * Lazy-loading библиотек обрабатывается внутренним placeholder в children.
 */
const DISCOUNT_SLIDER_MARKS = [0, 25, 50, 75, 100].map((value) => ({
  value,
  label: `${value}%`,
}));

export default function DiscountModal({
  open,
  onClose,
  selectedDiscount,
  setSelectedDiscount,
  discountStartDate,
  setDiscountStartDate,
  discountEndDate,
  setDiscountEndDate,
  onSave,
  discountActiveNow = false,
  discountHistory = [],
  activeDiscount = null,
}) {
  // Lazy load all date picker dependencies only when modal opens
  const [DatePicker, setDatePicker] = React.useState(null);
  const [LocalizationProvider, setLocalizationProvider] = React.useState(null);
  const [DateAdapter, setDateAdapter] = React.useState(null);
  const [locale, setLocale] = React.useState(null);
  const [dayjs, setDayjs] = React.useState(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = React.useState(false);

  React.useEffect(() => {
    if (open && !DatePicker && !LocalizationProvider) {
      // Load all date picker libraries only when modal opens for the first time
      Promise.all([
        // Используем DesktopDatePicker для компактного выпадающего календаря
        import("@mui/x-date-pickers/DesktopDatePicker").then((mod) => mod.DesktopDatePicker || mod.default),
        import("@mui/x-date-pickers/LocalizationProvider").then((mod) => mod.LocalizationProvider || mod.default),
        import("@mui/x-date-pickers/AdapterDayjs").then((mod) => mod.AdapterDayjs || mod.default),
        import("dayjs/locale/ru").then((mod) => mod.default || mod.ru),
        import("dayjs").then((mod) => mod.default),
      ])
        .then(([DatePickerComponent, LocalizationProviderComponent, adapter, ruLocale, dayjsLib]) => {
          // Проверяем, что все компоненты загружены
          if (DatePickerComponent && LocalizationProviderComponent && adapter && ruLocale && dayjsLib) {
            setDatePicker(() => DatePickerComponent);
            setLocalizationProvider(() => LocalizationProviderComponent);
            setDateAdapter(() => adapter);
            setLocale(ruLocale);
            setDayjs(() => dayjsLib);
          } else {
            console.error("Some date picker components failed to load:", {
              DatePickerComponent: !!DatePickerComponent,
              LocalizationProviderComponent: !!LocalizationProviderComponent,
              adapter: !!adapter,
              ruLocale: !!ruLocale,
              dayjs: !!dayjsLib,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to load date picker libraries:", err);
        });
    }
  }, [open, DatePicker, LocalizationProvider]);

  React.useEffect(() => {
    if (open) {
      setIsHistoryExpanded(false);
    }
  }, [open]);

  const isReady = DatePicker && LocalizationProvider && DateAdapter && locale && dayjs;

  const normalizeHistoryEntry = React.useCallback((entry, index) => {
    const type = entry?.type === "fixed" ? "fixed" : "percentage";
    const percentageValue = Number(entry?.value ?? entry?.discount ?? 0);
    const fixedValue = Number(entry?.value ?? entry?.amount ?? 0);
    const value = type === "fixed" ? fixedValue : percentageValue;
    const appliedAt = entry?.appliedAt || entry?.createdAt || entry?.updatedAt || null;
    const ts = appliedAt ? new Date(appliedAt).getTime() : NaN;
    return {
      ...entry,
      type,
      value: Number.isFinite(value) ? value : 0,
      appliedAt,
      __ts: Number.isFinite(ts) ? ts : null,
      __index: index,
      isActive: Boolean(entry?.isActive ?? entry?.active),
      source: entry?.source === "admin" ? "admin" : "system",
    };
  }, []);

  const sortedHistory = React.useMemo(() => {
    if (!Array.isArray(discountHistory) || discountHistory.length === 0) return [];
    return discountHistory
      .map((entry, index) => normalizeHistoryEntry(entry, index))
      .sort((a, b) => {
        if (a.__ts != null && b.__ts != null) return b.__ts - a.__ts;
        if (a.__ts != null) return -1;
        if (b.__ts != null) return 1;
        return b.__index - a.__index;
      });
  }, [discountHistory, normalizeHistoryEntry]);

  const resolvedActiveDiscount = React.useMemo(() => {
    if (activeDiscount) return normalizeHistoryEntry(activeDiscount, -1);
    if (!sortedHistory.length) return null;
    const activeEntries = sortedHistory.filter((entry) => entry.isActive);
    if (activeEntries.length === 0) return null;
    if (activeEntries.length > 1 && process.env.NODE_ENV === "development") {
      console.warn("[DiscountModal] Multiple active discounts found, using latest by appliedAt");
    }
    return activeEntries[0];
  }, [activeDiscount, sortedHistory, normalizeHistoryEntry]);

  const formatValue = React.useCallback((entry) => {
    if (!entry) return "—";
    if (entry.type === "fixed") return `€${Number(entry.value || 0)}`;
    return `${Number(entry.value || 0)}%`;
  }, []);

  const formatAppliedAt = React.useCallback((value) => {
    if (!value) return "—";
    const d = dayjs(value);
    return d.isValid() ? d.format("DD.MM.YYYY HH:mm") : "—";
  }, [dayjs]);

  return (
    <DialogLayout
      open={open}
      onClose={onClose}
      maxWidth="sm"
      title={`Выбор скидки: ${selectedDiscount}%`}
      showCloseButton={true}
      closeOnBackdropClick={false}
      closeOnEscape={false}
      // loading НЕ используется для lazy-import — только для UX-действий
      contentSx={{ minWidth: 350, pb: 3, pt: 3 }}
      sx={{
        "& .MuiDialog-paper": {
          minHeight: 400,
          minWidth: 350,
        },
      }}
    >
      {/* Внутренний placeholder пока библиотеки загружаются */}
      {!isReady ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 1,
              border: "1px solid",
              borderColor: resolvedActiveDiscount ? "success.main" : "divider",
              bgcolor: resolvedActiveDiscount ? alpha("#2e7d32", 0.08) : "transparent",
            }}
          >
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Активная скидка
            </Typography>
            <Typography variant="body2">
              {resolvedActiveDiscount
                ? `Активная скидка: ${formatValue(resolvedActiveDiscount)}`
                : "Скидка не применена"}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <LocalizationProvider dateAdapter={DateAdapter} adapterLocale={locale}>
            <Box sx={{ mb: 3, mt: 2 }}>
              <DatePicker
                label="Дата начала скидки"
                value={discountStartDate ? dayjs(discountStartDate) : null}
                disablePast
                minDate={dayjs()}
                onChange={(newValue) => {
                  if (!newValue) {
                    setDiscountStartDate(null);
                    return;
                  }
                  const d = newValue.toDate();
                  const today = new Date();
                  const todayStart = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                  );
                  if (d < todayStart) return;
                  setDiscountStartDate(d);
                  if (discountEndDate) {
                    const endLocal = new Date(
                      discountEndDate.getFullYear(),
                      discountEndDate.getMonth(),
                      discountEndDate.getDate()
                    );
                    if (endLocal <= d) setDiscountEndDate(null);
                  }
                }}
                format="DD.MM.YYYY"
                slotProps={{
                  textField: {
                    fullWidth: true,
                    margin: "normal",
                    sx: { mt: 2 },
                  },
                }}
              />
            </Box>
            <Box sx={{ mb: 3 }}>
              <DatePicker
                label="Дата окончания скидки"
                value={discountEndDate ? dayjs(discountEndDate) : null}
                disablePast
                minDate={
                  discountStartDate
                    ? dayjs(discountStartDate).add(1, "day")
                    : dayjs().add(1, "day")
                }
                onChange={(newValue) => {
                  if (!newValue) {
                    setDiscountEndDate(null);
                    return;
                  }
                  const d = newValue.toDate();
                  if (discountStartDate) {
                    const startLocal = new Date(
                      discountStartDate.getFullYear(),
                      discountStartDate.getMonth(),
                      discountStartDate.getDate()
                    );
                    if (d <= startLocal) return;
                  }
                  const today = new Date();
                  const todayStart = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate()
                  );
                  if (d <= todayStart) return;
                  setDiscountEndDate(d);
                }}
                format="DD.MM.YYYY"
                slotProps={{
                  textField: {
                    fullWidth: true,
                    margin: "normal",
                    sx: { mt: 2 },
                  },
                }}
              />
            </Box>
          </LocalizationProvider>

          <Box
            sx={(theme) => ({
              mt: 4,
              mb: 1,
              p: 2,
              borderRadius: 1,
              border: discountActiveNow
                ? `1px solid ${theme.palette.success.main}`
                : "1px solid transparent",
              bgcolor: discountActiveNow
                ? alpha(theme.palette.success.main, 0.1)
                : "transparent",
              transition: theme.transitions.create(
                ["border-color", "background-color"],
                { duration: theme.transitions.duration.short }
              ),
            })}
          >
            {discountActiveNow && (
              <Typography
                variant="caption"
                color="success.main"
                sx={{ display: "block", mb: 1.5, fontWeight: 600 }}
              >
                Скидка активна сегодня
              </Typography>
            )}
            <Typography gutterBottom sx={{ mb: 2 }}>
              Скидка на аренду (%):
            </Typography>
            <Slider
              value={selectedDiscount}
              onChange={(e, value) => setSelectedDiscount(value)}
              valueLabelDisplay="on"
              step={1}
              marks={DISCOUNT_SLIDER_MARKS}
              min={0}
              max={100}
              sx={{ width: "100%", mt: 1, maxWidth: 300 }}
            />
          </Box>

          <Box sx={{ mb: 1 }}>
            <Button
              size="small"
              variant="text"
              onClick={() => setIsHistoryExpanded((prev) => !prev)}
              sx={{ p: 0, minWidth: "auto", fontSize: "0.75rem", textTransform: "none" }}
            >
              {isHistoryExpanded
                ? "Скрыть историю скидок"
                : `История скидок (${sortedHistory.length})`}
            </Button>
          </Box>

          {isHistoryExpanded && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {sortedHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  История скидок пуста
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {sortedHistory.map((entry, idx) => (
                    <Box
                      key={entry?._id || entry?.id || idx}
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: entry.isActive ? "success.light" : "divider",
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {entry.type === "fixed" ? "Фиксированная скидка" : "% скидка"}: {formatValue(entry)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Когда: {formatAppliedAt(entry.appliedAt)}
                        {entry.appliedBy ? ` · Кем: ${entry.appliedBy}` : ""}
                        {` · Источник: ${entry.source}`}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        
          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
            <Button onClick={onClose}>Закрыть</Button>
            <Button variant="contained" onClick={onSave}>
              Сохранить
            </Button>
          </Box>
        </>
      )}
    </DialogLayout>
  );
}
