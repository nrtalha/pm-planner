import { useCallback, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'sow-architect-theme'

function readInitialTheme(): Theme {
  // index.html applies the saved theme before first paint; mirror what it decided.
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** Dark (Bevy) by default; the choice is remembered in this browser only. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this visit.
    }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle }
}
