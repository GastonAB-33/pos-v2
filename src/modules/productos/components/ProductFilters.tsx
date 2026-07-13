import { useState } from "react";
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
  const [actionsOpen, setActionsOpen] = useState(false);

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
            <button type="button" className="ui-btn-ghost" onClick={() => setActionsOpen((open) => !open)}>
              Acciones
            </button>
            {actionsOpen ? (
              <div className="workspace-action-menu">
                <button type="button" className="ui-popover-action" onClick={() => { onReload(); setActionsOpen(false); }} disabled={loading}>
                  Recargar catalogo
                </button>
                <button type="button" className="ui-popover-action" onClick={() => { onOpenImport(); setActionsOpen(false); }} disabled={!canWrite || loading}>
                  Importar XLSX
                </button>
                <button type="button" className="ui-popover-action" onClick={() => { onExportXlsx(); setActionsOpen(false); }} disabled={loading}>
                  Exportar XLSX
                </button>
              </div>
            ) : null}
          </div>
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

      <div className="workspace-filter-strip">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <input
              className="ui-input"
              value={filters.search}
              onChange={(event) => onFiltersChange({ search: event.target.value })}
              placeholder="Nombre, código o código de barras"
              aria-label="Buscar productos"
            />
          </div>

          <div>
            <input
              list="filtro-categorias-productos"
              className="ui-input"
              value={filters.category}
              onChange={(event) => onFiltersChange({ category: event.target.value })}
              placeholder="Todas"
              aria-label="Filtrar por categoría"
            />
            <datalist id="filtro-categorias-productos">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>

          <div>
            <input
              list="filtro-subcategorias-productos"
              className="ui-input"
              value={filters.subcategory}
              onChange={(event) => onFiltersChange({ subcategory: event.target.value })}
              placeholder="Todas"
              aria-label="Filtrar por subcategoría"
            />
            <datalist id="filtro-subcategorias-productos">
              {subcategories.map((subcategory) => (
                <option key={subcategory} value={subcategory} />
              ))}
            </datalist>
          </div>

          <div>
            <select
              className="ui-input"
              value={filters.supplier}
              onChange={(event) => onFiltersChange({ supplier: event.target.value })}
              aria-label="Filtrar por proveedor"
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

        <div className="workspace-filter-strip__footer">
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

          <p className="text-xs text-slate-500">Los filtros se aplican al instante.</p>
        </div>
      </div>
    </div>
  );
};
