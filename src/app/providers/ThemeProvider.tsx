import { useEffect } from "react";
import type { PropsWithChildren } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { settingsService } from "@/services/settings.service";
import { useUiStore } from "@/store/ui.store";

const hexToSoftRgba = (hex: string): string => {
  const normalized = hex.trim();
  const valid = /^#[0-9a-f]{6}$/i.test(normalized);
  if (!valid) return "rgba(0, 86, 179, 0.12)";

  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, 0.16)`;
};

const normalizeLegacyAccent = (color: string): string => {
  const normalized = color.trim().toLowerCase();
  return normalized === "#6054e8" || normalized === "#7c6af7" ? "#0056b3" : color;
};

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const tenantId = useAuthStore((state) => state.tenantId);
  const theme = useUiStore((state) => state.theme);
  const density = useUiStore((state) => state.density);
  const accentColor = useUiStore((state) => state.accentColor);
  const setTheme = useUiStore((state) => state.setTheme);
  const setDensity = useUiStore((state) => state.setDensity);
  const setAccentColor = useUiStore((state) => state.setAccentColor);

  useEffect(() => {
    if (!tenantId) return;

    let active = true;

    const loadTenantAppearance = async () => {
      try {
        const tenantSettings = await settingsService.getByTenant(tenantId);
        if (!active) return;

        setTheme(tenantSettings.apariencia.default_theme);
        setDensity(tenantSettings.apariencia.density);
        setAccentColor(normalizeLegacyAccent(tenantSettings.apariencia.accent_color));
      } catch {
        // Mantener theme actual si falla carga de settings.
      }
    };

    void loadTenantAppearance();

    return () => {
      active = false;
    };
  }, [setAccentColor, setDensity, setTheme, tenantId]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.classList.toggle("ui-density-compact", density === "compact");
    root.style.colorScheme = theme;
    root.style.setProperty("--ui-accent", accentColor);
    root.style.setProperty("--ui-accent-soft", hexToSoftRgba(accentColor));
    root.style.setProperty(
      "--ui-accent-strong",
      `color-mix(in srgb, ${accentColor} 82%, #000000)`,
    );
  }, [theme, density, accentColor]);

  return <>{children}</>;
};
