import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storageKeys } from "@/utils/local-storage";

export type UiTheme = "light" | "dark";
export type UiDensity = "standard" | "compact";
export type UiFontSize = "compact" | "normal" | "large" | "extra-large";
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
  fontSize: UiFontSize;
  accentColor: string;
  toasts: UiToast[];
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: UiTheme) => void;
  setDensity: (density: UiDensity) => void;
  setFontSize: (fontSize: UiFontSize) => void;
  cycleFontSize: () => void;
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

const fontSizeCycleOrder: UiFontSize[] = ["compact", "normal", "large", "extra-large"];

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: getInitialTheme(),
      density: "standard",
      fontSize: "normal",
      accentColor: "#0056b3",
      toasts: [],

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setFontSize: (fontSize) => set({ fontSize }),
      cycleFontSize: () =>
        set((state) => {
          const currentIndex = fontSizeCycleOrder.indexOf(state.fontSize);
          const nextIndex = (currentIndex + 1) % fontSizeCycleOrder.length;
          return { fontSize: fontSizeCycleOrder[nextIndex] };
        }),
      setAccentColor: (color) =>
        set({
          accentColor: /^#[0-9a-f]{6}$/i.test(color.trim())
            ? color.trim()
            : "#0056b3",
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
        fontSize: state.fontSize,
        accentColor: state.accentColor,
      }),
    }
  )
);
