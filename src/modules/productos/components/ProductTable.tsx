import { ProductActions } from "@/modules/productos/components/ProductActions";
import type { ProductViewModel } from "@/modules/productos/types/product.types";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, CircleX, PackageCheck, PackageX } from "lucide-react";
import type { ProductSortField, ProductSortState } from "@/modules/productos/types/product.types";

interface ProductTableProps {
  products: ProductViewModel[];
  selectedIds: string[];
  sort?: ProductSortState;
  onToggleSort?: (field: ProductSortField) => void;
  canWrite: boolean;
  canDelete: boolean;
  onToggleSelect: (productId: string, selected: boolean) => void;
  onToggleSelectAll: (selected: boolean) => void;
  onToggleStockTracking?: (product: ProductViewModel) => void;
  onToggleFavorite?: (product: ProductViewModel) => void;
  onOpenBarcode: (product: ProductViewModel) => void;
  onEdit: (product: ProductViewModel) => void;
  onDelete: (product: ProductViewModel) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const ProductTable = ({
  products,
  selectedIds,
  sort,
  onToggleSort,
  canWrite,
  canDelete,
  onToggleSelect,
  onToggleSelectAll,
  onToggleStockTracking,
  onToggleFavorite,
  onOpenBarcode,
  onEdit,
  onDelete,
}: ProductTableProps) => {
  const selectedSet = new Set(selectedIds);
  const allSelected =
    products.length > 0 && products.every((product) => selectedSet.has(product.entity.id));

  if (!products.length) {
    return <div className="ui-empty-state">No hay productos para los filtros seleccionados.</div>;
  }

  const handleToggleTracking = (product: ProductViewModel) => {
    if (onToggleStockTracking) {
      onToggleStockTracking(product);
    } else if (onToggleFavorite) {
      onToggleFavorite(product);
    }
  };

  const renderSortHeader = (label: string, field: ProductSortField) => {
    if (!onToggleSort) return label;
    const isActive = sort?.field === field;
    const isAsc = sort?.direction === "asc";

    return (
      <button
        type="button"
        onClick={() => onToggleSort(field)}
        className="group inline-flex items-center gap-1.5 font-bold hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer select-none transition"
        title={`Ordenar por ${label} (${isActive && isAsc ? "descendente" : "ascendente"})`}
      >
        <span>{label}</span>
        {isActive ? (
          isAsc ? (
            <ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </button>
    );
  };

  return (
    <div className="ui-table-wrap">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="w-10 px-3 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => onToggleSelectAll(event.target.checked)}
                aria-label="Seleccionar todos"
              />
            </th>
            <th className="px-3 py-3 text-left">
              {renderSortHeader("Producto", "nombre")}
            </th>
            <th className="px-3 py-3 text-left">
              {renderSortHeader("Categoría", "categoria")}
            </th>
            <th className="px-3 py-3 text-left">
              {renderSortHeader("Subcategoría", "subcategoria")}
            </th>
            <th className="px-3 py-3 text-left">
              {renderSortHeader("Precio Final", "precioFinal")}
            </th>
            <th className="px-3 py-3 text-left">
              {renderSortHeader("Stock", "stock")}
            </th>
            <th className="px-3 py-3 text-left">
              {renderSortHeader("Seguimiento", "trackStock")}
            </th>
            <th className="px-3 py-3 text-left">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {products.map((product) => {
            const isSelected = selectedSet.has(product.entity.id);
            const isTracking = product.trackStock ?? true;
            const isWeight = product.saleMode === "weight";

            return (
              <tr key={product.entity.id}>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(event) => onToggleSelect(product.entity.id, event.target.checked)}
                    aria-label={`Seleccionar ${product.nombre}`}
                  />
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{product.nombre}</p>
                  {product.codigoProducto ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Código: {product.codigoProducto}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{product.categoria}</td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{product.subcategoria || "-"}</td>
                <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">
                  {currency.format(product.precioFinal)}
                  {isWeight ? " / kg" : ""}
                </td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                  {(isWeight ? product.stock * 1000 : product.stock).toLocaleString("es-AR")} {isWeight ? "g" : "u."}
                </td>
                <td className="px-3 py-3">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      title={isTracking ? "Seguimiento de stock activo (clic para desactivar)" : "Sin seguimiento de stock (clic para activar)"}
                      aria-label={isTracking ? "Desactivar seguimiento de stock" : "Activar seguimiento de stock"}
                      onClick={() => handleToggleTracking(product)}
                      disabled={!canWrite}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 ${
                        isTracking ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {isTracking ? (
                        <PackageCheck aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <PackageX aria-hidden="true" className="h-4 w-4" />
                      )}
                    </button>
                    <span
                      aria-label={product.activo ? "Producto activo" : "Producto inactivo"}
                      title={product.activo ? "Producto activo" : "Producto inactivo"}
                      className="inline-flex h-4 w-4 items-center justify-center"
                      style={{ color: product.activo ? "var(--ui-success)" : "var(--ui-danger)" }}
                    >
                      {product.activo ? (
                        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                      ) : (
                        <CircleX aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <ProductActions
                    canWrite={canWrite}
                    canDelete={canDelete}
                    onBarcode={() => onOpenBarcode(product)}
                    onEdit={() => onEdit(product)}
                    onDelete={() => onDelete(product)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
