import type React from "react";

/**
 * input-helpers.ts
 * Utilidades para agilizar la entrada de números en formularios del sistema.
 *
 * Comportamiento:
 * - Al hacer click / focus en un input numérico que tenga valor por defecto ('0', '0.00', etc.)
 *   en un registro nuevo, se limpia automáticamente para permitir tipear directamente el valor nuevo.
 * - Si ya tiene un valor asignado previamente (ej. 1500) o está en modo edición, NO se borra;
 *   en su lugar se selecciona el texto (select()) para permitir sobreescribirlo o conservarlo.
 * - Al salir (blur), si el campo quedó vacío sin escribir nada, se restaura el valor por defecto.
 */

export const isDefaultZero = (value: unknown): boolean => {
  if (value === 0) return true;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return (
      trimmed === "0" ||
      trimmed === "0.00" ||
      trimmed === "0,00" ||
      trimmed === "0.000" ||
      trimmed === "0,000" ||
      trimmed === "00" ||
      trimmed === "000"
    );
  }
  return false;
};

export interface HandleNumericFocusOptions {
  isNew?: boolean;
  onClear?: () => void;
}

export const handleNumericInputFocus = (
  event: React.FocusEvent<HTMLInputElement>,
  options?: HandleNumericFocusOptions
) => {
  const isNew = options?.isNew ?? true;
  const currentVal = event.currentTarget.value;

  if (isNew && isDefaultZero(currentVal)) {
    event.currentTarget.value = "";
    if (options?.onClear) {
      options.onClear();
    }
  } else {
    // Timeout para que el mouseup del click de usuario no cancele la selección
    window.setTimeout(() => {
      event.target.select();
    }, 0);
  }
};

export const handleNumericInputBlur = (
  event: React.FocusEvent<HTMLInputElement>,
  defaultValue = "0",
  onRestore?: (defaultVal: string) => void
) => {
  if (!event.currentTarget.value.trim()) {
    event.currentTarget.value = defaultValue;
    if (onRestore) {
      onRestore(defaultValue);
    }
  }
};

export const parseNumericField = (value: unknown, allowNegative = false): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const normalized = String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".");

  if (!normalized) return 0;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  if (!allowNegative && parsed < 0) return 0;

  return parsed;
};
