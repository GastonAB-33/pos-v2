import { useState } from "react";
import { Camera, Download, Ellipsis, FilterX, Plus, RefreshCw, SlidersHorizontal, Upload, X } from "lucide-react";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { IconButton } from "@/components/ui/IconButton";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { ProductFiltersState } from "@/modules/productos/types/product.types";

interface ProductFiltersProps {
  canWrite: boolean;
  loading: boolean;
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
          <div className="relative">
            <IconButton
              icon={Ellipsis}
              label="Más acciones"
              onClick={() => setActionsOpen((open) => !open)}
            />
            {actionsOpen ? (
              <>
                <div
                  className="fixed inset-0 z-30 bg-transparent"
                  onClick={() => setActionsOpen(false)}
                  aria-hidden="true"
                />
                <div className="workspace-action-menu left-0 right-auto z-40 shadow-2xl">
                  <button
                    type="button"
                    className="ui-popover-action"
                    onClick={() => {
                      onReload();
                      setActionsOpen(false);
                    }}
                    disabled={loading}
                  >
                    <RefreshCw aria-hidden="true" className="h-4 w-4" />
                    Recargar catalogo
                  </button>
                  <button
                    type="button"
                    className="ui-popover-action"
                    onClick={() => {
                      onOpenImport();
                      setActionsOpen(false);
                    }}
                    disabled={!canWrite || loading}
                  >
                    <Upload aria-hidden="true" className="h-4 w-4" />
                    Importar XLSX
                  </button>
                  <button
                    type="button"
                    className="ui-popover-action"
                    onClick={() => {
                      onExportXlsx();
                      setActionsOpen(false);
                    }}
                    disabled={loading}
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
            Nuevo producto
          </button>
        </div>
      </header>

      <div className="workspace-filter-strip">
        {/* Barra principal de búsqueda compacta */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[200px] items-center gap-2">
            <input
              className="ui-input flex-1"
              value={filters.search}
              onChange={(event) => onFiltersChange({ search: event.target.value })}
              placeholder="Nombre, código o código de barras"
              aria-label="Buscar productos"
            />
            <IconButton
              icon={Camera}
              label="Escanear código de barras con cámara"
              onClick={() => setScannerOpen(true)}
              disabled={loading}
            />
          </div>

          <button
            type="button"
            className={`ui-btn-ghost gap-2 px-3 py-2 text-sm font-medium ${
              activeAdvancedFiltersCount > 0
                ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950 dark:text-blue-300"
                : ""
            }`}
            onClick={() => setFiltersModalOpen(true)}
          >
            <SlidersHorizontal aria-hidden="true" size={16} />
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
