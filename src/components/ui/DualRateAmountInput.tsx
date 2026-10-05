import React, { useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { handleNumericInputFocus } from "@/utils/input-helpers";

export type RateAmountMode = "percent" | "amount";

export interface DualRateAmountInputProps {
  /** Nombre o concepto del impuesto, recargo o descuento (ej: "IIBB", "Descuento", "Recargo") */
  label: string;
  /** Modo actual: alícuota porcentual o monto fijo */
  mode: RateAmountMode;
  /** Callback al cambiar el modo */
  onModeChange: (nextMode: RateAmountMode) => void;
  /** Valor actual en porcentaje (ej: 3.5) */
  percentValue: number;
  /** Valor actual en monto monetario (ej: 150) */
  amountValue: number;
  /** Base imponible o subtotal sobre el que se calculan los porcentajes o montos */
  baseTotal: number;
  /** Callback al cambiar el valor porcentual */
  onPercentChange: (percent: number) => void;
  /** Callback al cambiar el valor monetario */
  onAmountChange: (amount: number) => void;
  /** Deshabilita la interacción */
  disabled?: boolean;
  /** Color de acento para el texto resaltado */
  accentColor?: "amber" | "blue" | "emerald" | "purple" | "slate";
  /** Identificador HTML para el input */
  id?: string;
  /** Clases adicionales para el contenedor */
  className?: string;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const roundAmount = (val: number): number => Math.round(val * 100) / 100;

export const DualRateAmountInput: React.FC<DualRateAmountInputProps> = ({
  label,
  mode,
  onModeChange,
  percentValue,
  amountValue,
  baseTotal,
  onPercentChange,
  onAmountChange,
  disabled = false,
  accentColor = "amber",
  id,
  className,
}) => {
  const [draft, setDraft] = useState<string | null>(null);

  // Sincronizar el draft cuando cambian los valores externos
  useEffect(() => {
    setDraft(null);
  }, [mode, percentValue, amountValue]);

  // Cálculo del valor proyectado/equivalente
  const calculatedAmount =
    mode === "percent"
      ? roundAmount(baseTotal * ((percentValue || 0) / 100))
      : amountValue;

  const equivalentPercent =
    mode === "amount"
      ? baseTotal > 0
        ? roundAmount(((amountValue || 0) / baseTotal) * 100)
        : 0
      : percentValue;

  // Valor a mostrar en el input
  const displayValue =
    draft ??
    (mode === "percent"
      ? percentValue === 0
        ? "0"
        : percentValue.toString()
      : amountValue === 0
      ? "0"
      : amountValue.toString());

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDraft(raw);

    const clean = raw.trim().replace(",", ".");
    if (clean === "") {
      if (mode === "percent") {
        onPercentChange(0);
      } else {
        onAmountChange(0);
      }
      return;
    }

    const parsed = Number(clean);
    if (!isNaN(parsed) && parsed >= 0) {
      if (mode === "percent") {
        onPercentChange(Math.min(100, parsed));
      } else {
        onAmountChange(roundAmount(parsed));
      }
    }
  };

  const handleModeSwitch = (nextMode: RateAmountMode) => {
    if (nextMode === mode || disabled) return;

    if (nextMode === "amount") {
      // Al pasar a monto, precargar el monto equivalente si ya había un porcentaje
      const derivedAmount = roundAmount(baseTotal * ((percentValue || 0) / 100));
      onAmountChange(derivedAmount);
    } else {
      // Al pasar a porcentaje, precargar el porcentaje equivalente si ya había un monto
      const derivedPercent =
        baseTotal > 0 ? roundAmount(((amountValue || 0) / baseTotal) * 100) : 0;
      onPercentChange(Math.min(100, derivedPercent));
      onAmountChange(0);
    }

    setDraft(null);
    onModeChange(nextMode);
  };

  const accentColorStyles = {
    amber: {
      text: "text-amber-700 dark:text-amber-400",
      activeTab: "text-amber-700 dark:text-amber-400",
      focusBorder: "focus:border-amber-500",
    },
    blue: {
      text: "text-blue-700 dark:text-blue-400",
      activeTab: "text-blue-700 dark:text-blue-400",
      focusBorder: "focus:border-blue-500",
    },
    emerald: {
      text: "text-emerald-700 dark:text-emerald-400",
      activeTab: "text-emerald-700 dark:text-emerald-400",
      focusBorder: "focus:border-emerald-500",
    },
    purple: {
      text: "text-purple-700 dark:text-purple-400",
      activeTab: "text-purple-700 dark:text-purple-400",
      focusBorder: "focus:border-purple-500",
    },
    slate: {
      text: "text-slate-800 dark:text-slate-200",
      activeTab: "text-slate-900 dark:text-slate-100",
      focusBorder: "focus:border-slate-500",
    },
  }[accentColor];

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 transition-colors dark:border-slate-700 dark:bg-slate-900/90",
        className
      )}
    >
      {/* Selector toggle segmentado: % o $ */}
      <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => handleModeSwitch("percent")}
          disabled={disabled}
          className={cn(
            "rounded px-1 py-0.5 text-[9px] font-bold leading-none transition select-none disabled:opacity-50",
            mode === "percent"
              ? cn(
                  "bg-white shadow-xs dark:bg-slate-900",
                  accentColorStyles.activeTab
                )
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          )}
          title="Ingresar como alícuota porcentual (%)"
        >
          %
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch("amount")}
          disabled={disabled}
          className={cn(
            "rounded px-1 py-0.5 text-[9px] font-bold leading-none transition select-none disabled:opacity-50",
            mode === "amount"
              ? cn(
                  "bg-white shadow-xs dark:bg-slate-900",
                  accentColorStyles.activeTab
                )
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          )}
          title="Ingresar como monto monetario fijo ($)"
        >
          $
        </button>
      </div>

      {/* Etiqueta del concepto */}
      <label
        htmlFor={id}
        className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 cursor-pointer"
      >
        {label}:
      </label>

      {/* Input numérico con ancho constante y compacto */}
      <div className="flex items-center">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          max={mode === "percent" ? 100 : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          value={displayValue}
          onFocus={handleNumericInputFocus}
          onChange={handleInputChange}
          onBlur={() => setDraft(null)}
          disabled={disabled}
          placeholder="0"
          className={cn(
            "w-12 sm:w-14 rounded border border-slate-300 bg-white px-1 py-0.5 text-center text-xs font-bold text-slate-900 transition focus:outline-none dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100",
            accentColorStyles.focusBorder
          )}
        />
      </div>

      {/* Valor complementario calculado entre paréntesis */}
      <span className={cn("font-bold text-[10px] sm:text-[11px] whitespace-nowrap", accentColorStyles.text)}>
        {mode === "percent"
          ? `(${currency.format(calculatedAmount)})`
          : `(${equivalentPercent.toFixed(2)} %)`}
      </span>
    </div>
  );
};
