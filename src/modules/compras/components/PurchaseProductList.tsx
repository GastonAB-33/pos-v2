import { PaginationControls } from "@/components/ui/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { Barcode, CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";
import type { Product } from "@/types/entities";

interface PurchaseProductListProps {
  products: Product[];
  search: string;
  disabled?: boolean;
  canWrite: boolean;
  onSearchChange: (value: string) => void;
  onAddProduct: (product: Product) => void;
  onBarcodeScan: (
    barcode: string
  ) => Promise<{ ok: boolean; product?: Product; error?: string }>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const stockLabel = (product: Product) =>
  `${product.stock_current.toLocaleString("es-AR")} ${product.sale_mode === "weight" ? "kg" : "u."}`;

export const PurchaseProductList = ({
  products,
  search,
  disabled,
  canWrite,
  onSearchChange,
  onAddProduct,
  onBarcodeScan,
}: PurchaseProductListProps) => {
  const paginatedProducts = usePagination(products, 10, `${search}|${products.length}`);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [scannerFeedback, setScannerFeedback] = useState<
    { type: "success" | "error"; message: string } | undefined
  >();
  const [isScanning, setIsScanning] = useState(false);

  const submitBarcode = async () => {
    const barcode = barcodeValue.trim();
    if (!barcode || isScanning || disabled || !canWrite) return;

    setIsScanning(true);
    const result = await onBarcodeScan(barcode);
    if (result.ok && result.product) {
      setBarcodeValue("");
      setScannerFeedback({ type: "success", message: `${result.product.name} agregado` });
    } else {
      setScannerFeedback({ type: "error", message: result.error ?? "Codigo no encontrado" });
    }
    setIsScanning(false);
    window.setTimeout(() => {
      scannerInputRef.current?.focus({ preventScroll: true });
      if (!result.ok) scannerInputRef.current?.select();
    }, 0);
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Barcode aria-hidden="true" className="h-4 w-4 text-brand-700" />
          <label htmlFor="purchase-barcode" className="text-sm font-semibold text-slate-900">
            Lector de codigo de barras
          </label>
        </div>
        <div className="flex gap-2">
          <input
            ref={scannerInputRef}
            id="purchase-barcode"
            type="text"
            autoComplete="off"
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
            placeholder="Escanear codigo y presionar Enter"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            disabled={disabled || !canWrite || isScanning}
          />
          <button
            type="button"
            className="ui-btn-primary px-3"
            onClick={() => void submitBarcode()}
            disabled={disabled || !canWrite || isScanning || !barcodeValue.trim()}
          >
            Leer
          </button>
        </div>
        {scannerFeedback ? (
          <p
            className={`mt-2 flex items-center gap-1.5 text-xs ${
              scannerFeedback.type === "success" ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {scannerFeedback.type === "success" ? (
              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
            ) : null}
            {scannerFeedback.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">Productos</h2>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nombre, codigo o categoria"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="max-h-[480px] space-y-2 overflow-auto pr-1">
        {!products.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No hay productos para mostrar.
          </div>
        ) : null}

        {paginatedProducts.pageItems.map((product) => (
          <article
            key={product.id}
            className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_auto]"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{product.name}</p>
              <p className="text-xs text-slate-500">{product.category}</p>
              <p className="text-sm text-slate-700">
                Costo: {currency.format(product.cost_price)}
                {product.sale_mode === "weight" ? " / kg" : ""}
              </p>
              <p className="text-xs text-slate-500">
                Stock actual: {stockLabel(product)}
              </p>
            </div>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => onAddProduct(product)}
                disabled={disabled || !canWrite}
                className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </article>
        ))}
      </div>
      <PaginationControls
        currentPage={paginatedProducts.currentPage}
        pageCount={paginatedProducts.pageCount}
        startItem={paginatedProducts.startItem}
        endItem={paginatedProducts.endItem}
        totalItems={paginatedProducts.totalItems}
        onPageChange={paginatedProducts.setCurrentPage}
      />
    </section>
  );
};

