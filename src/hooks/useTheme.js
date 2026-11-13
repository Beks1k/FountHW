import { useEffect, useState } from 'react'

const THEME_KEY = 'founthw:theme'

function preferredTheme() {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored) return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyStoredTheme() {
  const theme = preferredTheme()
  document.documentElement.setAttribute('data-theme', theme)
  return theme
}

export default function useTheme() {
  const [theme, setTheme] = useState(preferredTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  return { theme, toggle }
}
