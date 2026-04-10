import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storageKeys } from "@/utils/local-storage";

export type UiTheme = "light" | "dark";
export type UiDensity = "standard" | "compact";
export type UiToastType = "success" | "error" | "info";

export interface UiToast {
  id: string;
  type: UiToastType;
  message: string;
  durationMs?: number;
}

interface UiStore {
  sidebarOpen: boolean;
  theme: UiTheme;
  density: UiDensity;
  accentColor: string;
  toasts: UiToast[];
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: UiTheme) => void;
  setDensity: (density: UiDensity) => void;
  setAccentColor: (color: string) => void;
  toggleTheme: () => void;
  pushToast: (toast: Omit<UiToast, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const getInitialTheme = (): UiTheme => {
  if (typeof window === "undefined") return "light";

  try {
    const raw = localStorage.getItem(storageKeys.ui);
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { theme?: UiTheme } };
      const persistedTheme = parsed?.state?.theme;

      if (persistedTheme === "light" || persistedTheme === "dark") {
        return persistedTheme;
      }
    }
  } catch {
    // Fallback a preferencia del sistema o modo claro.
  }

  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
};

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: getInitialTheme(),
      density: "standard",
      accentColor: "#6054e8",
      toasts: [],

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setAccentColor: (color) =>
        set({
          accentColor: /^#[0-9a-f]{6}$/i.test(color.trim())
            ? color.trim()
            : "#6054e8",
        }),
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === "dark" ? "light" : "dark",
        })),

      pushToast: (toast) => {
        const id = crypto.randomUUID();
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));
        return id;
      },

      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        })),

      clearToasts: () => set({ toasts: [] }),
    }),
    {
      name: storageKeys.ui,
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        density: state.density,
        accentColor: state.accentColor,
      }),
    }
  )
);
