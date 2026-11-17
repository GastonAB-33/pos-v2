import { useState } from "react";
import { FilterX, Plus, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { PriceList } from "@/types/entities";
import { cn } from "@/utils/cn";

export interface CustomersFiltersState {
  search: string;
  status: "all" | "active" | "inactive";
  priceListId: string;
  account: "all" | "enabled" | "with_debt";
}

interface CustomersToolbarProps {
  canWrite: boolean;
  loading: boolean;
  totalCount: number;
  filteredCount: number;
  filters: CustomersFiltersState;
  priceLists: PriceList[];
  onFiltersChange: (patch: Partial<CustomersFiltersState>) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  onReload: () => void;
}

export const CustomersToolbar = ({
  canWrite,
  loading,
  totalCount,
  filteredCount,
  filters,
  priceLists,
  onFiltersChange,
  onClearFilters,
  onCreate,
  onReload,
}: CustomersToolbarProps) => {
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  useBodyScrollLock(filtersModalOpen);

  const activeAdvancedFiltersCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.priceListId ? 1 : 0) +
    (filters.account !== "all" ? 1 : 0);

  const hasActiveFilters = Boolean(filters.search.trim()) || activeAdvancedFiltersCount > 0;

  const currentPriceListName =
    priceLists.find((pl) => pl.id === filters.priceListId)?.name ?? "Lista seleccionada";

  return (
    <div className="customers-toolbar space-y-4">
      {/* 1. Header flotante sin borde rígido wrapper */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Breadcrumb en mayúsculas con jerarquía */}
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">VENTAS</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">AGENDA DE CLIENTES</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Clientes
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Agenda de contactos, datos fiscales, límites de crédito y cuentas corrientes.
          </p>
        </div>

        {/* Fila de Botones Píldora */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Botón Secundario Píldora: Actualizar */}
          <button
            type="button"
            onClick={onReload}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Recargar listado de clientes"
          >
            <RefreshCw
              size={15}
              className={cn(
                "text-slate-500 dark:text-slate-400",
                loading && "animate-spin text-blue-600 dark:text-blue-400"
              )}
            />
            <span className="hidden sm:inline">{loading ? "Actualizando..." : "Actualizar"}</span>
          </button>

          {/* Botón Primario Píldora: Nuevo Cliente */}
          <button
            type="button"
            onClick={onCreate}
            disabled={!canWrite || loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Nuevo cliente</span>
          </button>
        </div>
      </header>

      {/* 2. Barra de Búsqueda y Filtros Avanzados (idéntico a Productos) */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
          {/* Input de Búsqueda Redondeado */}
          <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              type="text"
              className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              placeholder="Buscar por nombre, documento, teléfono o email..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onFiltersChange({ search: "" })}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Botones de Filtros Avanzados y Limpiar */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setFiltersModalOpen(true)}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 shrink-0 transition-all cursor-pointer",
                activeAdvancedFiltersCount > 0 &&
                  "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
              )}
            >
              <SlidersHorizontal size={15} className="text-blue-600 dark:text-blue-400" />
              <span>Filtros avanzados</span>
              {activeAdvancedFiltersCount > 0 ? (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {activeAdvancedFiltersCount}
                </span>
              ) : null}
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex items-center justify-center h-9 w-9 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0"
                title="Limpiar todos los filtros"
                aria-label="Limpiar todos los filtros"
              >
                <FilterX size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Chips de filtros activos */}
        {activeAdvancedFiltersCount > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {filters.status !== "all" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <span>
                  Estado: <strong>{filters.status === "active" ? "Solo Activos" : "Solo Inactivos"}</strong>
                </span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full"
                  onClick={() => onFiltersChange({ status: "all" })}
                  aria-label="Quitar filtro de estado"
                >
                  <X size={12} />
                </button>
              </span>
            ) : null}

            {filters.account !== "all" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <span>
                  Cta Cte: <strong>{filters.account === "enabled" ? "Habilitada" : "Con deuda"}</strong>
                </span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full"
                  onClick={() => onFiltersChange({ account: "all" })}
                  aria-label="Quitar filtro de cuenta corriente"
                >
                  <X size={12} />
                </button>
              </span>
            ) : null}

            {filters.priceListId ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <span>
                  Lista: <strong>{currentPriceListName}</strong>
                </span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full"
                  onClick={() => onFiltersChange({ priceListId: "" })}
                  aria-label="Quitar filtro de lista de precios"
                >
                  <X size={12} />
                </button>
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Resumen de conteo */}
        <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {hasActiveFilters ? (
              <>
                Mostrando <strong className="text-slate-800 dark:text-slate-200">{filteredCount}</strong> de {totalCount} clientes
              </>
            ) : (
              <>
                Total de clientes: <strong className="text-slate-800 dark:text-slate-200">{totalCount}</strong>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Modal Emergente de Filtros Avanzados (idéntico a Productos) */}
      {filtersModalOpen ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4 backdrop-blur-[0.5px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Filtros de clientes
                </h3>
              </div>
              <ModalCloseButton
                label="Cerrar filtros"
                onClick={() => setFiltersModalOpen(false)}
              />
            </div>

            <div className="space-y-4 py-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Estado del cliente
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={filters.status}
                  onChange={(e) =>
                    onFiltersChange({ status: e.target.value as CustomersFiltersState["status"] })
                  }
                  aria-label="Filtrar por estado"
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Solo Activos</option>
                  <option value="inactive">Solo Inactivos</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Cuenta Corriente
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={filters.account}
                  onChange={(e) =>
                    onFiltersChange({ account: e.target.value as CustomersFiltersState["account"] })
                  }
                  aria-label="Filtrar por cuenta corriente"
                >
                  <option value="all">Todas las cuentas corrientes</option>
                  <option value="enabled">Cta Cte Habilitada</option>
                  <option value="with_debt">Con deuda pendiente</option>
                </select>
              </div>

              {priceLists.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Lista de precios asignada
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                    value={filters.priceListId}
                    onChange={(e) => onFiltersChange({ priceListId: e.target.value })}
                    aria-label="Filtrar por lista de precios"
                  >
                    <option value="">Todas las listas de precios</option>
                    {priceLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                onClick={() => {
                  onFiltersChange({ status: "all", account: "all", priceListId: "" });
                }}
                disabled={activeAdvancedFiltersCount === 0}
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                onClick={() => setFiltersModalOpen(false)}
              >
                Aplicar y cerrar
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};
