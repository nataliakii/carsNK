"use client";
import { createTheme, alpha } from "@mui/material/styles";
/**
 * CarsNK brand palette (from logo)
 *
 * Navy:    #0B1F3A  — logo square background
 * Cyan:    #00C8D4  — NK letters (primary brand)
 * Red:     #E53935  — left accent bar
 * Yellow:  #FFD400  — right accent bar
 */
// ============================================
// БАЗОВЫЕ ЦВЕТА ПАЛИТРЫ
// ============================================
export const palette = {
  /** Brand cyan (NK) — links, focus, primary CTAs */
  primary: {
    main: "#00C8D4",
    light: "#4DDBE4",
    dark: "#009AA3",
    contrastText: "#0B1F3A",
  },
  /** Logo navy — footer, nav, secondary surfaces */
  secondary: {
    main: "#0B1F3A",
    light: "#1A3358",
    dark: "#061222",
    contrastText: "#ffffff",
  },
  brand: {
    navy: "#0B1F3A",
    cyan: "#00C8D4",
    red: "#E53935",
    yellow: "#FFD400",
  },
  analogous: {
    rose: "#E53935",
    roseLight: "#EF6A66",
    roseDark: "#B71C1C",
    amber: "#FFD400",
    amberLight: "#FFE04D",
    amberDark: "#C9A600",
  },
  triadic: {
    olive: "#5C7A1A",
    oliveLight: "#7A9E2E",
    oliveDark: "#3E5410",
    green: "#1B9E5A",
    greenLight: "#3DBF78",
    greenDark: "#0F6E3D",
    yellowBright: "#FFD400",
    yellow: "#FFD400",
    yellowLight: "#FFE566",
  },
  neutral: {
    white: "#ffffff",
    black: "#0a0a0a",
    gray50: "#F4F8FA",
    gray100: "#EAF1F5",
    gray200: "#D5E0E8",
    gray300: "#B8C7D2",
    gray400: "#8FA3B3",
    gray500: "#6B8294",
    gray600: "#516677",
    gray700: "#3C4F5C",
    gray800: "#283843",
    gray900: "#0B1F3A",
  },
  status: {
    success: "#1B9E5A",
    warning: "#FFD400",
    error: "#E53935",
    info: "#00C8D4",
  },
  // ============================================
  // КОНТРАСТНЫЕ ФОНЫ С ПРЕДОПРЕДЕЛЁННЫМИ ЦВЕТАМИ
  // ============================================
  // Тёмный фон #1 - навбар / фильтры (logo navy)
  backgroundDark1: {
    bg: "#0B1F3A",
    text: "#ffffff",
    textSecondary: "#A8B8C8",
    primary: "#FF6B6B",
    secondary: "#4DDBE4",
    accent: "#FFD400",
    success: "#3DBF78",
    warning: "#FFD400",
  },
  // Тёмный фон #2 - глубокий navy
  backgroundDark2: {
    bg: "#061222",
    text: "#ffffff",
    textSecondary: "#8FA3B3",
    primary: "#FF8A8A",
    secondary: "#00C8D4",
    accent: "#FFD400",
    success: "#3DBF78",
    warning: "#FFE566",
  },
  // Светлый фон - карточки, модали
  backgroundLight: {
    bg: "#ffffff",
    text: "#0B1F3A",
    textSecondary: "#516677",
    primary: "#00C8D4",
    secondary: "#0B1F3A",
    accent: "#E53935",
    success: "#1B9E5A",
    warning: "#C9A600",
  },
};

// ============================================
// СВЕТЛАЯ ТЕМА
// ============================================
const lightThemeColors = {
  background: {
    default: "#F4F8FA",
    paper: "#ffffff",
    subtle: palette.neutral.gray50,
    accent: alpha(palette.primary.main, 0.06),
  },
  text: {
    primary: palette.neutral.gray900,
    secondary: palette.neutral.gray700,
    disabled: palette.neutral.gray500,
    inverse: palette.neutral.white,
    light: palette.neutral.white,
    red: palette.brand.red,
    accent: palette.primary.main,
  },
  divider: palette.neutral.gray200,
  action: {
    active: palette.primary.main,
    hover: alpha(palette.primary.main, 0.08),
    selected: alpha(palette.primary.main, 0.12),
    disabled: palette.neutral.gray400,
    disabledBackground: palette.neutral.gray200,
  },
};

// ============================================
// ТЁМНАЯ ТЕМА
// ============================================
const darkThemeColors = {
  background: {
    default: "#121212",
    paper: "#1e1e1e",
    subtle: "#2a2a2a",
    accent: alpha(palette.secondary.light, 0.08),
  },
  text: {
    primary: "#ffffff",
    secondary: palette.neutral.gray400,
    disabled: palette.neutral.gray600,
    inverse: palette.neutral.gray900,
  },
  divider: palette.neutral.gray800,
  action: {
    active: palette.secondary.light,
    hover: alpha(palette.secondary.light, 0.12),
    selected: alpha(palette.secondary.light, 0.16),
    disabled: palette.neutral.gray700,
    disabledBackground: palette.neutral.gray800,
  },
};

// ============================================
// ЦВЕТА ДЛЯ БИЗНЕС-ЛОГИКИ (ЗАКАЗЫ, КАЛЕНДАРЬ)
// ============================================
export const businessColors = {
  order: {
    confirmed: palette.primary.main, // cyan brand
    confirmedMyOrder: palette.triadic.green,
    pending: palette.brand.yellow,
    pendingLight: palette.analogous.amberLight,
    conflict: alpha(palette.brand.yellow, 0.85),
  },
  calendar: {
    today: alpha(palette.brand.yellow, 0.55),
    todayText: palette.secondary.main,
    sunday: palette.brand.red,
    headerBg: palette.neutral.white,
    cellBorder: palette.neutral.gray300,
    firstColumnBg: palette.secondary.main,
    firstColumnText: palette.neutral.white,
    selected: palette.primary.main,
    moveHighlight: palette.brand.yellow,
    confirmed: palette.triadic.green,
    nonConfirmed: alpha(palette.brand.yellow, 0.9),
    conflict: alpha(palette.brand.yellow, 0.9),
  },
  button: {
    book: palette.primary.main,
    bookHover: palette.primary.dark,
    bookGlow: palette.primary.light,
    submit: palette.brand.red,
    submitHover: palette.analogous.roseDark,
    submitGlow: palette.analogous.roseLight,
  },
};

// ============================================
// CSS ПЕРЕМЕННЫЕ
// ============================================
export const cssVariables = {
  // Primary
  "--color-primary": palette.primary.main,
  "--color-primary-light": palette.primary.light,
  "--color-primary-dark": palette.primary.dark,
  
  // Secondary (Complementary)
  "--color-secondary": palette.secondary.main,
  "--color-secondary-light": palette.secondary.light,
  "--color-secondary-dark": palette.secondary.dark,
  
  // Analogous
  "--color-rose": palette.analogous.rose,
  "--color-amber": palette.analogous.amber,
  
  // Triadic
  "--color-olive": palette.triadic.olive,
  "--color-green": palette.triadic.green,
  // Status
  "--color-success": palette.status.success,
  "--color-warning": palette.status.warning,
  "--color-error": palette.status.error,
  "--color-info": palette.status.info,
  
  // Background
  "--color-bg-default": lightThemeColors.background.default,
  "--color-bg-paper": lightThemeColors.background.paper,
  "--color-bg-subtle": lightThemeColors.background.subtle,
  
  // Text
  "--color-text-primary": lightThemeColors.text.primary,
  "--color-text-secondary": lightThemeColors.text.secondary,
  "--color-text-inverse": lightThemeColors.text.inverse,
  
  // Business
  "--color-order-confirmed": businessColors.order.confirmed,
  "--color-order-confirmed-my": businessColors.order.confirmedMyOrder,
  "--color-order-pending": businessColors.order.pending,
  "--color-calendar-today": businessColors.calendar.today,
  "--color-calendar-first-col": businessColors.calendar.firstColumnBg,
  "--color-calendar-selected": businessColors.calendar.selected,
  
  // Button
  "--color-btn-book": businessColors.button.book,
  "--color-btn-book-glow": businessColors.button.bookGlow,
  "--color-btn-submit": businessColors.button.submit,
  "--color-btn-submit-glow": businessColors.button.submitGlow,
};

// ============================================
// СТИЛИ КНОПОК
// ============================================
const buttonStyles = {
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: {
        borderRadius: 8,
        textTransform: "none",
        fontWeight: 600,
        fontFamily: "'PT Sans', sans-serif",
        padding: "10px 24px",
        transition: "all 0.2s ease-in-out",
      },
      containedPrimary: {
        backgroundColor: palette.primary.main,
        color: palette.secondary.main,
        "&:hover": {
          backgroundColor: palette.primary.dark,
          color: palette.neutral.white,
        },
      },
      containedSecondary: {
        backgroundColor: palette.secondary.main,
        color: palette.neutral.white,
        "&:hover": {
          backgroundColor: palette.secondary.dark,
        },
      },
      containedSuccess: {
        backgroundColor: palette.triadic.green,
        color: palette.neutral.white,
        "&:hover": {
          backgroundColor: palette.triadic.greenDark,
        },
      },
      outlinedPrimary: {
        borderColor: palette.primary.main,
        color: palette.secondary.main,
        "&:hover": {
          backgroundColor: alpha(palette.primary.main, 0.1),
          borderColor: palette.primary.dark,
        },
      },
    },
  },
};

// ============================================
// КАСТОМНЫЕ ВАРИАНТЫ КНОПОК (для использования в компонентах)
// ============================================
export const customButtonStyles = {
  // Мерцающая кнопка "Забронировать" (зелёная)
  bookButton: {
    backgroundColor: businessColors.button.book,
    color: palette.secondary.main,
    fontWeight: "bold",
    fontSize: "1.1rem",
    minWidth: "180px",
    boxShadow: `0 0 16px ${businessColors.button.bookGlow}`,
    animation: "bookButtonPulse 1.5s ease-in-out infinite",
    "&:hover": {
      backgroundColor: businessColors.button.bookHover,
      color: palette.neutral.white,
      animation: "none",
      boxShadow: `0 4px 12px ${alpha(businessColors.button.book, 0.4)}`,
    },
    "@keyframes bookButtonPulse": {
      "0%": {
        boxShadow: `0 0 16px ${businessColors.button.bookGlow}`,
        transform: "scale(1)",
      },
      "50%": {
        boxShadow: `0 0 28px ${businessColors.button.bookGlow}`,
        transform: "scale(1.04)",
      },
      "100%": {
        boxShadow: `0 0 16px ${businessColors.button.bookGlow}`,
        transform: "scale(1)",
      },
    },
  },
  
  // Мерцающая кнопка "Отправить заявку" (красная)
  submitButton: {
    backgroundColor: businessColors.button.submit,
    color: palette.neutral.white,
    fontWeight: "bold",
    fontSize: "1.1rem",
    minWidth: "200px",
    boxShadow: `0 0 16px ${businessColors.button.submitGlow}`,
    animation: "submitButtonPulse 1.5s ease-in-out infinite",
    "&:hover": {
      backgroundColor: businessColors.button.submitHover,
      animation: "none",
      boxShadow: `0 4px 12px ${alpha(businessColors.button.submit, 0.4)}`,
    },
    "@keyframes submitButtonPulse": {
      "0%": {
        boxShadow: `0 0 16px ${businessColors.button.submitGlow}`,
        transform: "scale(1)",
      },
      "50%": {
        boxShadow: `0 0 24px ${businessColors.button.submitGlow}`,
        transform: "scale(1.03)",
      },
      "100%": {
        boxShadow: `0 0 16px ${businessColors.button.submitGlow}`,
        transform: "scale(1)",
      },
    },
  },
  
  // Hero кнопка (для главной страницы)
  heroButton: {
    fontSize: "clamp(14px, 3vw, 20px)",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    padding: "12px 32px",
    borderRadius: "50px",
    transition: "all 0.3s ease",
    lineHeight: 1.2,
    color: palette.neutral.white,
    border: `2px solid ${palette.secondary.main}`,
    backgroundColor: "transparent",
    "&:hover": {
      backgroundColor: palette.secondary.main,
      color: palette.neutral.white,
      transform: "translateY(-2px)",
      boxShadow: `0 4px 16px ${alpha(palette.secondary.main, 0.4)}`,
    },
  },
};

// ============================================
// ТИПОГРАФИКА
// ============================================
const typography = {
  fontFamily: "'PT Sans', 'Roboto', 'Helvetica', 'Arial', sans-serif",
  h1: {
    fontFamily: "'PT Sans', sans-serif",
    fontWeight: 700,
    fontSize: "clamp(2rem, 5vw, 3.5rem)",
    lineHeight: 1.2,
    letterSpacing: "-0.02em",
  },
  h2: {
    fontFamily: "'PT Sans', sans-serif",
    fontWeight: 700,
    fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
    lineHeight: 1.3,
    letterSpacing: "-0.01em",
  },
  h3: {
    fontFamily: "'PT Sans', sans-serif",
    fontWeight: 600,
    fontSize: "clamp(1.25rem, 3vw, 2rem)",
    lineHeight: 1.4,
  },
  h4: {
    fontFamily: "'PT Sans', sans-serif",
    fontWeight: 600,
    fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
    lineHeight: 1.4,
  },
  h5: {
    fontFamily: "'PT Sans', sans-serif",
    fontWeight: 600,
    fontSize: "1.1rem",
    lineHeight: 1.5,
  },
  h6: {
    fontFamily: "'PT Sans', sans-serif",
    fontWeight: 600,
    fontSize: "1rem",
    lineHeight: 1.5,
  },
  body1: {
    fontFamily: "'PT Sans', sans-serif",
    fontSize: "clamp(1rem, 1.25vw, 1.125rem)",
    lineHeight: 1.7,
  },
  body2: {
    fontFamily: "'PT Sans', sans-serif",
    fontSize: "clamp(0.875rem, 1vw, 1rem)",
    lineHeight: 1.6,
  },
  // Новые варианты для больших читабельных текстов
  bodyLarge: {
    fontFamily: "'PT Sans', sans-serif",
    fontSize: "clamp(1.125rem, 1.5vw, 1.375rem)",
    lineHeight: 1.7,
  },
  bodyExtraLarge: {
    fontFamily: "'PT Sans', sans-serif",
    fontSize: "clamp(1.25rem, 1.75vw, 1.5rem)",
    lineHeight: 1.7,
  },
  button: {
    fontFamily: "'PT Sans', sans-serif",
    fontWeight: 600,
    textTransform: "none",
  },
  caption: {
    fontFamily: "'PT Sans', sans-serif",
    fontSize: "0.75rem",
    lineHeight: 1.5,
  },
};

// ============================================
// СОЗДАНИЕ СВЕТЛОЙ ТЕМЫ
// ============================================
export const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: palette.primary,
    secondary: palette.secondary,
    success: {
      main: palette.status.success,
      light: palette.triadic.greenLight,
      dark: palette.triadic.greenDark,
      contrastText: palette.neutral.white,
    },
    warning: {
      main: palette.status.warning,
      light: palette.analogous.amberLight,
      dark: palette.analogous.amberDark,
      contrastText: palette.secondary.main,
    },
    error: {
      main: palette.status.error,
      light: palette.analogous.roseLight,
      dark: palette.analogous.roseDark,
      contrastText: palette.neutral.white,
    },
    info: {
      main: palette.status.info,
      light: palette.primary.light,
      dark: palette.primary.dark,
      contrastText: palette.secondary.main,
    },
    background: lightThemeColors.background,
    text: lightThemeColors.text,
    divider: lightThemeColors.divider,
    action: lightThemeColors.action,
    // Кастомные цвета для бизнес-логики
    order: businessColors.order,
    calendar: businessColors.calendar,
    button: businessColors.button,
    // Дополнительные цвета
    brand: palette.brand,
    analogous: palette.analogous,
    triadic: palette.triadic,
    neutral: palette.neutral,
    // Контрастные фоны с предопределёнными цветами
    backgroundDark1: palette.backgroundDark1,
    backgroundDark2: palette.backgroundDark2,
    backgroundLight: palette.backgroundLight,
  },
  typography,
  shape: {
    borderRadius: 8,
  },
  components: {
    ...buttonStyles,
    MuiTypography: {
      styleOverrides: {
        root: {
          "&.MuiTypography-bodyLarge": typography.bodyLarge,
          "&.MuiTypography-bodyExtraLarge": typography.bodyExtraLarge,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(11, 31, 58, 0.08)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiInputBase-root": {
            fontSize: "clamp(1rem, 1.25vw, 1.125rem)",
          },
          "& .MuiInputLabel-root": {
            fontSize: "clamp(1rem, 1.25vw, 1.125rem)",
          },
          "& .MuiFormHelperText-root": {
            fontSize: "clamp(0.875rem, 1vw, 1rem)",
          },
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: "'PT Sans', sans-serif",
        },
      },
    },
  },
});

// ============================================
// СОЗДАНИЕ ТЁМНОЙ ТЕМЫ
// ============================================
export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      ...palette.primary,
      main: palette.primary.light, // Используем светлый вариант для тёмной темы
    },
    secondary: {
      ...palette.secondary,
      main: palette.secondary.light,
    },
    triadic: {
      ...palette.triadic,
      yellowBright: palette.triadic.yellowBright,
    },
    analogous: {
      ...palette.analogous,
      amberBright: palette.analogous.amberBright,
    },
    neutral: {
      ...palette.neutral,
      whiteBright: palette.neutral.whiteBright,
    },
    success: {
      main: palette.triadic.greenLight,
      light: palette.triadic.greenLight,
      dark: palette.triadic.green,
      contrastText: palette.neutral.black,
    },
    warning: {
      main: palette.analogous.amberLight,
      light: palette.analogous.amberLight,
      dark: palette.analogous.amber,
      contrastText: palette.neutral.black,
    },
    error: {
      main: palette.primary.light,
      light: palette.primary.light,
      dark: palette.primary.main,
      contrastText: palette.neutral.white,
    },
    info: {
      main: palette.secondary.light,
      light: palette.secondary.light,
      dark: palette.secondary.main,
      contrastText: palette.neutral.black,
    },
    background: darkThemeColors.background,
    text: darkThemeColors.text,
    divider: darkThemeColors.divider,
    action: darkThemeColors.action,
    // Кастомные цвета
    order: businessColors.order,
    calendar: {
      ...businessColors.calendar,
      headerBg: darkThemeColors.background.paper,
    },
    button: businessColors.button,
    brand: palette.brand,
    analogous: palette.analogous,
    triadic: palette.triadic,
    neutral: palette.neutral,
    // Контрастные фоны
    backgroundDark1: palette.backgroundDark1,
    backgroundDark2: palette.backgroundDark2,
    backgroundLight: palette.backgroundLight,
  },
  typography,
  shape: {
    borderRadius: 8,
  },
  components: {
    ...buttonStyles,
    MuiTypography: {
      styleOverrides: {
        root: {
          "&.MuiTypography-bodyLarge": typography.bodyLarge,
          "&.MuiTypography-bodyExtraLarge": typography.bodyExtraLarge,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiInputBase-root": {
            fontSize: "clamp(1rem, 1.25vw, 1.125rem)",
          },
          "& .MuiInputLabel-root": {
            fontSize: "clamp(1rem, 1.25vw, 1.125rem)",
          },
          "& .MuiFormHelperText-root": {
            fontSize: "clamp(0.875rem, 1vw, 1rem)",
          },
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
          },
        },
      },
    },
  },
});

// ============================================
// ЭКСПОРТ ПО УМОЛЧАНИЮ (светлая тема)
// ============================================
export default lightTheme;

// ============================================
// СТИЛИ ДЛЯ BIGCALENDAR (централизованные)
// ============================================
export const calendarStyles = {
  // Корневой контейнер
  root: {
    display: "flex",
    flexDirection: "column",
    overflowX: "hidden",
    overflowY: "hidden",
    pt: 0,
    // Убираем maxWidth чтобы не обрезать контент
    width: "100%",
    boxSizing: "border-box",
    zIndex: 100,
    height: "100%",
    // Добавляем padding справа для 31-го дня
    pr: { xs: 0.5, sm: 1 },
  },
  
  // Легенда
  legend: {
    display: { xs: "none", sm: "flex" },
    justifyContent: "center",
    alignItems: "center",
    pt: 0,
    pb: 0,
    px: 2,
    flexShrink: 0,
    "@media (max-width:900px) and (orientation: landscape)": {
      display: "none",
    },
  },
  
  // TableContainer
  tableContainer: {
    flex: 1,
    minHeight: 0,
    overflowX: "auto",
    overflowY: "auto",
    scrollBehavior: "smooth",
  },
  
  // Шапка — первая ячейка (год/месяц)
  headerFirstCell: {
    position: "sticky",
    left: 0,
    zIndex: 5,
    fontWeight: "bold",
    // Width controlled by CSS variable --resource-col-width (set dynamically)
    // Fallback to 120px if variable not set
    minWidth: "var(--resource-col-width, 120px)",
    height: 82,
    py: 0,
  },
  
  // Шапка — ячейки дней (--calendar-day-width и --calendar-day-width-factor задаёт BigCalendar)
  headerDayCell: {
    position: "sticky",
    top: 0,
    zIndex: 4,
    fontSize: { xs: "0.9rem", sm: "0.95rem", md: "1rem" },
    padding: { xs: "4px 1px", sm: "5px 2px", md: "6px 3px" },
    width:
      "var(--calendar-day-width, calc((100% - var(--resource-col-width, 160px)) / var(--calendar-day-count, 31)))",
    minWidth:
      "var(--calendar-day-width, calc((100% - var(--resource-col-width, 160px)) / var(--calendar-day-count, 31)))",
    maxWidth:
      "var(--calendar-day-width, calc((100% - var(--resource-col-width, 160px)) / var(--calendar-day-count, 31)))",
    boxSizing: "border-box",
    fontWeight: "bold",
    cursor: "pointer",
  },
  
  // Первый столбец (названия машин)
  firstColumn: {
    position: "sticky",
    left: 0,
    backgroundColor: "secondary.main",
    color: "backgroundLight.bg",
    zIndex: 3,
    padding: { 
      xs: "2px 4px !important", 
      sm: "4px 8px !important", 
      md: "6px 12px !important" 
    },
    // Width controlled by CSS variable --resource-col-width (set dynamically)
    // Fallback to responsive widths if variable not set
    width: { xs: "var(--resource-col-width, 55px)", sm: "var(--resource-col-width, 100px)", md: "var(--resource-col-width, 140px)" },
    minWidth: { xs: "var(--resource-col-width, 55px)", sm: "var(--resource-col-width, 100px)", md: "var(--resource-col-width, 140px)" },
    maxWidth: { xs: "var(--resource-col-width, 55px)", sm: "var(--resource-col-width, 100px)", md: "var(--resource-col-width, 140px)" },
    fontSize: { xs: "0.65rem", sm: "0.75rem", md: "0.875rem" },
    fontWeight: 500,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    boxSizing: "border-box",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    "&:hover": {
      backgroundColor: "secondary.dark",
    },
  },
  
  // Селект года
  yearSelect: {
    minWidth: 80,
    fontSize: 13,
    "& .MuiSelect-select": { py: 0.2, fontSize: 13 },
  },
  
  // Селект месяца
  monthSelect: {
    minWidth: 80,
    fontSize: 13,
    "& .MuiSelect-select": {
      py: 0.2,
      fontSize: 13,
      letterSpacing: 0,
    },
    mx: 0.15,
  },
  
  // Кнопки навигации (стрелки)
  navButton: {
    p: 0.15,
  },
  
  // Стрелка внутри кнопки
  navArrow: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
    fontSize: 13,
    lineHeight: 1,
    userSelect: "none",
  },
  
  // Контейнер ряда год
  yearRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: 28,
    py: 0.5,
    mb: 0.1,
    "@media (max-width:900px) and (orientation: landscape)": {
      mt: 2,
    },
  },
  
  // Контейнер ряда месяц
  monthRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: 28,
    py: 0.5,
    mt: 0.5,
    mb: 0,
  },
  
  // Ячейка с датами (обёртка)
  cellWrapper: {
    width: "100%",
    height: { xs: "21.06px", sm: "27.54px", md: "34.02px", lg: "38.88px" },
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  
  // Сегодняшний день
  todayCell: {
    backgroundColor: "calendar.today",
  },
};

// ============================================
// СОВМЕСТИМОСТЬ СО СТАРЫМ КОДОМ
// ============================================
// Эти экспорты нужны для обратной совместимости
export const colors = {
  brand: {
    primary: palette.primary.main,
    primaryDark: palette.primary.dark,
    secondary: palette.secondary.main,
    accent: palette.primary.light,
    gold: palette.brand.yellow,
    navy: palette.brand.navy,
    cyan: palette.brand.cyan,
    red: palette.brand.red,
  },
  background: lightThemeColors.background,
  text: {
    primary: lightThemeColors.text.primary,
    secondary: lightThemeColors.text.secondary,
    light: palette.neutral.white,
    dark: palette.neutral.black,
    accent: palette.primary.main,
    red: palette.brand.red,
  },
  order: businessColors.order,
  calendar: businessColors.calendar,
  ui: {
    border: palette.neutral.gray300,
    divider: palette.neutral.gray200,
    hover: alpha(palette.primary.main, 0.08),
    disabled: palette.neutral.gray500,
    error: palette.status.error,
    success: palette.status.success,
    warning: palette.status.warning,
    info: palette.status.info,
  },
};
