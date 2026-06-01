import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  setTheme: () => null,
});

export function ThemeProvider({ children }) {
  // Initialisation synchronisée avec le localStorage pour éviter le FOUC (Flash Of Unstyled Content)
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('cca-theme');
      if (savedTheme) return savedTheme;
      
      // Fallback sur les préférences système
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    // Supprime l'ancien thème et applique le nouveau
    root.setAttribute('data-theme', theme);
    // Sauvegarde pour les futures sessions
    localStorage.setItem('cca-theme', theme);
  }, [theme]);

  // Fonction pour changer le thème (compatible avec l'ajout futur de 'ocean', etc.)
  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook utilitaire à utiliser dans les composants
// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme doit être utilisé à l\'intérieur d\'un ThemeProvider');
  }
  return context;
};
