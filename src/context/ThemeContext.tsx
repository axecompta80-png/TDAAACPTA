import React, { createContext, useContext } from 'react';

interface ThemeContextType {
  isDark: boolean;
}

// L'application ne propose plus que le mode clair.
const ThemeContext = createContext<ThemeContextType>({ isDark: false });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeContext.Provider value={{ isDark: false }}>
    {children}
  </ThemeContext.Provider>
);

export const useTheme = () => useContext(ThemeContext);
