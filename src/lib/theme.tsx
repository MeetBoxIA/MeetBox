"use client";
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

function getSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyClass(r: "light" | "dark") {
  document.documentElement.classList.toggle("dark", r === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,         setThemeState]  = React.useState<Theme>("system");
  const [resolvedTheme, setResolved]    = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const stored = (localStorage.getItem("meetbox-theme") as Theme) ?? "system";
    const r = stored === "system" ? getSystem() : stored;
    setThemeState(stored);
    setResolved(r);
    applyClass(r);
  }, []);

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

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return <Ctx.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>{children}</Ctx.Provider>;
}
