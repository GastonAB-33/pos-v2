import { ArrowLeft, Plus, RefreshCw, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { routePaths } from "@/config/routes";

interface PromotionsToolbarProps {
  canWrite: boolean;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onReload: () => void;
}

export const PromotionsToolbar = ({
  canWrite,
  loading,
  search,
  onSearchChange,
  onCreate,
  onReload,
}: PromotionsToolbarProps) => {
  return (
    <div className="space-y-4">
      {/* Encabezado Principal Flotante */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Breadcrumb con estándar moderno */}
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <Link
              to={routePaths.productos}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            >
              INVENTARIO
            </Link>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <Link
              to={routePaths.productos}
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            >
              PRODUCTOS
            </Link>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">PROMOCIONES Y COMBOS</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Promociones
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Packs, combos y descuentos automáticos aplicables en ventas.
          </p>
        </div>

        {/* Acciones superiores píldora */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Botón Volver a Productos */}
          <Link
            to={routePaths.productos}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all"
            title="Volver al catálogo de productos"
          >
            <ArrowLeft size={16} className="text-slate-500 dark:text-slate-400" />
            <span>Volver a Productos</span>
          </Link>

          <button
            type="button"
            onClick={onReload}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all"
            title="Recargar promociones"
            aria-label="Recargar promociones"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}
            />
            <span className="hidden sm:inline">Recargar</span>
          </button>

          <button
            type="button"
            onClick={onCreate}
            disabled={!canWrite || loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
          >
            <Plus size={16} />
            <span>Nueva promoción</span>
          </button>
        </div>
      </header>

      {/* Franja de Búsqueda Elevada y Redondeada */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, código o tipo..."
            className="w-full rounded-xl sm:rounded-2xl border border-slate-300 bg-slate-50/50 py-2 pl-10 pr-10 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:bg-slate-900"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
              title="Limpiar búsqueda"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
