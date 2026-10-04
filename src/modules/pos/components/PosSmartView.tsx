import { useMemo, useRef, useState } from "react";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import type { Product } from "@/types/entities";
import type { PosCartItem } from "@/modules/pos/hooks/usePosSale";
import { matchesProductSearch } from "@/utils/search";
import { cn } from "@/utils/cn";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export interface PosSmartViewProps {
  // Carrito
  items: PosCartItem[];
  isHighlighted?: boolean;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onEdit: (item: PosCartItem) => void;
  onRemove: (productId: string) => void;
  onClearCart: () => void;
  disabled?: boolean;
  canWrite?: boolean;

  // Catálogo y búsqueda
  products: Product[];
  primaryBarcodes: Record<string, string>;
  onAddProduct: (product: Product, quantity?: number) => Promise<boolean | void>;
  onScanBarcode: (barcode: string) => Promise<boolean>;

  // Totales y Cobro
  subtotal: number;
  total: number;
  onCheckout: () => void;

  // Panel de funciones superior derecho
  userName: string;
  operatorInitials: string;
  isRefreshingCatalog: boolean;
  onRefreshCatalog: () => void;
  onOpenReceipts: () => void;
  onOpenQuickProduct: () => void;
}

export const PosSmartView = ({
  items,
  isHighlighted = false,
  onIncrease,
  onDecrease,
  onEdit,
  onRemove,
  onClearCart,
  disabled = false,
  canWrite = true,
  products,
  primaryBarcodes,
  onAddProduct,
  onScanBarcode,
  subtotal,
  total,
  onCheckout,
  userName,
  operatorInitials,
  isRefreshingCatalog,
  onRefreshCatalog,
  onOpenReceipts,
  onOpenQuickProduct,
}: PosSmartViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Lista de categorías únicas para el dropdown
  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(products.map((p) => p.category?.trim()).filter(Boolean))
    ) as string[];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [products]);

  // Filtrado de productos para el buscador inteligente
  const searchResults = useMemo(() => {
    const raw = searchQuery.trim();
    if (!raw) return [];

    return products
      .filter((product) => {
        const barcode = primaryBarcodes[product.id] ?? "";
        const matchesQuery = matchesProductSearch(
          {
            name: product.name,
            code: product.code,
            barcode,
            brand: product.brand,
            category: product.category,
            subcategory: product.subcategory,
          },
          raw,
          "all"
        );

        if (!matchesQuery) return false;
        if (selectedCategory !== "all" && product.category !== selectedCategory) {
          return false;
        }
        return true;
      })
      .slice(0, 10);
  }, [products, primaryBarcodes, searchQuery, selectedCategory]);

  const handleSearchKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const query = searchQuery.trim();
      if (!query) return;

      // Intentar primero como código de barras directo
      const scanned = await onScanBarcode(query);
      if (scanned) {
        setSearchQuery("");
        setIsSearchOpen(false);
        return;
      }

      // Si no es un escaneo directo pero hay un resultado exacto o primero en la lista
      if (searchResults.length > 0) {
        await onAddProduct(searchResults[0], 1);
        setSearchQuery("");
        setIsSearchOpen(false);
      }
    } else if (event.key === "Escape") {
      setIsSearchOpen(false);
    }
  };

  const handleSelectSearchResult = async (product: Product) => {
    await onAddProduct(product, 1);
    setSearchQuery("");
    setIsSearchOpen(false);
    searchInputRef.current?.focus();
  };

  return (
    <div className="pos-smart-container w-full max-w-[1550px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 p-2 sm:p-3">
      {/* =========================================================================
          PANEL CENTRAL / IZQUIERDO: BUSCADOR Y LISTA DE PRODUCTOS ESCANEADOS
      ========================================================================= */}
      <section
        className={cn(
          "lg:col-span-8 flex flex-col rounded-2xl border transition-all duration-300",
          "bg-white dark:bg-[#0b1325] border-slate-200 dark:border-slate-800/90 p-4 sm:p-5 shadow-sm min-h-[580px]",
          isHighlighted && "ring-2 ring-emerald-500/60 border-emerald-500/80"
        )}
      >
        {/* Encabezado: Carrito (N ítems) + Botón Vaciar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="text-blue-600 dark:text-sky-400" size={20} />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Carrito ({items.length} {items.length === 1 ? "ítem" : "ítems"})
            </h2>
          </div>

          {items.length > 0 ? (
            <button
              type="button"
              onClick={onClearCart}
              disabled={disabled || !canWrite}
              className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800/50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/70 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-50"
            >
              Vaciar
            </button>
          ) : null}
        </div>

        {/* Buscador general con filtro desplegable de categoría */}
        <div className="relative mb-5 z-20">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0f1a33] px-3.5 py-2.5 focus-within:border-blue-500 dark:focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:focus-within:ring-sky-500/20 transition-all shadow-inner">
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsSearchOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar por nombre, código o barra..."
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none min-w-0"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />

            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X size={14} />
              </button>
            ) : null}

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700/80 mx-1 shrink-0" />

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer py-0.5 px-1 shrink-0 max-w-[120px] truncate"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                Todos
              </option>
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Menú flotante de resultados del buscador */}
          {isSearchOpen && searchResults.length > 0 ? (
            <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700/90 bg-white dark:bg-[#0d162d] p-1.5 shadow-2xl z-30 divide-y divide-slate-100 dark:divide-slate-800">
              {searchResults.map((prod) => {
                const barcode = primaryBarcodes[prod.id];
                return (
                  <div
                    key={prod.id}
                    onClick={() => void handleSelectSearchResult(prod)}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {prod.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {prod.category} {barcode ? `| Barcode: ${barcode}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-blue-600 dark:text-sky-400">
                        {currency.format(prod.price)}
                      </span>
                      <button
                        type="button"
                        className="rounded-lg bg-blue-50 dark:bg-sky-600/30 text-blue-600 dark:text-sky-300 p-1 hover:bg-blue-100 dark:hover:bg-sky-600/50"
                        title="Agregar al carrito"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Lista de productos escaneados organizados en 2 columnas */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
            <ShoppingCart size={40} className="text-slate-400 dark:text-slate-600 opacity-60 mb-1" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">El carrito está vacío</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
              Escaneá un código de barras o escribí en el buscador superior para agregar productos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start flex-1 content-start">
            {items.map((item) => (
              <article
                key={item.product_id}
                className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50/70 dark:bg-[#0e172e] p-3 sm:p-3.5 flex flex-col justify-between gap-2.5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700/80 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 uppercase tracking-tight line-clamp-1"
                      title={item.name}
                    >
                      {item.name}
                    </h3>
                    <span className="font-bold text-xs sm:text-sm text-blue-600 dark:text-sky-400 whitespace-nowrap">
                      {currency.format(
                        "line_total" in item && typeof (item as { line_total?: number }).line_total === "number"
                          ? (item as { line_total: number }).line_total
                          : item.unit_price * item.quantity
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {currency.format(item.unit_price)} /{" "}
                    {item.sale_mode === "weight" ? "kg" : "u."}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/70">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDecrease(item.product_id)}
                      disabled={disabled || !canWrite}
                      className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-bold transition disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="min-w-[24px] text-center font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                      {item.sale_mode === "weight" ? `${item.quantity} kg` : item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onIncrease(item.product_id)}
                      disabled={disabled || !canWrite}
                      className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-bold transition disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      disabled={disabled || !canWrite}
                      className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-medium transition disabled:opacity-40"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item.product_id)}
                      disabled={disabled || !canWrite}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition disabled:opacity-40"
                      title="Eliminar producto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* =========================================================================
          COLUMNA LATERAL DERECHA: FUNCIONES Y DETALLE DE PAGO
      ========================================================================= */}
      <aside className="lg:col-span-4 flex flex-col gap-3.5">
        {/* Panel Superior Derecho: Botones y funciones */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0b1325] p-3.5 sm:p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onRefreshCatalog}
              disabled={isRefreshingCatalog || disabled}
              className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={isRefreshingCatalog ? "animate-spin text-blue-600 dark:text-sky-400" : ""}
              />
              <span>Actualizar productos</span>
            </button>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-900/80 px-2.5 py-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-600 text-xs font-bold text-white shadow-sm">
                {operatorInitials}
              </span>
              <div className="leading-tight">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[110px]">
                  {userName}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Operador de caja</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenReceipts}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition"
            >
              <FileText size={14} />
              <span>Comprobantes</span>
            </button>

            <button
              type="button"
              onClick={onOpenQuickProduct}
              disabled={disabled || !canWrite}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition disabled:opacity-50"
            >
              <span>Producto rápido</span>
            </button>
          </div>
        </div>

        {/* Panel Inferior Derecho: Detalle de total y confirmación de cobro */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0b1325] p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-blue-600 dark:text-sky-400" />
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Carrito ({items.length} {items.length === 1 ? "ítem" : "ítems"})
              </span>
            </div>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={onClearCart}
                disabled={disabled || !canWrite}
                className="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-800/40 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60 transition disabled:opacity-50"
              >
                Vaciar
              </button>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="text-slate-900 dark:text-slate-200 font-medium">
                {currency.format(subtotal)}
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Total final</span>
              <span className="text-2xl font-black text-blue-600 dark:text-sky-400 tracking-tight">
                {currency.format(total)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCheckout}
            disabled={disabled || !canWrite || items.length === 0}
            className="w-full rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 active:bg-fuchsia-700 text-white font-bold py-3.5 px-4 text-center transition-all shadow-lg shadow-fuchsia-950/40 disabled:opacity-40 disabled:cursor-not-allowed text-sm sm:text-base flex items-center justify-center gap-2"
          >
            <span>Confirmar venta ({currency.format(total)})</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
