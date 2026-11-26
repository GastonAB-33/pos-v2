import { TrendingDown, TrendingUp } from "lucide-react";

interface PurchaseCostDiffBadgeProps {
  previousCost: number;
  currentCost: number;
  className?: string;
  compact?: boolean;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

/**
 * Indicador visual de variación de precio de costo para compras de proveedores.
 * - Caso 1: Precio igual (o sin historial previo) -> No muestra nada, solo el precio normal.
 * - Caso 2: Precio bajó -> Destacado en verde con precio anterior y nuevo, y tooltip detallado.
 * - Caso 3: Precio subió -> Destacado en rojo con precio anterior y nuevo, y tooltip detallado.
 */
export const PurchaseCostDiffBadge = ({
  previousCost,
  currentCost,
  className = "",
  compact = false,
}: PurchaseCostDiffBadgeProps) => {
  // Caso 1: Si no hay costo previo de referencia (producto nuevo sin historial) o el precio es el mismo, no mostrar nada
  if (!previousCost || previousCost <= 0) return null;

  const diff = currentCost - previousCost;
  // Consideramos diferencia significativa si cambia al menos 1 centavo
  if (Math.abs(diff) < 0.005) return null;

  const costIncreased = diff > 0;
  const pctDiff = (diff / previousCost) * 100;
  const absDiff = Math.abs(diff);

  return (
    <div className={`relative group inline-flex items-center ${className}`}>
      <span
        tabIndex={0}
        role="note"
        aria-label={
          costIncreased
            ? `Costo subió: antes ${currency.format(previousCost)}, nuevo ${currency.format(currentCost)} (+${pctDiff.toFixed(1)}%)`
            : `Costo bajó: antes ${currency.format(previousCost)}, nuevo ${currency.format(currentCost)} (${pctDiff.toFixed(1)}%)`
        }
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shadow-2xs cursor-help transition select-none ${
          costIncreased
            ? "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/90"
            : "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/90"
        }`}
      >
        {costIncreased ? (
          <TrendingUp className="h-3.5 w-3.5 text-red-600 dark:text-red-400 shrink-0" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        )}

        {compact ? (
          <span>
            {costIncreased ? `Subió +${pctDiff.toFixed(1)}%` : `Bajó ${pctDiff.toFixed(1)}%`}
          </span>
        ) : (
          <span>
            Antes: <span className="font-medium text-slate-600 dark:text-slate-300">{currency.format(previousCost)}</span> → Nuevo:{" "}
            <span className="font-black">{currency.format(currentCost)}</span>
            <span className="ml-1 opacity-90">
              ({costIncreased ? `+${pctDiff.toFixed(1)}%` : `${pctDiff.toFixed(1)}%`})
            </span>
          </span>
        )}
      </span>

      {/* Tooltip flotante emergente al pasar el cursor (hover) */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col gap-1.5 rounded-xl bg-slate-900 text-white p-3 text-xs shadow-2xl z-50 min-w-[230px] border border-slate-700 dark:bg-slate-800 dark:border-slate-600">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5 font-bold">
          <span className="flex items-center gap-1.5">
            {costIncreased ? (
              <TrendingUp className="h-4 w-4 text-red-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-emerald-400" />
            )}
            <span className={costIncreased ? "text-red-300" : "text-emerald-300"}>
              {costIncreased ? "Costo SUBIÓ" : "Costo BAJÓ"}
            </span>
          </span>
          <span className={`font-black text-xs ${costIncreased ? "text-red-400" : "text-emerald-400"}`}>
            {costIncreased ? `+${pctDiff.toFixed(1)}%` : `${pctDiff.toFixed(1)}%`}
          </span>
        </div>

        <div className="flex justify-between text-slate-300 text-[11px] pt-0.5">
          <span>Costo anterior (catálogo):</span>
          <strong className="text-slate-200 font-semibold">{currency.format(previousCost)}</strong>
        </div>

        <div className="flex justify-between text-slate-300 text-[11px]">
          <span>Nuevo costo de compra:</span>
          <strong className={costIncreased ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
            {currency.format(currentCost)}
          </strong>
        </div>

        <div className="flex justify-between text-slate-400 text-[11px] pt-1.5 border-t border-slate-800">
          <span>Variación neta por unidad:</span>
          <strong className={costIncreased ? "text-red-400" : "text-emerald-400"}>
            {costIncreased ? `+${currency.format(absDiff)}` : `-${currency.format(absDiff)}`}
          </strong>
        </div>
      </div>
    </div>
  );
};
