// import i18n from "i18next";
// import { initReactI18next } from "react-i18next";
// import translationsEn from "./en.json";
// import translationsEl from "./el.json";
// import translationsRu from "./ru.json";

// const resources = {
//   en: {
//     translation: translationsEn,
//   },
//   el: {
//     translation: translationsEl,
//   },
//   ru: {
//     translation: translationsRu,
//   },
// };

// i18n.use(initReactI18next).init({
//   resources,
//   fallbackLng: "en",
//   supportedLngs: ["en", "el", "ru"],
//   debug: true,
//   interpolation: {
//     escapeValue: false,
//   },
// });

// export default i18n;

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import translationsEn from "./en.json";
import translationsEl from "./el.json";
import translationsRu from "./ru.json";
import translationsDe from "./de.json";
import translationsBg from "./bg.json";
import translationsRo from "./ro.json";
import translationsSr from "./sr.json";
import translationsUk from "./uk.json";
import translationsPl from "./pl.json";
import translationsEs from "./es.json";
import {
  forBusinessCa,
  forBusinessFr,
  forBusinessNo,
  forBusinessSv,
} from "./forBusinessExtra";
import {
  PARTNER_LEGAL_NAV,
  partnerLegalDe,
  partnerLegalEl,
  partnerLegalEn,
  partnerLegalEs,
  partnerLegalRu,
  partnerLegalUk,
  withPartnerLegal,
} from "./partnerLegal";
import { ALL_UI_LOCALE_CODES } from "@/domain/platform/uiLocales";

const supportedLngs = [...ALL_UI_LOCALE_CODES];

const resources = {
  en: {
    translation: withPartnerLegal(translationsEn, partnerLegalEn, PARTNER_LEGAL_NAV.en),
  },
  el: {
    translation: withPartnerLegal(translationsEl, partnerLegalEl, PARTNER_LEGAL_NAV.el),
  },
  ru: {
    translation: withPartnerLegal(translationsRu, partnerLegalRu, PARTNER_LEGAL_NAV.ru),
  },
  de: {
    translation: withPartnerLegal(translationsDe, partnerLegalDe, PARTNER_LEGAL_NAV.de),
  },
  bg: {
    translation: withPartnerLegal(translationsBg, partnerLegalEn, PARTNER_LEGAL_NAV.en),
  },
  ro: {
    translation: withPartnerLegal(translationsRo, partnerLegalEn, PARTNER_LEGAL_NAV.en),
  },
  sr: {
    translation: withPartnerLegal(translationsSr, partnerLegalEn, PARTNER_LEGAL_NAV.en),
  },
  uk: {
    translation: withPartnerLegal(translationsUk, partnerLegalUk, PARTNER_LEGAL_NAV.uk),
  },
  pl: {
    translation: withPartnerLegal(translationsPl, partnerLegalEn, PARTNER_LEGAL_NAV.en),
  },
  es: {
    translation: withPartnerLegal(translationsEs, partnerLegalEs, PARTNER_LEGAL_NAV.es),
  },
  // UI chrome falls back to English until dedicated files exist
  fr: {
    translation: withPartnerLegal(
      { ...translationsEn, forBusiness: forBusinessFr },
      partnerLegalEn,
      PARTNER_LEGAL_NAV.en
    ),
  },
  it: {
    translation: withPartnerLegal(translationsEn, partnerLegalEn, PARTNER_LEGAL_NAV.en),
  },
  sv: {
    translation: withPartnerLegal(
      { ...translationsEn, forBusiness: forBusinessSv },
      partnerLegalEn,
      PARTNER_LEGAL_NAV.en
    ),
  },
  no: {
    translation: withPartnerLegal(
      { ...translationsEn, forBusiness: forBusinessNo },
      partnerLegalEn,
      PARTNER_LEGAL_NAV.en
    ),
  },
  ca: {
    translation: withPartnerLegal(
      { ...translationsEn, forBusiness: forBusinessCa },
      partnerLegalEn,
      PARTNER_LEGAL_NAV.en
    ),
  },
  pt: {
    translation: withPartnerLegal(translationsEn, partnerLegalEn, PARTNER_LEGAL_NAV.en),
  },
};

// Функция для определения языка браузера
const detectBrowserLanguage = () => {
  if (navigator.languages && navigator.languages.length > 0) {
    for (const lang of navigator.languages) {
      if (supportedLngs.includes(lang)) return lang;
      const shortLang = lang.split("-")[0];
      if (supportedLngs.includes(shortLang)) return shortLang;
    }
  }
  if (navigator.language) {
    if (supportedLngs.includes(navigator.language)) return navigator.language;
    const shortLang = navigator.language.split("-")[0];
    if (supportedLngs.includes(shortLang)) return shortLang;
  }
  return "en";
};

const getInitialLanguage = () => {
  if (typeof window !== "undefined") {
    const savedLang = localStorage.getItem("selectedLanguage");
    if (savedLang && supportedLngs.includes(savedLang)) return savedLang;
    return detectBrowserLanguage();
  }
  return "en";
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: "en",
  supportedLngs,
  debug: process.env.NODE_ENV === "development",
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: true,
  },
});

export default i18n;
