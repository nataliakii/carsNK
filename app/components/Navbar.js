"use client";
import { Fragment, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { styled } from "@mui/system";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { animateScroll as scroll } from "react-scroll";
import {
  AppBar,
  Button,
  Typography,
  Box,
  Stack,
  Toolbar,
  Container,
  Drawer,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Popover,
  Menu,
  MenuItem,
  TextField,
  Chip,
  Divider,
  Slider,
  InputAdornment,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useSession, signOut } from "next-auth/react";
import { ROLE } from "@/domain/orders/admin-rbac";

import LanguageIcon from "@mui/icons-material/Language";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { useMainContext } from "@app/Context";
import { CAR_CLASSES } from "@models/enums";
import SelectedFieldClass from "@/app/components/ui/inputs/SelectedFieldClass";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import dynamic from "next/dynamic";
import {
  isSupportedLocale,
  normalizeLocale,
  switchPathLocale,
  withLocalePrefix,
} from "@domain/locationSeo/locationSeoService";
import { useNavLocations } from "@app/context/NavLocationsContext";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import {
  SELECTED_LOCATION_STORAGE_KEY,
} from "@/domain/orders/locationOptions";
import { resolveBookingLocationFromPathname } from "@/domain/orders/bookingLocationPathResolver";

const NAVBAR_LOCATIONS_DIVIDER_INDEX = 4;

const LANG_LABELS = {
  en: "English",
  el: "Ελληνικά",
  ru: "Русский",
  uk: "Українська",
  de: "Deutsch",
  bg: "Български",
  ro: "Română",
  sr: "Srpski",
};

// ============================================================
// ADMIN-ONLY CODE ISOLATION
// All admin UI is loaded via AdminRoot to prevent bundle leakage
// ============================================================
const AdminRoot = dynamic(() => import("@app/admin/AdminRoot"), { ssr: false });

const StyledBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== "$isCarInfo" && prop !== "scrolled",
})(({ theme, $isCarInfo }) => ({
  zIndex: 996,
  position: "fixed",
  top: 50,
  left: 0,
  width: "100%",
  display: "flex",
  justifyContent: "center",
  py: theme.spacing(1),
  backgroundColor: theme.palette.backgroundDark1?.bg || "#1a1a1a",
  color: theme.palette.backgroundDark1?.text || "#ffffff",
  // можно использовать $isCarInfo для стилей, если нужно
}));

const GradientAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== "scrolled",
})(({ theme, scrolled }) => ({
  width: "100%",
  position: "fixed",
  // КРИТИЧНО для CLS: НЕ менять height после mount!
  // Убрана анимация height — она вызывала layout shift
  transition: theme.transitions.create(
    ["background-color", "backdrop-filter"],
    {
      duration: theme.transitions.duration.standard,
      easing: theme.transitions.easing.easeInOut,
    }
  ),
  // Фиксированная высота — НЕ меняется при scroll
  height: 60,
  minHeight: 60,
  backgroundColor: theme.palette.backgroundDark1?.bg || "#1a1a1a",
  color: theme.palette.backgroundDark1?.text || "#ffffff",
  boxShadow: "none",
  backdropFilter: scrolled ? "blur(10px)" : "none",
}));

const Logo = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.h1?.fontWeight || 400,
  fontFamily: theme.typography.h1.fontFamily,
  color: theme.palette.primary.main,
  display: "inline-block",
  // Prevent logo from pushing navbar items on small landscape touch devices only
  // add (hover: none) and (pointer: coarse) so desktop browsers don't match when window is narrowed
  "@media (max-width:900px) and (orientation: landscape) and (hover: none) and (pointer: coarse)":
    {
      // allow a bit more room for the company name on horizontal phones
      maxWidth: 220,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
}));

const LanguageSwitcher = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text?.light || "#ffffff",
  display: "flex",
  alignItems: "center",
}));

const LanguagePopover = styled(Popover)(({ theme }) => ({
  width: "150px",
  fontFamily: theme.typography.fontFamily,
}));

export default function NavBar({
  isMain,
  isAdmin = false,
  isCarInfo = false,
  setIsCarInfo = null,
}) {
  // Сессия для админки (SessionProvider в app/providers → SessionProviderGate).
  const sessionValue = useSession();
  const session = sessionValue?.data ?? null;
  const adminRole =
    isAdmin && session?.user?.role !== undefined ? session.user.role : null; // ROLE.ADMIN = 1, ROLE.SUPERADMIN = 2
  const isSuperAdmin = adminRole === ROLE.SUPERADMIN;

  // Обработчик logout
  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  // Следим за выходом из полноэкранного режима
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  // Обработчик выхода из полноэкранного режима
  const handleExitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  // Проверка на горизонтальный телефон
  const [isLandscapePhone, setIsLandscapePhone] = useState(false);
  useEffect(() => {
    const checkLandscape = () => {
      const mq = window.matchMedia(
        "(max-width: 900px) and (orientation: landscape)"
      );
      setIsLandscapePhone(mq.matches);
    };
    checkLandscape();
    window.addEventListener("resize", checkLandscape);
    window.addEventListener("orientationchange", checkLandscape);
    return () => {
      window.removeEventListener("resize", checkLandscape);
      window.removeEventListener("orientationchange", checkLandscape);
    };
  }, []);
  // Состояние для отслеживания полноэкранного режима (можно расширить при необходимости)
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Обработчик для перехода в полноэкранный режим
  const handleFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    }
  };
  const headerRef = useRef(null);
  const [languageAnchor, setLanguageAnchor] = useState(null);
  const [locationsAnchor, setLocationsAnchor] = useState(null);
  const locationsButtonRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { locationGroups } = useNavLocations();
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState(0);
  const [discountStartDate, setDiscountStartDate] = useState(null);
  const [discountEndDate, setDiscountEndDate] = useState(null);
  const [discountHistory, setDiscountHistory] = useState([]);

  const { i18n, t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  // Загружаем скидку для ВСЕХ пользователей (чтобы показать активную скидку)
  // Сохранение скидки доступно только админам (см. handleSaveDiscount)
  const loadDiscountData = useCallback(async () => {
    try {
      const res = await fetch("/api/discount?history=1", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Ошибка загрузки скидки из БД");

      const data = await res.json();
      const history = Array.isArray(data?.history) ? data.history : [];
      setDiscountHistory(history);

      const discountRecord =
        data?.active ||
        (history.length > 0 ? history[0] : data && !Array.isArray(data) ? data : null);

      if (discountRecord) {
        setSelectedDiscount(Number(discountRecord.discount || 0));
        setDiscountStartDate(
          discountRecord.startDate ? new Date(discountRecord.startDate) : null
        );
        setDiscountEndDate(
          discountRecord.endDate ? new Date(discountRecord.endDate) : null
        );
      } else {
        setSelectedDiscount(0);
        setDiscountStartDate(null);
        setDiscountEndDate(null);
      }
    } catch (err) {
      console.error("❌ Ошибка при загрузке скидки:", err);
    }
  }, []);

  useEffect(() => {
    loadDiscountData();
  }, [loadDiscountData]);

  useEffect(() => {
    // Админка больше не принудительно переключает язык на русский.
    // Язык определяется и сохраняется через общий i18n + Context.
  }, [isAdmin, i18n]);

  const {
    scrolled,
    setSelectedClass,
    selectedClass,
    arrayOfAvailableClasses,
    setSelectedTransmission, // Новые значения для фильтра коробки передач
    selectedTransmission,
    arrayOfAvailableTransmissions,
    setSelectedSeats,
    selectedSeats,
    arrayOfAvailableSeats,
    carSearchQuery,
    setCarSearchQuery,
    lang,
    setLang,
    changeLanguage, // Добавляем функцию смены языка
  } = useMainContext();

  // Локаль из URL имеет приоритет, чтобы отображаемый язык и ссылки всегда совпадали с страницей
  const pathSegments = pathname?.split("/").filter(Boolean) || [];
  const urlLocale =
    pathSegments[0] && isSupportedLocale(pathSegments[0])
      ? normalizeLocale(pathSegments[0])
      : null;
  const effectiveLocale = urlLocale || lang || "en";

  useEffect(() => {
    if (typeof window === "undefined" || !pathname || isAdmin) return;

    const bookingLocation = resolveBookingLocationFromPathname(pathname);

    if (bookingLocation) {
      localStorage.setItem(SELECTED_LOCATION_STORAGE_KEY, bookingLocation);
    }
  }, [pathname, isAdmin]);

  const localeLink = (path) =>
    isAdmin ? path : withLocalePrefix(effectiveLocale, path);
  const homeHref = localeLink("/");
  const rentalTermsHref = localeLink("/rental-terms");
  const contactsHref = localeLink("/contacts");
  const termsAliasHref = localeLink("/terms");

  const handleCarClassChange = (event) => {
    const selectedValue = event.target.value;
    setSelectedClass(selectedValue === "" ? "" : selectedValue);
  };

  const handleTransmissionChange = (event) => {
    const selectedValue = event.target.value;
    setSelectedTransmission(selectedValue === "" ? "" : selectedValue);
  };

  const handleSeatsChange = (event) => {
    const selectedValue = event.target.value;
    setSelectedSeats(selectedValue === "" ? "All" : selectedValue);
  };

  const handleCarSearchChange = (event) => {
    setCarSearchQuery(event.target.value ?? "");
  };

  const handleCarSearchClear = () => {
    setCarSearchQuery("");
  };

  const handleLanguageClick = (event) => {
    event.preventDefault();
    setLanguageAnchor(event.currentTarget);
  };

  const handleLanguageClose = () => {
    setLanguageAnchor(null);
  };

  const handleLocationsOpen = (event) => {
    setLocationsAnchor(locationsButtonRef.current || event?.currentTarget);
  };

  const handleLocationsClose = () => {
    setLocationsAnchor(null);
  };

  const handleLanguageSelect = (selectedLanguage) => {
    changeLanguage(selectedLanguage); // Используем новую функцию, которая автоматически сохраняет в localStorage
    if (typeof document !== "undefined") {
      document.cookie = `NEXT_LOCALE=${selectedLanguage}; path=/; max-age=31536000`;
    }
    if (!isAdmin && pathname) {
      router.push(switchPathLocale(pathname, selectedLanguage));
    }
    handleLanguageClose();
  };

  const handleSaveDiscount = async () => {
    if (!isAdmin) return;

    // Валидация дат перед сохранением
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    if (!discountStartDate || !discountEndDate) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Даты скидки не заполнены");
      }
      alert("Укажите дату начала и дату окончания скидки");
      return;
    }
    const startDateLocal = new Date(
      discountStartDate.getFullYear(),
      discountStartDate.getMonth(),
      discountStartDate.getDate()
    );
    const endDateLocal = new Date(
      discountEndDate.getFullYear(),
      discountEndDate.getMonth(),
      discountEndDate.getDate()
    );
    if (startDateLocal < startOfToday) {
      alert("Дата начала скидки не может быть раньше сегодняшней");
      return;
    }
    if (endDateLocal <= startDateLocal) {
      alert("Дата окончания скидки должна быть позже даты начала");
      return;
    }

    // 👉 Преобразуем в UTC-полночь вручную, чтобы сохранить точную дату
    // const startDateUtc = new Date(discountStartDate);
    // startDateUtc.setUTCHours(12, 0, 0, 0);

    const toUTCZeroTime = (date) => {
      return new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
      );
    };

    const startDateUtc = toUTCZeroTime(discountStartDate);
    const endDateUtc = toUTCZeroTime(discountEndDate);

    // 👉 Отправляем в MongoDB

    try {
      const res = await fetch("/api/discount", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          discount: selectedDiscount,
          // startDate: discountStartDate,
          // endDate: discountEndDate,
          startDate: startDateUtc,
          endDate: endDateUtc,
        }),
      });

      const response = await res.json();
      if (res.ok && response.success) {
        // Обновляем состояние после успешного сохранения
        // Используем данные из ответа API для консистентности
        const savedData = response.data;
        if (savedData) {
          if (savedData.startDate)
            setDiscountStartDate(new Date(savedData.startDate));
          if (savedData.endDate)
            setDiscountEndDate(new Date(savedData.endDate));
          if (typeof savedData.discount === "number")
            setSelectedDiscount(savedData.discount);
        }
        await loadDiscountData();
      } else {
        if (process.env.NODE_ENV === "development") {
          console.error("❌ Ошибка сохранения скидки:", response);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("❌ Ошибка при отправке скидки:", error);
      }
    }

    setDiscountModalOpen(false);
  };

  const activeDiscount = useMemo(() => {
    if (!Array.isArray(discountHistory) || discountHistory.length === 0) return null;
    const byDateDesc = [...discountHistory].sort((a, b) => {
      const aTs = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTs = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTs - aTs;
    });
    const activeEntries = byDateDesc.filter((item) => item?.active === true);
    if (activeEntries.length === 0) return byDateDesc[0] || null;
    if (activeEntries.length > 1 && process.env.NODE_ENV === "development") {
      console.warn("[Navbar] Multiple active discounts detected; using latest by createdAt", {
        count: activeEntries.length,
      });
    }
    return activeEntries[0];
  }, [discountHistory]);

  const currentDiscountInlineLabel = useMemo(() => {
    if (!activeDiscount) return "Скидки";
    const type = activeDiscount?.type === "fixed" ? "fixed" : "percentage";
    const rawValue =
      type === "fixed"
        ? Number(activeDiscount?.value ?? activeDiscount?.amount ?? 0)
        : Number(activeDiscount?.discount ?? activeDiscount?.value ?? 0);
    if (!Number.isFinite(rawValue) || rawValue <= 0) return "Скидки";
    return type === "fixed" ? `Скидка €${rawValue}` : `Скидка ${rawValue}%`;
  }, [activeDiscount]);

  // Определение: есть ли настроенная скидка (активная или будущая)
  const hasConfiguredDiscount = () => {
    return selectedDiscount > 0 && discountStartDate && discountEndDate;
  };

  // Определение: активна ли скидка сегодня (по локальной дате, без времени)
  const isDiscountActiveToday = () => {
    if (!hasConfiguredDiscount()) return false;

    const normalize = (d) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = normalize(new Date());
    const start = normalize(discountStartDate);
    const end = normalize(discountEndDate);

    return today >= start && today <= end;
  };

  // Определение: скидка в будущем
  const isDiscountUpcoming = () => {
    if (!hasConfiguredDiscount()) return false;

    const normalize = (d) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = normalize(new Date());
    const start = normalize(discountStartDate);

    return today < start;
  };

  // Форматирование даты для надписи кнопки: DD.MM.YY
  const formatDiscountDate = (date) => {
    if (!date) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
  };

  // Итоговая надпись для кнопки скидки (десктоп / мобильное меню)
  // Показываем информацию о скидке если она активна ИЛИ запланирована
  const getDiscountButtonLabel = () => {
    if (isDiscountActiveToday()) {
      // Скидка активна сейчас
      return t("discount.activeRange", {
        value: selectedDiscount,
        from: formatDiscountDate(discountStartDate),
        to: formatDiscountDate(discountEndDate),
      });
    }
    if (isDiscountUpcoming()) {
      // Скидка запланирована на будущее
      return `${selectedDiscount}% с ${formatDiscountDate(
        discountStartDate
      )} по ${formatDiscountDate(discountEndDate)}`;
    }
    // Нет настроенной скидки
    return t("discount.inactive");
  };

  const discountButtonLabel = getDiscountButtonLabel();
  const discountActiveNow = isDiscountActiveToday();
  const isAdminCarsRoute = pathname?.startsWith("/admin/cars");
  const isAdminCalendarRoute = pathname?.startsWith("/admin/orders-calendar");
  const isAdminOrdersRoute = pathname === "/admin/orders";
  const isAdminZonesRoute = pathname?.startsWith("/admin/delivery-zones");
  const adminNavLinkSx = {
    px: { md: 0.8, lg: 1.25 },
    py: 0.2,
    fontSize: { md: 13, lg: 14 },
    textTransform: "none",
    whiteSpace: "nowrap",
    lineHeight: 1.1,
    letterSpacing: 0.1,
    opacity: 0.72,
  };
  const adminActionButtonSx = {
    px: { md: 0.8, lg: 1.2 },
    minWidth: "auto",
    fontSize: { md: 11, lg: 12 },
    textTransform: "none",
    color: "white",
    borderColor: "rgba(255,255,255,0.55)",
    opacity: 0.86,
    whiteSpace: "nowrap",
    "&:hover": {
      borderColor: "white",
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      opacity: 1,
    },
  };
  const compactButtonTextSx = {
    display: "block",
    maxWidth: { md: 130, lg: 220 },
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <>
      <GradientAppBar
        ref={headerRef}
        scrolled={scrolled}
        sx={{
          display: "flex",
          // Явно показываем Navbar на landscape телефоне
          // Используем правильный синтаксис MUI для кастомных media queries
          "@media (max-width:900px) and (orientation: landscape)": {
            display: "flex",
          },
        }}
      >
        <Toolbar>
          <Stack
            direction="row-reverse"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              width: "100%",
              boxSizing: "border-box",
              "& > *": { minWidth: 0 },
            }}
          >
            <Stack alignItems="center" direction="row-reverse" spacing={2}>
              {/* Кнопка "Во весь экран" — только на горизонтальном телефоне */}
              {isLandscapePhone && !isFullscreen && (
                <IconButton
                  aria-label="Во весь экран"
                  onClick={handleFullscreen}
                  sx={{ ml: 1, color: "inherit" }}
                >
                  {/* SVG-иконка полноэкранного режима — четыре угла */}
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M2 7V2H7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M15 2H20V7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M20 15V20H15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M7 20H2V15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </IconButton>
              )}
              {isLandscapePhone && isFullscreen && (
                <IconButton
                  aria-label="Выйти из полноэкранного"
                  onClick={handleExitFullscreen}
                  sx={{ ml: 1, color: "inherit" }}
                >
                  {/* SVG-иконка выхода из полноэкранного режима (крестик в квадрате) */}
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="3"
                      y="3"
                      width="16"
                      height="16"
                      rx="3"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M8 8L14 14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M14 8L8 14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </IconButton>
              )}
              <IconButton
                edge="start"
                color="inherit"
                onClick={() => setDrawerOpen(true)}
                sx={{ display: { xs: "block", md: "none" } }}
              >
                <MenuIcon />
              </IconButton>

              {/* Языковой переключатель - всегда видим */}
              <LanguageSwitcher color="inherit" onClick={handleLanguageClick}>
                <Typography
                  sx={{
                    fontStretch: "extra-condensed",
                    textTransform: "none",
                    fontSize: "0.8rem",
                    opacity: 0.86,
                  }}
                >
                  {LANG_LABELS[effectiveLocale] || effectiveLocale}
                </Typography>
              </LanguageSwitcher>

              {/* Кнопка logout - только для админки */}
              {isAdmin && adminRole !== null && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleLogout}
                  sx={{
                    color: "inherit",
                    borderColor: "rgba(255, 255, 255, 0.5)",
                    fontSize: "0.72rem",
                    textTransform: "none",
                    px: 1.15,
                    minWidth: "auto",
                    opacity: 0.85,
                    "&:hover": {
                      borderColor: "rgba(255, 255, 255, 0.8)",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      opacity: 1,
                    },
                  }}
                >
                  {t("header.logout") || "Logout"}
                </Button>
              )}

              <Stack
                direction="row"
                spacing={{ md: 0.5, lg: 0.9 }}
                alignItems="center"
                sx={{
                  display: { xs: "none", md: "flex" },
                  minWidth: 0,
                  "& > *": { minWidth: 0 },
                }}
              >
                {!isAdmin && (
                  <>
                    <Link href={homeHref}>
                      <Typography
                        sx={{
                          fontStretch: "extra-condensed",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("header.main")}
                      </Typography>
                    </Link>
                    <Button
                      ref={locationsButtonRef}
                      type="button"
                      aria-haspopup="true"
                      aria-expanded={Boolean(locationsAnchor)}
                      aria-label={t("header.locations") || "Locations"}
                      aria-controls={
                        locationsAnchor ? "locations-menu" : undefined
                      }
                      id={locationsAnchor ? "locations-button" : undefined}
                      onClick={
                        locationGroups?.length ? handleLocationsOpen : undefined
                      }
                      sx={{
                        minWidth: 0,
                        px: { md: 0.8, lg: 1.5 },
                        color: "inherit",
                        textTransform: "uppercase",
                        fontStretch: "extra-condensed",
                        "&:hover": { backgroundColor: "transparent" },
                      }}
                    >
                      <Typography
                        component="span"
                        sx={{
                          fontStretch: "extra-condensed",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("header.locations") || "Locations"}
                      </Typography>
                      <KeyboardArrowDownIcon sx={{ fontSize: 18, ml: 0.25 }} />
                    </Button>
                    <Link href={rentalTermsHref}>
                      <Typography
                        sx={{
                          fontStretch: "extra-condensed",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("header.terms")}
                      </Typography>
                    </Link>
                    <Link href={contactsHref}>
                      <Typography
                        sx={{
                          fontStretch: "extra-condensed",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("header.contacts")}
                      </Typography>
                    </Link>
                  </>
                )}
                {isAdmin && (
                  <>
                    <Link href="/admin/cars">
                      <Typography
                        sx={{
                          ...adminNavLinkSx,
                          ...(isAdminCarsRoute
                            ? {
                                opacity: 1,
                                fontWeight: 600,
                                borderBottom: "1px solid rgba(255,255,255,0.75)",
                              }
                            : null),
                        }}
                      >
                        {t("header.cars")}
                      </Typography>
                    </Link>
                    {/*<Link href="/admin/orders">
                      <Typography
                        sx={{
                          px: { xs: 0.5, md: 3 },
                          fontSize: { xs: 11, md: 15 },
                          textTransform: "uppercase",
                        }}
                      >
                        {t("header.orders")}
                      </Typography>
                    </Link>*/}
                    <Link href="/admin/orders-calendar">
                      <Typography
                        sx={{
                          ...adminNavLinkSx,
                          ...(isAdminCalendarRoute
                            ? {
                                opacity: 1,
                                fontWeight: 600,
                                borderBottom: "1px solid rgba(255,255,255,0.75)",
                              }
                            : null),
                        }}
                      >
                        {t("header.calendar")}
                      </Typography>
                    </Link>
                    {isSuperAdmin && (
                      <Link href="/admin/orders">
                        <Typography
                          sx={{
                            ...adminNavLinkSx,
                            ...(isAdminOrdersRoute
                              ? {
                                  opacity: 1,
                                  fontWeight: 600,
                                  borderBottom: "1px solid rgba(255,255,255,0.75)",
                                }
                              : null),
                          }}
                        >
                          {t("header.table")}
                        </Typography>
                      </Link>
                    )}
                    <Link href="/admin/delivery-zones">
                      <Typography
                        sx={{
                          ...adminNavLinkSx,
                          ...(isAdminZonesRoute
                            ? {
                                opacity: 1,
                                fontWeight: 600,
                                borderBottom: "1px solid rgba(255,255,255,0.75)",
                              }
                            : null),
                        }}
                      >
                        {t("header.deliveryZones")}
                      </Typography>
                    </Link>
                  </>
                )}

                {isAdmin && (
                  <Button
                    variant="outlined"
                    onClick={() => setDiscountModalOpen(true)}
                    title={discountButtonLabel}
                    sx={{
                      ...adminActionButtonSx,
                      ...(discountActiveNow && {
                        borderColor: "success.light",
                        backgroundColor: "rgba(129, 199, 132, 0.2)",
                        "&:hover": {
                          borderColor: "success.light",
                          backgroundColor: "rgba(129, 199, 132, 0.32)",
                        },
                      }),
                    }}
                  >
                    <Box component="span" sx={compactButtonTextSx}>
                      {currentDiscountInlineLabel}
                    </Box>
                  </Button>
                )}
              </Stack>
            </Stack>

            <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <Link href={homeHref} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Image
                  src="/logo.png"
                  alt="CarsNK"
                  width={56}
                  height={56}
                  priority
                  style={{
                    width: "clamp(40px, 8vw, 56px)",
                    height: "auto",
                    borderRadius: 10,
                    objectFit: "contain",
                  }}
                />
                {isAdmin && (
                  <Logo
                    sx={{
                      fontSize: "clamp(10px, 2vw, 14px)",
                      lineHeight: 1,
                      opacity: 0.85,
                    }}
                  >
                    ADMIN
                  </Logo>
                )}
              </Link>
              {/* Chip с ролью - только для админки, в правом верхнем углу логотипа */}
              {isAdmin && adminRole === ROLE.SUPERADMIN && (
                <Chip
                  label={adminRole === ROLE.SUPERADMIN ? "Superadmin" : "Admin"}
                  size="small"
                  sx={{
                    position: "absolute",
                    top: -5,
                    right: -5,
                    backgroundColor:
                      adminRole === ROLE.SUPERADMIN
                        ? "rgba(255, 193, 7, 0.2)"
                        : "rgba(33, 150, 243, 0.2)",
                    color:
                      adminRole === ROLE.SUPERADMIN
                        ? "#ffc107"
                        : "secondary.main",
                    border: `1px solid ${
                      adminRole === ROLE.SUPERADMIN
                        ? "triadic.yellowBright"
                        : "secondary.main"
                    }`,
                    fontWeight: 600,
                    fontSize: "0.65rem",
                    height: 20,
                    zIndex: 1,
                    // Скрываем на очень маленьких экранах
                    display: { xs: "none", sm: "flex" },
                  }}
                />
              )}
            </Box>
          </Stack>
        </Toolbar>

        <Menu
          id="locations-menu"
          anchorEl={locationsAnchor}
          open={Boolean(locationsAnchor)}
          onClose={handleLocationsClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          slotProps={{
            paper: {
              sx: {
                mt: 1.5,
                minWidth: 320,
                maxWidth: 420,
                maxHeight: "70vh",
                borderRadius: 2,
                overflowX: "hidden",
                overflowY: "auto",
              },
            },
          }}
          MenuListProps={{
            "aria-labelledby": "locations-button",
            disablePadding: true,
          }}
        >
          <Box sx={{ py: 1.5, px: 1 }}>
            <List dense disablePadding>
              {locationGroups?.map((group, index) => (
                <Fragment key={group.href}>
                  {index === NAVBAR_LOCATIONS_DIVIDER_INDEX && (
                    <Divider sx={{ my: 0.75, borderColor: "common.black" }} />
                  )}
                  <ListItem disablePadding>
                    <Link
                      href={group.href}
                      onClick={handleLocationsClose}
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        width: "100%",
                        padding: "6px 12px",
                      }}
                    >
                      <ListItemText
                        primary={group.label}
                        primaryTypographyProps={{
                          variant: "body2",
                          fontWeight: 500,
                        }}
                      />
                    </Link>
                  </ListItem>
                </Fragment>
              ))}
            </List>
          </Box>
        </Menu>

        <LanguagePopover
          open={Boolean(languageAnchor)}
          anchorEl={languageAnchor}
          onClose={handleLanguageClose}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
        >
          <MenuItem onClick={() => handleLanguageSelect("en")}>
            English
          </MenuItem>
          <MenuItem onClick={() => handleLanguageSelect("el")}>
            Ελληνικά
          </MenuItem>
          <MenuItem onClick={() => handleLanguageSelect("ru")}>
            Русский
          </MenuItem>
          <MenuItem onClick={() => handleLanguageSelect("uk")}>
            Українська
          </MenuItem>
          <MenuItem onClick={() => handleLanguageSelect("de")}>
            Deutsch
          </MenuItem>
          <MenuItem onClick={() => handleLanguageSelect("pl")}>
            Polski
          </MenuItem>
          <MenuItem onClick={() => handleLanguageSelect("bg")}>
            Български
          </MenuItem>
          <MenuItem onClick={() => handleLanguageSelect("ro")}>Română</MenuItem>
          <MenuItem onClick={() => handleLanguageSelect("sr")}>Srpski</MenuItem>
        </LanguagePopover>

        {isMain && (
          <StyledBox
            scrolled={scrolled ? "true" : undefined}
            $isCarInfo={isCarInfo}
            sx={{
              display: { xs: "flex" },
              // Явно показываем StyledBox на landscape телефоне
              // Используем правильный синтаксис MUI для кастомных media queries
              "@media (max-width:900px) and (orientation: landscape)": {
                display: "flex",
              },
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 1, sm: 10 }}
              alignItems="center"
              justifyContent="center"
              pb={1}
              sx={{
                width: "100%",
                "& > *": { minWidth: 0 },
                // apply only for small landscape touch devices (phones/tablets)
                // Используем правильный синтаксис MUI для кастомных media queries
                "@media (max-width:900px) and (orientation: landscape) and (hover: none) and (pointer: coarse)":
                  {
                    gap: 1,
                    px: 1,
                  },
              }}
            >
              {/* Legend: occupy only intrinsic space - loaded via AdminRoot */}
              <Box sx={{ flex: "0 0 auto", mr: 1, minWidth: 0 }}>
                {isAdmin && <AdminRoot showLegend={true} isMain={isMain} />}
              </Box>

              {/* Контейнер для фильтров - занимает оставшееся пространство и может сжиматься */}
              <Stack
                direction="row"
                spacing={{ xs: 1, sm: 3 }}
                alignItems="center"
                justifyContent="center"
                sx={{
                  width: "100%",
                  flex: "1 1 auto",
                  minWidth: 0,
                  flexWrap: { xs: "wrap", sm: "nowrap" },
                  justifyContent: "center",
                  rowGap: 1,
                }}
              >
                <TextField
                  size="small"
                  name="carSearch"
                  value={carSearchQuery || ""}
                  onChange={handleCarSearchChange}
                  placeholder={t("header.searchCarsPlaceholder")}
                  aria-label={t("header.searchCars")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: "inherit", fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: carSearchQuery ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label={t("header.clearSearch")}
                          onClick={handleCarSearchClear}
                          edge="end"
                          sx={{ color: "inherit" }}
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                  sx={{
                    mt: 1,
                    minWidth: { xs: 180, sm: 220 },
                    maxWidth: { xs: 280, sm: 320 },
                    flex: { xs: "1 1 100%", sm: "0 1 280px" },
                    "& .MuiInputBase-root": {
                      color: (theme) =>
                        theme.palette.backgroundDark1?.text || "#ffffff",
                      fontSize: { xs: "0.85rem", sm: "1rem" },
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: (theme) =>
                        theme.palette.backgroundDark1?.textSecondary ||
                        "#b0b0b0",
                    },
                    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline":
                      {
                        borderColor: (theme) =>
                          theme.palette.backgroundDark1?.secondary || "#4dd4d4",
                      },
                    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
                      {
                        borderColor: (theme) =>
                          theme.palette.backgroundDark1?.secondary || "#4dd4d4",
                      },
                    "& .MuiInputAdornment-root": {
                      color: (theme) =>
                        theme.palette.backgroundDark1?.text || "#ffffff",
                    },
                  }}
                />
                <Box
                  sx={{
                    // only override widths for small landscape touch devices; let SelectedFieldClass control desktop sizes
                    // Используем правильный синтаксис MUI для кастомных media queries
                    "@media (max-width:900px) and (orientation: landscape) and (hover: none) and (pointer: coarse)":
                      {
                        "& .MuiFormControl-root": {
                          minWidth: 190,
                          maxWidth: 210,
                        },
                      },
                  }}
                >
                  <SelectedFieldClass
                    name="class"
                    label={t("header.carClass")}
                    options={Object.values(arrayOfAvailableClasses)}
                    value={selectedClass}
                    handleChange={handleCarClassChange}
                  />
                </Box>

                <Box
                  sx={{
                    // Используем правильный синтаксис MUI для кастомных media queries
                    "@media (max-width:900px) and (orientation: landscape) and (hover: none) and (pointer: coarse)":
                      {
                        "& .MuiFormControl-root": {
                          minWidth: 190,
                          maxWidth: 210,
                        },
                      },
                  }}
                >
                  <SelectedFieldClass
                    name="transmission"
                    label={t("header.transmission")}
                    options={Object.values(arrayOfAvailableTransmissions)}
                    value={selectedTransmission}
                    handleChange={handleTransmissionChange}
                  />
                </Box>

                {arrayOfAvailableSeats.length > 0 && (
                  <Box
                    sx={{
                      display: { xs: "none", sm: "block" },
                      "@media (max-width:900px) and (orientation: landscape) and (hover: none) and (pointer: coarse)":
                        {
                          display: "block",
                          "& .MuiFormControl-root": {
                            minWidth: 190,
                            maxWidth: 210,
                          },
                        },
                    }}
                  >
                    <SelectedFieldClass
                      name="seats"
                      label={t("header.seats")}
                      options={arrayOfAvailableSeats}
                      value={selectedSeats}
                      handleChange={handleSeatsChange}
                      formatMenuItemLabel={(opt) =>
                        t("header.seatsOption", { count: Number(opt) })
                      }
                    />
                  </Box>
                )}
              </Stack>
            </Stack>
          </StyledBox>
        )}
      </GradientAppBar>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
        }}
      >
        <Box sx={{ width: 250, p: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Link
              href={homeHref}
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Image
                src="/logo.png"
                alt="CarsNK"
                width={48}
                height={48}
                style={{
                  width: 48,
                  height: "auto",
                  borderRadius: 8,
                  objectFit: "contain",
                }}
              />
              {isAdmin && <Logo sx={{ fontSize: 12 }}>ADMIN</Logo>}
            </Link>
            <IconButton onClick={() => setDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <List>
            {!isAdmin ? (
              <>
                <ListItem button component={Link} href={homeHref}>
                  <ListItemText primary={t("header.main")} />
                </ListItem>
                {locationGroups?.length > 0 && (
                  <>
                    {locationGroups.map((group, index) => (
                      <Fragment key={group.href}>
                        {index === NAVBAR_LOCATIONS_DIVIDER_INDEX && (
                          <Divider sx={{ my: 0.5, borderColor: "common.black" }} />
                        )}
                        <ListItem
                          button
                          component={Link}
                          href={group.href}
                          onClick={() => setDrawerOpen(false)}
                        >
                          <ListItemText primary={group.label} inset />
                        </ListItem>
                      </Fragment>
                    ))}
                  </>
                )}
                <ListItem button component={Link} href={termsAliasHref}>
                  <ListItemText primary={t("header.terms")} />
                </ListItem>
                <ListItem button component={Link} href={contactsHref}>
                  <ListItemText primary={t("header.contacts")} />
                </ListItem>
              </>
            ) : (
              <>
                <ListItem button component={Link} href="/admin/cars">
                  <ListItemText primary={t("header.cars")} />
                </ListItem>
                <ListItem button component={Link} href="/admin/orders-calendar">
                  <ListItemText primary={t("header.calendar")} />
                </ListItem>
                {isSuperAdmin && (
                  <ListItem button component={Link} href="/admin/orders">
                    <ListItemText primary={t("header.table")} />
                  </ListItem>
                )}
                <ListItem
                  button
                  component={Link}
                  href="/admin/delivery-zones"
                  onClick={() => setDrawerOpen(false)}
                >
                  <ListItemText primary={t("header.deliveryZones")} />
                </ListItem>
                {isAdmin && (
                  <ListItem
                    button
                    onClick={() => {
                      setDrawerOpen(false);
                      setDiscountModalOpen(true);
                    }}
                    sx={
                      discountActiveNow
                        ? {
                            bgcolor: "rgba(129, 199, 132, 0.14)",
                            borderLeft: "3px solid",
                            borderColor: "success.main",
                          }
                        : undefined
                    }
                  >
                    <ListItemText
                      primary={currentDiscountInlineLabel}
                      secondary={discountButtonLabel}
                    />
                  </ListItem>
                )}
              </>
            )}

            {/* Кнопка logout - только для админки в мобильном меню */}
            {isAdmin && adminRole !== null && (
              <>
                <Box
                  sx={{ px: 2, py: 1, borderTop: "1px solid rgba(0,0,0,0.1)" }}
                >
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => {
                      setDrawerOpen(false);
                      handleLogout();
                    }}
                    sx={{
                      textTransform: "uppercase",
                      fontSize: "0.75rem",
                    }}
                  >
                    {t("header.logout") || "Logout"}
                  </Button>
                </Box>
              </>
            )}

            {/* Языковой переключатель убран из мобильного меню, 
                поскольку теперь он всегда видим в верхней панели */}
            {/* <ListItem button onClick={handleLanguageClick}>
              <ListItemText primary={lang} />
            </ListItem> */}
          </List>
        </Box>
      </Drawer>

      {/* Admin UI (DiscountModal) - loaded via AdminRoot */}
      {isAdmin && (
        <AdminRoot
          discountModalOpen={discountModalOpen}
          setDiscountModalOpen={setDiscountModalOpen}
          selectedDiscount={selectedDiscount}
          setSelectedDiscount={setSelectedDiscount}
          discountStartDate={discountStartDate}
          setDiscountStartDate={setDiscountStartDate}
          discountEndDate={discountEndDate}
          setDiscountEndDate={setDiscountEndDate}
          onSaveDiscount={handleSaveDiscount}
          discountActiveNow={discountActiveNow}
          discountHistory={discountHistory}
          activeDiscount={activeDiscount}
        />
      )}
    </>
  );
}

const ToggleButtons = ({ isCarInfo, setIsCarInfo }) => {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={{ xs: 0.3, md: 3 }}
      alignItems="center"
    >
      <Button
        variant={isCarInfo ? "contained" : "outlined"}
        sx={{
          px: { xs: 0.5, md: 3 },
          fontSize: { xs: 6, md: 15 },
        }}
        onClick={() => setIsCarInfo(true)}
      >
        Автопарк
      </Button>
      <Button
        variant={!isCarInfo ? "contained" : "outlined"}
        sx={{
          px: { xs: 0.5, md: 3 },
          fontSize: { xs: 6, md: 15 },
        }}
        onClick={() => setIsCarInfo(false)}
      >
        Заказы
      </Button>
    </Stack>
  );
};
