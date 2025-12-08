import { createContext, useContext, useState } from "react";

const translations = {
  en: {
    dashboard: "Instances",
    newBuild: "New Build",
    files: "Files",
    logout: "Log out",
    uploadTitle: "Upload New Build",
    uploadDesc: "Drag & drop ZIP artifact here",
    deploy: "Deploy Build",
    cancel: "Cancel",
    fileManager: "File Manager",
    uploadFile: "Upload File",
    searchPlaceholder: "Search files...",
    deleteConfirm: "Are you sure you want to delete this?",
    size: "Size",
    actions: "Actions",
    noInstances: "No active instances found. Create one!",
    manageFiles: "Manage Files",
    deleteInstance: "Delete Instance"
  },
  ru: {
    dashboard: "Сборки",
    newBuild: "Новая сборка",
    files: "Файлов",
    logout: "Выйти",
    uploadTitle: "Загрузка сборки",
    uploadDesc: "Перетащите ZIP архив сюда",
    deploy: "Развернуть сборку",
    cancel: "Отмена",
    fileManager: "Файловый менеджер",
    uploadFile: "Загрузить файл",
    searchPlaceholder: "Поиск файлов...",
    deleteConfirm: "Вы уверены, что хотите удалить это? Действие необратимо.",
    size: "Размер",
    actions: "Действия",
    noInstances: "Нет активных сборок. Создайте первую!",
    manageFiles: "Управление файлами",
    deleteInstance: "Удалить сборку"
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  // По умолчанию русский
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "ru");

  const toggleLang = () => {
    const newLang = lang === "ru" ? "en" : "ru";
    setLang(newLang);
    localStorage.setItem("lang", newLang);
  };

  // Функция перевода: t('dashboard') -> 'Сборки'
  const t = (key) => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);