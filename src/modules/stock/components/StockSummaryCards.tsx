import {
  Package,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  SlidersHorizontal,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/utils/cn";
import type { StockStatusFilter } from "@/modules/stock/utils/stock-labels";

interface StockSummaryCardsProps {
  activeProducts: number;
  lowStock: number;
  overMax: number;
  unassigned: number;
  activeFilter?: StockStatusFilter;
  onSelectFilter?: (filter: StockStatusFilter) => void;
  onConfigureUnassigned?: () => void;
}

export const StockSummaryCards = ({
  activeProducts,
  lowStock,
  overMax,
  unassigned,
  activeFilter = "all",
  onSelectFilter,
  onConfigureUnassigned,
}: StockSummaryCardsProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
      {/* 1. Todos los productos */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectFilter?.("all")}
        onKeyDown={(e) => e.key === "Enter" && onSelectFilter?.("all")}
        className={cn(
          "relative flex flex-col justify-between rounded-2xl border bg-white p-3 sm:p-4 shadow-xs transition-all cursor-pointer text-left select-none dark:bg-slate-900",
          activeFilter === "all"
            ? "border-blue-500 ring-2 ring-blue-500/25 bg-blue-50/20 dark:border-blue-500/80 dark:bg-blue-950/20"
            : "border-slate-200/90 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:hover:border-slate-700"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
            <Package size={17} />
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
            TOTAL
          </span>
        </div>

        <div className="mt-2 sm:mt-2.5">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            Todos los productos
          </p>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {activeProducts.toLocaleString("es-AR")}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
              arts.
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[10.5px] sm:text-xs font-medium text-emerald-600 dark:border-slate-800 dark:text-emerald-400 truncate">
          <TrendingUp size={13} className="shrink-0" />
          <span className="truncate">Catálogo activo</span>
        </div>
      </div>

      {/* 2. Stock bajo / Quiebre */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectFilter?.("low")}
        onKeyDown={(e) => e.key === "Enter" && onSelectFilter?.("low")}
        className={cn(
          "relative flex flex-col justify-between rounded-2xl border bg-white p-3 sm:p-4 shadow-xs transition-all cursor-pointer text-left select-none dark:bg-slate-900",
          activeFilter === "low"
            ? "border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/20 dark:border-amber-500/80 dark:bg-amber-950/20"
            : "border-slate-200/90 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:hover:border-slate-700"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              "flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border",
              lowStock > 0
                ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-900/40"
                : "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/40"
            )}
          >
            {lowStock > 0 ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0",
              lowStock > 0
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
            )}
          >
            {lowStock > 0 ? `${lowStock} ALERTA${lowStock > 1 ? "S" : ""}` : "ÓPTIMO"}
          </span>
        </div>

        <div className="mt-2 sm:mt-2.5">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            Stock bajo / Quiebre
          </p>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span
              className={cn(
                "text-xl sm:text-2xl font-black tracking-tight",
                lowStock > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-900 dark:text-slate-100"
              )}
            >
              {lowStock}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
              críticas
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[10.5px] sm:text-xs font-medium dark:border-slate-800 truncate">
          {lowStock > 0 ? (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 truncate">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 animate-pulse" />
              <span className="truncate">Reponer urgente</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 truncate">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span className="truncate">Sin riesgo</span>
            </span>
          )}
        </div>
      </div>

      {/* 3. Sobrestock */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectFilter?.("over")}
        onKeyDown={(e) => e.key === "Enter" && onSelectFilter?.("over")}
        className={cn(
          "relative flex flex-col justify-between rounded-2xl border bg-white p-3 sm:p-4 shadow-xs transition-all cursor-pointer text-left select-none dark:bg-slate-900",
          activeFilter === "over"
            ? "border-blue-500 ring-2 ring-blue-500/25 bg-blue-50/20 dark:border-blue-500/80 dark:bg-blue-950/20"
            : "border-slate-200/90 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:hover:border-slate-700"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
            <AlertCircle size={17} />
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shrink-0",
              overMax > 0
                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            )}
          >
            {overMax > 0 ? `${overMax} ALERTA` : "NORMAL"}
          </span>
        </div>

        <div className="mt-2 sm:mt-2.5">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            Sobrestock
          </p>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {overMax}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
              {overMax === 1 ? "art." : "arts."}
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[10.5px] sm:text-xs font-medium dark:border-slate-800 truncate">
          {overMax > 0 ? (
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 truncate">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span className="truncate">Excede máximo</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              <span className="truncate">Nivel normal</span>
            </span>
          )}
        </div>
      </div>

      {/* 4. Sin asignar mín / máx */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectFilter?.("unassigned")}
        onKeyDown={(e) => e.key === "Enter" && onSelectFilter?.("unassigned")}
        className={cn(
          "relative flex flex-col justify-between rounded-2xl border bg-white p-3 sm:p-4 shadow-xs transition-all cursor-pointer text-left select-none dark:bg-slate-900",
          activeFilter === "unassigned"
            ? "border-slate-500 ring-2 ring-slate-400/25 bg-slate-50/60 dark:border-slate-600 dark:bg-slate-800/40"
            : "border-slate-200/90 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:hover:border-slate-700"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
            <SlidersHorizontal size={17} />
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
            PENDIENTE
          </span>
        </div>

        <div className="mt-2 sm:mt-2.5">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            Sin asignar mín / máx
          </p>
          <div className="mt-0.5 flex items-baseline justify-between gap-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {unassigned.toLocaleString("es-AR")}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onConfigureUnassigned) {
                  onConfigureUnassigned();
                } else {
                  onSelectFilter?.("unassigned");
                }
              }}
              className="inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 group shrink-0 cursor-pointer"
            >
              <span>Config.</span>
              <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[10.5px] sm:text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400 truncate">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="truncate">Sin parámetros</span>
        </div>
      </div>
    </div>
  );
};
