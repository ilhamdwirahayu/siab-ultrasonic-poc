"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("siab-theme");
    const isDark = saved === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    const timer = window.setTimeout(() => setDark(isDark), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("siab-theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button className="icon-button" type="button" aria-label={dark ? "Aktifkan tema terang" : "Aktifkan tema gelap"} onClick={toggle}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
