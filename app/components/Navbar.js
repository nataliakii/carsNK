"use client";
import { Fragment, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { styled } from "@mui/system";
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
  Tooltip,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import { ROLE } from "@/domain/orders/admin-rbac";
import RovaroLogo from "@app/components/brand/RovaroLogo";
import { BRAND } from "@config/brand";
import AccountMenu from "@app/components/account/AccountMenu";

import LanguageIcon from "@mui/icons-material/Language";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { useMainContext } from "@app/Context";
import { CAR_CLASSES } from "@models/enums";
import SelectedFieldClass from "@/app/components/ui/inputs/SelectedFieldClass";
import FilterLocationAutocomplete from "@/app/components/ui/inputs/FilterLocationAutocomplete";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import dynamic from "next/dynamic";
import {
  isRoutableLocale,
  switchPathLocale,
  withLocalePrefix,
} from "@domain/locationSeo/locationSeoService";
import { ALL_UI_LOCALES } from "@/domain/platform/uiLocales";
import { translateCarEnumValue } from "@/domain/cars/translateCarEnum";
import { getSiteCountryCode, getSiteCountryConfig } from "@config/siteCountry";
import { useNavLocations } from "@app/context/NavLocationsContext";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { resolveBookingLocationFromPathname } from "@/domain/orders/bookingLocationPathResolver";
import { useCompanyBookingLocations } from "@/app/hooks/useCompanyBookingLocations";
import {
  isSpainBookingSite,
  resolveCatalogPlaceOptions,
} from "@/domain/orders/catalogPlaceOptions";
import TransferRequestModal from "@app/components/TransferRequestModal";
import AdminCountrySwitch from "@app/admin/shared/components/AdminCountrySwitch";
import { useAdminViewAs } from "@app/hooks/useAdminViewAs";
import { useAdminCountryFilter } from "@app/hooks/useAdminCountryFilter";
import { useAdminPendingInbox } from "@app/hooks/useAdminPendingInbox";
import { usePendingPartnerReviews } from "@app/hooks/usePendingPartnerReviews";
import AdminNavLinks, {
  adminNavLinkSx,
} from "@app/admin/shared/components/AdminNavLinks";
import { ADMIN_PATHS, getAdminNavItems } from "@app/admin/shared/adminNav";

const AdminPendingInboxBell = dynamic(
  () => import("@app/admin/shared/components/AdminPendingInboxBell"),
  { ssr: false }
);

const NAVBAR_LOCATIONS_DIVIDER_INDEX = 4;

const LANG_LABELS = {
  en: "English",
  el: "Ελληνικά",
  ru: "Язык",
  uk: "Українська",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  sv: "Svenska",
  no: "Norsk",
  bg: "Български",
  ro: "Română",
  sr: "Srpski",
  es: "Español",
  ca: "Català",
  pl: "Polski",
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
  top: 64,
  left: 0,
  width: "100%",
  display: "flex",
  justifyContent: "center",
  py: theme.spacing(1.25),
  backgroundColor: theme.palette.backgroundDark1?.bg || "#1a1a1a",
  color: theme.palette.backgroundDark1?.text || "#ffffff",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
}));

/** CSS var consumed by Feed so main content clears the fixed header + filter bar. */
export const CATALOG_CHROME_OFFSET_VAR = "--catalog-chrome-offset";
const CATALOG_HEADER_HEIGHT = 64;
/** Breathing room below the black filter bar for catalog meta/intro text. */
const CATALOG_TEXT_GAP_BELOW_FILTERS = 20;

const GradientAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== "scrolled",
})(({ theme, scrolled }) => ({
  width: "100%",
  position: "fixed",
  transition: theme.transitions.create(
    ["background-color", "backdrop-filter", "box-shadow"],
    {
      duration: theme.transitions.duration.standard,
      easing: theme.transitions.easing.easeInOut,
    }
  ),
  height: 64,
  minHeight: 64,
  overflow: "visible",
  backgroundColor: theme.palette.backgroundDark1?.bg || "#1a1a1a",
  color: theme.palette.backgroundDark1?.text || "#ffffff",
  boxShadow: scrolled ? "0 8px 24px rgba(0,0,0,0.28)" : "none",
  backdropFilter: scrolled ? "blur(10px)" : "none",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
}));

const NavLinkText = styled(Typography)(({ theme }) => ({
  fontSize: "0.82rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.88)",
  whiteSpace: "nowrap",
  transition: "color 0.18s ease",
  "&:hover": {
    color: "#ffffff",
  },
}));

const LanguageSwitcher = styled(IconButton)(({ theme }) => ({
  color: theme.palette.text?.light || "#ffffff",
  display: "flex",
  alignItems: "center",
  borderRadius: 10,
  padding: "6px 10px",
  "&:hover": {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
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
    isAdmin && session?.user?.role !== undefined
      ? Number(session.user.role)
      : null; // ROLE.ADMIN = 1, ROLE.SUPERADMIN = 2
  const isSuperAdmin = adminRole === ROLE.SUPERADMIN;
  const { active: viewAsActive, company: viewAsCompany, exit: exitViewAs } =
    useAdminViewAs();
  /** Superadmin chrome (Owners, Platform, country switch) — hidden while viewing as a company. */
  const showSuperAdminChrome = isSuperAdmin && !viewAsActive;
  const { country: adminCountry } = useAdminCountryFilter();
  const { rentals: pendingRentalsCount } = useAdminPendingInbox({
    enabled: Boolean(isAdmin),
    country: adminCountry,
  });
  const legalPendingCount = usePendingPartnerReviews({
    enabled: Boolean(isSuperAdmin),
    country: adminCountry,
  });
  const [partnerCompanyName, setPartnerCompanyName] = useState("");

  const refreshPartnerCompanyName = useCallback(() => {
    if (!isAdmin || (isSuperAdmin && !viewAsActive) || (!session?.user?.ownerId && !viewAsCompany?._id)) {
      if (!isSuperAdmin && session?.user?.companyName) {
        setPartnerCompanyName(session.user.companyName);
      } else if (viewAsActive && viewAsCompany?.name) {
        setPartnerCompanyName(viewAsCompany.name);
      } else {
        setPartnerCompanyName("");
      }
      return;
    }
    const ownerId = viewAsCompany?._id
      ? String(viewAsCompany._id)
      : String(session.user.ownerId);
    fetch(`/api/company/${ownerId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.name) setPartnerCompanyName(String(data.name).trim());
        else if (viewAsCompany?.name) setPartnerCompanyName(viewAsCompany.name);
        else if (session?.user?.companyName) {
          setPartnerCompanyName(session.user.companyName);
        }
      })
      .catch(() => {
        if (viewAsCompany?.name) setPartnerCompanyName(viewAsCompany.name);
        else if (session?.user?.companyName) {
          setPartnerCompanyName(session.user.companyName);
        }
      });
  }, [
    isAdmin,
    isSuperAdmin,
    viewAsActive,
    viewAsCompany,
    session?.user?.ownerId,
    session?.user?.companyName,
  ]);

  useEffect(() => {
    refreshPartnerCompanyName();
  }, [refreshPartnerCompanyName]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => refreshPartnerCompanyName();
    window.addEventListener("company-contacts-updated", handler);
    return () => window.removeEventListener("company-contacts-updated", handler);
  }, [refreshPartnerCompanyName]);

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
        "(max-width: 900px) and (orientation: landscape) and (hover: none) and (pointer: coarse)"
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
  const filterBarRef = useRef(null);
  const [languageAnchor, setLanguageAnchor] = useState(null);
  const [locationsAnchor, setLocationsAnchor] = useState(null);
  const locationsButtonRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const { locationGroups } = useNavLocations();
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState(0);
  const [discountStartDate, setDiscountStartDate] = useState(null);
  const [discountEndDate, setDiscountEndDate] = useState(null);
  const [discountHistory, setDiscountHistory] = useState([]);

  const { i18n, t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const isAccessLink =
    typeof pathname === "string" && pathname.startsWith("/access/");

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
    bookingPlaceIn,
    setBookingPlaceIn,
    bookingPlaceOut,
    setBookingPlaceOut,
    searchDates,
    setSearchDates,
    clearSearchDates,
    lang,
    setLang,
    changeLanguage, // Добавляем функцию смены языка
    company,
    platform,
  } = useMainContext();

  const { names: companyBookingLocationOptions } = useCompanyBookingLocations(
    company?._id
  );
  const spainSite = isSpainBookingSite(getSiteCountryCode());
  const bookingLocationOptions = useMemo(
    () =>
      resolveCatalogPlaceOptions(
        companyBookingLocationOptions,
        getSiteCountryCode()
      ),
    [companyBookingLocationOptions]
  );

  const [draftSearchStart, setDraftSearchStart] = useState("");
  const [draftSearchEnd, setDraftSearchEnd] = useState("");

  useEffect(() => {
    setDraftSearchStart(searchDates?.start || "");
    setDraftSearchEnd(searchDates?.end || "");
  }, [searchDates?.start, searchDates?.end]);

  // Publish measured header+filter height so Feed padding clears the fixed chrome
  // and leaves room for catalog text between the black bar and car cards.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    if (!isMain || isAdmin || isAccessLink) {
      document.documentElement.style.removeProperty(CATALOG_CHROME_OFFSET_VAR);
      return undefined;
    }

    const updateOffset = () => {
      const filterH = filterBarRef.current?.offsetHeight ?? 0;
      const total =
        CATALOG_HEADER_HEIGHT + filterH + CATALOG_TEXT_GAP_BELOW_FILTERS;
      document.documentElement.style.setProperty(
        CATALOG_CHROME_OFFSET_VAR,
        `${total}px`
      );
    };

    updateOffset();

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateOffset)
        : null;
    if (filterBarRef.current && ro) {
      ro.observe(filterBarRef.current);
    }
    window.addEventListener("resize", updateOffset);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateOffset);
      document.documentElement.style.removeProperty(CATALOG_CHROME_OFFSET_VAR);
    };
  }, [
    isMain,
    isAdmin,
    isAccessLink,
    bookingLocationOptions.length,
    arrayOfAvailableSeats.length,
  ]);

  const filterPairRowSx = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    columnGap: 1.25,
    width: "100%",
    minWidth: 0,
  };

  const filterDateFieldSx = {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    height: 40,
    "& .MuiInputBase-root": {
      color: "#fff",
      fontSize: "0.85rem",
      height: 40,
      backgroundColor: "rgba(255,255,255,0.04)",
      borderRadius: "10px",
    },
    "& .MuiOutlinedInput-input": {
      py: 0,
    },
    "& .MuiInputLabel-root": {
      color: "rgba(255,255,255,0.72)",
      fontSize: "0.85rem",
      letterSpacing: "0.01em",
      wordSpacing: "0.12em",
    },
    "& .MuiInputLabel-root.Mui-focused": {
      color: BRAND.pink,
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(255,255,255,0.28)",
    },
    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: BRAND.pinkLight,
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: BRAND.pink,
      borderWidth: 1,
    },
    '& input[type="date"]::-webkit-calendar-picker-indicator': {
      filter: "invert(1)",
      opacity: 0.75,
      cursor: "pointer",
    },
  };

  const filterLocationFieldBoxSx = {
    minWidth: 0,
    width: "100%",
    "& .MuiFormControl-root, & .MuiAutocomplete-root": {
      m: 0,
      width: "100%",
      minWidth: "100% !important",
      maxWidth: "100% !important",
    },
    "& .MuiOutlinedInput-input, & .MuiSelect-select": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  };

  const enabledLocales = platform?.enabledLocales?.length
    ? platform.enabledLocales
    : getSiteCountryConfig().defaultLocales;
  const languageOptions = ALL_UI_LOCALES.filter((item) =>
    enabledLocales.includes(item.code)
  );

  const adminIdentityLabel = viewAsActive
    ? viewAsCompany?.name || partnerCompanyName || t("header.adminRole")
    : isSuperAdmin
      ? "S"
      : "A";

  const adminIdentityTooltip = viewAsActive
    ? viewAsCompany?.name || partnerCompanyName || t("header.adminRole")
    : isSuperAdmin
      ? t("header.superadmin")
      : partnerCompanyName ||
        session?.user?.companyName ||
        t("header.adminRole");

  const adminChipSx = {
    maxWidth: viewAsActive ? { xs: 150, sm: 210, md: 280 } : 36,
    minWidth: viewAsActive ? undefined : 28,
    height: 24,
    fontWeight: 700,
    fontSize: "0.72rem",
    backgroundColor: viewAsActive
      ? "rgba(76, 175, 80, 0.22)"
      : isSuperAdmin
        ? "rgba(255, 193, 7, 0.22)"
        : "rgba(255, 45, 138, 0.18)",
    color: viewAsActive ? "#81c784" : isSuperAdmin ? "#ffc107" : BRAND.pinkLight,
    border: viewAsActive
      ? "1px solid rgba(129, 199, 132, 0.7)"
      : isSuperAdmin
        ? "1px solid rgba(255, 193, 7, 0.55)"
        : `1px solid ${BRAND.pink}`,
    "& .MuiChip-label": {
      px: viewAsActive ? 0.9 : 0.5,
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  };

  const headerIdentityLabel = isAdmin ? adminIdentityLabel : "";
  const accessCompanyName =
    !isAdmin && isAccessLink && company?.name
      ? String(company.name).trim()
      : "";

  // Локаль из URL имеет приоритет, чтобы отображаемый язык и ссылки всегда совпадали с страницей
  const pathSegments = pathname?.split("/").filter(Boolean) || [];
  const urlLocale =
    pathSegments[0] && isRoutableLocale(pathSegments[0])
      ? pathSegments[0]
      : null;
  const effectiveLocale = urlLocale || lang || "en";

  useEffect(() => {
    if (typeof window === "undefined" || !pathname || isAdmin) return;

    const bookingLocation = resolveBookingLocationFromPathname(pathname);

    if (bookingLocation) {
      setBookingPlaceIn(bookingLocation);
    }
  }, [pathname, isAdmin, setBookingPlaceIn]);

  const localeLink = (path) =>
    isAdmin ? path : withLocalePrefix(effectiveLocale, path);
  // Admin logo must not send staff to the public rental homepage.
  const homeHref = isAdmin ? "/admin/orders-calendar" : localeLink("/");
  const rentalTermsHref = localeLink("/rental-terms");
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

  const handlePickupLocationChange = (eventOrValue) => {
    const next =
      eventOrValue && typeof eventOrValue === "object" && eventOrValue.target
        ? eventOrValue.target.value
        : eventOrValue;
    setBookingPlaceIn(next ?? "");
  };

  const handleReturnLocationChange = (eventOrValue) => {
    const next =
      eventOrValue && typeof eventOrValue === "object" && eventOrValue.target
        ? eventOrValue.target.value
        : eventOrValue;
    setBookingPlaceOut(next ?? "");
  };

  useEffect(() => {
    if (!bookingLocationOptions.length) return;
    const allowed = new Set(
      bookingLocationOptions.map((name) => String(name).toLowerCase())
    );
    if (
      bookingPlaceIn &&
      !allowed.has(String(bookingPlaceIn).toLowerCase())
    ) {
      setBookingPlaceIn("");
    }
    if (
      bookingPlaceOut &&
      !allowed.has(String(bookingPlaceOut).toLowerCase())
    ) {
      setBookingPlaceOut("");
    }
  }, [
    bookingLocationOptions,
    bookingPlaceIn,
    bookingPlaceOut,
    setBookingPlaceIn,
    setBookingPlaceOut,
  ]);

  const handleApplyDateSearch = useCallback(() => {
    if (!draftSearchStart || !draftSearchEnd) return;
    if (draftSearchEnd < draftSearchStart) return;
    if (
      searchDates?.start === draftSearchStart &&
      searchDates?.end === draftSearchEnd
    ) {
      return;
    }
    setSearchDates({ start: draftSearchStart, end: draftSearchEnd });
  }, [
    draftSearchStart,
    draftSearchEnd,
    searchDates?.start,
    searchDates?.end,
    setSearchDates,
  ]);

  useEffect(() => {
    handleApplyDateSearch();
  }, [handleApplyDateSearch]);

  const handleClearDateSearch = () => {
    setDraftSearchStart("");
    setDraftSearchEnd("");
    clearSearchDates();
  };

  const datesOutOfOrder = Boolean(
    draftSearchStart && draftSearchEnd && draftSearchEnd < draftSearchStart
  );

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
    // Keep /access/{token}/… URLs intact — locale lives in i18n only there.
    const isAccessLinkPath =
      typeof pathname === "string" && pathname.startsWith("/access/");
    if (!isAdmin && !isAccessLinkPath && pathname) {
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
    if (!activeDiscount) return t("discount.navLabel");
    const type = activeDiscount?.type === "fixed" ? "fixed" : "percentage";
    const rawValue =
      type === "fixed"
        ? Number(activeDiscount?.value ?? activeDiscount?.amount ?? 0)
        : Number(activeDiscount?.discount ?? activeDiscount?.value ?? 0);
    if (!Number.isFinite(rawValue) || rawValue <= 0) return t("discount.navLabel");
    return type === "fixed"
      ? t("discount.navFixed", { value: rawValue })
      : t("discount.navPercent", { value: rawValue });
  }, [activeDiscount, t]);

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
      return t("discount.upcomingRange", {
        value: selectedDiscount,
        from: formatDiscountDate(discountStartDate),
        to: formatDiscountDate(discountEndDate),
      });
    }
    // Нет настроенной скидки
    return t("discount.inactive");
  };

  const discountButtonLabel = getDiscountButtonLabel();
  const discountActiveNow = isDiscountActiveToday();
  const adminNavItems = isAdmin
    ? getAdminNavItems({
        t,
        showSuperAdminChrome,
        showCompanyNav: isAdmin,
        showLegalNav: isAdmin,
        legalHref: showSuperAdminChrome
          ? `${ADMIN_PATHS.legalHub}?tab=partners`
          : ADMIN_PATHS.legal,
        pendingCount: pendingRentalsCount,
        legalPendingCount: isSuperAdmin ? legalPendingCount : 0,
      })
    : [];
  const adminActionLinkSx = {
    ...adminNavLinkSx,
    opacity: 0.9,
    px: { md: 0.75, lg: 1.1 },
    letterSpacing: "normal",
    wordSpacing: "normal",
  };

  return (
    <>
      <GradientAppBar
        ref={headerRef}
        scrolled={scrolled}
        className={isAdmin ? "admin-nav" : undefined}
        sx={{
          display: "flex",
          // Явно показываем Navbar на landscape телефоне
          // Используем правильный синтаксис MUI для кастомных media queries
          "@media (max-width:900px) and (orientation: landscape)": {
            display: "flex",
          },
          ...(isAdmin
            ? { letterSpacing: "normal", wordSpacing: "normal" }
            : null),
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            minHeight: "64px !important",
            height: 64,
            px: { xs: 1.5, sm: 2.5, md: 3 },
            gap: { xs: 1, md: 2 },
          }}
        >
          {/* Logo — left */}
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 1,
              minWidth: 0,
              flexShrink: 0,
            }}
          >
            {isAccessLink ? (
              <Typography
                component="span"
                title={accessCompanyName}
                sx={{
                  fontWeight: 700,
                  fontSize: "clamp(16px, 2.4vw, 22px)",
                  letterSpacing: "0.02em",
                  color: BRAND.pinkLight,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: { xs: "58vw", sm: 420 },
                }}
              >
                {accessCompanyName}
              </Typography>
            ) : (
              <>
                <Link
                  href={homeHref}
                  aria-label={BRAND.name}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    lineHeight: 0,
                  }}
                >
                  <RovaroLogo variant="dark" height={34} priority />
                </Link>
                {headerIdentityLabel ? (
                  isSuperAdmin ? (
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.75}
                      sx={{ minWidth: 0, display: { xs: "none", sm: "flex" } }}
                    >
                      <Tooltip title={adminIdentityTooltip} arrow>
                        <Chip
                          label={headerIdentityLabel}
                          size="small"
                          aria-label={adminIdentityTooltip}
                          sx={adminChipSx}
                        />
                      </Tooltip>
                      {viewAsActive ? (
                        <Button
                          size="small"
                          onClick={async () => {
                            await exitViewAs();
                            router.push("/admin/owners");
                            router.refresh();
                          }}
                          sx={{
                            ...adminActionLinkSx,
                            color: "#81c784",
                            borderBottom: "1px solid rgba(129,199,132,0.55)",
                            minWidth: 0,
                            px: 0.5,
                            fontSize: "0.72rem",
                          }}
                        >
                          {t("header.viewAsExit")}
                        </Button>
                      ) : (
                        <AdminCountrySwitch />
                      )}
                    </Stack>
                  ) : (
                    <Tooltip title={adminIdentityTooltip} arrow>
                      <Chip
                        label={headerIdentityLabel}
                        size="small"
                        aria-label={adminIdentityTooltip}
                        sx={{
                          ...adminChipSx,
                          height: 26,
                          fontSize: "0.8rem",
                          display: { xs: "none", sm: "inline-flex" },
                        }}
                      />
                    </Tooltip>
                  )
                ) : null}
              </>
            )}
          </Box>

          {/* Desktop nav — center */}
          <Stack
            direction="row"
            spacing={{ md: 0.5, lg: 1.25 }}
            alignItems="center"
            justifyContent="center"
            sx={{
              display: { xs: "none", md: "flex" },
              flex: 1,
              minWidth: 0,
              overflowX: "auto",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
              "& > *": { flexShrink: 0 },
            }}
          >
            {!isAdmin && !isAccessLink && (
              <>
                <Link href={homeHref} style={{ textDecoration: "none" }}>
                  <NavLinkText>{t("header.main")}</NavLinkText>
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
                  endIcon={
                    <KeyboardArrowDownIcon sx={{ fontSize: 18, ml: -0.5 }} />
                  }
                  sx={{
                    minWidth: 0,
                    px: { md: 1, lg: 1.25 },
                    color: "rgba(255,255,255,0.88)",
                    textTransform: "uppercase",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    "&:hover": {
                      backgroundColor: "transparent",
                      color: "#fff",
                    },
                  }}
                >
                  {t("header.locations") || "Locations"}
                </Button>
                <Link href={rentalTermsHref} style={{ textDecoration: "none" }}>
                  <NavLinkText>{t("header.terms")}</NavLinkText>
                </Link>
                <Button
                  type="button"
                  onClick={() => setTransferModalOpen(true)}
                  sx={{
                    minWidth: 0,
                    px: { md: 1, lg: 1.25 },
                    color: "rgba(255,255,255,0.88)",
                    textTransform: "uppercase",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    "&:hover": {
                      backgroundColor: "transparent",
                      color: "#fff",
                    },
                  }}
                >
                  {t("header.transfer")}
                </Button>
              </>
            )}
            {isAdmin && (
              <>
                <AdminNavLinks items={adminNavItems} pathname={pathname} />
                <Box
                  aria-hidden
                  sx={{
                    width: "1px",
                    alignSelf: "stretch",
                    my: 0.6,
                    mx: { md: 0.4, lg: 0.75 },
                    backgroundColor: "rgba(255,255,255,0.28)",
                    flexShrink: 0,
                  }}
                />
                <Button
                  onClick={() => setDiscountModalOpen(true)}
                  title={discountButtonLabel}
                  sx={{
                    ...adminActionLinkSx,
                    maxWidth: { md: 140, lg: 200 },
                    ...(discountActiveNow && {
                      opacity: 1,
                      color: "#a5d6a7",
                      borderBottom: "1px solid rgba(165,214,167,0.7)",
                    }),
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {currentDiscountInlineLabel}
                  </Box>
                </Button>
              </>
            )}
          </Stack>

          {/* Actions — right */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ flexShrink: 0, ml: "auto" }}
          >
            {isAdmin ? <AdminPendingInboxBell /> : null}

            <LanguageSwitcher color="inherit" onClick={handleLanguageClick}>
              <Typography
                sx={{
                  textTransform: "none",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  opacity: 0.9,
                }}
              >
                {LANG_LABELS[effectiveLocale] || effectiveLocale}
              </Typography>
            </LanguageSwitcher>

            {session?.user ? (
              <Box
                sx={{
                  display: { xs: "none", md: "inline-flex" },
                  alignItems: "center",
                  height: 32,
                }}
              >
                <AccountMenu
                  companyName={viewAsCompany?.name || partnerCompanyName || ""}
                />
              </Box>
            ) : null}

            {isLandscapePhone && !isFullscreen && (
              <IconButton
                aria-label="Во весь экран"
                onClick={handleFullscreen}
                sx={{ color: "inherit" }}
              >
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
                sx={{ color: "inherit" }}
              >
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

            {!isAccessLink ? (
              <IconButton
                edge="end"
                color="inherit"
                onClick={() => setDrawerOpen(true)}
                sx={{ display: { xs: "inline-flex", md: "none" } }}
              >
                <MenuIcon />
              </IconButton>
            ) : null}
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
          {languageOptions.map((item) => (
            <MenuItem
              key={item.code}
              onClick={() => handleLanguageSelect(item.code)}
            >
              {item.label}
            </MenuItem>
          ))}
        </LanguagePopover>

        {isMain && (
          <StyledBox
            id="catalog-filters"
            ref={filterBarRef}
            scrolled={scrolled ? "true" : undefined}
            $isCarInfo={isCarInfo}
            sx={{
              display: { xs: "flex" },
              overflow: "visible",
              px: { xs: 1.5, sm: 2.5 },
              py: { xs: 1.25, sm: 1.5 },
              "@media (max-width:900px) and (orientation: landscape)": {
                display: "flex",
              },
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 1, sm: 2 }}
              alignItems="center"
              justifyContent="center"
              sx={{
                width: "100%",
                maxWidth: "100%",
                mx: "auto",
              }}
            >
              <Box
                sx={{
                  flex: { xs: "1 1 100%", sm: "0 0 auto" },
                  minWidth: 0,
                  maxWidth: "100%",
                  display: "flex",
                  justifyContent: { xs: "center", sm: "flex-start" },
                }}
              >
                {isAdmin && <AdminRoot showLegend={true} isMain={isMain} />}
              </Box>

              <Stack
                direction="column"
                spacing={1.25}
                alignItems="stretch"
                sx={{
                  width: "100%",
                  flex: "1 1 auto",
                  minWidth: 0,
                  pt: 0.75,
                }}
              >
                <TextField
                  size="small"
                  name="carSearch"
                  value={carSearchQuery || ""}
                  onChange={handleCarSearchChange}
                  placeholder={t("header.searchCarsPlaceholder")}
                  aria-label={t("header.searchCars")}
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: "inherit", fontSize: 18 }} />
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
                    width: "100%",
                    minWidth: 0,
                    height: 40,
                    "& .MuiInputBase-root": {
                      color: "#fff",
                      fontSize: "0.85rem",
                      height: 40,
                      backgroundColor: "rgba(255,255,255,0.04)",
                      borderRadius: "10px",
                    },
                    "& .MuiOutlinedInput-input": {
                      py: 0,
                      overflow: "visible",
                      textOverflow: "clip",
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255,255,255,0.28)",
                    },
                    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline":
                      {
                        borderColor: BRAND.pinkLight,
                      },
                    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
                      {
                        borderColor: BRAND.pink,
                        borderWidth: 1,
                      },
                    "& .MuiInputAdornment-root": { color: "rgba(255,255,255,0.75)" },
                    "& .MuiInputBase-input::placeholder": {
                      color: "rgba(255,255,255,0.55)",
                      opacity: 1,
                      letterSpacing: "0.01em",
                      wordSpacing: "0.12em",
                    },
                  }}
                />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr) minmax(0, 1fr)",
                      sm:
                        arrayOfAvailableSeats.length > 0
                          ? "repeat(3, minmax(0, 1fr))"
                          : "minmax(0, 1fr) minmax(0, 1fr)",
                    },
                    columnGap: 1.25,
                    width: "100%",
                    minWidth: 0,
                    "& .MuiFormControl-root": {
                      m: 0,
                      minWidth: "100% !important",
                      maxWidth: "100% !important",
                    },
                  }}
                >
                <Box sx={{ minWidth: 0 }}>
                  <SelectedFieldClass
                    name="class"
                    label={t("header.carClass")}
                    options={Object.values(arrayOfAvailableClasses)}
                    value={selectedClass}
                    handleChange={handleCarClassChange}
                    formatMenuItemLabel={(opt) =>
                      translateCarEnumValue(t, opt)
                    }
                  />
                </Box>

                <Box sx={{ minWidth: 0 }}>
                  <SelectedFieldClass
                    name="transmission"
                    label={t("header.transmission")}
                    options={Object.values(arrayOfAvailableTransmissions)}
                    value={selectedTransmission}
                    handleChange={handleTransmissionChange}
                    formatMenuItemLabel={(opt) =>
                      translateCarEnumValue(t, opt)
                    }
                  />
                </Box>

                {arrayOfAvailableSeats.length > 0 && (
                  <Box
                    sx={{
                      display: { xs: "none", sm: "block" },
                      minWidth: 0,
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
                </Box>

                {bookingLocationOptions.length > 0 && (
                  <Box sx={filterPairRowSx}>
                    <Box sx={filterLocationFieldBoxSx}>
                      {spainSite ? (
                        <FilterLocationAutocomplete
                          name="pickupLocation"
                          label={t("header.pickupLocation")}
                          options={bookingLocationOptions}
                          value={bookingPlaceIn}
                          onChange={handlePickupLocationChange}
                          emptyOptionLabel={t("header.locationNotSet")}
                        />
                      ) : (
                        <SelectedFieldClass
                          name="pickupLocation"
                          label={t("header.pickupLocation")}
                          options={bookingLocationOptions}
                          value={bookingPlaceIn}
                          handleChange={handlePickupLocationChange}
                          includeAllOption={false}
                          emptyOptionLabel={t("header.locationNotSet")}
                          formatMenuItemLabel={(opt) => opt}
                        />
                      )}
                    </Box>
                    <Box sx={filterLocationFieldBoxSx}>
                      {spainSite ? (
                        <FilterLocationAutocomplete
                          name="returnLocation"
                          label={t("header.returnLocation")}
                          options={bookingLocationOptions}
                          value={bookingPlaceOut}
                          onChange={handleReturnLocationChange}
                          emptyOptionLabel={t("header.locationNotSet")}
                        />
                      ) : (
                        <SelectedFieldClass
                          name="returnLocation"
                          label={t("header.returnLocation")}
                          options={bookingLocationOptions}
                          value={bookingPlaceOut}
                          handleChange={handleReturnLocationChange}
                          includeAllOption={false}
                          emptyOptionLabel={t("header.locationNotSet")}
                          formatMenuItemLabel={(opt) => opt}
                        />
                      )}
                    </Box>
                  </Box>
                )}

                <Box
                  id="catalog-date-fields"
                  sx={{
                    ...filterPairRowSx,
                    gridTemplateColumns:
                      searchDates?.start || draftSearchStart
                        ? "minmax(0, 1fr) minmax(0, 1fr) 40px"
                        : "minmax(0, 1fr) minmax(0, 1fr)",
                    alignItems: "end",
                  }}
                >
                      <TextField
                        id="catalog-search-start"
                        size="small"
                        type="date"
                        name="searchStart"
                        label={t("header.searchFrom")}
                        value={draftSearchStart}
                        onChange={(e) => setDraftSearchStart(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        error={datesOutOfOrder}
                        inputProps={{
                          min: new Date().toISOString().slice(0, 10),
                          "aria-label": t("header.searchFrom"),
                        }}
                        sx={filterDateFieldSx}
                      />
                      <TextField
                        size="small"
                        type="date"
                        name="searchEnd"
                        label={t("header.searchTo")}
                        value={draftSearchEnd}
                        onChange={(e) => setDraftSearchEnd(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        error={datesOutOfOrder}
                        inputProps={{
                          min:
                            draftSearchStart ||
                            new Date().toISOString().slice(0, 10),
                          "aria-label": t("header.searchTo"),
                        }}
                        sx={filterDateFieldSx}
                      />
                      {(searchDates?.start || draftSearchStart) && (
                        <IconButton
                          size="small"
                          aria-label={t("header.clearSearchDates")}
                          onClick={handleClearDateSearch}
                          sx={{
                            height: 40,
                            width: 40,
                            color: "rgba(255,255,255,0.75)",
                          }}
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      )}
                </Box>
              </Stack>
            </Stack>
          </StyledBox>
        )}
      </GradientAppBar>

      {!isAccessLink ? (
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
            alignItems="flex-start"
            spacing={1}
          >
            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
              <Link
                href={homeHref}
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                <RovaroLogo variant="light" height={28} />
              </Link>
              {headerIdentityLabel ? (
                isSuperAdmin ? (
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, flexWrap: "wrap" }}>
                    <Tooltip title={adminIdentityTooltip} arrow>
                      <Chip
                        label={headerIdentityLabel}
                        size="small"
                        aria-label={adminIdentityTooltip}
                        sx={{
                          ...adminChipSx,
                          maxWidth: viewAsActive ? 180 : 36,
                        }}
                      />
                    </Tooltip>
                    {viewAsActive ? (
                      <Button
                        size="small"
                        onClick={async () => {
                          setDrawerOpen(false);
                          await exitViewAs();
                          router.push("/admin/owners");
                          router.refresh();
                        }}
                        sx={{ textTransform: "none", color: "#2e7d32" }}
                      >
                        {t("header.viewAsExit")}
                      </Button>
                    ) : (
                      <AdminCountrySwitch />
                    )}
                  </Stack>
                ) : (
                  <Tooltip title={adminIdentityTooltip} arrow>
                    <Chip
                      label={headerIdentityLabel}
                      size="small"
                      aria-label={adminIdentityTooltip}
                      sx={{
                        ...adminChipSx,
                        maxWidth: viewAsActive ? 220 : 36,
                        height: 26,
                        fontSize: "0.8rem",
                      }}
                    />
                  </Tooltip>
                )
              ) : null}
            </Stack>
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
                <ListItem
                  button
                  onClick={() => {
                    setDrawerOpen(false);
                    setTransferModalOpen(true);
                  }}
                >
                  <ListItemText primary={t("header.transfer")} />
                </ListItem>
              </>
            ) : (
              <>
                <AdminNavLinks
                  items={adminNavItems}
                  pathname={pathname}
                  variant="drawer"
                  onNavigate={() => setDrawerOpen(false)}
                />
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

            {/* Языковой переключатель убран из мобильного меню, 
                поскольку теперь он всегда видим в верхней панели */}
            {/* <ListItem button onClick={handleLanguageClick}>
              <ListItemText primary={lang} />
            </ListItem> */}
          </List>
          <AccountMenu
            placement="drawer"
            companyName={viewAsCompany?.name || partnerCompanyName || ""}
            onNavigate={() => setDrawerOpen(false)}
          />
        </Box>
      </Drawer>
      ) : null}

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

      {!isAdmin && !isAccessLink && (
        <TransferRequestModal
          open={transferModalOpen}
          onClose={() => setTransferModalOpen(false)}
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
