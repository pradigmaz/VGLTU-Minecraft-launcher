import { useContext } from "react";
import { LanguageContext, ThemeContext } from "./contexts";

export const useLanguage = () => useContext(LanguageContext);
export const useTheme = () => useContext(ThemeContext);
