import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { hydrateStore, patchSettings, useSettings } from "@/lib/api";

export type Theme = "light" | "dark" | "system";
type Prefs = {
  askOpen: boolean;
  setAskOpen: (o: boolean) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  privacy: boolean;
  setPrivacy: (p: boolean) => void;
};
const Ctx = createContext<Prefs | null>(null);
const THEME_KEY = "hf.theme";

export function PrefsProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const [askOpen, setAskOpen] = useState(false);
  const [theme, setThemeState] = useState<Theme>("light");

  // Saved state loads after the first client render so server and client markup match.
  useEffect(() => {
    hydrateStore();
    const t = localStorage.getItem(THEME_KEY);
    if (t === "dark" || t === "system" || t === "light") setThemeState(t);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = (t: Theme) => { setThemeState(t); try { localStorage.setItem(THEME_KEY, t); } catch { /* not persisted */ } };

  return (
    <Ctx.Provider value={{
      privacy: settings.privacy, setPrivacy: (privacy) => patchSettings({ privacy }),
      askOpen, setAskOpen, theme, setTheme,
    }}>{children}</Ctx.Provider>
  );
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("PrefsProvider missing");
  return c;
}

/** False during server render and the first client paint; widgets show a skeleton until then. */
export function useReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
