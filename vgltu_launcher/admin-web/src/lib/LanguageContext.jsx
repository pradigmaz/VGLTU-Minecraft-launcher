import { createContext, useContext, useState } from "react";
import ru from "../locales/ru.json";
import en from "../locales/en.json";

// Объект с переводами
const translations = {
  en,
  ru
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  // Инициализация языка из localStorage или дефолтного (ru)
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "ru");

  const toggleLang = () => {
    const newLang = lang === "ru" ? "en" : "ru";
    setLang(newLang);
    localStorage.setItem("lang", newLang);
  };

  // Функция перевода: ищет ключ в JSON, если нет — возвращает сам ключ
  const t = (key) => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);