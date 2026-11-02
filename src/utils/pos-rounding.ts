import type { PosRoundingMode, PosRoundingRule, PosRoundingTarget } from "@/types/entities";

export interface PosRoundingResult {
  originalAmount: number;
  roundedAmount: number;
  adjustmentAmount: number; // roundedAmount - originalAmount (puede ser positivo o negativo)
}

/**
 * Aplica la regla de redondeo comercial sobre un importe dado.
 */
export const calculatePosRounding = (
  amount: number,
  options?: {
    enabled?: boolean;
    rule?: PosRoundingRule;
    mode?: PosRoundingMode;
    target?: PosRoundingTarget;
    isCashPayment?: boolean;
  }
): PosRoundingResult => {
  const original = Number(amount.toFixed(2));

  // Si no está habilitado, o el monto es menor o igual a 0, o regla es "none" -> resultado idéntico
  if (
    !options?.enabled ||
    original <= 0 ||
    !options.rule ||
    options.rule === "none"
  ) {
    return {
      originalAmount: original,
      roundedAmount: original,
      adjustmentAmount: 0,
    };
  }

  // Si la configuración es "solo efectivo" y no es pago en efectivo, no se redondea
  if (options.target === "cash_only" && !options.isCashPayment) {
    return {
      originalAmount: original,
      roundedAmount: original,
      adjustmentAmount: 0,
    };
  }

  const rule = options.rule;
  const mode = options.mode ?? "nearest";

  let rounded = original;

  if (rule === "integer") {
    if (mode === "up") rounded = Math.ceil(original);
    else if (mode === "down") rounded = Math.floor(original);
    else rounded = Math.round(original);
  } else {
    const step = Number(rule);
    if (!Number.isFinite(step) || step <= 0) {
      return {
        originalAmount: original,
        roundedAmount: original,
        adjustmentAmount: 0,
      };
    }

    if (mode === "up") {
      rounded = Math.ceil(original / step) * step;
    } else if (mode === "down") {
      rounded = Math.floor(original / step) * step;
    } else {
      rounded = Math.round(original / step) * step;
    }
  }

  // Limpiar posibles imprecisiones de coma flotante de JS
  rounded = Number(rounded.toFixed(2));
  const adjustment = Number((rounded - original).toFixed(2));

  return {
    originalAmount: original,
    roundedAmount: rounded,
    adjustmentAmount: adjustment,
  };
};
