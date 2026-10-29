import { useState } from 'react';
import { applyTheme, currentTheme } from './theme';

export function useTheme() {
  const [theme, setTheme] = useState(currentTheme);
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    applyTheme(next, true);
    setTheme(next);
  };
  return { theme, toggle };
}
