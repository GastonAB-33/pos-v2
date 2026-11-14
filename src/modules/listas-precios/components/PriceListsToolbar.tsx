import { Plus, RefreshCw, Search, X } from "lucide-react";

interface PriceListsToolbarProps {
  canWrite: boolean;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onReload: () => void;
}

export const PriceListsToolbar = ({
  canWrite,
  loading,
  search,
  onSearchChange,
  onCreate,
  onReload,
}: PriceListsToolbarProps) => {
  return (
    <div className="price-lists-toolbar space-y-4">
      {/* Encabezado Principal de Listas de Precios */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Breadcrumb con jerarquía de navegación */}
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">INVENTARIO</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">LISTAS DE PRECIOS</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Listas de Precios
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Crea y administra diferentes esquemas de precios para tus clientes y canales de venta.
          </p>
        </div>

        {/* Acciones Superiores con Botones Redondeados */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Botón Actualizar */}
          <button
            type="button"
            onClick={onReload}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <RefreshCw size={15} className={`text-slate-500 dark:text-slate-400 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>

          {/* Botón Primario: Crear Nueva Lista */}
          <button
            type="button"
            onClick={onCreate}
            disabled={!canWrite || loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Nueva lista de precios</span>
          </button>
        </div>
      </header>

      {/* Barra de Búsqueda Integrada con bordes redondeados modernos */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
          {/* Input de Búsqueda Redondeado */}
          <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar por nombre de lista o descripción..."
              className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
