import { useRef, useState } from "react";
import { Barcode, Camera, Check, CheckCircle2, Search, ShoppingCart, X } from "lucide-react";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { IconButton } from "@/components/ui/IconButton";
import type { Product } from "@/types/entities";
import type { PurchaseCartItemView } from "@/modules/compras/components/PurchaseCart";

interface PurchaseProductSelectModalProps {
  open: boolean;
  products: Product[];
  cart: PurchaseCartItemView[];
  search: string;
  disabled?: boolean;
  canWrite: boolean;
  onSearchChange: (value: string) => void;
  onAddProduct: (product: Product) => void;
  onBarcodeScan: (
    barcode: string
  ) => Promise<{ ok: boolean; product?: Product; error?: string }>;
  onClose: () => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const stockLabel = (product: Product) =>
  `${product.stock_current.toLocaleString("es-AR")} ${product.sale_mode === "weight" ? "kg" : "u."}`;

export const PurchaseProductSelectModal = ({
  open,
  products,
  cart,
  search,
  disabled,
  canWrite,
  onSearchChange,
  onAddProduct,
  onBarcodeScan,
  onClose,
}: PurchaseProductSelectModalProps) => {
  const paginatedProducts = usePagination(products, 8, `${search}|${products.length}`);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();
  const [isScanning, setIsScanning] = useState(false);

  if (!open) return null;

  const cartQuantities = new Map(cart.map((item) => [item.product_id, item.quantity + (item.bonified_quantity || 0)]));

  const handleAddProduct = (product: Product) => {
    onAddProduct(product);
    setScannerFeedback({
      type: "success",
      message: `${product.name} agregado a la compra`,
    });
  };

  const handleSearchSubmit = async () => {
    const query = search.trim();
    if (!query || isScanning || disabled || !canWrite) return;

    setIsScanning(true);

    // 1. Probar como código de barras primero
    const result = await onBarcodeScan(query);
    if (result.ok && result.product) {
      onSearchChange("");
      setScannerFeedback({
        type: "success",
        message: `${result.product.name} agregado a la compra`,
      });
      setIsScanning(false);
      window.setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 0);
      return;
    }

    // 2. Si no fue código de barras exacto pero hay 1 producto filtrado
    if (products.length === 1) {
      onAddProduct(products[0]);
      onSearchChange("");
      setScannerFeedback({
        type: "success",
        message: `${products[0].name} agregado a la compra`,
      });
      setIsScanning(false);
      window.setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 0);
      return;
    }

    // 3. Si no hay coincidencias
    if (products.length === 0) {
      setScannerFeedback({
        type: "error",
        message: result.error ?? "No se encontró ningún producto con ese código o nombre",
      });
    }

    setIsScanning(false);
    window.setTimeout(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    }, 0);
  };

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-2 sm:p-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">
              <ShoppingCart className="h-4 w-4" />
              Seleccionar productos para la compra
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
              Agregar producto a la compra
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Busca por nombre, código interno o escanea el código de barras (con lector físico o cámara).
            </p>
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} disabled={disabled} />
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 space-y-4">
          {/* Buscador Unificado: Nombre, Código o Código de Barras */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="purchase-search-input" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                <Search className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                Buscar o escanear producto
              </label>
              <span className="text-[11px] text-slate-400 dark:text-slate-400">
                Presiona Enter o haz clic en Agregar
              </span>
            </div>

            <div className="flex gap-2">
              <div className="relative flex flex-1 items-center rounded-xl border border-slate-300 bg-white shadow-sm transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800">
                <Barcode aria-hidden="true" className="ml-3 h-5 w-5 text-slate-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  id="purchase-search-input"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
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
                  placeholder="Escanear código de barras o buscar por nombre, código..."
                  className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
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
                    className="mr-2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    title="Limpiar búsqueda"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <button
                type="button"
                className="ui-btn-primary px-4 text-xs font-semibold shrink-0"
                onClick={() => void handleSearchSubmit()}
                disabled={disabled || !canWrite || isScanning || !search.trim()}
                title="Buscar o agregar por código"
              >
                {isScanning ? "Agregando..." : "Agregar"}
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-300 bg-brand-50 px-3.5 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50 shrink-0 shadow-sm dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300 dark:hover:bg-brand-900/60"
                onClick={() => setIsCameraOpen(true)}
                disabled={disabled || !canWrite || isScanning}
                title="Escanear código de barras con la cámara"
              >
                <Camera aria-hidden="true" className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                <span className="hidden sm:inline">Cámara</span>
              </button>
            </div>

            {scannerFeedback ? (
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium animate-fadeIn ${
                  scannerFeedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-red-50 text-red-700 border border-red-200 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {scannerFeedback.type === "success" ? (
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" />
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
                onSearchChange("");
                setScannerFeedback({
                  type: "success",
                  message: `${result.product.name} agregado a la compra`,
                });
              } else {
                onSearchChange(scannedCode);
                setScannerFeedback({
                  type: "error",
                  message: result.error ?? "Código no encontrado",
                });
              }
              setIsScanning(false);
              window.setTimeout(() => {
                searchInputRef.current?.focus({ preventScroll: true });
              }, 0);
            }}
          />

          {/* Lista de productos */}
          <div className="max-h-[380px] space-y-2 overflow-auto pr-1">
            {!products.length ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No hay productos para mostrar con ese filtro.
              </div>
            ) : null}

            {paginatedProducts.pageItems.map((product) => {
              const inCartQty = cartQuantities.get(product.id) ?? 0;

              return (
                <article
                  key={product.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-slate-700"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{product.name}</p>
                      {product.sale_mode === "weight" && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:border dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300">
                          Balanza (kg)
                        </span>
                      )}
                      {inCartQty > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <Check className="h-3 w-3" /> En compra ({inCartQty.toLocaleString("es-AR", { maximumFractionDigits: 3 })} {product.sale_mode === "weight" ? "kg" : "u."})
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cód: {product.code} • Cat: {product.category}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>
                        Costo base:{" "}
                        <strong className="text-slate-800 dark:text-slate-200">
                          {currency.format(product.cost_price)}
                          {product.sale_mode === "weight" ? " / kg" : ""}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>Stock actual: <strong className="text-slate-700 dark:text-slate-300">{stockLabel(product)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleAddProduct(product)}
                      disabled={disabled || !canWrite}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                    >
                      + Agregar
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <PaginationControls
            currentPage={paginatedProducts.currentPage}
            pageCount={paginatedProducts.pageCount}
            startItem={paginatedProducts.startItem}
            endItem={paginatedProducts.endItem}
            totalItems={paginatedProducts.totalItems}
            onPageChange={paginatedProducts.setCurrentPage}
          />
        </div>

        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900/90">
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {cart.length === 0
              ? "Aún no hay productos en la compra."
              : `${cart.length} ${cart.length === 1 ? "producto seleccionado" : "productos seleccionados"}`}
          </span>
          <button
            type="button"
            className="ui-btn-primary px-4 py-2 text-xs font-semibold"
            onClick={onClose}
          >
            Listo, volver a la compra
          </button>
        </footer>
      </div>
    </section>
  );
};
