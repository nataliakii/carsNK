import React, { useState, useRef } from "react";
import { styled, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  Paper,
  Box,
  Typography,
  Stack,
  Divider,
  Chip,
  IconButton,
  Collapse,
  Button,
} from "@mui/material";
import { styled as muiStyled } from "@mui/material/styles";
// Стили для заголовка автомобиля (как в CarDetails)
const CarTitle = muiStyled(Typography)(({ theme }) => ({
  fontSize: "1.5rem",
  textTransform: "uppercase",
  fontWeight: 700,
  marginBottom: theme.spacing(1.7),
  marginTop: theme.spacing(2.5),
  width: "100%",
  textAlign: "center",
  // уменьшенный отступ сверху для горизонтальных телефонов
  ["@media (max-width:900px) and (orientation: landscape)"]: {
    marginTop: theme.spacing(0.5),
    fontSize: "1.35rem",
  },
  // компактнее по вертикали на телефоне в портрете (размер шрифта как у базового 1.5rem)
  ["@media (max-width:600px) and (orientation: portrait)"]: {
    marginTop: theme.spacing(0.75),
    marginBottom: theme.spacing(0.5),
  },
}));
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import SpeedIcon from "@mui/icons-material/Speed";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { lazy, Suspense } from "react";
import { fetchCar } from "@utils/action";
import { fetchOrdersByCar } from "@utils/action";
import TimeToLeaveIcon from "@mui/icons-material/TimeToLeave";
import { useMainContext } from "@app/Context";
import { useCompanyBookingLocations } from "@/app/hooks/useCompanyBookingLocations";
import {
  resolveCatalogPlaceOptions,
} from "@/domain/orders/catalogPlaceOptions";
import { getSiteCountryCode } from "@config/siteCountry";

// Lazy load тяжелых компонентов для улучшения производительности
const BookingModal = lazy(() => import("./BookingModal"));
const CalendarPicker = lazy(() => import("./CalendarPicker"));
const PricingTiers = lazy(() => import("@app/components/CarComponent/PricingTiers"));
const CarDetails = lazy(() => import("./CarDetails"));
const CarDetailsModal = lazy(() => import("./CarDetailsModal"));
const CarDeliveryInfo = lazy(() => import("./CarDeliveryInfo"));

import { useTranslation } from "react-i18next";
import CarPhoto from "./CarPhoto";
import CarCitiesSummary from "./CarCitiesSummary";
import { resolveCarOperatingZones } from "@/domain/cars/carOperatingZones";
import { useSnackbar } from "notistack";

// ДОБАВИТЬ ЭТУ СТРОКУ:
import dayjs from "dayjs";

/**
 * Client-side slug for car link when DB slug is missing (e.g. cached API response).
 * Must match utils/slugCar.js generateSlugBase so links work before cache refresh.
 */
function getSlugFromCar(car) {
  if (!car) return "";
  const model = car.model ? String(car.model).trim() : "";
  const transmission = car.transmission ? String(car.transmission).trim() : "";
  const parts = [];
  if (model) parts.push(model);
  if (transmission && !model.toLowerCase().includes(transmission.toLowerCase())) {
    parts.push(transmission);
  }
  const raw = parts.join(" ");
  if (!raw) return "car";
  const normalized = raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const slug = normalized.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug || "car";
}

const StyledCarItem = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(0.5), // Уменьшили с 1 до 0.5
  marginLeft: 2,
  width: "100%",
  maxWidth: 400,
  minWidth: 0,
  boxSizing: "border-box",
  zIndex: 22,
  display: "flex",
  justifyContent: "center",
  backgroundColor: "#fff",
  alignItems: "center",
  alignContent: "center",
  flexDirection: "column",
  boxShadow: theme.shadows[4],
  transition: "transform 0.3s",
  overflow: "visible",
  "&:hover": {
    transform: "scale(1.02)",
    boxShadow: theme.shadows[5],
  },
  ["@media (max-width:600px) and (orientation: portrait)"]: {
    padding: theme.spacing(0.25),
  },
  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    alignItems: "center",
    // Fit the catalog column instead of forcing a wider min-width that overflows.
    maxWidth: 920,
    padding: theme.spacing(3),
  },
  [theme.breakpoints.up("md")]: {
    maxWidth: 1100,
    padding: theme.spacing(3),
  },
}));

const Wrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
}));

const CarImage = styled(Box)(({ theme }) => ({
  // КРИТИЧНО для CLS: position: relative + фиксированные размеры
  // Это позволяет использовать fill prop в CldImage/next/image
  position: "relative",
  width: "100%",
  // Используем padding-bottom hack для aspect-ratio (100% browser support)
  // 66.67% = 2/3 = height/width для соотношения 3:2
  paddingBottom: "66.67%",
  borderRadius: theme.shape.borderRadius,
  overflow: "hidden",

  // Мобильные устройства
  [theme.breakpoints.down("sm")]: {
    marginBottom: theme.spacing(1),
    ["@media (orientation: portrait)"]: {
      marginBottom: theme.spacing(0.5),
      // чуть ниже по высоте, чтобы карточка занимала меньше места по вертикали
      paddingBottom: "56%",
    },
  },

  // Desktop: cap width but allow shrink when the calendar column needs space
  [theme.breakpoints.up("md")]: {
    width: "100%",
    maxWidth: 450,
    aspectRatio: "3 / 2",
    height: "auto",
    paddingBottom: 0,
  },
}));

// Row that places image/params (left) and calendar/pricing (right)
const MediaRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  minWidth: 0,
  gap: theme.spacing(2),
  ["@media (max-width:600px) and (orientation: portrait)"]: {
    gap: theme.spacing(1),
  },
  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    alignItems: "flex-start",
    "& .car-image-wrapper": {
      flex: "1 1 0",
      minWidth: 0,
    },
    "& .calendar-wrapper": {
      flex: "1 1 0",
      minWidth: 0,
      // Let the Ant calendar shrink to the column instead of overflowing.
      overflow: "visible",
    },
  },
  // For small landscape phones split 40/60
  "@media (max-width:900px) and (orientation: landscape)": {
    flexDirection: "row",
    "& .car-image-wrapper": {
      flex: "0 1 40%",
      maxWidth: "40%",
      minWidth: 0,
    },
    "& .calendar-wrapper": {
      flex: "0 1 60%",
      maxWidth: "60%",
      minWidth: 0,
    },
  },
}));
// const StyledCarDetails = styled(Box)(({ theme }) => ({
//   display: "flex",
//   flexDirection: "column",
//   flexGrow: 1,
// }));

const ExpandButton = styled(IconButton)(({ theme, expanded }) => ({
  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
  transition: theme.transitions.create("transform", {
    duration: theme.transitions.duration.shortest,
  }),
}));

// Мемоизируем компонент для предотвращения ненужных ре-рендеров
const CarItemComponent = React.memo(function CarItemComponent({ 
  car, 
  discount, 
  discountStart, 
  discountEnd,
  isFirstCar = false, // Only first car above-the-fold gets priority loading
  presetSearchDates = null,
}) {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const localeFromUrl = pathname?.split("/")[1];
  const supportedLocales = ["en", "ru", "uk", "el", "de", "bg", "ro", "sr", "pl"];
  const locale = localeFromUrl && supportedLocales.includes(localeFromUrl)
    ? localeFromUrl
    : (i18n.language || "en").split("-")[0];
  const slugForLink = car?.slug?.trim() || getSlugFromCar(car);
  const carPageHref = slugForLink ? `/${locale}/cars/${encodeURIComponent(slugForLink)}` : null;
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  // Для хранения id последнего снэка
  const lastSnackRef = useRef(null);
  // --- Скидка теперь приходит из родителя ---
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [bookDates, setBookedDates] = useState({ start: null, end: null });
  const [modalOpen, setModalOpen] = useState(false);
  // Keep BookingModal mounted until exit transition finishes
  const [bookingModalMounted, setBookingModalMounted] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const detailsPanelId = `car-details-${car._id}`;
  const [selectedTimes, setSelectedTimes] = useState({
    start: null,
    end: null,
  });
  const [calculatedPrice, setCalculatedPrice] = useState(null); // Просчитанная цена из календаря

  // Состояние для передачи месяца из календаря:
  const [currentCalendarDate, setCurrentCalendarDate] = useState(dayjs());

  // Оптимизация: деструктурируем только нужные поля из контекста
  // и мемоизируем carOrders, чтобы избежать лишних ре-рендеров
  // ✅ CLIENT-SAFE: используем fetchAndUpdateActiveOrders (только активные заказы)
  const { fetchAndUpdateActiveOrders, isLoading, ordersByCarId, allOrders, company } =
    useMainContext();

  const { names: bookingZoneNames } = useCompanyBookingLocations(
    car?.ownerId || company?._id
  );
  const operatingZoneNames = React.useMemo(
    () => resolveCatalogPlaceOptions(bookingZoneNames, getSiteCountryCode()),
    [bookingZoneNames]
  );
  // Same list the expanded delivery block renders, so the compact summary
  // above can preview the first few places without a second source of truth.
  const operatingZones = React.useMemo(
    () =>
      resolveCarOperatingZones({
        car,
        company,
        zoneNames: operatingZoneNames,
      }),
    [car, company, operatingZoneNames]
  );
  
  // Мемоизируем carOrders вместо useState + useEffect для снижения TBT
  const carOrders = React.useMemo(() => {
    return ordersByCarId(car._id);
  }, [ordersByCarId, car._id]);

  const handleBookingComplete = () => {
    setBookingModalMounted(true);
    setModalOpen(true);
  };

  // ДОБАВИТЬ ЭТУ ФУНКЦИЮ для передачи месяца из календаря:
  const handleCurrentDateChange = (newDate) => {
    // console.log(
    //   "CarItemComponent получил новую дату:",
    //   newDate.format("YYYY-MM-DD")
    // );
    setCurrentCalendarDate(newDate);
  };

  // ref для контейнера изображения
  const carImageRef = useRef(null);

  // Добавляем обработчик для CalendarPicker
  const handleDateChange = ({ type, message }) => {
    // Закрыть предыдущий снэк, если есть
    if (lastSnackRef.current) {
      closeSnackbar(lastSnackRef.current);
    }
    // Показать новый снэк и сохранить его id
    lastSnackRef.current = enqueueSnackbar(message, { variant: type });
  };

  return (
    <StyledCarItem elevation={3}>
      <Wrapper>
        {/* Название автомобиля над фото — ссылка на страницу машины */}
        {carPageHref ? (
          <Link href={carPageHref} style={{ textDecoration: "none", color: "inherit" }}>
            <CarTitle variant="h5">{car.model}</CarTitle>
          </Link>
        ) : (
          <CarTitle variant="h5">{car.model}</CarTitle>
        )}
        <MediaRow>
          <Box
            className="car-image-wrapper"
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: { xs: 1, sm: 1.5 },
              minWidth: 0,
              width: "100%",
              // Match the image cap so every block in this column shares one
              // right edge instead of the text running wider than the photo.
              maxWidth: { xs: "100%", md: 450 },
            }}
          >
            <CarImage
              ref={carImageRef}
              onClick={() => setDetailsModalOpen(true)}
              sx={{
                position: "relative",
                cursor: "pointer",
                bgcolor: "action.hover",
                marginBottom: 0,
                "@media (max-width:600px) and (orientation: portrait)": {
                  marginBottom: 0,
                },
              }}
            >
              {/* КРИТИЧНО для CLS: используем fill prop от next/image
                  - Родитель (CarImage) имеет position: relative + фиксированные размеры
                  - fill заставляет изображение заполнить родителя БЕЗ layout shift */}
              <CarPhoto
                photoUrl={car?.photoUrl}
                alt={car?.model || ""}
                priority={isFirstCar}
                sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 450px"
              />
            </CarImage>

            <Suspense fallback={null}>
              <CarDetails car={car} sections="highlights" />
            </Suspense>

            {detailsExpanded ? null : (
              <CarCitiesSummary
                zones={operatingZones}
                onShowAll={() => setDetailsExpanded(true)}
              />
            )}

            {/* Collapsed by default: the card stays short until asked. */}
            <Button
              onClick={() => setDetailsExpanded((prev) => !prev)}
              aria-expanded={detailsExpanded}
              aria-controls={detailsPanelId}
              fullWidth
              variant="text"
              size="small"
              endIcon={
                <ExpandMoreIcon
                  sx={{
                    transform: detailsExpanded
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                    transition: (t) =>
                      t.transitions.create("transform", {
                        duration: t.transitions.duration.shortest,
                      }),
                  }}
                />
              }
              sx={{
                justifyContent: "center",
                py: 0.5,
                fontSize: "0.78rem",
                fontWeight: 600,
                textTransform: "none",
                color: "text.secondary",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
                "&:hover": {
                  borderColor: "primary.main",
                  color: "primary.main",
                  backgroundColor: "transparent",
                },
              }}
            >
              {detailsExpanded ? t("car.hideDetails") : t("car.showDetails")}
            </Button>

            <Collapse in={detailsExpanded} unmountOnExit>
              <Box
                id={detailsPanelId}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: { xs: 1, sm: 1.5 },
                  minWidth: 0,
                }}
              >
                <Suspense fallback={null}>
                  <CarDetails car={car} sections="details" />
                </Suspense>

                <Divider sx={{ borderStyle: "dashed" }} />

                <Suspense fallback={null}>
                  <CarDeliveryInfo
                    car={car}
                    company={company}
                    zoneNames={operatingZoneNames}
                  />
                </Suspense>

                <Button
                  onClick={() => setDetailsModalOpen(true)}
                  variant="outlined"
                  size="small"
                  sx={{
                    alignSelf: "flex-start",
                    mt: 0.5,
                    px: 1.5,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "none",
                    borderColor: "divider",
                    color: "text.primary",
                    "&:hover": {
                      borderColor: "primary.main",
                      color: "primary.main",
                      backgroundColor: "transparent",
                    },
                  }}
                >
                  {t("car.viewDetails")}
                </Button>
              </Box>
            </Collapse>
          </Box>
          <Box className="calendar-wrapper">
            <Suspense fallback={null}>
              <CalendarPicker
              carId={car._id}
              car={car}
              isLoading={isLoading}
              orders={carOrders}
              setBookedDates={setBookedDates}
              onBookingComplete={handleBookingComplete}
              setSelectedTimes={setSelectedTimes}
              selectedTimes={selectedTimes}
              onCurrentDateChange={handleCurrentDateChange}
              discount={discount}
              discountStart={discountStart}
              discountEnd={discountEnd}
              onDateChange={handleDateChange}
              onPriceCalculated={setCalculatedPrice}
              presetSearchDates={presetSearchDates}
              />
            </Suspense>
            {/* Информация о дискаунте с логикой как в PricingTiers */}
            {(() => {
              // При useSeasons=false скидка показывается в скобках у строки цены в PricingTiers
              if (company?.useSeasons === false) return null;
              // Логика отображения надписи о скидке:
              // Для будущих месяцев — как раньше (весь месяц),
              // для текущего — от сегодня до конца месяца.
              if (!discount || !discountStart || !discountEnd) return null;
              const isCurrentMonth = currentCalendarDate.isSame(
                dayjs(),
                "month"
              );
              const monthStart = currentCalendarDate.startOf("month");
              const monthEnd = currentCalendarDate.endOf("month");
              const rangeStart = isCurrentMonth
                ? dayjs().startOf("day")
                : monthStart;
              let discountType = "none"; // 'full', 'partial', 'none'

              if (
                typeof discount === "number" &&
                discount > 0 &&
                discountStart &&
                discountEnd
              ) {
                if (
                  rangeStart.isSameOrAfter(discountStart, "day") &&
                  monthEnd.isSameOrBefore(discountEnd, "day")
                ) {
                  discountType = "full";
                } else if (
                  monthEnd.isSameOrAfter(discountStart, "day") &&
                  rangeStart.isSameOrBefore(discountEnd, "day")
                ) {
                  discountType = "partial";
                } else {
                  discountType = "none";
                }
              }

              if (discountType === "none") return null; // НЕ показываем надпись

              const discountText =
                discountType === "full"
                  ? `${t("order.discount")} ${discount}%`
                  : `${t("order.discount")} ${discount}% ${t(
                      "basic.from"
                    )} ${dayjs(discountStart).format("DD.MM")} ${t(
                      "basic.till"
                    )} ${dayjs(discountEnd).format("DD.MM")}`;

              return (
                <Typography
                  variant="body2"
                  sx={{
                    mt: { xs: 0.5, sm: 0.5 },
                    mb: { xs: 0.5, sm: 0.5 },
                    color: "error.main",
                    fontWeight: 600,
                    fontSize: { xs: "0.85rem", sm: "0.9rem" },
                    textAlign: "center",
                  }}
                >
                  {discountText}
                </Typography>
              );
            })()}
            {car?.pricingTiers && (
              <Suspense fallback={null}>
                <PricingTiers
                  prices={car?.pricingTiers}
                  selectedDate={currentCalendarDate}
                  discount={discount}
                  discountStart={discountStart}
                  discountEnd={discountEnd}
                />
              </Suspense>
            )}
          </Box>
        </MediaRow>
      </Wrapper>
      {bookingModalMounted && (
        <Suspense fallback={null}>
          <BookingModal
            fetchAndUpdateOrders={fetchAndUpdateActiveOrders}
            open={modalOpen}
            car={car}
            orders={carOrders}
            presetDates={{ startDate: bookDates?.start, endDate: bookDates?.end }}
            isLoading={isLoading}
            selectedTimes={selectedTimes}
            initialPrice={calculatedPrice}
            onClose={() => {
              setModalOpen(false);
              setCalculatedPrice(null); // Сбрасываем цену при закрытии
            }}
            onExited={() => setBookingModalMounted(false)}
          />
        </Suspense>
      )}
      {detailsModalOpen && (
        <Suspense fallback={null}>
          <CarDetailsModal
            open={detailsModalOpen}
            onClose={() => setDetailsModalOpen(false)}
            car={car}
          />
        </Suspense>
      )}
    </StyledCarItem>
  );
}, (prevProps, nextProps) => {
  // Кастомная функция сравнения для оптимизации
  // Сравниваем только примитивные значения для производительности
  const carChanged = prevProps.car?._id !== nextProps.car?._id;
  const discountChanged = prevProps.discount !== nextProps.discount;
  const isFirstCarChanged = prevProps.isFirstCar !== nextProps.isFirstCar;
  
  // Для dayjs объектов сравниваем через valueOf (timestamp)
  const discountStartChanged = 
    prevProps.discountStart?.valueOf() !== nextProps.discountStart?.valueOf();
  const discountEndChanged = 
    prevProps.discountEnd?.valueOf() !== nextProps.discountEnd?.valueOf();
  
  // Возвращаем true если ничего не изменилось (не нужно ре-рендерить)
  return !carChanged && !discountChanged && !discountStartChanged && !discountEndChanged && !isFirstCarChanged;
});

CarItemComponent.displayName = "CarItemComponent";

export default CarItemComponent;
