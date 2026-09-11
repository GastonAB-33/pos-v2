import { useRef, useState } from "react";
import { Barcode, Camera, Check, CheckCircle2, ShoppingCart, X } from "lucide-react";
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
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scannerFeedback, setScannerFeedback] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();
  const [isScanning, setIsScanning] = useState(false);

  if (!open) return null;

  const cartQuantities = new Map(cart.map((item) => [item.product_id, item.quantity + (item.bonified_quantity || 0)]));

  const submitBarcode = async () => {
    const barcode = barcodeValue.trim();
    if (!barcode || isScanning || disabled || !canWrite) return;

    setIsScanning(true);
    const result = await onBarcodeScan(barcode);
    if (result.ok && result.product) {
      setBarcodeValue("");
      setScannerFeedback({ type: "success", message: `${result.product.name} agregado a la compra` });
    } else {
      setScannerFeedback({ type: "error", message: result.error ?? "Código no encontrado" });
    }
    setIsScanning(false);
    window.setTimeout(() => {
      scannerInputRef.current?.focus({ preventScroll: true });
      if (!result.ok) scannerInputRef.current?.select();
    }, 0);
  };

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-2 sm:p-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
              <ShoppingCart className="h-4 w-4" />
              Seleccionar productos para la compra
            </div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Agregar producto existente
            </h2>
            <p className="text-xs text-slate-500">
              Escanea con lector físico / cámara o busca por nombre, código o categoría.
            </p>
          </div>
          <IconButton icon={X} label="Cerrar" onClick={onClose} disabled={disabled} />
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 space-y-4">
          {/* Lector de código de barras */}
          <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <Barcode aria-hidden="true" className="h-4 w-4 text-brand-700" />
              <label htmlFor="purchase-modal-barcode" className="text-xs font-bold uppercase tracking-wider text-brand-900">
                Lector de código de barras
              </label>
            </div>
            <div className="flex gap-2">
              <input
                ref={scannerInputRef}
                id="purchase-modal-barcode"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
                autoFocus
                value={barcodeValue}
                onChange={(event) => {
                  setBarcodeValue(event.target.value);
                  setScannerFeedback(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  void submitBarcode();
                }}
                placeholder="Escanear código y presionar Enter..."
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                disabled={disabled || !canWrite || isScanning}
              />
              <button
                type="button"
                className="ui-btn-primary px-3 text-xs"
                onClick={() => void submitBarcode()}
                disabled={disabled || !canWrite || isScanning || !barcodeValue.trim()}
              >
                Leer
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                onClick={() => setIsCameraOpen(true)}
                disabled={disabled || !canWrite || isScanning}
                title="Escanear con la cámara del celular"
              >
                <Camera aria-hidden="true" className="h-4 w-4" />
                <span>Cámara</span>
              </button>
            </div>
            {scannerFeedback ? (
              <p
                className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${
                  scannerFeedback.type === "success" ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {scannerFeedback.type === "success" ? (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                ) : null}
                {scannerFeedback.message}
              </p>
            ) : null}
          </div>

          <BarcodeScannerModal
            open={isCameraOpen}
            title="Escanear producto para compra"
            description="Apuntá la cámara al código de barras del producto."
            onClose={() => setIsCameraOpen(false)}
            onDetected={async (scannedCode) => {
              setIsCameraOpen(false);
              setBarcodeValue(scannedCode);
              setIsScanning(true);
              const result = await onBarcodeScan(scannedCode);
              if (result.ok && result.product) {
                setBarcodeValue("");
                setScannerFeedback({ type: "success", message: `${result.product.name} agregado a la compra` });
              } else {
                setScannerFeedback({ type: "error", message: result.error ?? "Código no encontrado" });
              }
              setIsScanning(false);
            }}
          />

          {/* Buscador de catálogo */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Buscar en el catálogo
            </label>
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por nombre, código interno o categoría..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Lista de productos */}
          <div className="max-h-[380px] space-y-2 overflow-auto pr-1">
            {!products.length ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No hay productos para mostrar con ese filtro.
              </div>
            ) : null}

            {paginatedProducts.pageItems.map((product) => {
              const inCartQty = cartQuantities.get(product.id) ?? 0;

              return (
                <article
                  key={product.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{product.name}</p>
                      {inCartQty > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <Check className="h-3 w-3" /> En compra ({inCartQty})
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      Cód: {product.code} • Cat: {product.category}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>Costo base: <strong>{currency.format(product.cost_price)}</strong></span>
                      <span>•</span>
                      <span>Stock actual: {stockLabel(product)}</span>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => onAddProduct(product)}
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

        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3.5">
          <span className="text-xs text-slate-600">
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
