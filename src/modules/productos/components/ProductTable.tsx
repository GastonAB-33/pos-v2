import { useState } from "react";
import {
  Barcode,
  CheckCircle2,
  CheckSquare,
  CircleX,
  MoreVertical,
  PackageCheck,
  PackageX,
  Pencil,
  Trash2,
} from "lucide-react";
import { ProductActions } from "@/modules/productos/components/ProductActions";
import type { ProductViewModel } from "@/modules/productos/types/product.types";
import { cn } from "@/utils/cn";

interface ProductTableProps {
  products: ProductViewModel[];
  selectedIds: string[];
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const selectedSet = new Set(selectedIds);
  const isSelectionActive = selectedSet.size > 0;
  const allSelected =
    products.length > 0 && products.every((product) => selectedSet.has(product.entity.id));

  if (!products.length) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No hay productos para los filtros seleccionados.
      </div>
    );
  }

  const handleToggleTracking = (product: ProductViewModel) => {
    if (onToggleStockTracking) {
      onToggleStockTracking(product);
    } else if (onToggleFavorite) {
      onToggleFavorite(product);
    }
  };

  const getStockBadge = (product: ProductViewModel) => {
    const isWeight = product.saleMode === "weight";
    const stockVal = isWeight ? product.stock * 1000 : product.stock;
    const unit = isWeight ? "g" : "u.";
    const stockMin = product.entity.stock_min;

    if (stockVal <= 0) {
      return {
        text: `${stockVal.toLocaleString("es-AR")} ${unit}`,
        dotClass: "bg-rose-500",
        badgeClass:
          "bg-rose-50 border-rose-200/80 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-400",
      };
    }

    const isLow = stockMin != null ? stockVal <= stockMin : stockVal <= 5;
    if (isLow) {
      return {
        text: `${stockVal.toLocaleString("es-AR")} ${unit}`,
        dotClass: "bg-amber-500",
        badgeClass:
          "bg-amber-50 border-amber-200/80 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-400",
      };
    }

    return {
      text: `${stockVal.toLocaleString("es-AR")} ${unit}`,
      dotClass: "bg-emerald-500",
      badgeClass:
        "bg-emerald-50 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-400",
    };
  };

  return (
    <>
      {/* Vista Móvil: Tarjetas individuales separadas idénticas a la imagen 3 */}
      <div className="md:hidden flex flex-col gap-3">
        {products.map((product) => {
          const isSelected = selectedSet.has(product.entity.id);
          const isWeight = product.saleMode === "weight";
          const stockBadge = getStockBadge(product);
          const isMenuOpen = menuOpenId === product.entity.id;

          return (
            <article
              key={product.entity.id}
              className={cn(
                "rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col gap-2.5 transition-all",
                isSelected && "border-blue-500 bg-blue-50/20 dark:border-blue-600 dark:bg-blue-950/20 ring-1 ring-blue-500/30"
              )}
            >
              {/* Fila Superior: Badges de Categoría, Proveedor y Stock a la derecha */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  {isSelectionActive && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => onToggleSelect(product.entity.id, event.target.checked)}
                      aria-label={`Seleccionar ${product.nombre}`}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 cursor-pointer mr-0.5 shrink-0"
                    />
                  )}
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60 max-w-[160px] truncate">
                    {product.categoria || "General"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100/80 px-2 py-0.5 text-xs font-medium text-slate-500 border border-slate-200/40 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700/40 max-w-[140px] truncate">
                    {product.proveedor || product.subcategoria || "-"}
                  </span>
                </div>

                {/* Badge de Stock con punto de color */}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shrink-0",
                    stockBadge.badgeClass
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full shrink-0", stockBadge.dotClass)} />
                  <span>{stockBadge.text}</span>
                </span>
              </div>

              {/* Fila Media: Nombre del producto, imagen y código opcional */}
              <div className="flex items-start gap-3 min-w-0">
                {product.imagenUrl ? (
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-0.5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800">
                    <img
                      src={product.imagenUrl}
                      alt={product.nombre}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
                      {product.nombre}
                    </h3>
                    {product.publicadoWeb ? (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.2 text-[9.5px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                        Web
                      </span>
                    ) : null}
                  </div>
                  {product.codigoProducto ? (
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      Código: {product.codigoProducto}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Fila Inferior: PRECIO FINAL y botones circulares de acción */}
              <div className="flex items-end justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    PRECIO FINAL
                  </span>
                  <span className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {currency.format(product.precioFinal)}
                    {isWeight ? " / kg" : ""}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Botón Barcode */}
                  <button
                    type="button"
                    onClick={() => onOpenBarcode(product)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/80 text-slate-600 hover:border-slate-300 hover:bg-slate-100 active:scale-95 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                    title="Generar código de barras"
                    aria-label="Generar código de barras"
                  >
                    <Barcode size={16} />
                  </button>

                  {/* Botón Editar */}
                  <button
                    type="button"
                    onClick={() => onEdit(product)}
                    disabled={!canWrite}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/80 text-slate-600 hover:border-slate-300 hover:bg-slate-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                    title="Editar producto"
                    aria-label="Editar producto"
                  >
                    <Pencil size={15} />
                  </button>

                  {/* Botón Más Opciones (Tres puntos verticales) idéntico a imagen 3 */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMenuOpenId(isMenuOpen ? null : product.entity.id)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border border-blue-100 bg-blue-50/80 text-blue-600 hover:border-blue-200 hover:bg-blue-100 active:scale-95 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-all",
                        isMenuOpen && "ring-2 ring-blue-500/30"
                      )}
                      title="Más opciones del producto"
                      aria-label="Más opciones del producto"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {isMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40 bg-transparent"
                          onClick={() => setMenuOpenId(null)}
                          aria-hidden="true"
                        />
                        <div
                          className="absolute right-0 bottom-full mb-2 z-50 w-52 rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left transition-colors"
                            onClick={() => {
                              setMenuOpenId(null);
                              onToggleSelect(product.entity.id, !isSelected);
                            }}
                          >
                            <CheckSquare className="h-4 w-4 text-blue-500" />
                            {isSelected ? "Deseleccionar producto" : "Seleccionar producto"}
                          </button>

                          {onToggleStockTracking && (
                            <button
                              type="button"
                              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left transition-colors"
                              onClick={() => {
                                setMenuOpenId(null);
                                onToggleStockTracking(product);
                              }}
                            >
                              {(product.trackStock ?? true) ? (
                                <>
                                  <PackageX className="h-4 w-4 text-slate-400" />
                                  Desactivar control de stock
                                </>
                              ) : (
                                <>
                                  <PackageCheck className="h-4 w-4 text-emerald-500" />
                                  Activar control de stock
                                </>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={!canWrite || !canDelete}
                            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            onClick={() => {
                              setMenuOpenId(null);
                              onDelete(product);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                            Eliminar producto
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Vista de Escritorio: Tabla completa */}
      <div className="hidden md:block ui-table-wrap rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800">
            <tr>
              <th className="w-10 px-3.5 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => onToggleSelectAll(event.target.checked)}
                  aria-label="Seleccionar todos"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </th>
              <th className="px-3.5 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Producto</th>
              <th className="px-3.5 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Categoría</th>
              <th className="px-3.5 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Subcategoría</th>
              <th className="px-3.5 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Precio Final</th>
              <th className="px-3.5 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Stock</th>
              <th className="px-3.5 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Seguimiento</th>
              <th className="px-3.5 py-3 text-left font-semibold text-slate-700 dark:text-slate-200">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {products.map((product) => {
              const isSelected = selectedSet.has(product.entity.id);
              const isTracking = product.trackStock ?? true;
              const isWeight = product.saleMode === "weight";

              return (
                <tr key={product.entity.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-3.5 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => onToggleSelect(product.entity.id, event.target.checked)}
                      aria-label={`Seleccionar ${product.nombre}`}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-3">
                      {product.imagenUrl ? (
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-0.5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800">
                          <img
                            src={product.imagenUrl}
                            alt={product.nombre}
                            className="h-full w-full object-contain"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{product.nombre}</p>
                          {product.publicadoWeb ? (
                            <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60" title="Publicado en Mi Tienda">
                              Web
                            </span>
                          ) : null}
                          {product.destacadoWeb ? (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60" title="Destacado en portada">
                              ★
                            </span>
                          ) : null}
                        </div>
                        {product.codigoProducto ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">Código: {product.codigoProducto}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700/60">
                      {product.categoria || "General"}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300">{product.subcategoria || "-"}</td>
                  <td className="px-3.5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    {currency.format(product.precioFinal)}
                    {isWeight ? " / kg" : ""}
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 dark:text-slate-300">
                    {(isWeight ? product.stock * 1000 : product.stock).toLocaleString("es-AR")} {isWeight ? "g" : "u."}
                  </td>
                  <td className="px-3.5 py-3">
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
                  <td className="px-3.5 py-3">
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
    </>
  );
};
