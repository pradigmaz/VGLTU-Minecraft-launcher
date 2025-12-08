import { LogOut, Moon, Sun, Languages, Server } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { useLanguage } from '../lib/LanguageContext';

export default function Header({ onLogout }) {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLanguage();

  return (
    <header className="flex justify-between items-center mb-8 bg-surface border border-border p-4 rounded-xl shadow-sm transition-colors duration-300">
      {/* Логотип */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
          <Server className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text dark:text-white leading-tight">
            Faculty Admin
          </h1>
          <p className="text-xs text-muted font-medium">v3.2 Stable</p>
        </div>
      </div>

      {/* Правая часть: Контролы */}
      <div className="flex items-center gap-3">
        
        {/* Переключатель Языка */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all text-sm font-medium text-muted hover:text-primary"
          title="Switch Language"
        >
          <Languages size={18} />
          <span>{lang.toUpperCase()}</span>
        </button>

        {/* Переключатель Темы */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all text-muted hover:text-yellow-500 dark:hover:text-yellow-400"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="w-px h-6 bg-border mx-1"></div>

        {/* Кнопка Выхода */}
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-all font-medium text-sm"
        >
          <LogOut size={18} />
          <span>{t('logout')}</span>
        </button>
      </div>
    </header>
  );
}