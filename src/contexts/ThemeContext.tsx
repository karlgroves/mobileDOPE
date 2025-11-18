import React, { createContext, useContext, ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { createTheme, AppTheme } from '../constants/theme';

interface ThemeContextValue {
  theme: AppTheme;
  setThemeMode: (mode: 'dark' | 'light' | 'nightVision') => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { settings, updateSettings } = useAppStore();
  const theme = createTheme(settings.themeMode);

  const setThemeMode = (mode: 'dark' | 'light' | 'nightVision') => {
    updateSettings({ themeMode: mode });
  };

  return (
    <ThemeContext.Provider value={{ theme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
