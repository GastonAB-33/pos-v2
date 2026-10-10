import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Barcode,
  Camera,
  Check,
  CheckCircle2,
  Plus,
  Search,
  ShoppingCart,
  X,
} from "lucide-react";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { IconButton } from "@/components/ui/IconButton";
import {
  matchesProductSearch,
  PRODUCT_SEARCH_SCOPE_OPTIONS,
  getSearchPlaceholder,
  type ProductSearchScope,
} from "@/utils/search";
import type { Product } from "@/types/entities";
import type { PurchaseCartItemView } from "@/modules/compras/components/PurchaseCart";

interface PurchaseProductSelectModalProps {
  open: boolean;
  products: Product[];
  barcodesByProductId?: Map<string, string[]>;
  cart: PurchaseCartItemView[];
  search: string;
  disabled?: boolean;
  canWrite: boolean;
  onSearchChange: (value: string) => void;
  onAddProduct: (
    product: Product,
    quantity?: number,
    unitCost?: number,
    vatPercent?: number,
    bonifiedQty?: number,
    discountPercent?: number
  ) => void;
  onBarcodeScan: (
    barcode: string
  ) => Promise<{ ok: boolean; product?: Product; error?: string }>;
  onCreateNewProduct: (searchQuery?: string) => void;
  backgroundSavingText?: string | null;
  onClose: () => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const PurchaseProductSelectModal = ({
  open,
  products,
  barcodesByProductId,
  cart,
  search,
  disabled,
  canWrite,
  onSearchChange,
  onAddProduct,
  onBarcodeScan,
  onCreateNewProduct,
  backgroundSavingText,
  onClose,
}: PurchaseProductSelectModalProps) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchScope, setSearchScope] = useState<ProductSearchScope>("all");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();
  const [isScanning, setIsScanning] = useState(false);

  // Autofocus al abrir el modal
  useEffect(() => {
    if (open) {
      setScannerFeedback(undefined);
      window.setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 50);
    }
  }, [open]);

  const cartQuantities = useMemo(() => {
    return new Map(
      cart.map((item) => [
        item.product_id,
        item.quantity + (item.bonified_quantity || 0),
      ])
    );
  }, [cart]);

  // Resultados de búsqueda en vivo con filtro de ámbito (Todos / Solo nombre / Solo código / Solo código de barras)
  const filteredProducts = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    return products
      .filter((p) =>
        matchesProductSearch(
          {
            name: p.name,
            code: p.code,
            barcodes: barcodesByProductId?.get(p.id) ?? [],
            category: p.category,
            subcategory: p.subcategory,
          },
          q,
          searchScope
        )
      )
      .slice(0, 20);
  }, [barcodesByProductId, products, search, searchScope]);

  if (!open) return null;

  // Agregar rápido 1 unidad directamente a la lista de compras
  const handleQuickAdd = (product: Product) => {
    onAddProduct(product, 1);
    setScannerFeedback({
      type: "success",
      message: `${product.name} agregado a la compra`,
    });
    onSearchChange("");
    window.setTimeout(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  // Submit al presionar Enter en el input de búsqueda
  const handleSearchSubmit = async () => {
    const query = search.trim();
    if (!query || isScanning || disabled || !canWrite) return;

    setIsScanning(true);

    try {
      // 1. Probar como código de barras primero solo si el ámbito no es "solo nombre"
      if (searchScope !== "name") {
        const result = await onBarcodeScan(query);
        if (result.ok && result.product) {
          setScannerFeedback({
            type: "success",
            message: `${result.product.name} agregado a la compra`,
          });
          onSearchChange("");
          setIsScanning(false);
          window.setTimeout(() => {
            searchInputRef.current?.focus({ preventScroll: true });
          }, 0);
          return;
        }
      }

      // 2. Si no fue código exacto pero hay 1 única coincidencia o más, agregar el primero
      if (filteredProducts.length > 0) {
        handleQuickAdd(filteredProducts[0]);
        setIsScanning(false);
        return;
      }

      // 3. Si no hay coincidencias en el catálogo
      setScannerFeedback({
        type: "error",
        message: "No se encontró ningún producto con ese criterio de búsqueda",
      });
    } finally {
      setIsScanning(false);
      window.setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 0);
    }
  };

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-2 sm:p-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-2.5 sm:px-5 sm:py-4 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
              <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Seleccionar producto para la compra</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                Agregar producto a la compra
              </h2>
              {backgroundSavingText && (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300/40 dark:border-blue-700/60 shrink-0 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping shrink-0" />
                  {backgroundSavingText}
                </span>
              )}
            </div>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
              Escaneá el código de barras o buscá por nombre o código interno.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onCreateNewProduct(search.trim())}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-300 bg-brand-50/80 px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
              title="Crear un producto nuevo directamente"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden xs:inline sm:inline">Nuevo</span>
            </button>
            <IconButton icon={X} label="Cerrar" onClick={onClose} disabled={disabled} />
          </div>
        </header>

        {/* Buscador Rápido con Autofocus, Dictado por Voz y Cámara */}
        <div className="border-b border-slate-100 px-3 py-2.5 sm:px-5 sm:py-3 dark:border-slate-800">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0"
              />
              <input
                ref={searchInputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                autoFocus
                value={search}
                onChange={(event) => {
                  onSearchChange(event.target.value);
                  if (scannerFeedback) setScannerFeedback(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  void handleSearchSubmit();
                }}
                placeholder={getSearchPlaceholder(searchScope)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-9 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500"
                disabled={disabled || !canWrite || isScanning}
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange("");
                    setScannerFeedback(undefined);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {/* Selector de Ámbito de Búsqueda: Todos / Solo nombre / Solo código / Solo código de barras */}
            <select
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value as ProductSearchScope)}
              className="rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shrink-0 max-w-[100px] xs:max-w-[135px] sm:max-w-none truncate"
              aria-label="Filtro de búsqueda"
            >
              {PRODUCT_SEARCH_SCOPE_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200"
                >
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50 shrink-0 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-400 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
              onClick={() => setIsCameraOpen(true)}
              disabled={disabled || !canWrite || isScanning}
              title="Escanear con cámara del celular"
            >
              <Camera aria-hidden="true" className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              <span className="hidden sm:inline">Cámara</span>
            </button>
          </div>

          {/* Feedback de escaneo (sólo si no es un error ya ilustrado en la tarjeta amarilla no encontrada) */}
          {scannerFeedback && (scannerFeedback.type === "success" || filteredProducts.length > 0) ? (
            <div
              className={`mt-2 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium animate-fadeIn ${
                scannerFeedback.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/80 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-800/80 dark:text-red-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {scannerFeedback.type === "success" ? (
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-red-500 dark:text-red-400" />
                )}
                <span>{scannerFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setScannerFeedback(undefined)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-2"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>

        {/* Modal de Cámara de Escaneo */}
        <BarcodeScannerModal
          open={isCameraOpen}
          title="Escanear producto para compra"
          description="Apuntá la cámara al código de barras del producto."
          onClose={() => setIsCameraOpen(false)}
          onDetected={async (scannedCode) => {
            setIsCameraOpen(false);
            setIsScanning(true);
            const result = await onBarcodeScan(scannedCode);
            if (result.ok && result.product) {
              setScannerFeedback({
                type: "success",
                message: `${result.product.name} agregado a la compra`,
              });
              onSearchChange("");
            } else {
              onSearchChange(scannedCode);
              setScannerFeedback({
                type: "error",
                message: result.error ?? `Código "${scannedCode}" no encontrado`,
              });
            }
            setIsScanning(false);
            window.setTimeout(() => {
              searchInputRef.current?.focus({ preventScroll: true });
            }, 0);
          }}
        />

        {/* Contenido Principal */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">
          {search.trim().length > 0 ? (
            /* BÚSQUEDA ACTIVA CON RESULTADOS O SIN RESULTADOS */
            filteredProducts.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400 dark:text-slate-500">
                    Coincidencias encontradas ({filteredProducts.length})
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline">
                    Hacé clic en el producto o en + Agregar para sumarlo a la compra
                  </span>
                </div>

                <div className="space-y-2">
                  {filteredProducts.map((product) => {
                    const inCartQty = cartQuantities.get(product.id) ?? 0;

                    return (
                      <div
                        key={product.id}
                        onClick={() => handleQuickAdd(product)}
                        className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs transition hover:border-brand-500 hover:bg-brand-50/20 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-850 dark:hover:border-brand-500/60 dark:hover:bg-brand-950/20 cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-xs sm:text-sm text-slate-900 truncate dark:text-slate-100">
                              {product.name}
                            </p>
                            {product.sale_mode === "weight" && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                Balanza (kg)
                              </span>
                            )}
                            {inCartQty > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <Check className="h-3 w-3" /> En compra ({inCartQty})
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            {product.code ? <span>Cód: {product.code}</span> : null}
                            {product.code ? <span>•</span> : null}
                            <span>Cat: {product.category || "General"}</span>
                            <span>•</span>
                            <span>
                              Costo reg.:{" "}
                              <strong className="text-slate-700 dark:text-slate-200">
                                {currency.format(product.cost_price || 0)}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Precio vta.:{" "}
                              <strong className="text-slate-700 dark:text-slate-200">
                                {currency.format(product.price || 0)}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Stock: {product.stock_current.toLocaleString("es-AR")}{" "}
                              {product.sale_mode === "weight" ? "kg" : "u."}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAdd(product);
                            }}
                            disabled={disabled || !canWrite}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 disabled:opacity-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* NO ENCONTRADO COMPACTO PARA MÓVIL (Sin scroll interno) */
              <div className="py-4 sm:py-7 px-3.5 sm:px-4 text-center rounded-xl border border-dashed border-amber-300 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/20 my-auto">
                <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 mx-auto mb-2 sm:mb-3">
                  <AlertTriangle className="h-4.5 w-4.5 sm:h-6 sm:w-6" />
                </div>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  No se encontró ningún producto
                </h4>
                <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  No hay coincidencias en el catálogo {searchScope === "name" ? "por nombre" : searchScope === "code" ? "por código de producto" : searchScope === "barcode" ? "por código de barras" : "para el código o nombre"}:
                </p>
                <p className="mt-1 sm:mt-1.5 font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-lg max-w-full truncate">
                  "{search.trim()}"
                </p>
                <div className="mt-3 sm:mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      onCreateNewProduct(search.trim());
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-brand-700 transition active:scale-95 w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Crear producto nuevo "{search.trim()}"
                  </button>
                </div>
              </div>
            )
          ) : (
            /* ESPERANDO BÚSQUEDA (Compacto) */
            <div className="py-6 sm:py-10 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40 my-auto">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 mb-2 sm:mb-3">
                <Barcode className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Esperando producto para agregar
              </h4>
              <p className="mt-0.5 sm:mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400 px-2">
                Escribí el nombre o código para buscar, o escaneá un código de barras.
              </p>

              <div className="mt-3 sm:mt-4">
                <button
                  type="button"
                  onClick={() => onCreateNewProduct("")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear nuevo producto
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-3.5 dark:border-slate-800 dark:bg-slate-900/60">
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {cart.length === 0
              ? "Aún no hay productos en la compra."
              : `${cart.length} ${cart.length === 1 ? "ítem seleccionado" : "ítems seleccionados"}`}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700"
            onClick={onClose}
          >
            Listo, volver a la compra
          </button>
        </footer>
      </div>
    </section>
  );
};
