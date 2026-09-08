import { cn } from "@/utils/cn";
import type { StockStatusFilter } from "@/modules/stock/utils/stock-labels";

interface StockSummaryCardsProps {
  activeProducts: number;
  lowStock: number;
  noStock: number;
  overMax: number;
  activeFilter?: StockStatusFilter;
  onSelectFilter?: (filter: StockStatusFilter) => void;
}

export const StockSummaryCards = ({
  activeProducts,
  lowStock,
  noStock,
  overMax,
  activeFilter = "all",
  onSelectFilter,
}: StockSummaryCardsProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onSelectFilter?.("all")}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
          activeFilter === "all"
            ? "bg-slate-900 text-white shadow-sm dark:bg-slate-700"
            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        )}
      >
        <span>Todos:</span>
        <strong>{activeProducts}</strong>
      </button>

      <button
        type="button"
        onClick={() => onSelectFilter?.("low")}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
          activeFilter === "low"
            ? "bg-amber-500 text-white shadow-sm"
            : "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
        )}
      >
        <span>Bajo mínimo:</span>
        <strong className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[11px] text-amber-900 dark:text-amber-200">
          {lowStock}
        </strong>
      </button>

      <button
        type="button"
        onClick={() => onSelectFilter?.("no_stock")}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
          activeFilter === "no_stock"
            ? "bg-red-600 text-white shadow-sm"
            : "border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        )}
      >
        <span>Sin stock:</span>
        <strong className="rounded-full bg-red-600/20 px-1.5 py-0.2 text-[11px] text-red-900 dark:text-red-200">
          {noStock}
        </strong>
      </button>

      <button
        type="button"
        onClick={() => onSelectFilter?.("over")}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
          activeFilter === "over"
            ? "bg-blue-600 text-white shadow-sm"
            : "border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300"
        )}
      >
        <span>Sobre máximo:</span>
        <strong className="rounded-full bg-blue-600/20 px-1.5 py-0.2 text-[11px] text-blue-900 dark:text-blue-200">
          {overMax}
        </strong>
      </button>
    </div>
  );
};
