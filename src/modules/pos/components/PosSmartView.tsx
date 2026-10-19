import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgePercent,
  Calculator,
  Coins,
  FileText,
  Moon,
  MoonStar,
  Percent,
  Plus,
  PlusCircle,
  RefreshCw,
  Scale,
  Search,
  ShoppingCart,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useUiStore } from "@/store/ui.store";
import { QuickPriceGlobalModal } from "@/modules/productos/components/QuickPriceGlobalModal";
import type { Product } from "@/types/entities";
import type {
  PosCartItem,
  PosCartItemComputed,
  CartManualDiscount,
} from "@/modules/pos/hooks/usePosSale";
import {
  matchesProductSearch,
  PRODUCT_SEARCH_SCOPE_OPTIONS,
  getSearchPlaceholder,
  type ProductSearchScope,
} from "@/utils/search";
import { cn } from "@/utils/cn";
import { handleNumericInputFocus, handleNumericInputBlur } from "@/utils/input-helpers";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const kgToGrams = (quantityKg: number): number => Number((quantityKg * 1000).toFixed(3));
const gramsToKg = (quantityGrams: number): number => Number((quantityGrams / 1000).toFixed(3));

export interface PosSmartViewProps {
  // Carrito
  items: (PosCartItem | PosCartItemComputed)[];
  isHighlighted?: boolean;
  onIncrease: (productId: string) => void;
  onDecrease: (productId: string) => void;
  onSetQuantity?: (productId: string, quantity: number) => void;
  onEdit: (item: PosCartItem | PosCartItemComputed) => void;
  onRemove: (productId: string) => void;
  onClearCart: () => void;
  onCycleReturnableStatus?: (productId: string) => void;
  disabled?: boolean;
  canWrite?: boolean;
  onOpenDebtPaymentModal?: () => void;
  hasDebtPaymentInCart?: boolean;
  debtPaymentAmount?: number;

  // Descuentos y Promociones
  cartManualDiscount?: CartManualDiscount | null;
  manualCartDiscountTotal?: number;
  subtotalBeforePromotions?: number;
  onOpenCartDiscountModal?: () => void;
  onRemoveCartDiscount?: () => void;
  onOpenItemPromoModal?: (item: PosCartItemComputed) => void;

  // Catálogo y búsqueda
  products: Product[];
  primaryBarcodes: Record<string, string>;
  onAddProduct: (product: Product, quantity?: number) => Promise<boolean | void>;
  onScanBarcode: (barcode: string) => Promise<boolean>;

  // Totales y Cobro
  subtotal: number;
  total: number;
  roundingAdjustment?: number;
  roundingEnabled?: boolean;
  onToggleRounding?: () => void;
  discountsEnabled?: boolean;
  onToggleDiscounts?: () => void;
  promotionDiscountTotal?: number;
  lastAddedProductId?: string | null;
  onCheckout: () => void;

  // Panel de funciones superior derecho
  userName: string;
  operatorInitials: string;
  isRefreshingCatalog: boolean;
  onRefreshCatalog: () => void;
  onOpenReceipts: () => void;
  onOpenQuickProduct: () => void;
  onOpenQuickPrice?: () => void;
  searchResetToken?: number;
}

export const PosSmartView = ({
  items,
  isHighlighted = false,
  onIncrease,
  onDecrease,
  onSetQuantity,
  onEdit,
  onRemove,
  onClearCart,
  onCycleReturnableStatus,
  disabled = false,
  canWrite = true,
  searchResetToken,
  onOpenDebtPaymentModal,
  hasDebtPaymentInCart = false,
  debtPaymentAmount = 0,
  cartManualDiscount,
  manualCartDiscountTotal = 0,
  subtotalBeforePromotions,
  onOpenCartDiscountModal,
  onRemoveCartDiscount,
  onOpenItemPromoModal,
  products,
  primaryBarcodes,
  onAddProduct,
  onScanBarcode,
  subtotal,
  total,
  roundingAdjustment = 0,
  roundingEnabled = true,
  onToggleRounding,
  discountsEnabled = true,
  onToggleDiscounts,
  promotionDiscountTotal = 0,
  lastAddedProductId,
  onCheckout,
  userName,
  operatorInitials,
  isRefreshingCatalog,
  onRefreshCatalog,
  onOpenReceipts,
  onOpenQuickProduct,
  onOpenQuickPrice,
}: PosSmartViewProps) => {
  const theme = useUiStore((state) => state.theme);
  const cycleTheme = useUiStore((state) => state.cycleTheme);

  const [isQuickPriceModalOpen, setIsQuickPriceModalOpen] = useState(false);

  const handleOpenQuickPrice = () => {
    if (onOpenQuickPrice) {
      onOpenQuickPrice();
    } else {
      setIsQuickPriceModalOpen(true);
    }
  };

  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setQuantityDrafts((current) => {
      const itemIds = new Set(items.map((item) => item.product_id));
      const next = Object.fromEntries(
        Object.entries(current).filter(([productId]) => itemIds.has(productId))
      );
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [items]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<ProductSearchScope>("all");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const resultItemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const cartContainerRef = useRef<HTMLDivElement | null>(null);
  const lastItemRef = useRef<HTMLElement | null>(null);
  const prevItemsLengthRef = useRef(items.length);

  // Limpiar buscador al finalizar venta o cambio de señal externa
  useEffect(() => {
    setSearchQuery("");
    setIsSearchOpen(false);
    setSelectedResultIndex(0);
  }, [searchResetToken]);

  // Cerrar el menú de búsqueda al hacer clic en cualquier otra parte del sistema
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Último producto en la secuencia de carga del carrito (al principio de la lista arriba)
  const effectiveLastAddedId =
    lastAddedProductId !== undefined
      ? lastAddedProductId
      : items.length > 0
      ? items[0].product_id
      : null;

  useEffect(() => {
    // Si se agregó un nuevo producto, hacemos scroll suave hacia la fila recién agregada en la parte superior
    if (items.length > prevItemsLengthRef.current) {
      if (cartContainerRef.current) {
        cartContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        lastItemRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
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

  // Sincronizar índice seleccionado con los resultados
  useEffect(() => {
    setSelectedResultIndex(0);
  }, [searchResults]);

  // Auto-scroll del elemento seleccionado en la lista flotante
  useEffect(() => {
    if (isSearchOpen && resultItemRefs.current[selectedResultIndex]) {
      resultItemRefs.current[selectedResultIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [isSearchOpen, selectedResultIndex]);

  const handleSearchKeyDown = async (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "ArrowDown") {
      if (searchResults.length > 0) {
        event.preventDefault();
        setIsSearchOpen(true);
        setSelectedResultIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
      }
      return;
    }

    if (event.key === "ArrowUp") {
      if (searchResults.length > 0) {
        event.preventDefault();
        setIsSearchOpen(true);
        setSelectedResultIndex((prev) => Math.max(prev - 1, 0));
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const query = searchQuery.trim();
      if (!query) return;

      // Si hay resultados de catálogo, agregar el producto actualmente seleccionado con flechitas
      if (searchResults.length > 0) {
        const targetProd = searchResults[selectedResultIndex] || searchResults[0];
        if (targetProd) {
          await onAddProduct(targetProd, 1);
          // Requisito: SIN cerrar el panel de búsqueda para poder agregar con enter tantos productos como quiera
          setIsSearchOpen(true);
          window.setTimeout(() => {
            searchInputRef.current?.focus();
          }, 10);
        }
        return;
      }

      // Si no es un resultado de catálogo directo, intentar como código de barras
      if (searchScope !== "name") {
        const scanned = await onScanBarcode(query);
        if (scanned) {
          setSearchQuery("");
          setIsSearchOpen(false);
          return;
        }
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      // Requisito: Con esc salgo del buscador y devuelvo el foco al escáner
      setSearchQuery("");
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
      const scannerEl = document.querySelector('[data-scanner-capture="true"]') as HTMLElement | null;
      scannerEl?.focus();
      return;
    }
  };

  const handleSelectSearchResult = async (product: Product) => {
    await onAddProduct(product, 1);
    // Mantener abierto para poder agregar más unidades si se desea
    setIsSearchOpen(true);
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 10);
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
        {/* Encabezado: Carrito (N ítems) y botón Vaciar a la derecha */}
        <div className="flex items-center justify-between gap-2.5 mb-4">
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
              className="h-8 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 dark:hover:border-rose-800/80 transition disabled:opacity-50 whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              title="Vaciar todos los productos del carrito"
            >
              <Trash2 size={13} className="text-slate-400 group-hover:text-rose-500" />
              <span>Vaciar</span>
            </button>
          ) : null}
        </div>

        {/* Buscador general con filtro desplegable de categoría */}
        <div
          ref={searchContainerRef}
          data-search-open={isSearchOpen ? "true" : undefined}
          className="relative mb-5 z-20"
        >
          <div
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0f1a33] px-3.5 py-2.5 focus-within:border-blue-500 dark:focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:focus-within:ring-sky-500/20 transition-all shadow-inner cursor-text"
            onClick={() => {
              if (searchQuery.trim()) {
                setIsSearchOpen(true);
              }
              searchInputRef.current?.focus();
            }}
          >
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              id="pos-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => {
                if (searchQuery.trim()) setIsSearchOpen(true);
              }}
              onClick={(e) => {
                e.stopPropagation();
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
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery("");
                  setIsSearchOpen(false);
                  searchInputRef.current?.focus();
                }}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            ) : null}

            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700/80 mx-1 shrink-0" />

            <select
              value={searchScope}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                setSearchScope(e.target.value as ProductSearchScope);
                if (searchQuery.trim()) setIsSearchOpen(true);
              }}
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
              {searchResults.map((prod, index) => {
                const barcode = primaryBarcodes[prod.id];
                const isSelected = index === selectedResultIndex;
                return (
                  <div
                    key={prod.id}
                    ref={(el) => {
                      resultItemRefs.current[index] = el;
                    }}
                    onClick={() => void handleSelectSearchResult(prod)}
                    className={cn(
                      "flex items-center justify-between gap-3 p-2.5 rounded-lg cursor-pointer transition border",
                      isSelected
                        ? "border-blue-500 dark:border-sky-500 bg-blue-50/90 dark:bg-sky-950/80 ring-2 ring-blue-500/40 shadow-xs"
                        : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p
                          className={cn(
                            "text-xs sm:text-sm font-semibold truncate",
                            isSelected
                              ? "text-blue-900 dark:text-sky-100 font-bold"
                              : "text-slate-900 dark:text-slate-100"
                          )}
                        >
                          {prod.name}
                        </p>
                        {prod.id.startsWith("promo-") || prod.category === "Promociones" ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60">
                            <Sparkles size={10} className="shrink-0" />
                            <span>PROMO</span>
                          </span>
                        ) : null}
                        {prod.sale_mode === "weight" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60">
                            <Scale size={10} className="shrink-0" />
                            <span>Pesable</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {prod.id.startsWith("promo-")
                          ? `Combo promocional • Disp: ${prod.stock_current} u.`
                          : prod.category}{" "}
                        {barcode ? `| Barcode: ${barcode}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-blue-600 dark:text-sky-400">
                        {currency.format(prod.price)}
                        <span className="text-[10px] font-medium text-slate-400 ml-0.5">
                          / {prod.sale_mode === "weight" ? "kg" : "u."}
                        </span>
                      </span>
                      {isSelected ? (
                        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-600 dark:bg-sky-500 text-white shadow-xs">
                          Enter ↵
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-lg bg-blue-50 dark:bg-sky-600/30 text-blue-600 dark:text-sky-300 p-1 hover:bg-blue-100 dark:hover:bg-sky-600/50"
                        title="Agregar al carrito (Enter)"
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
            {cartManualDiscount ? (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-dashed border-emerald-400 dark:border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <BadgePercent size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs">Descuento Global al Carrito</span>
                      <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200">
                        {cartManualDiscount.type === "percent"
                          ? `-${cartManualDiscount.value}%`
                          : `-$${cartManualDiscount.value.toLocaleString("es-AR")}`}
                      </span>
                      {manualCartDiscountTotal > 0 ? (
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          (-{currency.format(manualCartDiscountTotal)})
                        </span>
                      ) : null}
                    </div>
                    {cartManualDiscount.reason ? (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 truncate">
                        Motivo: <span className="font-semibold">{cartManualDiscount.reason}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {onOpenCartDiscountModal ? (
                    <button
                      type="button"
                      onClick={onOpenCartDiscountModal}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700 cursor-pointer shadow-2xs"
                    >
                      Editar
                    </button>
                  ) : null}
                  {onRemoveCartDiscount ? (
                    <button
                      type="button"
                      onClick={onRemoveCartDiscount}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Quitar descuento del carrito"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {items.map((item, index) => {
              const isLastItem = item.product_id === effectiveLastAddedId;
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
                      {"is_promo_item" in item && item.is_promo_item ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60">
                          <Sparkles size={10} />
                          PROMO
                        </span>
                      ) : null}
                      {"manual_discount" in item && (item as PosCartItemComputed).manual_discount ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                          <Percent size={10} />
                          {(item as PosCartItemComputed).manual_discount!.type === "percent"
                            ? `-${(item as PosCartItemComputed).manual_discount!.value}%`
                            : `-$${(item as PosCartItemComputed).manual_discount!.value.toLocaleString("es-AR")}`}
                          {(item as PosCartItemComputed).manual_discount!.reason
                            ? ` (${(item as PosCartItemComputed).manual_discount!.reason})`
                            : ""}
                        </span>
                      ) : null}
                      {"manual_promotion" in item && (item as PosCartItemComputed).manual_promotion ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800/60">
                          <Sparkles size={10} />
                          {(item as PosCartItemComputed).manual_promotion!.name}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      {item.is_debt_payment_item ? (
                        <span>Cancelación de saldo pendiente</span>
                      ) : (
                        <>
                          {"is_promo_item" in item && item.is_promo_item && item.base_unit_price > item.unit_price ? (
                            <span className="line-through text-slate-400 dark:text-slate-500 text-[10px] mr-0.5">
                              {currency.format(item.base_unit_price)}
                            </span>
                          ) : null}
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {currency.format(item.unit_price)} / {item.sale_mode === "weight" ? "kg" : "u."}
                          </span>
                          {"is_promo_item" in item && item.is_promo_item && item.base_unit_price > item.unit_price ? (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                              Ahorro: {currency.format((item.base_unit_price - item.unit_price) * item.quantity)}
                            </span>
                          ) : null}
                          {item.category ? (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className="truncate max-w-[140px]">{item.category}</span>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>

                    {/* Detalle de productos incluidos en el pack / combo de la promoción */}
                    {"is_promo_item" in item && item.is_promo_item && item.promo_items?.length ? (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">📦 Incluye:</span>
                        {item.promo_items.map((sub) => (
                          <span
                            key={sub.product_id}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-bold border border-slate-300/60 dark:border-slate-700"
                          >
                            {sub.quantity}x {sub.name}
                          </span>
                        ))}
                      </div>
                    ) : null}

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

                  {/* Controles de cantidad táctiles interactivos */}
                  <div className="flex items-center shrink-0">
                    {item.is_debt_payment_item ? (
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                        Pago único
                      </span>
                    ) : (
                      <div className="flex items-center h-8 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
                        <button
                          type="button"
                          onClick={() => onDecrease(item.product_id)}
                          disabled={disabled || !canWrite}
                          className="h-full w-8 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 select-none shrink-0 border-r border-slate-200 dark:border-slate-800/80"
                          title={item.sale_mode === "weight" ? "Disminuir 50g" : "Disminuir cantidad"}
                        >
                          -
                        </button>
                        <div className="flex items-center justify-center px-1.5 h-full">
                          <input
                            type="number"
                            step="any"
                            min={0}
                            placeholder="0"
                            value={
                              quantityDrafts[item.product_id] ??
                              (item.sale_mode === "weight"
                                ? String(kgToGrams(item.quantity))
                                : String(item.quantity))
                            }
                            onFocus={(event) =>
                              handleNumericInputFocus(event, {
                                isNew: true,
                                onClear: () =>
                                  setQuantityDrafts((current) => ({
                                    ...current,
                                    [item.product_id]: "",
                                  })),
                              })
                            }
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setQuantityDrafts((current) => ({
                                ...current,
                                ...{ [item.product_id]: nextValue },
                              }));
                              const parsedInput = Number(nextValue);
                              if (nextValue.trim() && Number.isFinite(parsedInput) && parsedInput >= 0 && onSetQuantity) {
                                onSetQuantity(
                                  item.product_id,
                                  item.sale_mode === "weight" ? gramsToKg(parsedInput) : parsedInput
                                );
                              }
                            }}
                            onBlur={(event) => {
                              handleNumericInputBlur(event, "0", () => {
                                setQuantityDrafts((current) => ({
                                  ...current,
                                  ...{ [item.product_id]: "0" },
                                }));
                                onSetQuantity?.(item.product_id, 0);
                              });
                              const rawValue = quantityDrafts[item.product_id];
                              if (rawValue != null && onSetQuantity) {
                                const parsedInput = Number(rawValue);
                                if (Number.isFinite(parsedInput) && parsedInput >= 0) {
                                  onSetQuantity(
                                    item.product_id,
                                    item.sale_mode === "weight" ? gramsToKg(parsedInput) : parsedInput
                                  );
                                }
                              }
                              setQuantityDrafts((current) => {
                                const { [item.product_id]: _discard, ...next } = current;
                                return next;
                              });
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.currentTarget.blur();
                              }
                            }}
                            style={{
                              backgroundColor: "transparent",
                              border: "none",
                              outline: "none",
                              boxShadow: "none",
                              padding: 0,
                            }}
                            className={cn(
                              "h-full !bg-transparent !border-0 !outline-none !shadow-none !p-0 !min-h-0 font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 tabular-nums text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                              item.sale_mode === "weight" ? "w-14" : "w-10"
                            )}
                            title={
                              item.sale_mode === "weight"
                                ? "Tipeá los gramos libremente (ej: 260)"
                                : "Cantidad en unidades"
                            }
                            disabled={disabled || !canWrite}
                          />
                          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 select-none shrink-0 pl-1">
                            {item.sale_mode === "weight" ? "g" : "u."}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onIncrease(item.product_id)}
                          disabled={disabled || !canWrite}
                          className="h-full w-8 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 select-none shrink-0 border-l border-slate-200 dark:border-slate-800/80"
                          title={item.sale_mode === "weight" ? "Aumentar 50g" : "Aumentar cantidad"}
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
                      {"promotion_discount_total" in item && typeof item.promotion_discount_total === "number" && item.promotion_discount_total > 0 ? (
                        <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          -{currency.format(item.promotion_discount_total)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!item.is_debt_payment_item && onOpenItemPromoModal ? (
                        <button
                          type="button"
                          onClick={() => onOpenItemPromoModal(item as PosCartItemComputed)}
                          disabled={disabled || !canWrite}
                          title="Aplicar promoción o descuento manual a este producto"
                          className={cn(
                            "px-2.5 py-1 rounded-lg border text-xs font-semibold transition disabled:opacity-40 flex items-center gap-1 cursor-pointer",
                            ("manual_discount" in item && (item as PosCartItemComputed).manual_discount) ||
                            ("manual_promotion" in item && (item as PosCartItemComputed).manual_promotion)
                              ? "border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold"
                              : "border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200"
                          )}
                        >
                          <BadgePercent
                            size={12}
                            className={
                              ("manual_discount" in item && (item as PosCartItemComputed).manual_discount) ||
                              ("manual_promotion" in item && (item as PosCartItemComputed).manual_promotion)
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-400"
                            }
                          />
                          <span>Promo</span>
                        </button>
                      ) : null}

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
          {/* Fila 1: Operador, Consulta rápida y Tema */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50 dark:bg-slate-900/80 px-2.5 py-1.5 h-8 shrink-0">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-fuchsia-600 text-[10px] font-bold text-white shadow-sm shrink-0">
                {operatorInitials}
              </span>
              <div className="leading-tight flex items-baseline gap-1.5 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[105px]">
                  {userName}
                </p>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">Operador</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenQuickPrice}
              className="h-8 flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 px-2 text-xs font-semibold text-blue-700 dark:text-blue-300 transition shadow-2xs whitespace-nowrap min-w-0 cursor-pointer"
              title="Consulta rápida de precios y stock (escanear o buscar)"
            >
              <Search size={14} className="text-blue-600 dark:text-sky-400 shrink-0" />
              <span className="truncate">Consulta rápida</span>
            </button>

            <button
              type="button"
              onClick={cycleTheme}
              className="h-8 flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
              title={`Tema actual: ${theme === "midnight" ? "Azul Medianoche" : theme === "dark" ? "Oscuro" : "Claro"}. Clic para cambiar.`}
            >
              {theme === "midnight" ? (
                <MoonStar size={14} className="text-indigo-400" />
              ) : theme === "dark" ? (
                <Moon size={14} className="text-amber-300" />
              ) : (
                <Sun size={14} className="text-amber-500" />
              )}
              <span className="text-xs font-semibold">
                {theme === "midnight" ? "Azul" : theme === "dark" ? "Oscuro" : "Claro"}
              </span>
            </button>
          </div>

          {/* Fila 2: Acciones operativas (Comprobantes, Producto rápido, Actualizar) */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onOpenReceipts}
              className="h-8 flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition shadow-2xs whitespace-nowrap min-w-0"
              title="Ver comprobantes y ventas emitidas"
            >
              <FileText size={14} className="shrink-0" />
              <span className="truncate">Comprobantes</span>
            </button>

            <button
              type="button"
              onClick={onOpenQuickProduct}
              disabled={disabled || !canWrite}
              className="h-8 flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition shadow-2xs disabled:opacity-50 whitespace-nowrap min-w-0"
              title="Crear o vender producto rápido no registrado (F8)"
            >
              <PlusCircle size={14} className="shrink-0" />
              <span className="truncate">Prod. rápido</span>
              <kbd className="hidden sm:inline-flex items-center px-1 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                F8
              </kbd>
            </button>

            <button
              type="button"
              onClick={onRefreshCatalog}
              disabled={isRefreshingCatalog || disabled}
              className="h-8 flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition shadow-2xs disabled:opacity-50 whitespace-nowrap min-w-0"
              title="Actualizar catálogo de productos"
            >
              <RefreshCw
                size={14}
                className={cn("shrink-0", isRefreshingCatalog ? "animate-spin text-blue-600 dark:text-sky-400" : "")}
              />
              <span className="truncate">Actualizar</span>
            </button>
          </div>
        </div>

        {/* Panel Inferior Derecho: Detalle de total y confirmación de cobro */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0b1325] p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex flex-col gap-2.5 border-b border-slate-200 dark:border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-blue-600 dark:text-sky-400 shrink-0" />
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Carrito ({items.length} {items.length === 1 ? "ítem" : "ítems"})
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {onToggleRounding ? (
                <button
                  type="button"
                  onClick={onToggleRounding}
                  disabled={disabled || !canWrite}
                  title={
                    roundingEnabled
                      ? "Redondeo comercial activado (clic para desactivar)"
                      : "Redondeo comercial desactivado (clic para activar)"
                  }
                  aria-label={roundingEnabled ? "Desactivar redondeo" : "Activar redondeo"}
                  className={cn(
                    "h-8 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition shadow-2xs cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0",
                    roundingEnabled
                      ? "border-emerald-300 dark:border-emerald-700/80 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                      : "border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                  )}
                >
                  {roundingEnabled ? (
                    <Calculator size={14} />
                  ) : (
                    <span className="relative flex items-center justify-center">
                      <Calculator size={14} className="opacity-50" />
                      <span className="absolute h-0.5 w-3.5 bg-rose-500 rotate-45 rounded-full" />
                    </span>
                  )}
                  <span>{roundingEnabled ? "Red. ON" : "Red. OFF"}</span>
                </button>
              ) : onToggleDiscounts ? (
                <button
                  type="button"
                  onClick={onToggleDiscounts}
                  disabled={disabled || !canWrite}
                  title={
                    discountsEnabled
                      ? "Descuentos activados (clic para desactivar)"
                      : "Descuentos desactivados (clic para activar)"
                  }
                  aria-label={discountsEnabled ? "Desactivar descuentos" : "Activar descuentos"}
                  className={cn(
                    "h-8 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition shadow-2xs cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0",
                    discountsEnabled
                      ? "border-emerald-300 dark:border-emerald-700/80 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                      : "border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                  )}
                >
                  {discountsEnabled ? (
                    <BadgePercent size={14} />
                  ) : (
                    <span className="relative flex items-center justify-center">
                      <BadgePercent size={14} className="opacity-50" />
                      <span className="absolute h-0.5 w-3.5 bg-rose-500 rotate-45 rounded-full" />
                    </span>
                  )}
                  <span>{discountsEnabled ? "Desc. ON" : "Desc. OFF"}</span>
                </button>
              ) : null}

              {onOpenCartDiscountModal ? (
                <button
                  type="button"
                  onClick={onOpenCartDiscountModal}
                  disabled={disabled || !canWrite || items.length === 0}
                  title={
                    cartManualDiscount
                      ? `Descuento carrito: ${cartManualDiscount.type === "percent" ? `${cartManualDiscount.value}%` : `$${cartManualDiscount.value}`}. Clic para editar`
                      : "Aplicar descuento global al carrito con monto y motivo"
                  }
                  className={cn(
                    "h-8 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition shadow-2xs cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0",
                    cartManualDiscount
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold"
                      : "border-slate-300 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 dark:hover:border-emerald-800/80"
                  )}
                >
                  <Percent size={13} className={cartManualDiscount ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"} />
                  <span>
                    {cartManualDiscount
                      ? cartManualDiscount.type === "percent"
                        ? `-${cartManualDiscount.value}%`
                        : `-$${cartManualDiscount.value.toLocaleString("es-AR")}`
                      : "Descuento"}
                  </span>
                </button>
              ) : null}

              {onOpenDebtPaymentModal ? (
                <button
                  type="button"
                  onClick={onOpenDebtPaymentModal}
                  disabled={disabled || !canWrite}
                  className={cn(
                    "h-8 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold transition shadow-2xs disabled:opacity-50 whitespace-nowrap shrink-0",
                    hasDebtPaymentInCart
                      ? "border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-600/80 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/60"
                      : "border-indigo-200 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700/70 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                  )}
                  title={hasDebtPaymentInCart ? "Modificar cobro de cuenta corriente" : "Agregar cobro de deuda de cuenta corriente al carrito"}
                >
                  <Coins size={14} className={hasDebtPaymentInCart ? "text-amber-600 dark:text-amber-400" : "text-indigo-600 dark:text-indigo-400"} />
                  <span>{hasDebtPaymentInCart ? "Editar deuda" : "Cobrar deuda"}</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="text-slate-900 dark:text-slate-200 font-medium">
                {currency.format(
                  subtotalBeforePromotions && subtotalBeforePromotions > 0
                    ? subtotalBeforePromotions
                    : subtotal
                )}
              </span>
            </div>

            {manualCartDiscountTotal > 0 ? (
              <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="flex items-center gap-1">
                  <Percent size={12} />
                  <span>
                    Desc. carrito{" "}
                    {cartManualDiscount?.type === "percent" ? `(${cartManualDiscount.value}%)` : ""}
                  </span>
                </span>
                <span className="font-semibold">-{currency.format(manualCartDiscountTotal)}</span>
              </div>
            ) : null}

            {discountsEnabled && promotionDiscountTotal - manualCartDiscountTotal > 0 ? (
              <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Desc. productos / promociones</span>
                <span className="font-semibold">
                  -{currency.format(promotionDiscountTotal - manualCartDiscountTotal)}
                </span>
              </div>
            ) : !discountsEnabled ? (
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="text-rose-500 dark:text-rose-400">Descuentos</span>
                <span className="text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                  Desactivados
                </span>
              </div>
            ) : null}

            {hasDebtPaymentInCart && debtPaymentAmount > 0 ? (
              <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-900/60">
                <span className="flex items-center gap-1.5">
                  <Coins size={13} className="text-amber-600 dark:text-amber-400" />
                  <span>Cobro Cta. Cte.</span>
                </span>
                <span>+{currency.format(debtPaymentAmount)}</span>
              </div>
            ) : null}

            {roundingAdjustment !== 0 && roundingEnabled ? (
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Redondeo comercial</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  {roundingAdjustment > 0 ? `+${currency.format(roundingAdjustment)}` : currency.format(roundingAdjustment)}
                </span>
              </div>
            ) : !roundingEnabled ? (
              <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                <span>Redondeo comercial</span>
                <span className="text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                  Desactivado
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

      {isQuickPriceModalOpen ? (
        <QuickPriceGlobalModal
          open={isQuickPriceModalOpen}
          onClose={() => {
            setIsQuickPriceModalOpen(false);
            onRefreshCatalog();
          }}
        />
      ) : null}
    </div>
  );
};
