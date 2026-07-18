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

const supportedLngs = ["en", "el", "ru", "uk", "de", "bg", "ro", "sr", "pl"];

const resources = {
  en: { translation: translationsEn },
  el: { translation: translationsEl },
  ru: { translation: translationsRu },
  de: { translation: translationsDe },
  bg: { translation: translationsBg },
  ro: { translation: translationsRo },
  sr: { translation: translationsSr },
  uk: { translation: translationsUk },
  pl: { translation: translationsPl },
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
