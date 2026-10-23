/**
 * Utilidades de fecha y zona horaria para el módulo de Caja Diaria.
 * Evita el salto de día al cambiar a UTC en horarios nocturnos (Argentina UTC-3).
 */

/**
 * Convierte un ISO string de timestamp (almacenado en UTC en Supabase/Postgres)
 * a la fecha local 'YYYY-MM-DD' del dispositivo / navegador.
 * 
 * En Argentina (UTC-3), pasadas las 21:00 hs UTC ya es el día siguiente.
 * Esta función preserva el día calendario local real en que ocurrió la operación.
 */
export const formatLocalDateKey = (isoDate: string | null | undefined): string => {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate.slice(0, 10);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return (isoDate || "").slice(0, 10);
  }
};

/**
 * Formatea una fecha ISO o YYYY-MM-DD para presentación legible en español: "23/10/2026"
 */
export const formatLocalDateDisplay = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "-";
  try {
    if (dateStr.length === 10 && dateStr.includes("-")) {
      const [year, month, day] = dateStr.split("-");
      if (year && month && day) {
        return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

/**
 * Formatea hora local HH:mm a partir de un ISO timestamp
 */
export const formatLocalTime = (isoDate: string | null | undefined): string => {
  if (!isoDate) return "--:--";
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return "--:--";
    return d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--";
  }
};

export type ShiftPeriod = "morning" | "afternoon" | "night";

/**
 * Determina el nombre y período amigable del turno según la hora local de apertura:
 * - 05:00 a 13:59: Turno Mañana
 * - 14:00 a 19:59: Turno Tarde
 * - 20:00 a 04:59: Turno Noche
 */
export const getShiftLabel = (
  openedAtIso: string,
  indexInDay?: number
): { label: string; period: ShiftPeriod } => {
  try {
    const d = new Date(openedAtIso);
    if (isNaN(d.getTime())) {
      return {
        label: indexInDay != null ? `Turno ${indexInDay + 1}` : "Turno",
        period: "morning",
      };
    }
    const hour = d.getHours();
    if (hour >= 5 && hour < 14) {
      return { label: "Turno Mañana", period: "morning" };
    }
    if (hour >= 14 && hour < 20) {
      return { label: "Turno Tarde", period: "afternoon" };
    }
    return { label: "Turno Noche", period: "night" };
  } catch {
    return {
      label: indexInDay != null ? `Turno ${indexInDay + 1}` : "Turno",
      period: "morning",
    };
  }
};
