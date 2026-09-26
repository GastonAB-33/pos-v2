import { useState } from "react";
import { Camera, Download, Ellipsis, FilterX, Plus, RefreshCw, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { IconButton } from "@/components/ui/IconButton";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { ProductFiltersState } from "@/modules/productos/types/product.types";
import { PRODUCT_SEARCH_SCOPE_OPTIONS, getSearchPlaceholder, type ProductSearchScope } from "@/utils/search";

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
}: ProductFiltersProps) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  useBodyScrollLock(filtersModalOpen);

  const activeAdvancedFiltersCount =
    (filters.category ? 1 : 0) +
    (filters.subcategory ? 1 : 0) +
    (filters.supplier ? 1 : 0);

  return (
    <div className="workspace-toolbar space-y-3">
      <header className="workspace-toolbar__header">
        <div>
          <p className="ui-section-label">Catalogo</p>
          <h1 className="text-2xl font-semibold text-slate-900">Productos</h1>
          <p className="mt-1 text-sm text-slate-600">Busca, edita e incorpora productos al inventario.</p>
        </div>

        <div className="workspace-toolbar__actions">
          <IconButton
            icon={RefreshCw}
            label={isRefreshing ? "Actualizando catálogo..." : "Actualizar catálogo"}
            onClick={onReload}
            loading={isRefreshing || loading}
          />

          <div className="relative z-30">
            <IconButton
              icon={Ellipsis}
              label="Más acciones"
              onClick={() => setActionsOpen((open) => !open)}
            />
            {actionsOpen ? (
              <>
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setActionsOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="workspace-action-menu left-0 right-auto z-50 shadow-2xl"
                  style={{ zIndex: 50 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="ui-popover-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionsOpen(false);
                      onReload();
                    }}
                    disabled={loading}
                  >
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    Recargar catalogo
                  </button>
                  <button
                    type="button"
                    className="ui-popover-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionsOpen(false);
                      onOpenImport();
                    }}
                    disabled={!canWrite}
                  >
                    <Upload aria-hidden="true" className="h-4 w-4" />
                    Importar XLSX
                  </button>
                  <button
                    type="button"
                    className="ui-popover-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionsOpen(false);
                      onExportXlsx();
                    }}
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                    Exportar XLSX
                  </button>
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="ui-btn-primary"
            onClick={onOpenCreate}
            disabled={!canWrite || loading}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            <span>Nuevo producto</span>
          </button>
        </div>
      </header>

      <div className="workspace-filter-strip">
        {/* Barra principal de búsqueda y controles de filtro */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Campo de búsqueda principal */}
          <div className="flex flex-1 items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-500 overflow-hidden px-2.5 py-1">
            <Search className="h-4 w-4 text-slate-400 shrink-0 ml-0.5" aria-hidden="true" />
            <input
              className="flex-1 min-w-0 border-0 bg-transparent px-2 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
              value={filters.search}
              onChange={(event) => onFiltersChange({ search: event.target.value })}
              placeholder={getSearchPlaceholder(filters.searchScope)}
              aria-label="Buscar productos"
            />
            {filters.search ? (
              <button
                type="button"
                onClick={() => onFiltersChange({ search: "" })}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                aria-label="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            ) : null}

            {/* Ámbito en Desktop: integrado en la barra */}
            <div className="hidden sm:block h-4 w-[1px] bg-slate-200 dark:bg-slate-700 shrink-0" />
            <select
              value={filters.searchScope ?? "all"}
              onChange={(event) =>
                onFiltersChange({ searchScope: event.target.value as ProductSearchScope })
              }
              className="hidden sm:block bg-transparent text-xs font-medium text-slate-600 focus:outline-none dark:text-slate-300 cursor-pointer py-1 px-1 shrink-0"
              aria-label="Tipo de búsqueda"
            >
              {PRODUCT_SEARCH_SCOPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <IconButton
              icon={Camera}
              label="Escanear código de barras con cámara"
              onClick={() => setScannerOpen(true)}
              disabled={loading}
              className="shrink-0"
            />
          </div>

          {/* Fila de controles secundarios (en móvil abajo, en desktop al lado) */}
          <div className="flex items-center gap-2">
            {/* Ámbito en Móvil: dropdown táctil independiente */}
            <div className="sm:hidden flex-1 min-w-0">
              <select
                value={filters.searchScope ?? "all"}
                onChange={(event) =>
                  onFiltersChange({ searchScope: event.target.value as ProductSearchScope })
                }
                className="w-full h-9 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                aria-label="Ámbito de búsqueda"
              >
                {PRODUCT_SEARCH_SCOPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label === "Todos" ? "Buscar: Todos" : opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className={`ui-btn-ghost gap-2 px-3 py-2 text-xs sm:text-sm font-medium h-9 sm:h-auto ${
                activeAdvancedFiltersCount > 0
                  ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950 dark:text-blue-300"
                  : ""
              } ${!filters.search && activeAdvancedFiltersCount === 0 ? "flex-1 sm:flex-initial" : ""}`}
              onClick={() => setFiltersModalOpen(true)}
            >
              <SlidersHorizontal aria-hidden="true" size={15} />
              <span>Filtros</span>
              {activeAdvancedFiltersCount > 0 ? (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.2 text-[11px] font-bold text-white">
                  {activeAdvancedFiltersCount}
                </span>
              ) : null}
            </button>

            {(filters.search || activeAdvancedFiltersCount > 0) ? (
              <IconButton
                icon={FilterX}
                label="Limpiar todos los filtros"
                onClick={onClearFilters}
              />
            ) : null}
          </div>
        </div>

        {/* Chips de filtros activos */}
        {activeAdvancedFiltersCount > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {filters.category ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <span>Categoría: <strong>{filters.category}</strong></span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-900"
                  onClick={() => onFiltersChange({ category: "" })}
                  aria-label="Quitar filtro de categoría"
                >
                  <X size={12} />
                </button>
              </span>
            ) : null}

            {filters.subcategory ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <span>Subcategoría: <strong>{filters.subcategory}</strong></span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-900"
                  onClick={() => onFiltersChange({ subcategory: "" })}
                  aria-label="Quitar filtro de subcategoría"
                >
                  <X size={12} />
                </button>
              </span>
            ) : null}

            {filters.supplier ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                <span>Proveedor: <strong>{filters.supplier}</strong></span>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-900"
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
          <div className="workspace-filter-strip__footer flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 dark:border-slate-800">
            {selectedCount < filteredCount ? (
              <button
                type="button"
                className="ui-btn-ghost px-3 py-1.5 text-xs"
                onClick={onSelectAllFiltered}
                disabled={loading}
              >
                Seleccionar los {filteredCount} resultados
              </button>
            ) : (
              <span className="ui-badge ui-badge--info">Todos los {filteredCount} seleccionados</span>
            )}
            <button
              type="button"
              className="ui-btn-ghost px-3 py-1.5 text-xs"
              onClick={onClearSelection}
              disabled={loading}
            >
              Quitar seleccion
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
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
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-blue-600" />
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
                  Categoría
                </label>
                <input
                  list="filtro-categorias-productos"
                  className="ui-input w-full"
                  value={filters.category}
                  onChange={(event) => onFiltersChange({ category: event.target.value })}
                  placeholder="Buscar o seleccionar categoría..."
                  aria-label="Filtrar por categoría"
                />
                <datalist id="filtro-categorias-productos">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Subcategoría
                </label>
                <input
                  list="filtro-subcategorias-productos"
                  className="ui-input w-full"
                  value={filters.subcategory}
                  onChange={(event) => onFiltersChange({ subcategory: event.target.value })}
                  placeholder="Buscar o seleccionar subcategoría..."
                  aria-label="Filtrar por subcategoría"
                />
                <datalist id="filtro-subcategorias-productos">
                  {subcategories.map((subcategory) => (
                    <option key={subcategory} value={subcategory} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Proveedor
                </label>
                <select
                  className="ui-input w-full"
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
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
              <button
                type="button"
                className="ui-btn-ghost text-xs text-slate-600 dark:text-slate-400"
                onClick={() => {
                  onFiltersChange({ category: "", subcategory: "", supplier: "" });
                }}
                disabled={activeAdvancedFiltersCount === 0}
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                className="ui-btn-primary px-4 py-2 text-sm"
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
