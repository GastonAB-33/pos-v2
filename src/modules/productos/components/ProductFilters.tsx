import type { ProductFiltersState } from "@/modules/productos/types/product.types";

interface ProductFiltersProps {
  canWrite: boolean;
  loading: boolean;
  selectedCount: number;
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
}

export const ProductFilters = ({
  canWrite,
  loading,
  selectedCount,
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
}: ProductFiltersProps) => {
  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Gestión de Productos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Administra el catálogo del sistema y los niveles de inventario.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="ui-btn-ghost"
            onClick={onReload}
            disabled={loading}
          >
            Recargar
          </button>
          <button
            type="button"
            className="ui-btn-ghost"
            onClick={onOpenImport}
            disabled={!canWrite || loading}
          >
            Importar XLSX
          </button>
          <button
            type="button"
            className="ui-btn-ghost"
            onClick={onExportXlsx}
            disabled={loading}
          >
            Exportar XLSX
          </button>
          <button
            type="button"
            className="ui-btn-primary"
            onClick={onOpenCreate}
            disabled={!canWrite || loading}
          >
            Nuevo Producto
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Buscar
            </label>
            <input
              className="ui-input"
              value={filters.search}
              onChange={(event) => onFiltersChange({ search: event.target.value })}
              placeholder="Nombre, código o código de barras"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Categoría
            </label>
            <input
              list="filtro-categorias-productos"
              className="ui-input"
              value={filters.category}
              onChange={(event) => onFiltersChange({ category: event.target.value })}
              placeholder="Todas"
            />
            <datalist id="filtro-categorias-productos">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Subcategoría
            </label>
            <input
              list="filtro-subcategorias-productos"
              className="ui-input"
              value={filters.subcategory}
              onChange={(event) => onFiltersChange({ subcategory: event.target.value })}
              placeholder="Todas"
            />
            <datalist id="filtro-subcategorias-productos">
              {subcategories.map((subcategory) => (
                <option key={subcategory} value={subcategory} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Proveedor
            </label>
            <select
              className="ui-input"
              value={filters.supplier}
              onChange={(event) => onFiltersChange({ supplier: event.target.value })}
            >
              <option value="">Todos</option>
              {suppliers.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button type="button" className="ui-btn-ghost" onClick={onClearFilters}>
              Limpiar filtros
            </button>
            {selectedCount > 0 ? (
              <button
                type="button"
                className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700"
                onClick={onDeleteSelected}
                disabled={!canWrite || loading}
              >
                Eliminar seleccionados ({selectedCount})
              </button>
            ) : null}
          </div>

          <p className="text-xs text-slate-500">Vista optimizada para escritorio y tablet.</p>
        </div>
      </div>
    </div>
  );
};
