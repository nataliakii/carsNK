import React, { useState, useEffect, useRef } from "react";
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
import { CLOUDINARY_PLACEHOLDER_PUBLIC_ID } from "@config/cloudinary";
import SpeedIcon from "@mui/icons-material/Speed";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { lazy, Suspense } from "react";
import { fetchCar } from "@utils/action";
import { fetchOrdersByCar } from "@utils/action";
import TimeToLeaveIcon from "@mui/icons-material/TimeToLeave";
import { useMainContext } from "@app/Context";


// Lazy load тяжелых компонентов для улучшения производительности
const BookingModal = lazy(() => import("./BookingModal"));
const CalendarPicker = lazy(() => import("./CalendarPicker"));
const PricingTiers = lazy(() => import("@app/components/CarComponent/PricingTiers"));
const CarDetails = lazy(() => import("./CarDetails"));
const CarDetailsModal = lazy(() => import("./CarDetailsModal"));

import { CldImage } from "next-cloudinary";
import { useTranslation } from "react-i18next";
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
  maxWidth: 400,
  zIndex: 22,
  display: "flex",
  justifyContent: "center",
  backgroundColor: "#fff",
  alignItems: "center",
  alignContent: "center",
  flexDirection: "column",
  boxShadow: theme.shadows[4],
  transition: "transform 0.3s",
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
    minWidth: 700,
    padding: theme.spacing(3),
  },
  [theme.breakpoints.up("md")]: {
    // flexDirection: "row",
    // alignItems: "center",
    minWidth: 980,
    padding: theme.spacing(3),
  },
}));

const Wrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
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

  // Desktop: фиксированные размеры
  [theme.breakpoints.up("md")]: {
    width: 450,
    height: 300,
    paddingBottom: 0, // Отключаем padding-bottom, используем height
  },
}));

// Row that places image/params (left) and calendar/pricing (right)
const MediaRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  gap: theme.spacing(2),
  ["@media (max-width:600px) and (orientation: portrait)"]: {
    gap: theme.spacing(1),
  },
  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  // For small landscape phones split 40/60
  "@media (max-width:900px) and (orientation: landscape)": {
    flexDirection: "row",
    "& .car-image-wrapper": {
      flex: "0 0 40%",
      maxWidth: "40%",
    },
    "& .calendar-wrapper": {
      flex: "0 0 60%",
      maxWidth: "60%",
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
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
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
  
  // Мемоизируем carOrders вместо useState + useEffect для снижения TBT
  const carOrders = React.useMemo(() => {
    return ordersByCarId(car._id);
  }, [ordersByCarId, car._id]);

  const handleBookingComplete = () => {
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

  // Добавляем ref для контейнера CarItemComponent
  const carItemRef = useRef(null);
  // ref для контейнера изображения — будем измерять ширину для расчёта шрифта стикера
  const carImageRef = useRef(null);
  const [stickerFont, setStickerFont] = useState(null);

  // Скроллим CarItemComponent чуть выше центра экрана, когда появляется кнопка BOOK
  useEffect(() => {
    if (carItemRef.current && bookDates?.start && bookDates?.end) {
      const rect = carItemRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // Смещение вверх на 160px (можно изменить по желанию)
      const offset = -160;
      const scrollY =
        window.scrollY +
        rect.top +
        rect.height / 2 -
        viewportHeight / 2 +
        offset;
      window.scrollTo({
        top: scrollY,
        behavior: "smooth",
      });
    }
  }, [bookDates?.start, bookDates?.end]);

  // Рассчитываем размер шрифта для стикера в зависимости от ширины контейнера изображения
  useEffect(() => {
    const node = carImageRef.current;
    if (!node) return;

    const computeFont = () => {
      const width = node.clientWidth || 0;
      // Фактор 0.038 — немного уменьшенный для лучшей гарантии размещения в одну строку
      // Ограничиваем размер шрифта в пикселях между 8 и 15
      const px = Math.round(Math.max(8, Math.min(15, width * 0.038)));
      setStickerFont(px + "px");
    };

    // Initial
    computeFont();

    // ResizeObserver — обновляем при изменении ширины
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => computeFont());
      ro.observe(node);
    } else {
      // Фоллбек на window.resize
      window.addEventListener("resize", computeFont);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", computeFont);
    };
  }, []);

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
    <StyledCarItem elevation={3} ref={carItemRef}>
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
          <Box className="car-image-wrapper">
            <CarImage
              ref={carImageRef}
              sx={{
                position: "relative",
                cursor: "pointer",
                marginBottom: { xs: 1, sm: 3 },
                "@media (max-width:600px) and (orientation: portrait)": {
                  marginBottom: 0.5,
                },
              }}
            >
              {/* Стикер 'Без депозита' */}
              {car.deposit === 0 && (
                <Box
                  sx={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    zIndex: 2,
                    bgcolor: "calendar.today",
                    color: "text.primary",
                    width: "32%", // увеличили ширину, чтобы поместилась надпись
                    minWidth: 110,
                    px: "3%", // увеличили горизонтальные отступы
                    py: "1%",
                    borderRadius: 2,
                    fontWeight: 700,
                    // responsive font: computed from image width (stickerFont) or fallback clamp
                    fontSize: stickerFont || "clamp(0.6rem, 2vw, 1rem)",
                    boxShadow: 2,
                    textTransform: "uppercase",
                    pointerEvents: "none",
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    // force single-line to keep text in one line
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {t("car.noDeposit") || "Без депозита"}
                </Box>
              )}
              {/* КРИТИЧНО для CLS: используем fill prop от next/image
                  - Родитель (CarImage) имеет position: relative + фиксированные размеры
                  - fill заставляет изображение заполнить родителя БЕЗ layout shift */}
                  <CldImage
                    onClick={() => setDetailsModalOpen(true)}
                    src={car?.photoUrl || CLOUDINARY_PLACEHOLDER_PUBLIC_ID}
                    alt={`Natali-Cars-${car.model}`}
                fill
                    crop="fill"
                priority={isFirstCar}
                sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 450px"
                    style={{
                  objectFit: "cover",
                      cursor: "pointer",
                    }}
                  />
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailsModalOpen(true);
                    }}
                    variant="outlined"
                    size="small"
                    sx={{
                      position: "absolute",
                      bottom: { xs: 4, sm: 8 },
                      right: { xs: 4, sm: 8 },
                      backgroundColor: "rgba(255, 255, 255, 0.9)",
                      "&:hover": {
                        backgroundColor: "rgba(255, 255, 255, 1)",
                      },
                      fontSize: { xs: "0.65rem", sm: "0.75rem" },
                      padding: { xs: "2px 6px", sm: "4px 8px" },
                      zIndex: 1,
                    }}
                  >
                    {t("car.viewDetails")}
                  </Button>
            </CarImage>
            <Suspense fallback={null}>
              <CarDetails car={car} />
            </Suspense>
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
              />
            </Suspense>
            {/* Информация о дискаунте с логикой как в PricingTiers */}
            {(() => {
              // При useSeasons=false скидка показывается в скобках у строки «Цены» в PricingTiers
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
      {modalOpen && (
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
