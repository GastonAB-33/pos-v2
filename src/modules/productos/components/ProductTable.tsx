import { ProductActions } from "@/modules/productos/components/ProductActions";
import type { ProductViewModel } from "@/modules/productos/types/product.types";

interface ProductTableProps {
  products: ProductViewModel[];
  selectedIds: string[];
  canWrite: boolean;
  canDelete: boolean;
  onToggleSelect: (productId: string, selected: boolean) => void;
  onToggleSelectAll: (selected: boolean) => void;
  onToggleFavorite: (product: ProductViewModel) => void;
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
  canWrite,
  canDelete,
  onToggleSelect,
  onToggleSelectAll,
  onToggleFavorite,
  onOpenBarcode,
  onEdit,
  onDelete,
}: ProductTableProps) => {
  const selectedSet = new Set(selectedIds);
  const allSelected = products.length > 0 && selectedIds.length === products.length;

  if (!products.length) {
    return <div className="ui-empty-state">No hay productos para los filtros seleccionados.</div>;
  }

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
            <th className="px-3 py-3 text-left">Producto</th>
            <th className="px-3 py-3 text-left">Categoría</th>
            <th className="px-3 py-3 text-left">Subcategoría</th>
            <th className="px-3 py-3 text-left">Precio Final</th>
            <th className="px-3 py-3 text-left">Stock</th>
            <th className="px-3 py-3 text-left">Favorito</th>
            <th className="px-3 py-3 text-left">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {products.map((product) => {
            const isSelected = selectedSet.has(product.entity.id);
            const isFavorite = product.favorito;
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
                  <p className="font-medium text-slate-900">{product.nombre}</p>
                  <p className="text-xs text-slate-500">Código: {product.codigoProducto}</p>
                </td>
                <td className="px-3 py-3">{product.categoria}</td>
                <td className="px-3 py-3">{product.subcategoria || "-"}</td>
                <td className="px-3 py-3 font-medium text-slate-900">
                  {currency.format(product.precioFinal)}
                  {isWeight ? " / kg" : ""}
                </td>
                <td className="px-3 py-3">
                  {product.stock.toLocaleString("es-AR")} {isWeight ? "kg" : "u."}
                </td>
                <td className="px-3 py-3">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      title={isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                      aria-label={isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
                      onClick={() => onToggleFavorite(product)}
                      disabled={!canWrite}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ color: isFavorite ? "var(--ui-accent)" : "var(--ui-muted)" }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill={isFavorite ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="m12 3.8 2.57 5.21 5.75.84-4.16 4.06.98 5.73L12 16.98 6.86 19.64l.98-5.73L3.68 9.85l5.75-.84L12 3.8z" />
                      </svg>
                    </button>
                    <span
                      aria-label={product.activo ? "Producto activo" : "Producto inactivo"}
                      title={product.activo ? "Producto activo" : "Producto inactivo"}
                      className="inline-flex h-4 w-4 items-center justify-center"
                      style={{ color: product.activo ? "var(--ui-success)" : "var(--ui-danger)" }}
                    >
                      {product.activo ? (
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 8.3 6.3 11.2 13 4.7" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="m4.2 4.2 7.6 7.6M11.8 4.2l-7.6 7.6" />
                        </svg>
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
