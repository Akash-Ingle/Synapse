import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  init: () => void;
}

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export const useTheme = create<ThemeState>((set) => ({
  theme: (localStorage.getItem("synapse_theme") as Theme) ?? "system",
  setTheme(theme) {
    localStorage.setItem("synapse_theme", theme);
    applyTheme(theme);
    set({ theme });
  },
  init() {
    const saved = (localStorage.getItem("synapse_theme") as Theme) ?? "system";
    applyTheme(saved);
    set({ theme: saved });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const current = (localStorage.getItem("synapse_theme") as Theme) ?? "system";
      if (current === "system") applyTheme("system");
    });
  },
}));
