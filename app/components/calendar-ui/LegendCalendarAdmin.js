import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  Stack,
  useTheme,
  Tooltip,
  ButtonBase,
  Popover,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { ORDER_COLORS, getOrderColorsForLegend, getOfflineHatchBackground } from "@/config/orderColors";
import { useMainContext } from "@app/Context";
import dynamic from "next/dynamic";

// ВАЖНО: Динамический импорт admin-only компонентов
// Это исключает их из public bundle (экономия ~50KB+)
const SettingsIcon = dynamic(() => import("@mui/icons-material/Settings"), { ssr: false });
const BufferSettingsModal = dynamic(
  () => import("@/app/admin/features/settings/BufferSettingsModal"),
  { ssr: false }
);

const TOOLBAR_LEGEND_DETAIL_BY_KEY = {
  PAID_AND_CLOSED: "Заказ завершён, оплачен и закрыт. Только просмотр.",
  CONFIRMED_CLIENT: "Клиентский заказ подтверждён. Приоритетный.",
  CONFIRMED_ADMIN: "Админский заказ (блокировка дат). Подтверждён.",
  OFFLINE: "Офлайн-бронь вне сайта. Блокирует даты, особая штриховка.",
  PENDING_CLIENT: "Клиентский заказ ожидает подтверждения.",
  PENDING_ADMIN: "Админский заказ (черновик). Ожидает подтверждения.",
};

const LEGEND_POPOVER_ID = "calendar-admin-legend-popover";

/**
 * Легенда календаря для админки и клиентской части
 * 
 * Для админки показывает 4 типа заказов:
 * 1. Подтверждён (клиент) — красный
 * 2. Подтверждён (внутр.) — горчичный
 * 3. Ожидает (клиент) — фиолетовый
 * 4. Ожидает (внутр.) — жёлтый
 * 
 * + Заблокированные pending (⛔)
 */
function LegendCalendarAdmin({
  client,
  showLegendItems = true,
  /** Только квадратики статусов; подписи в Tooltip (тулбар) */
  legendIconsOnly = false,
  showBufferControls = true,
  showDeliveryInfo = true,
  /** В Drawer настройки — показывать на всех ширинах экрана */
  inDrawer = false,
  /** В верхнем control bar — без фоновой карточки */
  inToolbar = false,
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { company } = useMainContext();
  const [bufferModalOpen, setBufferModalOpen] = useState(false);
  /** Свернута / развёрнута: в тулбаре = открыт popover; в блоке под календарем = inline-раскладка */
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const legendGroupRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarsePointer(Boolean(mq.matches));
    sync();
    if (mq.addEventListener) mq.addEventListener("change", sync);
    else if (mq.addListener) mq.addListener(sync);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", sync);
      else if (mq.removeListener) mq.removeListener(sync);
    };
  }, []);

  // Светлые цвета для тёмного фона
  const darkBgColors = theme.palette.backgroundDark1 || {};
  const primaryTextColor = inToolbar
    ? "rgba(255,255,255,0.9)"
    : darkBgColors.text || "#ffffff";
  const secondaryTextColor = inToolbar
    ? "rgba(255,255,255,0.66)"
    : darkBgColors.text || "#ffffff";

  const deliveryPrice =
    company?.deliveryPricePerKm != null && Number.isFinite(company.deliveryPricePerKm)
      ? company.deliveryPricePerKm
      : null;
  const bufferRaw = company?.bufferTime;
  const bufferLabel =
    typeof bufferRaw === "number" && Number.isFinite(bufferRaw)
      ? bufferRaw >= 24 && bufferRaw % 24 === 0
        ? `${bufferRaw / 24} day`
        : `${bufferRaw}h`
      : "—";

  const baseItemSx = {
    display: "inline-flex",
    alignItems: "center",
    gap: inToolbar ? 0.45 : 0.6,
    color: primaryTextColor,
    fontSize: inToolbar ? "0.72rem" : "0.75rem",
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    maxWidth: "100%",
  };

  const legendTooltipTitle = (label, tooltip) =>
    tooltip && String(tooltip).trim() ? `${label}: ${tooltip}` : label;

  // Компактный элемент легенды
  const CompactLegendItem = ({ color, label, tooltip, iconsOnly, hatch }) => {
    const title = legendTooltipTitle(label, tooltip);
    const swatch = (
      <Box
        component="span"
        sx={{
          width: iconsOnly ? 11 : 9,
          height: iconsOnly ? 11 : 9,
          minWidth: iconsOnly ? 11 : 9,
          borderRadius: iconsOnly ? "3px" : "2px",
          backgroundColor: hatch ? undefined : color,
          background: hatch ? getOfflineHatchBackground(color) : undefined,
          boxShadow: iconsOnly ? "0 0 0 1px rgba(255,255,255,0.12) inset" : "none",
        }}
      />
    );
    if (iconsOnly) {
      return (
        <Tooltip title={title} arrow>
          <Box
            sx={{
              ...baseItemSx,
              cursor: "help",
              px: 0.35,
              py: 0.35,
              borderRadius: 0.75,
              "&:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
            }}
          >
            {swatch}
          </Box>
        </Tooltip>
      );
    }
    return (
      <Tooltip title={tooltip || ""} arrow>
        <Box
          sx={{
            ...baseItemSx,
            cursor: tooltip ? "help" : "default",
          }}
        >
          {swatch}
          <Typography
            component="span"
            variant="caption"
            sx={{
              color: secondaryTextColor,
              fontSize: inToolbar ? "0.7rem" : "0.74rem",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </Typography>
        </Box>
      </Tooltip>
    );
  };

  // Полный элемент легенды (inline или внутри popover)
  const FullLegendItem = ({ color, label, tooltip, wrap = false, hatch = false }) => (
    <Tooltip title={tooltip || ""} arrow>
      <Box
        sx={{
          display: "flex",
          alignItems: wrap ? "flex-start" : "center",
          justifyContent: "flex-start",
          gap: 1,
          cursor: tooltip ? "help" : "default",
          py: wrap ? 0.35 : 0,
          minWidth: 0,
        }}
      >
        <Box
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 14,
            height: 14,
            minWidth: 14,
            backgroundColor: hatch ? undefined : color,
            background: hatch ? getOfflineHatchBackground(color) : undefined,
            borderRadius: "3px",
            flexShrink: 0,
            mt: wrap ? 0.2 : 0,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1) inset",
          }}
        />
        <Typography
          component="span"
          variant="body2"
          sx={{
            fontSize: "0.8125rem",
            color: darkBgColors.text || "#ffffff",
            fontWeight: 500,
            whiteSpace: wrap ? "normal" : "nowrap",
            wordBreak: wrap ? "break-word" : "normal",
            lineHeight: wrap ? 1.35 : 1.2,
            flex: wrap ? "1 1 auto" : "none",
            minWidth: 0,
          }}
        >
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );

  const rowDisplay = inDrawer || inToolbar ? "flex" : { xs: "none", sm: "flex" };
  const compactLegendItems = client
    ? [
        {
          key: "client-confirmed",
          color: ORDER_COLORS.CONFIRMED_CLIENT.main,
          label: t("order.unavailable-dates"),
          tooltip: "Эти даты уже забронированы",
        },
      ]
    : [
        {
          key: "paid-and-closed",
          color: ORDER_COLORS.PAID_AND_CLOSED.main,
          label: "Closed",
          tooltip: "Заказ завершён, оплачен и закрыт. Только просмотр.",
        },
        {
          key: "confirmed-client",
          color: ORDER_COLORS.CONFIRMED_CLIENT.main,
          label: "Client",
          tooltip: "Клиентский заказ подтверждён. Приоритетный.",
        },
        {
          key: "confirmed-admin",
          color: ORDER_COLORS.CONFIRMED_ADMIN.main,
          label: "Admin",
          tooltip: "Админский заказ (блокировка дат). Подтверждён.",
        },
        {
          key: "offline",
          color: ORDER_COLORS.OFFLINE.main,
          hatch: true,
          label: "Offline",
          tooltip: "Офлайн-бронь вне сайта. Блокирует даты.",
        },
        {
          key: "pending-client",
          color: ORDER_COLORS.PENDING_CLIENT.main,
          label: "Pending",
          tooltip: "Клиентский заказ ожидает подтверждения.",
        },
        {
          key: "pending-admin",
          color: ORDER_COLORS.PENDING_ADMIN.main,
          label: "Pending Admin",
          tooltip: "Админский заказ (черновик). Ожидает подтверждения.",
        },
      ];

  const toolbarInfoOnly = inToolbar && !showLegendItems;
  const useIconOnlyLegend = Boolean(
    inToolbar && showLegendItems && legendIconsOnly
  );
  const toolbarInteractiveLegend = Boolean(useIconOnlyLegend && !client);
  const toolbarLegendRows = toolbarInteractiveLegend
    ? getOrderColorsForLegend().map((oc) => ({
        key: oc.key,
        color: oc.main,
        hatch: Boolean(oc.hatch),
        hoverTitle: oc.label,
        label: oc.label,
        detailTooltip: TOOLBAR_LEGEND_DETAIL_BY_KEY[oc.key] || "",
      }))
    : [];

  return (
    <Stack
      display={rowDisplay}
      width={useIconOnlyLegend ? "auto" : "100%"}
      maxWidth={useIconOnlyLegend ? "100%" : undefined}
      spacing={inToolbar ? 0.5 : 0.9}
      sx={{
        py: inToolbar ? 0 : 0.7,
        px: inToolbar ? 0 : 1.25,
        backgroundColor: inToolbar
          ? "transparent"
          : theme.palette.backgroundDark1?.bg || "#1a1a1a",
        borderRadius: inToolbar ? 0 : 1.25,
        boxShadow: inToolbar ? "none" : "0 2px 8px rgba(0, 0, 0, 0.25)",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent={toolbarInfoOnly ? "center" : "space-between"}
        flexWrap="wrap"
        sx={{
          columnGap: useIconOnlyLegend ? 0.5 : inToolbar ? 0.95 : 1.25,
          rowGap: inToolbar ? 0.35 : 0.6,
        }}
      >
        {/* LEFT: compact legend */}
        {showLegendItems && toolbarInteractiveLegend ? (
          <>
            <ButtonBase
              ref={legendGroupRef}
              id="calendar-admin-legend-trigger"
              component="div"
              aria-label="Легенда статусов заказов. Открыть полный список."
              aria-expanded={legendExpanded}
              aria-haspopup="dialog"
              aria-controls={LEGEND_POPOVER_ID}
              onClick={() => setLegendExpanded((open) => !open)}
              disableRipple
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.45,
                minWidth: 0,
                maxWidth: "100%",
                flexWrap: "nowrap",
                py: 0.35,
                px: 0.55,
                borderRadius: 1,
                border: "1px solid rgba(255,255,255,0.14)",
                backgroundColor: "rgba(255,255,255,0.03)",
                color: "inherit",
                textAlign: "left",
                cursor: "pointer",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.22)",
                },
                "&.Mui-focusVisible": {
                  outline: "2px solid rgba(255,255,255,0.55)",
                  outlineOffset: 1,
                },
              }}
            >
              {toolbarLegendRows.map((item) => (
                <Tooltip
                  key={item.key}
                  title={item.hoverTitle}
                  arrow
                  disableHoverListener={coarsePointer}
                  disableFocusListener={coarsePointer}
                  disableTouchListener
                >
                  <Box
                    component="span"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 11,
                      height: 11,
                      minWidth: 11,
                      borderRadius: "3px",
                      backgroundColor: item.hatch ? undefined : item.color,
                      background: item.hatch
                        ? getOfflineHatchBackground(item.color)
                        : undefined,
                      boxShadow: "0 0 0 1px rgba(255,255,255,0.12) inset",
                      pointerEvents: coarsePointer ? "none" : "auto",
                    }}
                  />
                </Tooltip>
              ))}
            </ButtonBase>
            <Popover
              id={LEGEND_POPOVER_ID}
              open={legendExpanded}
              anchorEl={legendGroupRef.current}
              onClose={() => setLegendExpanded(false)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              disableRestoreFocus
              slotProps={{
                paper: {
                  sx: {
                    p: 1.25,
                    maxWidth: "min(calc(100vw - 16px), 340px)",
                    maxHeight: "min(70vh, 360px)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "8px",
                    bgcolor: "#2e2e2e",
                    color: "rgba(255,255,255,0.92)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "0 6px 16px rgba(0,0,0,0.22)",
                  },
                },
              }}
            >
              <Box
                component="div"
                role="dialog"
                aria-label="Легенда статусов заказов"
                sx={{
                  overflowY: "auto",
                  overflowX: "hidden",
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 1,
                  rowGap: 0.75,
                  maxWidth: "100%",
                  pr: 0.25,
                }}
              >
                {toolbarLegendRows.map((item) => (
                  <Box
                    key={`pop-${item.key}`}
                    sx={{
                      flex: "1 1 140px",
                      minWidth: 0,
                      maxWidth: "100%",
                    }}
                  >
                    <FullLegendItem
                      color={item.color}
                      label={item.label}
                      tooltip={item.detailTooltip}
                      wrap
                    />
                  </Box>
                ))}
              </Box>
            </Popover>
          </>
        ) : showLegendItems ? (
          <Stack
            direction="row"
            alignItems="center"
            flexWrap="wrap"
            sx={{
              columnGap: useIconOnlyLegend ? 0.35 : 1.1,
              rowGap: 0.45,
              minWidth: 0,
            }}
          >
            {compactLegendItems.map((item) => (
              <CompactLegendItem
                key={item.key}
                color={item.color}
                hatch={item.hatch}
                label={item.label}
                tooltip={item.tooltip}
                iconsOnly={useIconOnlyLegend}
              />
            ))}
            {!client && (
              <Tooltip title={legendExpanded ? "Свернуть легенду" : "Раскрыть легенду"} arrow>
                <ButtonBase
                  onClick={() => setLegendExpanded((v) => !v)}
                  sx={{
                    ...baseItemSx,
                    fontWeight: 600,
                    px: useIconOnlyLegend ? 0.35 : 0.5,
                    py: useIconOnlyLegend ? 0.35 : undefined,
                    minWidth: useIconOnlyLegend ? 28 : undefined,
                    minHeight: useIconOnlyLegend ? 28 : undefined,
                    borderRadius: 0.8,
                    justifyContent: "center",
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.06)" },
                  }}
                >
                  {!useIconOnlyLegend ? (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ color: "inherit", fontSize: "0.74rem" }}
                    >
                      Legend
                    </Typography>
                  ) : null}
                  <Typography
                    component="span"
                    sx={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                    aria-hidden
                  >
                    {legendExpanded ? "⌃" : "⌄"}
                  </Typography>
                </ButtonBase>
              </Tooltip>
            )}
          </Stack>
        ) : null}

        {/* RIGHT: buffer + delivery */}
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          justifyContent={toolbarInfoOnly ? "center" : "flex-end"}
          sx={{
            columnGap: 0.75,
            rowGap: 0.45,
            minWidth: 0,
            ...(toolbarInfoOnly ? { ml: 0 } : { ml: "auto" }),
          }}
        >
          {showBufferControls && (
            <Tooltip
              title={`Буфер между заказами: ${
                company?.bufferTime != null ? `${company.bufferTime} ч.` : "—"
              } (нажмите для изменения)`}
              arrow
            >
              <ButtonBase
                onClick={() => setBufferModalOpen(true)}
                sx={{
                  ...baseItemSx,
                  px: inToolbar ? 0.5 : 0.7,
                  py: inToolbar ? 0.15 : 0.25,
                  borderRadius: 0.9,
                  color: inToolbar
                    ? "rgba(255,255,255,0.78)"
                    : theme.palette.secondary.light,
                  maxWidth: { xs: "100%", sm: "180px" },
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.06)",
                    color: inToolbar
                      ? "rgba(255,255,255,0.94)"
                      : theme.palette.secondary.main,
                  },
                }}
              >
                <Typography component="span" sx={{ fontSize: "0.8rem", lineHeight: 1 }}>
                  ⏱
                </Typography>
                <Typography
                  component="span"
                  variant="caption"
                  sx={{
                    color: "inherit",
                    fontSize: inToolbar ? "0.71rem" : "0.74rem",
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Buffer: {bufferLabel}
                </Typography>
                <SettingsIcon sx={{ fontSize: 14, color: "inherit" }} />
              </ButtonBase>
            </Tooltip>
          )}

          {showDeliveryInfo && (
            <Tooltip title="Тариф доставки за километр" arrow>
              <Typography
                variant="caption"
                sx={{
                  ...baseItemSx,
                  color: inToolbar
                    ? "rgba(255,255,255,0.72)"
                    : theme.palette.secondary.light,
                  fontWeight: 600,
                  px: inToolbar ? 0.45 : 0.6,
                  py: inToolbar ? 0.15 : 0.25,
                  borderRadius: 0.8,
                  maxWidth: { xs: "100%", sm: "150px" },
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <Box component="span" sx={{ fontSize: "0.8rem", lineHeight: 1 }}>
                  🚚
                </Box>
                <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {deliveryPrice != null ? `${deliveryPrice} €/км` : "— €/км"}
                </Box>
              </Typography>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {/* Развёрнутая легенда под строкой (не тулбар с popover) */}
      {!client &&
        showLegendItems &&
        legendExpanded &&
        !toolbarInteractiveLegend && (
        <Stack
          direction="row"
          flexWrap="wrap"
          sx={{
            columnGap: 1.25,
            rowGap: 0.65,
            pt: 0.35,
            maxWidth: 340,
            width: "100%",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <FullLegendItem
            color={ORDER_COLORS.PAID_AND_CLOSED.main}
            label={ORDER_COLORS.PAID_AND_CLOSED.label}
            tooltip="Заказ завершён, оплачен и закрыт. Только просмотр."
            wrap
          />
          <FullLegendItem
            color={ORDER_COLORS.CONFIRMED_CLIENT.main}
            label={ORDER_COLORS.CONFIRMED_CLIENT.label}
            tooltip="Клиентский заказ подтверждён. Приоритетный."
            wrap
          />
          <FullLegendItem
            color={ORDER_COLORS.CONFIRMED_ADMIN.main}
            label={ORDER_COLORS.CONFIRMED_ADMIN.label}
            tooltip="Админский заказ (блокировка дат). Подтверждён."
            wrap
          />
          <FullLegendItem
            color={ORDER_COLORS.OFFLINE.main}
            label={ORDER_COLORS.OFFLINE.label}
            tooltip="Офлайн-бронь вне сайта. Блокирует даты."
            hatch
            wrap
          />
          <FullLegendItem
            color={ORDER_COLORS.PENDING_CLIENT.main}
            label={ORDER_COLORS.PENDING_CLIENT.label}
            tooltip="Клиентский заказ ожидает подтверждения."
            wrap
          />
          <FullLegendItem
            color={ORDER_COLORS.PENDING_ADMIN.main}
            label={ORDER_COLORS.PENDING_ADMIN.label}
            tooltip="Админский заказ (черновик). Ожидает подтверждения."
            wrap
          />
        </Stack>
      )}

      {/* Модальное окно настроек буфера */}
      <BufferSettingsModal
        open={bufferModalOpen}
        onClose={() => setBufferModalOpen(false)}
      />
    </Stack>
  );
}

export default LegendCalendarAdmin;
