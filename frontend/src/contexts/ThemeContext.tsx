import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'midnight' | 'light' | 'high-dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('portal-theme') as Theme) || 'midnight';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'midnight' ? '' : theme);
    localStorage.setItem('portal-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
