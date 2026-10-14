import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { translations } from "../lib/i18n";

const LangContext = createContext(null);

export const LangProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => localStorage.getItem("df_lang") || "ar");

  const applyDir = useCallback((l) => {
    const dir = l === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", l);
  }, []);

  useEffect(() => {
    applyDir(lang);
  }, [lang, applyDir]);

  const setLang = (l) => {
    localStorage.setItem("df_lang", l);
    setLangState(l);
  };

  const toggle = () => setLang(lang === "ar" ? "en" : "ar");

  const t = (key) => translations[lang][key] || translations.en[key] || key;

  return (
    <LangContext.Provider value={{ lang, setLang, toggle, t, dir: lang === "ar" ? "rtl" : "ltr" }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be inside LangProvider");
  return ctx;
};
