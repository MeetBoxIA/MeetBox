"use client";
/**
 * Theme provider and hook for MeetBox's light/dark/system theming.
 * Persists the user's choice in localStorage under "meetbox-theme".
 * Applies the Tailwind `dark` class directly on <html> so CSS variables
 * and dark: variants work without a wrapper element.
 */
import * as React from "react";

type Theme = "light" | "dark" | "system";
interface ThemeCtx {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const Ctx = React.createContext<ThemeCtx>({
  theme: "system", resolvedTheme: "light",
  setTheme: () => {}, toggleTheme: () => {},
});

export function useTheme() { return React.useContext(Ctx); }

/** Read the OS preference — returns "light" during SSR (no window). */
function getSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Toggle the `dark` class on <html>; Tailwind's darkMode: "class" picks it up. */
function applyClass(r: "light" | "dark") {
  document.documentElement.classList.toggle("dark", r === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,         setThemeState]  = React.useState<Theme>("system");
  const [resolvedTheme, setResolved]    = React.useState<"light" | "dark">("light");

  // On mount, read persisted preference and resolve "system" immediately
  // so there's no flash of wrong theme after hydration.
  React.useEffect(() => {
    const stored = (localStorage.getItem("meetbox-theme") as Theme) ?? "system";
    const r = stored === "system" ? getSystem() : stored;
    setThemeState(stored);
    setResolved(r);
    applyClass(r);
  }, []);

  // When the theme is "system", follow OS changes in real time without
  // requiring the user to reload the page.
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => {
      if (theme === "system") {
        const r = getSystem();
        setResolved(r);
        applyClass(r);
      }
    };
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [theme]);

  const setTheme = React.useCallback((t: Theme) => {
    const r = t === "system" ? getSystem() : t;
    setThemeState(t);
    setResolved(r);
    applyClass(r);
    localStorage.setItem("meetbox-theme", t);
  }, []);

  // Convenience toggle: flips between light and dark (ignores "system").
  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return <Ctx.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>{children}</Ctx.Provider>;
}
