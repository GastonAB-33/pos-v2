import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  Download,
  FilterX,
  MoreVertical,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Upload,
  X,
} from "lucide-react";
import { routePaths } from "@/config/routes";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { ProductFiltersState } from "@/modules/productos/types/product.types";
import { PRODUCT_SEARCH_SCOPE_OPTIONS, getSearchPlaceholder, type ProductSearchScope } from "@/utils/search";
import { cn } from "@/utils/cn";

interface ProductFiltersProps {
  canWrite: boolean;
  loading: boolean;
  isRefreshing?: boolean;
  selectedCount: number;
  filteredCount: number;
  filters: ProductFiltersState;
  categories: string[];
  subcategories: string[];
  suppliers: string[];
  onFiltersChange: (patch: Partial<ProductFiltersState>) => void;
  onClearFilters: () => void;
  onReload: () => void;
  onOpenCreate: () => void;
  onOpenImport: () => void;
  onExportXlsx: () => void;
  onDeleteSelected: () => void;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onOpenReturnablePackages?: () => void;
}

export const ProductFilters = ({
  canWrite,
  loading,
  isRefreshing = false,
  selectedCount,
  filteredCount,
  filters,
  categories,
  subcategories,
  suppliers,
  onFiltersChange,
  onClearFilters,
  onReload,
  onOpenCreate,
  onOpenImport,
  onExportXlsx,
  onDeleteSelected,
  onSelectAllFiltered,
  onClearSelection,
  onOpenReturnablePackages,
}: ProductFiltersProps) => {
  const { canRead } = usePermissions();
  const canReadPriceLists = canRead("listas_precios");
  const canReadPromotions = canRead("promociones");

  const [actionsOpen, setActionsOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  useBodyScrollLock(filtersModalOpen);

  const activeAdvancedFiltersCount =
    (filters.category ? 1 : 0) +
    (filters.subcategory ? 1 : 0) +
    (filters.supplier ? 1 : 0) +
    (filters.searchScope && filters.searchScope !== "all" ? 1 : 0);

  return (
    <div className="product-toolbar space-y-4">
      {/* Encabezado Principal de Productos */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {/* Breadcrumb idéntico al diseño */}
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">INVENTARIO</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">CATÁLOGO DE PRODUCTOS</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Productos
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
            Busca, edita e incorpora productos al inventario general.
          </p>
        </div>

        {/* Acciones Superiores con Botones Redondeados */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 flex-wrap sm:flex-nowrap justify-end">
          {/* Botón Actualizar */}
          <button
            type="button"
            onClick={onReload}
            disabled={loading || isRefreshing}
            className="inline-flex h-9 w-9 sm:h-10 sm:w-auto items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-0 sm:px-4 text-xs sm:text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all shrink-0 whitespace-nowrap"
            title="Actualizar productos y catálogo desde el servidor"
            aria-label="Actualizar catálogo de productos"
          >
            <RefreshCw
              size={15}
              className={cn(
                "text-slate-500 dark:text-slate-400",
                (isRefreshing || loading) && "animate-spin text-blue-600 dark:text-blue-400"
              )}
            />
            <span className="hidden sm:inline">
              {isRefreshing ? "Actualizando..." : "Actualizar"}
            </span>
          </button>

          {/* Botón Listas de Precios */}
          {canReadPriceLists && (
            <Link
              to={routePaths.listasPrecios}
              className="inline-flex h-9 w-9 sm:h-10 sm:w-auto items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-0 sm:px-4 text-xs sm:text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all shrink-0 whitespace-nowrap"
              title="Ver y configurar listas de precios"
            >
              <Tags size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="hidden lg:inline">Listas de precios</span>
              <span className="inline lg:hidden hidden sm:inline">Listas</span>
            </Link>
          )}

          {/* Botón Promociones */}
          {canReadPromotions && (
            <Link
              to={routePaths.promociones}
              className="inline-flex h-9 w-9 sm:h-10 sm:w-auto items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white p-0 sm:px-4 text-xs sm:text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all shrink-0 whitespace-nowrap"
              title="Ver y configurar promociones y combos"
            >
              <Sparkles size={15} className="text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="hidden sm:inline">Promociones</span>
            </Link>
          )}

          {/* Menú Más Acciones (...) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setActionsOpen((open) => !open)}
              className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-500 shadow-xs hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 active:scale-95 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-all shrink-0"
              title="Más acciones"
              aria-label="Más acciones"
            >
              <MoreVertical size={16} />
            </button>

            {actionsOpen ? (
              <>
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setActionsOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onOpenReturnablePackages && (
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionsOpen(false);
                        onOpenReturnablePackages();
                      }}
                    >
                      <Package className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                      Envases Retornables
                    </button>
                  )}
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left transition-colors disabled:opacity-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionsOpen(false);
                      onOpenImport();
                    }}
                    disabled={!canWrite}
                  >
                    <Upload className="h-4 w-4 text-slate-500" />
                    Importar XLSX
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionsOpen(false);
                      onExportXlsx();
                    }}
                  >
                    <Download className="h-4 w-4 text-slate-500" />
                    Exportar XLSX
                  </button>
                </div>
              </>
            ) : null}
          </div>

          {/* Botón Principal + Nuevo Producto */}
          <button
            type="button"
            onClick={onOpenCreate}
            disabled={!canWrite || loading}
            className="inline-flex h-9 sm:h-10 items-center justify-center gap-1.5 sm:gap-2 rounded-2xl bg-blue-600 px-3 sm:px-5 text-xs sm:text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 transition-all shrink-0 whitespace-nowrap"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Nuevo</span>
            <span className="hidden min-[400px]:inline">&nbsp;producto</span>
          </button>
        </div>
      </header>

      {/* Panel Redondeado de Búsqueda y Filtros */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
          {/* Campo de Búsqueda Redondeado */}
          <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden="true" />
            <input
              className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              value={filters.search}
              onChange={(event) => onFiltersChange({ search: event.target.value })}
              placeholder={getSearchPlaceholder(filters.searchScope)}
              aria-label="Buscar productos"
            />
            {filters.search ? (
              <button
                type="button"
                onClick={() => onFiltersChange({ search: "" })}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 rounded-full"
                aria-label="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              disabled={loading}
              className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 shrink-0 transition-colors rounded-lg"
              title="Escanear código de barras con cámara"
              aria-label="Escanear código de barras con cámara"
            >
              <Camera size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Botón Filtros Avanzados */}
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

            {/* Botón Limpiar Filtros */}
            {(filters.search || activeAdvancedFiltersCount > 0) ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex items-center justify-center h-9 w-9 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0"
                title="Limpiar todos los filtros"
                aria-label="Limpiar todos los filtros"
              >
                <FilterX size={16} />
              </button>
            ) : null}
          </div>
        </div>

        {/* Chips de filtros activos */}
        {activeAdvancedFiltersCount > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {filters.searchScope && filters.searchScope !== "all" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <span>
                  Búsqueda:{" "}
                  <strong>
                    {PRODUCT_SEARCH_SCOPE_OPTIONS.find((opt) => opt.value === filters.searchScope)?.label}
                  </strong>
                </span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full"
                  onClick={() => onFiltersChange({ searchScope: "all" })}
                  aria-label="Restablecer ámbito de búsqueda"
                >
                  <X size={12} />
                </button>
              </span>
            ) : null}

            {filters.category ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <span>Categoría: <strong>{filters.category}</strong></span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full"
                  onClick={() => onFiltersChange({ category: "" })}
                  aria-label="Quitar filtro de categoría"
                >
                  <X size={12} />
                </button>
              </span>
            ) : null}

            {filters.subcategory ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <span>Subcategoría: <strong>{filters.subcategory}</strong></span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full"
                  onClick={() => onFiltersChange({ subcategory: "" })}
                  aria-label="Quitar filtro de subcategoría"
                >
                  <X size={12} />
                </button>
              </span>
            ) : null}

            {filters.supplier ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <span>Proveedor: <strong>{filters.supplier}</strong></span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 rounded-full"
                  onClick={() => onFiltersChange({ supplier: "" })}
                  aria-label="Quitar filtro de proveedor"
                >
                  <X size={12} />
                </button>
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Acciones de selección múltiple */}
        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-800">
            {selectedCount < filteredCount ? (
              <button
                type="button"
                className="inline-flex items-center rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                onClick={onSelectAllFiltered}
                disabled={loading}
              >
                Seleccionar los {filteredCount} resultados
              </button>
            ) : (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Todos los {filteredCount} seleccionados
              </span>
            )}
            <button
              type="button"
              className="inline-flex items-center rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              onClick={onClearSelection}
              disabled={loading}
            >
              Quitar selección
            </button>
            <button
              type="button"
              className="rounded-xl border border-red-300 bg-red-50/50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
              onClick={onDeleteSelected}
              disabled={!canWrite || loading}
            >
              Eliminar seleccionados ({selectedCount})
            </button>
          </div>
        ) : null}
      </div>

      {/* Modal Emergente de Filtros Avanzados */}
      {filtersModalOpen ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4 backdrop-blur-[0.5px]">
          <div className="w-full max-w-md overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Filtros de productos
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
                  Ámbito de búsqueda
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={filters.searchScope ?? "all"}
                  onChange={(event) =>
                    onFiltersChange({ searchScope: event.target.value as ProductSearchScope })
                  }
                  aria-label="Tipo de búsqueda"
                >
                  {PRODUCT_SEARCH_SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Categoría
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={filters.category}
                  onChange={(event) => onFiltersChange({ category: event.target.value })}
                  aria-label="Filtrar por categoría"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  {filters.category && !categories.includes(filters.category) && (
                    <option value={filters.category}>{filters.category}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Subcategoría
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={filters.subcategory}
                  onChange={(event) => onFiltersChange({ subcategory: event.target.value })}
                  aria-label="Filtrar por subcategoría"
                >
                  <option value="">Todas las subcategorías</option>
                  {subcategories.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                  {filters.subcategory && !subcategories.includes(filters.subcategory) && (
                    <option value={filters.subcategory}>{filters.subcategory}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Proveedor
                </label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                  value={filters.supplier}
                  onChange={(event) => onFiltersChange({ supplier: event.target.value })}
                  aria-label="Filtrar por proveedor"
                >
                  <option value="">Todos los proveedores</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier} value={supplier}>
                      {supplier}
                    </option>
                  ))}
                  {filters.supplier && !suppliers.includes(filters.supplier) && (
                    <option value={filters.supplier}>{filters.supplier}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                onClick={() => {
                  onFiltersChange({ category: "", subcategory: "", supplier: "", searchScope: "all" });
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

      <BarcodeScannerModal
        open={scannerOpen}
        title="Buscar por código de barras"
        description="Apuntá la cámara al código de barras para buscar el producto automáticamente."
        onClose={() => setScannerOpen(false)}
        onDetected={(barcode) => {
          onFiltersChange({ search: barcode });
          setScannerOpen(false);
        }}
      />
    </div>
  );
};
