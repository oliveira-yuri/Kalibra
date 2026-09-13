import { useEffect, useState } from 'react';
import type { Theme } from '@/types';

const STORAGE_KEY = 'kalibra-theme';

function loadTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  // Dark é o padrão do Kalibra; só o valor explícito 'light' muda isso.
  return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(loadTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');

  return { theme, toggleTheme };
}
