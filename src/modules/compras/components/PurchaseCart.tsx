import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Barcode,
  CheckCircle2,
  DollarSign,
  Gift,
  Loader2,
  Lock,
  Package,
  PackagePlus,
  Percent,
  Search,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { handleNumericInputFocus } from "@/utils/input-helpers";
import { DualRateAmountInput, type RateAmountMode } from "@/components/ui/DualRateAmountInput";
import { matchesProductSearch } from "@/utils/search";
import type { Product } from "@/types/entities";
import { useBarcodeScanner } from "@/modules/pos/hooks/useBarcodeScanner";
import { cn } from "@/utils/cn";

export interface PurchaseCartItemView {
  product_id: string;
  name: string;
  sale_mode: "unit" | "weight";
  quantity: number;
  unit_cost: number;
  discount_percent: number;
  vat_percent: number;
  bonified_quantity: number;
  stock_current: number;
  previous_cost: number;
  current_sale_price: number;
  profit_percent: number;
  update_sale_price: boolean;
  new_sale_price: number;
}

export interface PurchaseSummary {
  subtotal: number;
  vatPercent?: number;
  vatTotal: number;
  iibbPercent?: number;
  iibbTotal?: number;
  extraTaxAmount?: number;
  extraTaxTotal?: number;
  total: number;
  totalUnits: number;
  totalDiscountAmount?: number;
}

interface PurchaseCartProps {
  items: PurchaseCartItemView[];
  summary: PurchaseSummary;
  canWrite: boolean;
  canAdjustProfitMargin?: boolean;
  disabled?: boolean;
  formId?: string;
  vatPercent?: number;
  onVatPercentChange?: (vat: number) => void;
  iibbPercent?: number;
  onIibbPercentChange?: (iibb: number) => void;
  iibbAmount?: number;
  onIibbAmountChange?: (amount: number) => void;
  extraTaxAmount?: number;
  onExtraTaxAmountChange?: (amount: number) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onSetUnitCost: (productId: string, unitCost: number) => void;
  onSetDiscountPercent?: (productId: string, discountPercent: number) => void;
  onSetProfitPercent?: (productId: string, profitPercent: number) => void;
  onSetSalePrice?: (productId: string, salePrice: number) => void;
  onSetVatPercent: (productId: string, vatPercent: number) => void;
  onSetBonifiedQuantity: (productId: string, bonifiedQty: number) => void;
  onSetUpdateSalePrice?: (productId: string, update: boolean) => void;
  onRemove: (productId: string) => void;
  onOpenCreateProductModal?: (initialCode?: string) => void;
  products?: Product[];
  barcodesByProductId?: Map<string, string[]>;
  onAddProduct?: (product: Product, quantity?: number) => void;
  onBarcodeScan?: (barcode: string) => Promise<{ ok: boolean; product?: Product; error?: string }>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const roundAmount = (val: number): number => Math.round(val * 100) / 100;

const VAT_OPTIONS = [
  { label: "0%", value: 0 },
  { label: "10.5%", value: 10.5 },
  { label: "21%", value: 21 },
  { label: "27%", value: 27 },
];

export const PurchaseCart = ({
  items,
  summary,
  canWrite,
  canAdjustProfitMargin = true,
  disabled,
  formId = "purchase-checkout-form",
  vatPercent = 0,
  onVatPercentChange,
  iibbPercent = 0,
  onIibbPercentChange,
  iibbAmount = 0,
  onIibbAmountChange,
  extraTaxAmount = 0,
  onExtraTaxAmountChange,
  onSetQuantity,
  onSetUnitCost,
  onSetDiscountPercent,
  onSetProfitPercent,
  onSetSalePrice,
  onSetVatPercent,
  onSetBonifiedQuantity,
  onSetUpdateSalePrice,
  onRemove,
  onOpenCreateProductModal,
  products = [],
  barcodesByProductId,
  onAddProduct,
  onBarcodeScan,
}: PurchaseCartProps) => {
  // Buscador y escáner inline
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Auto-dismiss scan feedback after 3s
  useEffect(() => {
    if (!scanFeedback) return;
    const t = setTimeout(() => setScanFeedback(null), 3000);
    return () => clearTimeout(t);
  }, [scanFeedback]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global F2 shortcut to focus the product search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filtrado de productos en vivo
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q || !products.length) return [];
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
          "all"
        )
      )
      .slice(0, 8);
  }, [searchQuery, products, barcodesByProductId]);

  const handleSelectProduct = (product: Product) => {
    if (disabled || !canWrite) return;
    onAddProduct?.(product, 1);
    setSearchQuery("");
    setIsDropdownOpen(false);
    setNotFoundCode(null);
    setScanFeedback({
      type: "success",
      message: `${product.name} agregado`,
    });
    window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleTriggerCreateNew = () => {
    const codeToUse = notFoundCode || searchQuery.trim() || undefined;
    onOpenCreateProductModal?.(codeToUse);
    setNotFoundCode(null);
    setSearchQuery("");
    setIsDropdownOpen(false);
  };

  const handleDirectBarcodeScan = async (scannedBarcode: string) => {
    const raw = scannedBarcode.trim();
    if (!raw || disabled || !canWrite) return;

    setIsScanning(true);
    setNotFoundCode(null);

    try {
      if (onBarcodeScan) {
        const scanResult = await onBarcodeScan(raw);
        if (scanResult.ok && scanResult.product) {
          setSearchQuery("");
          setIsDropdownOpen(false);
          setNotFoundCode(null);
          setScanFeedback({
            type: "success",
            message: `✓ ${scanResult.product.name} agregado a la compra`,
          });
          return;
        }
      }

      // No se encontró ningún producto con ese código de barras
      setNotFoundCode(raw);
      setSearchQuery(raw);
      setIsDropdownOpen(true);
      setScanFeedback({
        type: "error",
        message: `Código "${raw}" no encontrado en el inventario`,
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Escaneo global de código de barras (estilo POS, no requiere foco previo en el buscador)
  useBarcodeScanner({
    enabled: Boolean(canWrite && !disabled),
    onScan: (barcode) => {
      void handleDirectBarcodeScan(barcode);
    },
  });

  const handleSearchSubmit = async () => {
    const query = searchQuery.trim();
    if (!query || isScanning || disabled || !canWrite) return;

    setIsScanning(true);
    setNotFoundCode(null);

    try {
      // 1. Probar primero si coincide con código de barras o código directo
      if (onBarcodeScan) {
        const scanResult = await onBarcodeScan(query);
        if (scanResult.ok && scanResult.product) {
          setSearchQuery("");
          setIsDropdownOpen(false);
          setNotFoundCode(null);
          setScanFeedback({
            type: "success",
            message: `${scanResult.product.name} agregado a la compra`,
          });
          window.setTimeout(() => {
            searchInputRef.current?.focus();
          }, 50);
          return;
        }
      }

      // 2. Si no fue código exacto pero hay coincidencia en el dropdown
      if (searchResults.length > 0) {
        const target = searchResults[selectedIndex] ?? searchResults[0];
        handleSelectProduct(target);
        return;
      }

      // 3. No se encontró ningún producto
      setNotFoundCode(query);
      setScanFeedback({
        type: "error",
        message: `Código "${query}" no encontrado en el inventario`,
      });
      setIsDropdownOpen(true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isDropdownOpen && searchResults.length > 0) {
        setIsDropdownOpen(true);
      }
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      void handleSearchSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsDropdownOpen(false);
      setSearchQuery("");
    }
  };

  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
  const [discountDrafts, setDiscountDrafts] = useState<Record<string, string>>({});
  const [profitDrafts, setProfitDrafts] = useState<Record<string, string>>({});
  const [salePriceDrafts, setSalePriceDrafts] = useState<Record<string, string>>({});
  const [bonifiedDrafts, setBonifiedDrafts] = useState<Record<string, string>>({});
  const [vatDraft, setVatDraft] = useState<string | null>(null);
  const [extraTaxDraft, setExtraTaxDraft] = useState<string | null>(null);
  const [iibbMode, setIibbMode] = useState<RateAmountMode>(
    iibbAmount > 0 ? "amount" : "percent"
  );

  useEffect(() => {
    setVatDraft(null);
  }, [vatPercent]);

  useEffect(() => {
    setExtraTaxDraft(null);
  }, [extraTaxAmount]);

  const getUnitLabel = (item: PurchaseCartItemView) =>
    item.sale_mode === "weight" ? "g" : "u.";

  useEffect(() => {
    const ids = new Set(items.map((item) => item.product_id));
    setQuantityDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id)))
    );
    setCostDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id)))
    );
    setDiscountDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id)))
    );
    setProfitDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id)))
    );
    setSalePriceDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id)))
    );
    setBonifiedDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id)))
    );
  }, [items]);

  const commitQuantity = (item: PurchaseCartItemView) => {
    const raw = quantityDrafts[item.product_id];
    if (raw == null) return;
    const sanitized = raw.trim().replace(",", ".");
    const parsed = Number(sanitized);
    if (Number.isFinite(parsed) && parsed >= 0) {
      const qtyToSet = item.sale_mode === "weight" ? Number((parsed / 1000).toFixed(4)) : parsed;
      onSetQuantity(item.product_id, qtyToSet);
    }
    setQuantityDrafts((current) => {
      const { [item.product_id]: _discard, ...next } = current;
      return next;
    });
  };

  const commitCost = (item: PurchaseCartItemView) => {
    const raw = costDrafts[item.product_id];
    if (raw == null) return;
    const sanitized = raw.trim().replace(",", ".");
    const parsed = Number(sanitized);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSetUnitCost(item.product_id, parsed);
    }
    setCostDrafts((current) => {
      const { [item.product_id]: _discard, ...next } = current;
      return next;
    });
  };

  const commitDiscount = (item: PurchaseCartItemView) => {
    const raw = discountDrafts[item.product_id];
    if (raw == null) return;
    const sanitized = raw.trim().replace(",", ".");
    const parsed = Number(sanitized);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSetDiscountPercent?.(item.product_id, Math.min(99.99, parsed));
    }
    setDiscountDrafts((current) => {
      const { [item.product_id]: _discard, ...next } = current;
      return next;
    });
  };

  const commitProfit = (item: PurchaseCartItemView) => {
    const raw = profitDrafts[item.product_id];
    if (raw == null) return;
    const sanitized = raw.trim().replace(",", ".");
    const parsed = Number(sanitized);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSetProfitPercent?.(item.product_id, parsed);
    }
    setProfitDrafts((current) => {
      const { [item.product_id]: _discard, ...next } = current;
      return next;
    });
  };

  const commitSalePrice = (item: PurchaseCartItemView) => {
    const raw = salePriceDrafts[item.product_id];
    if (raw == null) return;
    const sanitized = raw.trim().replace(",", ".");
    const parsed = Number(sanitized);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSetSalePrice?.(item.product_id, parsed);
    }
    setSalePriceDrafts((current) => {
      const { [item.product_id]: _discard, ...next } = current;
      return next;
    });
  };

  const commitBonified = (item: PurchaseCartItemView) => {
    const raw = bonifiedDrafts[item.product_id];
    if (raw == null) return;
    const sanitized = raw.trim().replace(",", ".");
    const parsed = Number(sanitized);
    if (Number.isFinite(parsed) && parsed >= 0) {
      const qtyToSet = item.sale_mode === "weight" ? Number((parsed / 1000).toFixed(4)) : parsed;
      onSetBonifiedQuantity(item.product_id, qtyToSet);
    }
    setBonifiedDrafts((current) => {
      const { [item.product_id]: _discard, ...next } = current;
      return next;
    });
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 w-full max-w-full">
      {/* Header con Buscador / Escáner directo y botón Nuevo producto */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Productos de la compra
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {items.length} {items.length === 1 ? "ítem" : "ítems"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-400">
              Total mercadería a ingresar en stock:{" "}
              <strong className="text-slate-700 dark:text-slate-200">
                {items.some((i) => i.sale_mode === "weight")
                  ? items.every((i) => i.sale_mode === "weight")
                    ? `${(summary.totalUnits * 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} g`
                    : `${summary.totalUnits.toLocaleString("es-AR", { maximumFractionDigits: 3 })} (u. y kg)`
                  : `${summary.totalUnits.toLocaleString("es-AR", { maximumFractionDigits: 3 })} u.`}
              </strong>
            </p>
          </div>
        </div>

        {/* Buscador y Escáner Inline + Botón Nuevo Producto */}
        <div className="flex flex-1 items-center justify-start lg:justify-end gap-2.5 max-w-xl w-full">
          <div className="relative flex-1 max-w-md w-full">
            <div className="relative flex items-center h-10 w-full">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center text-slate-400 dark:text-slate-400 z-10">
                {isScanning ? (
                  <Loader2 className="h-4 w-4 animate-spin text-brand-600 dark:text-brand-400" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </span>
              <input
                ref={searchInputRef}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-scanner-capture="true"
                value={searchQuery}
                disabled={disabled || !canWrite}
                placeholder="Buscar o escanear código (F2 / Enter)..."
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                  setSelectedIndex(0);
                  if (notFoundCode) setNotFoundCode(null);
                }}
                onFocus={() => {
                  if (searchQuery.trim().length > 0) {
                    setIsDropdownOpen(true);
                  }
                }}
                onKeyDown={handleInputKeyDown}
                className="w-full h-10 pl-10 pr-9 text-xs sm:text-sm font-medium rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 dark:focus:border-brand-400 shadow-xs transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setIsDropdownOpen(false);
                    setNotFoundCode(null);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-md z-10"
                  title="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* FEEDBACK DE ESCANEO / NOTIFICACIÓN RÁPIDA */}
            {scanFeedback && (
              <div
                className={cn(
                  "absolute left-0 top-full mt-1.5 z-40 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg border animate-in fade-in slide-in-from-top-1",
                  scanFeedback.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                    : "bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                )}
              >
                {scanFeedback.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <span>{scanFeedback.message}</span>
              </div>
            )}

            {/* DROPDOWN FLOTANTE DE RESULTADOS DE BÚSQUEDA */}
            {isDropdownOpen && searchQuery.trim().length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-80 overflow-y-auto rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-2xl divide-y divide-slate-100 dark:divide-slate-800"
              >
                {searchResults.length > 0 ? (
                  <>
                    <div className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Resultados ({searchResults.length})</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                        Usa ↑↓ y Enter para agregar
                      </span>
                    </div>
                    {searchResults.map((prod, index) => {
                      const isHighlighted = index === selectedIndex;
                      const primaryBarcode = barcodesByProductId?.get(prod.id)?.[0] ?? "";
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => handleSelectProduct(prod)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={cn(
                            "w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between gap-3 transition-colors cursor-pointer border-l-4",
                            isHighlighted
                              ? "bg-blue-50/90 dark:bg-slate-800 text-slate-900 dark:text-white border-blue-600 dark:border-blue-400"
                              : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200 border-transparent"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                "font-bold truncate text-sm",
                                isHighlighted
                                  ? "text-blue-900 dark:text-white"
                                  : "text-slate-900 dark:text-slate-100"
                              )}
                            >
                              {prod.name}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {primaryBarcode && (
                                <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                                  <Barcode className="h-3 w-3" /> {primaryBarcode}
                                </span>
                              )}
                              {prod.code && <span className="text-slate-600 dark:text-slate-300">Cód: {prod.code}</span>}
                              <span className="text-slate-600 dark:text-slate-400">
                                Stock: <strong className="text-slate-800 dark:text-slate-200">{prod.stock_current.toLocaleString("es-AR")} {prod.sale_mode === "weight" ? "g" : "u."}</strong>
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-xs text-emerald-700 dark:text-emerald-400">
                              Costo: {currency.format(prod.cost_price ?? 0)}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                              Venta: {currency.format(prod.price)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <div className="p-4 text-center space-y-2.5 bg-white dark:bg-slate-900">
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      No se encontró ningún producto para <strong className="text-slate-900 dark:text-slate-100">"{searchQuery}"</strong>
                    </p>
                    {onOpenCreateProductModal && (
                      <button
                        type="button"
                        onClick={handleTriggerCreateNew}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow-xs cursor-pointer"
                      >
                        <PackagePlus className="h-4 w-4" />
                        Crear nuevo con este código
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BOTÓN NUEVO PRODUCTO (LEE AUTOMÁTICAMENTE EL CÓDIGO NO ENCONTRADO) */}
          {onOpenCreateProductModal && (
            <button
              type="button"
              onClick={handleTriggerCreateNew}
              disabled={disabled || !canWrite}
              title={
                notFoundCode
                  ? `Crear nuevo producto con el código escaneado "${notFoundCode}"`
                  : "Dar de alta un nuevo producto"
              }
              className={cn(
                "h-10 inline-flex items-center gap-1.5 rounded-xl border-2 px-3.5 text-xs font-semibold shadow-2xs transition-all cursor-pointer shrink-0",
                notFoundCode
                  ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-200 ring-2 ring-amber-400/50 animate-pulse font-bold"
                  : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80"
              )}
            >
              <PackagePlus className={cn("h-4 w-4", notFoundCode ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400")} />
              <span className="whitespace-nowrap">
                {notFoundCode ? `Crear "${notFoundCode}"` : "Nuevo producto"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Lista de productos o estado vacío */}
      {!items.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 py-8 text-center dark:border-slate-700/80 dark:bg-slate-800/40">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
            No hay productos cargados en esta compra
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-400">
            Escanea con el lector o busca en el campo superior para comenzar
          </p>

          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                searchInputRef.current?.focus();
              }}
              disabled={disabled || !canWrite}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              Buscar / Escanear producto
            </button>

            {onOpenCreateProductModal && (
              <button
                type="button"
                onClick={handleTriggerCreateNew}
                disabled={disabled || !canWrite}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <PackagePlus className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                {notFoundCode ? `Crear "${notFoundCode}"` : "Crear nuevo producto"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const grossLineTotal = roundAmount(item.quantity * item.unit_cost);
            const discountPct = Math.max(0, Math.min(100, item.discount_percent || 0));
            const lineSavings = roundAmount(grossLineTotal * (discountPct / 100));
            const lineTotal = roundAmount(grossLineTotal - lineSavings);
            const effectiveUnitCost = item.quantity > 0 ? roundAmount(lineTotal / item.quantity) : item.unit_cost;
            const totalStockIn = item.quantity + (item.bonified_quantity || 0);

            // Variación de costo
            const prevCost = item.previous_cost || 0;
            const unitCostDiff = item.unit_cost - prevCost;
            const hasCostDiff = Math.abs(unitCostDiff) > 0.001 && prevCost > 0;
            const costPctDiff = prevCost > 0 ? (unitCostDiff / prevCost) * 100 : 0;

            return (
              <article
                key={item.product_id}
                className="w-full max-w-full overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50/40 p-3 transition hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700/80 dark:bg-slate-800/50 dark:hover:border-slate-600 dark:hover:bg-slate-800/80"
              >
                <div className="flex items-start justify-between gap-2 w-full max-w-full">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900 truncate dark:text-slate-100">{item.name}</p>
                      {item.sale_mode === "weight" && (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          Pesable (g)
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        Stock actual:{" "}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {(item.sale_mode === "weight" ? item.stock_current * 1000 : item.stock_current).toLocaleString("es-AR", { maximumFractionDigits: 3 })}{" "}
                          {getUnitLabel(item)}
                        </strong>
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Ingresa a stock: +
                        {(item.sale_mode === "weight" ? totalStockIn * 1000 : totalStockIn).toLocaleString("es-AR", { maximumFractionDigits: 3 })}{" "}
                        {getUnitLabel(item)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.product_id)}
                    disabled={disabled || !canWrite}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                    title="Quitar producto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium">Quitar</span>
                  </button>
                </div>

                {/* Controles de edición en cuadrícula responsiva de 7 columnas */}
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 w-full max-w-full">
                  {/* 1. Cantidad a pagar */}
                  <div className="min-w-0">
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate" title={`Cant. a pagar (${getUnitLabel(item)})`}>
                      Cant. pagar ({getUnitLabel(item)})
                    </label>
                    <input
                      type="number"
                      step={item.sale_mode === "weight" ? "any" : "1"}
                      min="0"
                      value={
                        quantityDrafts[item.product_id] ??
                        (item.sale_mode === "weight"
                          ? String(Number((item.quantity * 1000).toFixed(3)))
                          : String(item.quantity))
                      }
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setQuantityDrafts((current) => ({
                          ...current,
                          [item.product_id]: nextValue,
                        }));
                        if (!nextValue.trim()) return;
                        const parsed = Number(nextValue.trim().replace(",", "."));
                        if (Number.isFinite(parsed) && parsed >= 0) {
                          const qtyToSet = item.sale_mode === "weight" ? Number((parsed / 1000).toFixed(4)) : parsed;
                          onSetQuantity(item.product_id, qtyToSet);
                        }
                      }}
                      onFocus={(e) =>
                        handleNumericInputFocus(e, {
                          isNew: false,
                        })
                      }
                      onBlur={() => commitQuantity(item)}
                      className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-brand-400"
                      disabled={disabled || !canWrite}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  </div>

                  {/* 2. Precio unitario */}
                  <div className="min-w-0">
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate" title={`Precio unitario (${item.sale_mode === "weight" ? "$/kg" : "$/u"})`}>
                      Precio unit. ({item.sale_mode === "weight" ? "$/kg" : "$/u"})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={costDrafts[item.product_id] ?? String(item.unit_cost)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setCostDrafts((current) => ({
                          ...current,
                          [item.product_id]: nextValue,
                        }));
                        if (!nextValue.trim()) return;
                        const parsed = Number(nextValue.trim().replace(",", "."));
                        if (Number.isFinite(parsed) && parsed >= 0) {
                          onSetUnitCost(item.product_id, parsed);
                        }
                      }}
                      onFocus={(e) =>
                        handleNumericInputFocus(e, {
                          isNew: item.unit_cost === 0,
                          onClear: () =>
                            setCostDrafts((current) => ({
                              ...current,
                              [item.product_id]: "",
                            })),
                        })
                      }
                      onBlur={() => commitCost(item)}
                      className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-brand-400"
                      disabled={disabled || !canWrite}
                      title="Precio que cobra el proveedor por unidad (con descuento incluido)"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  </div>

                  {/* 3. Unidades bonificadas */}
                  <div className="min-w-0">
                    <label className="mb-0.5 flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 truncate" title={`Unidades bonificadas (${getUnitLabel(item)})`}>
                      <Gift className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      Bonif. ({getUnitLabel(item)})
                    </label>
                    <input
                      type="number"
                      step={item.sale_mode === "weight" ? "any" : "1"}
                      min="0"
                      placeholder="0"
                      value={
                        bonifiedDrafts[item.product_id] ??
                        (item.sale_mode === "weight"
                          ? String(Number(((item.bonified_quantity || 0) * 1000).toFixed(3)))
                          : String(item.bonified_quantity || 0))
                      }
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setBonifiedDrafts((current) => ({
                          ...current,
                          [item.product_id]: nextValue,
                        }));
                        if (!nextValue.trim()) return;
                        const parsed = Number(nextValue.trim().replace(",", "."));
                        if (Number.isFinite(parsed) && parsed >= 0) {
                          const qtyToSet = item.sale_mode === "weight" ? Number((parsed / 1000).toFixed(4)) : parsed;
                          onSetBonifiedQuantity(item.product_id, qtyToSet);
                        }
                      }}
                      onFocus={(e) =>
                        handleNumericInputFocus(e, {
                          isNew: (item.bonified_quantity || 0) === 0,
                          onClear: () =>
                            setBonifiedDrafts((current) => ({
                              ...current,
                              [item.product_id]: "",
                            })),
                        })
                      }
                      onBlur={() => commitBonified(item)}
                      className="w-full min-w-0 rounded-md border border-emerald-300 bg-emerald-50/40 px-2 py-1.5 text-xs font-bold text-emerald-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:focus:border-emerald-400"
                      disabled={disabled || !canWrite}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  </div>

                  {/* 4. Descuento proveedor */}
                  <div className="min-w-0">
                    <label className="mb-0.5 flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400 truncate" title="Descuento del proveedor (%)">
                      <Tag className="h-2.5 w-2.5 text-brand-600 dark:text-brand-400 shrink-0" />
                      Desc. prov. (%)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={discountDrafts[item.product_id] ?? String(item.discount_percent || 0)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setDiscountDrafts((current) => ({
                          ...current,
                          [item.product_id]: nextValue,
                        }));
                        if (!nextValue.trim()) return;
                        const parsed = Number(nextValue.trim().replace(",", "."));
                        if (Number.isFinite(parsed) && parsed >= 0) {
                          onSetDiscountPercent?.(item.product_id, Math.min(99.99, parsed));
                        }
                      }}
                      onFocus={(e) =>
                        handleNumericInputFocus(e, {
                          isNew: (item.discount_percent || 0) === 0,
                          onClear: () =>
                            setDiscountDrafts((current) => ({
                              ...current,
                              [item.product_id]: "",
                            })),
                        })
                      }
                      onBlur={() => commitDiscount(item)}
                      className="w-full min-w-0 rounded-md border border-brand-300 bg-brand-50/40 px-2 py-1.5 text-xs font-bold text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-brand-700/60 dark:bg-brand-950/40 dark:text-brand-200 dark:focus:border-brand-400"
                      disabled={disabled || !canWrite}
                      title="Descuento aplicado por el proveedor: se descuenta directamente sobre el total a pagar de este producto"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  </div>

                  {/* 5. % Ganancia */}
                  <div className="min-w-0">
                    <label className="mb-0.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400 truncate" title="Margen de ganancia (%)">
                      <span className="flex items-center gap-0.5 truncate">
                        <Percent className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400 shrink-0" />
                        Ganancia (%)
                      </span>
                      {!canAdjustProfitMargin && <Lock className="h-2.5 w-2.5 text-slate-400 dark:text-slate-500 shrink-0 ml-1" />}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={profitDrafts[item.product_id] ?? String(item.profit_percent ?? 0)}
                      onChange={(event) => {
                        if (!canAdjustProfitMargin) return;
                        const nextValue = event.target.value;
                        setProfitDrafts((current) => ({
                          ...current,
                          [item.product_id]: nextValue,
                        }));
                        if (!nextValue.trim()) return;
                        const parsed = Number(nextValue.trim().replace(",", "."));
                        if (Number.isFinite(parsed) && parsed >= 0) {
                          onSetProfitPercent?.(item.product_id, parsed);
                        }
                      }}
                      onFocus={(e) =>
                        handleNumericInputFocus(e, {
                          isNew: (item.profit_percent || 0) === 0,
                          onClear: () =>
                            setProfitDrafts((current) => ({
                              ...current,
                              [item.product_id]: "",
                            })),
                        })
                      }
                      onBlur={() => commitProfit(item)}
                      className={`w-full min-w-0 rounded-md border px-2 py-1.5 text-xs font-bold ${
                        !canAdjustProfitMargin
                          ? "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500"
                          : "border-purple-300 bg-purple-50/30 text-purple-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-purple-700/60 dark:bg-purple-950/40 dark:text-purple-200 dark:focus:border-purple-400"
                      }`}
                      disabled={disabled || !canWrite || !canAdjustProfitMargin}
                      title={!canAdjustProfitMargin ? "Ajuste de margen deshabilitado por configuración o permisos" : "Margen de ganancia aplicado sobre el costo real"}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  </div>

                  {/* 6. IVA */}
                  <div className="min-w-0">
                    <label className="mb-0.5 flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                      <Percent className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                      IVA
                    </label>
                    <select
                      value={item.vat_percent}
                      onChange={(event) => onSetVatPercent(item.product_id, Number(event.target.value))}
                      className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:focus:border-brand-400"
                      disabled={disabled || !canWrite}
                    >
                      {VAT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 7. Precio final unitario: En móvil abarca las 2 columnas para no desbordar y brindar máxima claridad */}
                  <div className="col-span-2 sm:col-span-2 lg:col-span-1 min-w-0">
                    <label className="mb-0.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 truncate" title={`Precio final unitario (${item.sale_mode === "weight" ? "$/kg" : "$/u"})`}>
                      <span className="truncate">Precio final unit. ({item.sale_mode === "weight" ? "$/kg" : "$/u"})</span>
                      {!canAdjustProfitMargin && <Lock className="h-2.5 w-2.5 text-slate-400 dark:text-slate-500 shrink-0 ml-1" />}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={salePriceDrafts[item.product_id] ?? String(item.new_sale_price || 0)}
                      onChange={(event) => {
                        if (!canAdjustProfitMargin) return;
                        const nextValue = event.target.value;
                        setSalePriceDrafts((current) => ({
                          ...current,
                          [item.product_id]: nextValue,
                        }));
                        if (!nextValue.trim()) return;
                        const parsed = Number(nextValue.trim().replace(",", "."));
                        if (Number.isFinite(parsed) && parsed >= 0) {
                          onSetSalePrice?.(item.product_id, parsed);
                        }
                      }}
                      onFocus={(e) =>
                        handleNumericInputFocus(e, {
                          isNew: (item.new_sale_price || 0) === 0,
                          onClear: () =>
                            setSalePriceDrafts((current) => ({
                              ...current,
                              [item.product_id]: "",
                            })),
                        })
                      }
                      onBlur={() => commitSalePrice(item)}
                      className={`w-full min-w-0 rounded-md border px-2 py-1.5 text-xs font-bold ${
                        !canAdjustProfitMargin
                          ? "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500"
                          : "border-blue-300 bg-blue-50/40 text-blue-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-700/60 dark:bg-blue-950/40 dark:text-blue-200 dark:focus:border-blue-400"
                      }`}
                      disabled={disabled || !canWrite || !canAdjustProfitMargin}
                      title={!canAdjustProfitMargin ? "Ajuste de precio/margen deshabilitado por configuración o permisos" : "Precio de venta final al público (aplica ganancia e IVA sobre el costo real)"}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                  </div>
                </div>

                {/* Subtotal, Costo antes, Opciones de Actualización de Venta y Totales por fila */}
                <div className="mt-2 flex flex-col gap-2 border-t border-slate-200/60 pt-2 text-[11px] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between dark:border-slate-700/60 w-full max-w-full">
                  {/* Subtotal y Costo antes */}
                  <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-400 min-w-0">
                    <span>
                      Subtotal: <strong className="text-slate-800 dark:text-slate-200">{currency.format(grossLineTotal)}</strong>
                    </span>

                    {/* Costo antes con variación: solo si hubo cambio de costo de lista */}
                    {hasCostDiff ? (
                      <>
                        <span>•</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                            unitCostDiff > 0
                              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300"
                          }`}
                          title={`Costo anterior: ${currency.format(prevCost)} | Diferencia: ${currency.format(unitCostDiff)}`}
                        >
                          <span>Costo antes: {currency.format(prevCost)}</span>
                          <span>
                            ({unitCostDiff > 0 ? "+" : ""}
                            {costPctDiff.toFixed(1)}% {unitCostDiff > 0 ? "▲" : "▼"})
                          </span>
                        </span>
                      </>
                    ) : null}
                  </div>

                  {/* Opciones inline de actualización de precio (SOLO aparecen si hubo cambio de costo) */}
                  {hasCostDiff && (
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-md border border-slate-200/60 bg-slate-50/80 px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700/60 dark:bg-slate-900/80 dark:text-slate-300 w-full sm:w-auto max-w-full">
                      {/* Casilla 1: Mantener precio venta */}
                      <label className="inline-flex cursor-pointer items-center gap-1.5 select-none text-[10px] sm:text-[11px]">
                        <input
                          type="radio"
                          name={`sale-price-policy-${item.product_id}`}
                          checked={!item.update_sale_price}
                          onChange={() => onSetUpdateSalePrice?.(item.product_id, false)}
                          disabled={disabled || !canWrite}
                          className="h-3.5 w-3.5 text-brand-600 focus:ring-brand-500 shrink-0"
                        />
                        <span className="font-medium">
                          <span>Mantener anterior </span>
                          ({currency.format(item.current_sale_price || 0)})
                        </span>
                      </label>

                      {/* Casilla 2: Actualizar precio venta */}
                      <label className="inline-flex cursor-pointer items-center gap-1.5 select-none text-[10px] sm:text-[11px]">
                        <input
                          type="radio"
                          name={`sale-price-policy-${item.product_id}`}
                          checked={Boolean(item.update_sale_price)}
                          onChange={() => onSetUpdateSalePrice?.(item.product_id, true)}
                          disabled={disabled || !canWrite}
                          className="h-3.5 w-3.5 text-brand-600 focus:ring-brand-500 shrink-0"
                        />
                        <span className="font-medium">
                          <span>Aplicar nuevo </span>
                          ({currency.format(item.new_sale_price || 0)})
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Total del ítem y desglose de descuento */}
                  <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto min-w-0">
                    {item.discount_percent > 0 && (
                      <span
                        className="inline-flex flex-wrap items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 max-w-full break-words leading-tight"
                        title={`Descuento del proveedor: -${currency.format(lineSavings)}. Costo unitario neto a pagar: ${currency.format(effectiveUnitCost)}/u. Ahorro para el comercio: +${currency.format(lineSavings)}`}
                      >
                        <span>🏷️ Desc. {item.discount_percent}% (-{currency.format(lineSavings)})</span>
                        <span>• Neto: {currency.format(effectiveUnitCost)}/u</span>
                      </span>
                    )}
                    <div className="flex items-center justify-between sm:justify-end gap-1.5 font-bold text-slate-900 dark:text-slate-100 w-full xs:w-auto shrink-0">
                      <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">Total a pagar:</span>
                      <span className="text-base sm:text-lg font-black text-brand-700 dark:text-brand-400">
                        {currency.format(lineTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Resumen Total y Botón de Confirmación Responsivo para Móvil (al final de la compra) */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 sm:p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/80 w-full max-w-full overflow-hidden">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between w-full max-w-full">
          {/* Grid de Totales e Impuestos: fila 1 (IVA y Neto), fila 2 (IIBB), fila 3 (Imp. Agregado y Total) */}
          <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_auto] items-center gap-x-2.5 sm:gap-x-4 gap-y-2 text-xs w-full max-w-full">
            {/* Fila 1, Columna 1: % IVA */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900/90">
              <span className="flex items-center justify-center rounded bg-blue-50 dark:bg-blue-950/60 p-1 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50" title="Porcentaje de IVA">
                <Percent className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
              </span>
              <label
                htmlFor="purchase-vat-input"
                className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                IVA:
              </label>
              <div className="flex items-center">
                <input
                  id="purchase-vat-input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="100"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  value={vatDraft ?? (vatPercent === 0 ? "0" : vatPercent.toString())}
                  onFocus={handleNumericInputFocus}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setVatDraft(raw);
                    const val = raw.trim().replace(",", ".");
                    if (val === "") {
                      onVatPercentChange?.(0);
                    } else {
                      const parsed = Number(val);
                      if (!isNaN(parsed) && parsed >= 0) {
                        onVatPercentChange?.(Math.min(100, parsed));
                      }
                    }
                  }}
                  onBlur={() => setVatDraft(null)}
                  disabled={disabled || !canWrite}
                  placeholder="0"
                  className="w-14 sm:w-16 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-center text-xs sm:text-sm font-bold text-slate-900 transition focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <span className="font-bold text-[11px] sm:text-xs text-blue-700 dark:text-blue-400 whitespace-nowrap">
                ({currency.format(summary.vatTotal)})
              </span>
            </div>

            {/* Fila 1, Columna 2: Subtotal neto */}
            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap justify-self-end">
              <span className="text-slate-500 dark:text-slate-400">Neto:</span>
              <strong className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                {currency.format(summary.subtotal)}
              </strong>
            </div>

            {/* Fila 2, Columna 1: IIBB con selector dual (% o $) */}
            <DualRateAmountInput
              id="purchase-iibb-input"
              label="IIBB"
              mode={iibbMode}
              onModeChange={setIibbMode}
              percentValue={iibbPercent}
              amountValue={iibbAmount > 0 ? iibbAmount : summary.iibbTotal ?? 0}
              baseTotal={summary.subtotal}
              onPercentChange={(val) => {
                onIibbPercentChange?.(val);
                onIibbAmountChange?.(0);
              }}
              onAmountChange={(val) => {
                onIibbAmountChange?.(val);
                const derivedPercent = summary.subtotal > 0 ? (val / summary.subtotal) * 100 : 0;
                onIibbPercentChange?.(Math.min(100, Math.round(derivedPercent * 100) / 100));
              }}
              disabled={disabled || !canWrite}
              accentColor="amber"
            />

            {/* Fila 2, Columna 2: Descuentos / Ahorro */}
            <div className="flex items-center justify-end justify-self-end">
              {summary.totalDiscountAmount != null && summary.totalDiscountAmount > 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-100/80 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  Ahorro: +{currency.format(summary.totalDiscountAmount)}
                </div>
              ) : null}
            </div>

            {/* Fila 3, Columna 1: Impuesto Agregado (solo por monto) */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-900/90">
              <span
                className="flex items-center justify-center rounded bg-purple-50 dark:bg-purple-950/60 p-1 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50"
                title="Impuesto por monto fijo"
              >
                <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.5} />
              </span>
              <label
                htmlFor="purchase-extra-tax-input"
                className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 cursor-pointer"
                title="Impuesto agregado o percepción adicional por monto fijo"
              >
                Imp. Agregado:
              </label>
              <div className="flex items-center">
                <input
                  id="purchase-extra-tax-input"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  value={extraTaxDraft ?? (extraTaxAmount === 0 ? "0" : extraTaxAmount.toString())}
                  onFocus={handleNumericInputFocus}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setExtraTaxDraft(raw);
                    const val = raw.trim().replace(",", ".");
                    if (val === "") {
                      onExtraTaxAmountChange?.(0);
                    } else {
                      const parsed = Number(val);
                      if (!isNaN(parsed) && parsed >= 0) {
                        onExtraTaxAmountChange?.(Math.round(parsed * 100) / 100);
                      }
                    }
                  }}
                  onBlur={() => setExtraTaxDraft(null)}
                  disabled={disabled || !canWrite}
                  placeholder="0"
                  className="w-14 sm:w-16 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-center text-xs sm:text-sm font-bold text-slate-900 transition focus:border-purple-500 focus:outline-none dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <span className="font-bold text-[11px] sm:text-xs text-purple-700 dark:text-purple-400 whitespace-nowrap">
                ({currency.format(summary.extraTaxTotal ?? 0)})
              </span>
            </div>

            {/* Fila 3, Columna 2: Total a pagar */}
            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap justify-self-end">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Total:</span>
              <strong className="text-base sm:text-lg font-black text-brand-700 dark:text-brand-400">
                {currency.format(summary.total)}
              </strong>
            </div>
          </div>

          {/* Botón de confirmación / pago */}
          <button
            type="submit"
            form={formId}
            disabled={disabled || !canWrite || items.length === 0}
            title={items.length === 0 ? "Agregá productos al carrito para proceder al pago" : "Proceder al registro del pago"}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            <span>Proceder al pago</span>
            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </section>
  );
};
