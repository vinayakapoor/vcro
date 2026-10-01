import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
type Prefs = {
  currency: "INR" | "AED";
  setCurrency: (c: "INR" | "AED") => void;
  askOpen: boolean;
  setAskOpen: (o: boolean) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  privacy: boolean;
  setPrivacy: (p: boolean) => void;
};
const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<"INR" | "AED">("INR");
  const [askOpen, setAskOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [privacy, setPrivacy] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && mq.matches));
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return (
    <Ctx.Provider value={{ currency, setCurrency, askOpen, setAskOpen, theme, setTheme, privacy, setPrivacy }}>{children}</Ctx.Provider>
  );
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("PrefsProvider missing");
  return c;
}

/** True shortly after first client render; widgets show Skeleton until then. */
export function useReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(t);
  }, []);
  return ready;
}
