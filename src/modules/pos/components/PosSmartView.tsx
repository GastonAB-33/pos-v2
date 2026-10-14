import { useEffect, useMemo, useRef, useState } from "react";
import {
  Coins,
  FileText,
  Moon,
  MoonStar,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useUiStore } from "@/store/ui.store";
import type { Product } from "@/types/entities";
import type { PosCartItem } from "@/modules/pos/hooks/usePosSale";
import {
  matchesProductSearch,
  PRODUCT_SEARCH_SCOPE_OPTIONS,
  getSearchPlaceholder,
  type ProductSearchScope,
} from "@/utils/search";
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
  onCycleReturnableStatus?: (productId: string) => void;
  disabled?: boolean;
  canWrite?: boolean;
  onOpenDebtPaymentModal?: () => void;
  hasDebtPaymentInCart?: boolean;
  debtPaymentAmount?: number;

  // Catálogo y búsqueda
  products: Product[];
  primaryBarcodes: Record<string, string>;
  onAddProduct: (product: Product, quantity?: number) => Promise<boolean | void>;
  onScanBarcode: (barcode: string) => Promise<boolean>;

  // Totales y Cobro
  subtotal: number;
  total: number;
  roundingAdjustment?: number;
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
  onCycleReturnableStatus,
  disabled = false,
  canWrite = true,
  onOpenDebtPaymentModal,
  hasDebtPaymentInCart = false,
  debtPaymentAmount = 0,
  products,
  primaryBarcodes,
  onAddProduct,
  onScanBarcode,
  subtotal,
  total,
  roundingAdjustment = 0,
  onCheckout,
  userName,
  operatorInitials,
  isRefreshingCatalog,
  onRefreshCatalog,
  onOpenReceipts,
  onOpenQuickProduct,
}: PosSmartViewProps) => {
  const theme = useUiStore((state) => state.theme);
  const cycleTheme = useUiStore((state) => state.cycleTheme);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<ProductSearchScope>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const cartContainerRef = useRef<HTMLDivElement | null>(null);
  const lastItemRef = useRef<HTMLElement | null>(null);
  const prevItemsLengthRef = useRef(items.length);

  // Último producto en la secuencia de carga del carrito
  const lastAddedProductId = items.length > 0 ? items[items.length - 1].product_id : null;

  useEffect(() => {
    // Si se agregó un nuevo producto, hacemos scroll suave hacia la fila recién agregada
    if (items.length > prevItemsLengthRef.current) {
      lastItemRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevItemsLengthRef.current = items.length;
  }, [items.length]);

  // Filtrado de productos para el buscador inteligente
  const searchResults = useMemo(() => {
    const raw = searchQuery.trim();
    if (!raw) return [];

    return products
      .filter((product) => {
        const barcode = primaryBarcodes[product.id] ?? "";
        return matchesProductSearch(
          {
            name: product.name,
            code: product.code,
            barcode,
            brand: product.brand,
            category: product.category,
            subcategory: product.subcategory,
          },
          raw,
          searchScope
        );
      })
      .slice(0, 10);
  }, [products, primaryBarcodes, searchQuery, searchScope]);

  const handleSearchKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const query = searchQuery.trim();
      if (!query) return;

      // Intentar primero como código de barras directo si el ámbito no es "solo nombre"
      if (searchScope !== "name") {
        const scanned = await onScanBarcode(query);
        if (scanned) {
          setSearchQuery("");
          setIsSearchOpen(false);
          return;
        }
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
              placeholder={getSearchPlaceholder(searchScope)}
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
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value as ProductSearchScope)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer py-0.5 px-1 shrink-0 max-w-[150px] truncate"
              aria-label="Filtro de búsqueda"
            >
              {PRODUCT_SEARCH_SCOPE_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-white dark:bg-[#0d162d] text-slate-900 dark:text-slate-100 font-medium py-1"
                >
                  {opt.label}
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

        {/* Lista de productos escaneados: 1 columna vertical continua y filas compactas estilizadas (Opción 1 + 3) */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-2">
            <ShoppingCart size={40} className="text-slate-400 dark:text-slate-600 opacity-60 mb-1" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">El carrito está vacío</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
              Escaneá un código de barras o escribí en el buscador superior para agregar productos.
            </p>
          </div>
        ) : (
          <div
            ref={cartContainerRef}
            className="flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[360px] pr-1"
          >
            {items.map((item, index) => {
              const isLastItem = item.product_id === lastAddedProductId;
              const itemSubtotal =
                "line_total" in item && typeof (item as { line_total?: number }).line_total === "number"
                  ? (item as { line_total: number }).line_total
                  : item.unit_price * item.quantity;

              return (
                <article
                  key={item.product_id}
                  ref={isLastItem ? lastItemRef : undefined}
                  className={cn(
                    "group rounded-xl border p-2.5 sm:p-3 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs",
                    isLastItem
                      ? "border-blue-400 dark:border-sky-500/80 bg-blue-50/50 dark:bg-sky-950/25 ring-1 ring-blue-400/30 dark:ring-sky-500/30"
                      : "border-slate-200 dark:border-slate-800/90 bg-slate-50/70 dark:bg-[#0e172e] hover:border-slate-300 dark:hover:border-slate-700/80"
                  )}
                >
                  {/* Información del producto (Nombre, orden, categoría y precio unitario) */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                        #{index + 1}
                      </span>
                      <h3
                        className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 uppercase tracking-tight truncate max-w-full"
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                      {isLastItem ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 dark:bg-sky-900/60 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-sky-700/60">
                          Último agregado
                        </span>
                      ) : null}
                      {item.is_debt_payment_item ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60">
                          Cobro Cta. Cte.
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      {item.is_debt_payment_item ? (
                        <span>Cancelación de saldo pendiente</span>
                      ) : (
                        <>
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {currency.format(item.unit_price)} / {item.sale_mode === "weight" ? "kg" : "u."}
                          </span>
                          {item.category ? (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className="truncate max-w-[140px]">{item.category}</span>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>

                    {/* Botón rápido de estado de envase retornable */}
                    {item.returnable_config?.enabled && onCycleReturnableStatus ? (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          Envase ({item.returnable_config.packageName}):
                        </span>
                        <button
                          type="button"
                          onClick={() => onCycleReturnableStatus(item.product_id)}
                          disabled={disabled || !canWrite}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border transition shadow-2xs cursor-pointer",
                            item.returnable_status === "charge"
                              ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900"
                              : item.returnable_status === "owe"
                              ? "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900"
                              : "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-900"
                          )}
                          title="Hacé clic para cambiar: Canje mano a mano / Cobrar envase / Anotar en cuenta corriente"
                        >
                          {item.returnable_status === "charge" ? (
                            <>
                              <span>💰 Cobrar envase</span>
                              <span className="font-extrabold text-[10px]">
                                (+{currency.format(item.returnable_config.packagePrice * item.quantity)})
                              </span>
                            </>
                          ) : item.returnable_status === "owe" ? (
                            <>
                              <span>📝 Debe envase</span>
                              <span className="font-normal text-[10px]">(Cta. Cte.)</span>
                            </>
                          ) : (
                            <>
                              <span>🔄 Canje</span>
                              <span className="font-normal text-[10px]">(Trajo envase)</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Controles de cantidad táctiles compactos */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.is_debt_payment_item ? (
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800/50">
                        Pago único
                      </span>
                    ) : (
                      <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => onDecrease(item.product_id)}
                          disabled={disabled || !canWrite}
                          className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-bold transition disabled:opacity-40"
                          title="Disminuir cantidad"
                        >
                          -
                        </button>
                        <span className="min-w-[44px] px-1 text-center font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 tabular-nums">
                          {item.sale_mode === "weight" ? `${item.quantity} kg` : item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onIncrease(item.product_id)}
                          disabled={disabled || !canWrite}
                          className="w-7 h-7 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-bold transition disabled:opacity-40"
                          title="Aumentar cantidad"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Subtotal destacado y botones de acción */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800/60">
                    <div className="text-left sm:text-right min-w-[90px]">
                      <span className="text-[10px] block text-slate-400 sm:hidden">Subtotal</span>
                      <span className="font-extrabold text-sm sm:text-base text-blue-600 dark:text-sky-400 tracking-tight">
                        {currency.format(itemSubtotal)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        disabled={disabled || !canWrite}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-semibold transition disabled:opacity-40"
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
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
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

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cycleTheme}
                className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 px-2.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition shadow-2xs"
                title={`Tema actual: ${theme === "midnight" ? "Azul Medianoche" : theme === "dark" ? "Oscuro" : "Claro"}. Clic para cambiar.`}
              >
                {theme === "midnight" ? (
                  <MoonStar size={14} className="text-indigo-400" />
                ) : theme === "dark" ? (
                  <Moon size={14} className="text-amber-300" />
                ) : (
                  <Sun size={14} className="text-amber-500" />
                )}
                <span className="text-[11px] font-bold">
                  {theme === "midnight" ? "Azul" : theme === "dark" ? "Oscuro" : "Claro"}
                </span>
              </button>

              <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-900/80 px-2.5 py-1.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-600 text-xs font-bold text-white shadow-sm">
                  {operatorInitials}
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[100px]">
                    {userName}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Operador</p>
                </div>
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
            <div className="flex items-center gap-1.5">
              {onOpenDebtPaymentModal ? (
                <button
                  type="button"
                  onClick={onOpenDebtPaymentModal}
                  disabled={disabled || !canWrite}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition shadow-2xs disabled:opacity-50",
                    hasDebtPaymentInCart
                      ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-600/80 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/60"
                      : "border-indigo-200 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700/70 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                  )}
                  title={hasDebtPaymentInCart ? "Modificar cobro de cuenta corriente" : "Agregar cobro de deuda de cuenta corriente al carrito"}
                >
                  <Coins size={13} className={hasDebtPaymentInCart ? "text-amber-600 dark:text-amber-400" : "text-indigo-600 dark:text-indigo-400"} />
                  <span>{hasDebtPaymentInCart ? "Editar deuda" : "Cobrar deuda"}</span>
                </button>
              ) : null}

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
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="text-slate-900 dark:text-slate-200 font-medium">
                {currency.format(subtotal)}
              </span>
            </div>

            {hasDebtPaymentInCart && debtPaymentAmount > 0 ? (
              <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-900/60">
                <span className="flex items-center gap-1.5">
                  <Coins size={13} className="text-amber-600 dark:text-amber-400" />
                  <span>Cobro Cta. Cte.</span>
                </span>
                <span>+{currency.format(debtPaymentAmount)}</span>
              </div>
            ) : null}

            {roundingAdjustment !== 0 ? (
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Redondeo comercial</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  {roundingAdjustment > 0 ? `+${currency.format(roundingAdjustment)}` : currency.format(roundingAdjustment)}
                </span>
              </div>
            ) : null}

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
