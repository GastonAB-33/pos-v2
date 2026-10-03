import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCircle2,
  DollarSign,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Tag,
  X,
} from "lucide-react";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useBarcodeScanner } from "@/modules/pos/hooks/useBarcodeScanner";
import type { ProductViewModel } from "@/modules/productos/types/product.types";
import {
  computePricingForward,
  computePricingReverse,
  DEFAULT_IVA_PERCENT,
  roundMoney,
  roundPercent,
} from "@/modules/productos/utils/product-pricing";
import { handleNumericInputFocus } from "@/utils/input-helpers";
import { matchesProductSearch, normalizeSearchQuery } from "@/utils/search";

type CalcMode = "forward" | "reverse";

interface FieldErrors {
  costPrice?: string;
  profitPercent?: string;
  vatPercent?: string;
  finalPrice?: string;
  addedStock?: string;
  general?: string;
}

interface ProductQuickPriceModalProps {
  open: boolean;
  onClose: () => void;
  products: ProductViewModel[];
  barcodesByProductId?: Map<string, string[]>;
  canWrite: boolean;
  onSavePrice: (
    productId: string,
    pricing: {
      costPrice: number;
      profitPercent: number;
      vatPercent: number;
      priceWithoutVat: number;
      finalPrice: number;
      addedStock?: number;
    }
  ) => Promise<unknown>;
  onCreateNewProduct?: (initialQuery?: string) => void;
  onEditProduct?: (product: ProductViewModel) => void;
  initialQuery?: string | null;
}

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const ProductQuickPriceModal = ({
  open,
  onClose,
  products,
  barcodesByProductId,
  canWrite,
  onSavePrice,
  onCreateNewProduct,
  onEditProduct,
  initialQuery,
}: ProductQuickPriceModalProps) => {
  useBodyScrollLock(open);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const finalPriceInputRef = useRef<HTMLInputElement | null>(null);
  const lastAppliedInitialQueryRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const productInfoCardRef = useRef<HTMLDivElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductViewModel | null>(null);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Campos de precios editables
  const [costPrice, setCostPrice] = useState<number>(0);
  const [profitPercent, setProfitPercent] = useState<number>(0);
  const [vatPercent, setVatPercent] = useState<number>(DEFAULT_IVA_PERCENT);
  const [priceWithoutVat, setPriceWithoutVat] = useState<number>(0);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [addedStock, setAddedStock] = useState<string>("");

  const [isSaving, setIsSaving] = useState(false);
  const [calcMode, setCalcMode] = useState<CalcMode>("forward");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [flashStatus, setFlashStatus] = useState<"success" | "error" | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field] && !prev.general) return prev;
      const next = { ...prev };
      delete next[field];
      delete next.general;
      return next;
    });
  };

  // Estado para confirmación de cambios no guardados
  const [pendingProduct, setPendingProduct] = useState<ProductViewModel | null>(null);
  const [pendingCreateQuery, setPendingCreateQuery] = useState<string | null>(null);
  const [pendingSearchQuery, setPendingSearchQuery] = useState<string | null>(null);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);

  // Detectar si el precio o stock actual fue modificado (dirty)
  const isPriceDirty = useMemo(() => {
    if (!selectedProduct) return false;
    const initialCost = roundMoney(selectedProduct.precioCosto || 0);
    const initialProfit = roundPercent(selectedProduct.porcentajeGanancia || 0);
    const initialVat = roundPercent(selectedProduct.porcentajeIva ?? DEFAULT_IVA_PERCENT);
    const initialFinal = roundMoney(selectedProduct.precioFinal || 0);

    const hasAddedStock =
      addedStock.trim() !== "" && !isNaN(Number(addedStock)) && Number(addedStock) !== 0;

    return (
      roundMoney(costPrice) !== initialCost ||
      roundPercent(profitPercent) !== initialProfit ||
      roundPercent(vatPercent) !== initialVat ||
      roundMoney(finalPrice) !== initialFinal ||
      hasAddedStock
    );
  }, [selectedProduct, costPrice, profitPercent, vatPercent, finalPrice, addedStock]);

  // Autofocus en el input de búsqueda al abrir o seleccionar producto inicial
  useEffect(() => {
    if (open) {
      if (initialQuery && initialQuery !== lastAppliedInitialQueryRef.current) {
        lastAppliedInitialQueryRef.current = initialQuery;
        const clean = initialQuery.trim();
        const compact = normalizeSearchQuery(clean).replace(/\s+/g, "");
        const match = products.find((p) => {
          if (normalizeSearchQuery(p.codigoBarras) === compact) return true;
          if (normalizeSearchQuery(p.codigoProducto) === compact) return true;
          if (p.nombre.trim().toLowerCase() === clean.toLowerCase()) return true;
          return false;
        });

        if (match) {
          applySelectProduct(match);
        } else {
          setNotFoundCode(clean);
          setSearchQuery("");
        }
      } else if (!selectedProduct) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
    } else {
      lastAppliedInitialQueryRef.current = null;
      setSearchQuery("");
      setSelectedProduct(null);
      setNotFoundCode(null);
      setAddedStock("");
      setCalcMode("forward");
      setFieldErrors({});
      setFlashStatus(null);
      setPendingProduct(null);
      setPendingCreateQuery(null);
      setPendingSearchQuery(null);
      setShowUnsavedPrompt(false);
    }
  }, [open, initialQuery, products, barcodesByProductId]);

  // Aplicar selección efectiva de producto
  const applySelectProduct = (product: ProductViewModel) => {
    setSelectedProduct(product);
    setNotFoundCode(null);
    setCostPrice(product.precioCosto || 0);
    setProfitPercent(product.porcentajeGanancia || 0);
    setVatPercent(product.porcentajeIva ?? DEFAULT_IVA_PERCENT);
    setPriceWithoutVat(product.precioSinIva || 0);
    setFinalPrice(product.precioFinal || 0);
    setAddedStock("");
    setCalcMode("forward");
    setFieldErrors({});
    setFlashStatus(null);
    setSearchQuery("");
    setShowUnsavedPrompt(false);
    setPendingProduct(null);
    setPendingCreateQuery(null);
    setPendingSearchQuery(null);

    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: "auto" });
      }
      const isMobile =
        typeof window !== "undefined" &&
        (window.innerWidth < 768 || window.matchMedia("(max-width: 768px)").matches);
      if (!isMobile) {
        searchInputRef.current?.focus({ preventScroll: true });
      }
    }, 100);
  };

  // Intentar cambiar de producto (con chequeo de cambios no guardados)
  const attemptSelectProduct = (nextProduct: ProductViewModel) => {
    if (selectedProduct && selectedProduct.entity.id === nextProduct.entity.id) {
      setSearchQuery("");
      setNotFoundCode(null);
      return;
    }

    if (selectedProduct && isPriceDirty) {
      setPendingProduct(nextProduct);
      setPendingCreateQuery(null);
      setPendingSearchQuery(null);
      setShowUnsavedPrompt(true);
      return;
    }

    applySelectProduct(nextProduct);
  };

  // Intentar crear producto nuevo (con chequeo de cambios no guardados)
  const attemptCreateNew = (query?: string) => {
    const targetQuery = (query || notFoundCode || searchQuery).trim();
    if (selectedProduct && isPriceDirty) {
      setPendingProduct(null);
      setPendingCreateQuery(targetQuery);
      setPendingSearchQuery(null);
      setShowUnsavedPrompt(true);
      return;
    }

    onCreateNewProduct?.(targetQuery);
  };

  // Abrir la ficha completa del producto para editar nombre, categoría, etc.
  const handleOpenEditProduct = () => {
    if (!selectedProduct || !onEditProduct) return;
    if (isPriceDirty) {
      const confirmLeave = window.confirm(
        "Hay cambios de precio sin guardar en la consulta rápida. ¿Deseas descartarlos para editar la ficha completa del producto?"
      );
      if (!confirmLeave) return;
    }
    onEditProduct(selectedProduct);
  };

  // Acciones ante cambios no guardados: Guardar y avanzar
  const handleSaveAndProceed = async () => {
    if (!selectedProduct) return;
    setIsSaving(true);
    try {
      const parsedAdded = addedStock.trim() !== "" ? parseFloat(addedStock) : 0;
      await onSavePrice(selectedProduct.entity.id, {
        costPrice: roundMoney(costPrice),
        profitPercent: roundPercent(profitPercent),
        vatPercent: roundPercent(vatPercent),
        priceWithoutVat: roundMoney(priceWithoutVat),
        finalPrice: roundMoney(finalPrice),
        addedStock: parsedAdded > 0 ? parsedAdded : undefined,
      });

      setAddedStock("");
      setShowUnsavedPrompt(false);
      if (pendingProduct) {
        applySelectProduct(pendingProduct);
      } else if (pendingCreateQuery !== null) {
        onCreateNewProduct?.(pendingCreateQuery);
      } else if (pendingSearchQuery !== null) {
        setSelectedProduct(null);
        setNotFoundCode(pendingSearchQuery);
        setSearchQuery("");
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else {
        setSelectedProduct(null);
        setNotFoundCode(null);
        setSearchQuery("");
      }
    } catch (err) {
      setFlashStatus("error");
      setFieldErrors({
        general: err instanceof Error ? err.message : "Error al guardar el precio del producto",
      });
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => {
        setFlashStatus(null);
      }, 1500);
    } finally {
      setIsSaving(false);
      setPendingProduct(null);
      setPendingCreateQuery(null);
      setPendingSearchQuery(null);
    }
  };

  // Acciones ante cambios no guardados: Descartar y avanzar
  const handleDiscardAndProceed = () => {
    setShowUnsavedPrompt(false);
    setAddedStock("");
    if (pendingProduct) {
      applySelectProduct(pendingProduct);
    } else if (pendingCreateQuery !== null) {
      onCreateNewProduct?.(pendingCreateQuery);
    } else if (pendingSearchQuery !== null) {
      setSelectedProduct(null);
      setNotFoundCode(pendingSearchQuery);
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSelectedProduct(null);
      setNotFoundCode(null);
      setSearchQuery("");
    }
    setPendingProduct(null);
    setPendingCreateQuery(null);
    setPendingSearchQuery(null);
  };

  // Acciones ante cambios no guardados: Cancelar
  const handleCancelSwitch = () => {
    setShowUnsavedPrompt(false);
    setPendingProduct(null);
    setPendingCreateQuery(null);
    setPendingSearchQuery(null);
    finalPriceInputRef.current?.focus();
  };

  // Procesar código de barras escaneado (físico o cámara)
  const handleScannedBarcode = (scannedBarcode: string) => {
    const clean = scannedBarcode.trim();
    if (!clean) return;

    const compact = normalizeSearchQuery(clean).replace(/\s+/g, "");
    const match = products.find((p) => {
      if (normalizeSearchQuery(p.codigoBarras) === compact) return true;
      if (normalizeSearchQuery(p.codigoProducto) === compact) return true;
      return false;
    });

    if (match) {
      setNotFoundCode(null);
      attemptSelectProduct(match);
    } else {
      if (selectedProduct && isPriceDirty) {
        setPendingProduct(null);
        setPendingCreateQuery(null);
        setPendingSearchQuery(clean);
        setShowUnsavedPrompt(true);
      } else {
        setSelectedProduct(null);
        setNotFoundCode(clean);
        setSearchQuery("");
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    }
  };

  // Escáner continuo de código de barras (Hardware / lector USB)
  useBarcodeScanner({
    enabled: open && !scannerOpen && !showUnsavedPrompt,
    onScan: handleScannedBarcode,
  });

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (notFoundCode) {
      setNotFoundCode(null);
    }
    if (selectedProduct && isPriceDirty && val.trim() !== "") {
      setPendingProduct(null);
      setPendingCreateQuery(null);
      setPendingSearchQuery(val);
      setShowUnsavedPrompt(true);
      return;
    }
    setSearchQuery(val);
    if (selectedProduct && val.trim() !== "") {
      setSelectedProduct(null);
    }
  };

  const handleClearSearch = () => {
    if (selectedProduct && isPriceDirty) {
      setPendingProduct(null);
      setPendingCreateQuery(null);
      setPendingSearchQuery("");
      setShowUnsavedPrompt(true);
      return;
    }
    setSearchQuery("");
    setSelectedProduct(null);
    setNotFoundCode(null);
    setFieldErrors({});
    setFlashStatus(null);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Búsqueda en tiempo real para sugerencias
  const searchResults = useMemo(() => {
    const raw = searchQuery.trim();
    if (!raw) return [];

    const norm = normalizeSearchQuery(raw);
    const compact = norm.replace(/\s+/g, "");

    return products
      .filter((p) => {
        return matchesProductSearch(
          {
            name: p.nombre,
            code: p.codigoProducto,
            barcode: p.codigoBarras,
            category: p.categoria,
            subcategory: p.subcategoria,
            supplier: p.proveedor,
          },
          raw,
          "all"
        );
      })
      .sort((a, b) => {
        const aCode = normalizeSearchQuery(a.codigoProducto);
        const bCode = normalizeSearchQuery(b.codigoProducto);
        const aBar = normalizeSearchQuery(a.codigoBarras);
        const bBar = normalizeSearchQuery(b.codigoBarras);

        if (aBar === compact || aCode === compact) return -1;
        if (bBar === compact || bCode === compact) return 1;
        return a.nombre.localeCompare(b.nombre);
      })
      .slice(0, 10);
  }, [products, searchQuery]);

  // Si el usuario presiona Enter en la búsqueda
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const raw = searchQuery.trim();
      if (!raw) return;

      const compact = normalizeSearchQuery(raw).replace(/\s+/g, "");

      const exactMatch = products.find((p) => {
        if (normalizeSearchQuery(p.codigoBarras) === compact) return true;
        if (normalizeSearchQuery(p.codigoProducto) === compact) return true;
        return false;
      });

      const isBarcodeLike = /^\d{6,}$/.test(compact);

      if (exactMatch) {
        setNotFoundCode(null);
        attemptSelectProduct(exactMatch);
        return;
      }

      // Si no es un código de barras numérico y hay sugerencias por nombre/texto, seleccionar la primera
      if (!isBarcodeLike && searchResults.length > 0) {
        setNotFoundCode(null);
        attemptSelectProduct(searchResults[0]);
        return;
      }

      // No results
      if (selectedProduct && isPriceDirty) {
        setPendingProduct(null);
        setPendingCreateQuery(null);
        setPendingSearchQuery(raw);
        setShowUnsavedPrompt(true);
      } else {
        setSelectedProduct(null);
        setNotFoundCode(raw);
        setSearchQuery("");
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    }
  };

  // Recálculos de precios reactivos (idénticos a la lógica del módulo de productos)
  const handleCostChange = (newCost: number) => {
    setCostPrice(newCost);
    clearFieldError("costPrice");
    setCalcMode("forward");
    const forward = computePricingForward({
      precioCosto: newCost,
      porcentajeGanancia: profitPercent,
      porcentajeIva: vatPercent,
    });
    setPriceWithoutVat(forward.precioSinIva);
    setFinalPrice(forward.precioFinal);
  };

  const handleProfitChange = (newProfit: number) => {
    setProfitPercent(newProfit);
    clearFieldError("profitPercent");
    if (calcMode === "reverse") {
      const reverse = computePricingReverse({
        precioFinal: finalPrice,
        porcentajeGanancia: newProfit,
        porcentajeIva: vatPercent,
      });
      setPriceWithoutVat(reverse.precioSinIva);
      setCostPrice(reverse.precioCosto);
    } else {
      const forward = computePricingForward({
        precioCosto: costPrice,
        porcentajeGanancia: newProfit,
        porcentajeIva: vatPercent,
      });
      setPriceWithoutVat(forward.precioSinIva);
      setFinalPrice(forward.precioFinal);
    }
  };

  const handleVatChange = (newVat: number) => {
    setVatPercent(newVat);
    clearFieldError("vatPercent");
    if (calcMode === "reverse") {
      const reverse = computePricingReverse({
        precioFinal: finalPrice,
        porcentajeGanancia: profitPercent,
        porcentajeIva: newVat,
      });
      setPriceWithoutVat(reverse.precioSinIva);
      setCostPrice(reverse.precioCosto);
    } else {
      const forward = computePricingForward({
        precioCosto: costPrice,
        porcentajeGanancia: profitPercent,
        porcentajeIva: newVat,
      });
      setPriceWithoutVat(forward.precioSinIva);
      setFinalPrice(forward.precioFinal);
    }
  };

  const handleFinalPriceChange = (newFinalPrice: number) => {
    setFinalPrice(newFinalPrice);
    clearFieldError("finalPrice");
    setCalcMode("reverse");
    const reverse = computePricingReverse({
      precioFinal: newFinalPrice,
      porcentajeGanancia: profitPercent,
      porcentajeIva: vatPercent,
    });
    setPriceWithoutVat(reverse.precioSinIva);
    setCostPrice(reverse.precioCosto);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProduct) return;

    // Validación de datos
    const errors: FieldErrors = {};
    if (isNaN(costPrice) || costPrice < 0) {
      errors.costPrice = "El precio de costo no puede ser menor a 0.";
    }
    if (isNaN(profitPercent) || profitPercent < -100) {
      errors.profitPercent = "El margen de ganancia no puede ser menor a -100%.";
    }
    if (isNaN(vatPercent) || vatPercent < 0) {
      errors.vatPercent = "La alícuota de IVA no puede ser menor a 0%.";
    }
    if (isNaN(finalPrice) || finalPrice <= 0) {
      errors.finalPrice = "El precio final de venta debe ser mayor a 0.";
    }
    const parsedAddedStock = addedStock.trim() !== "" ? parseFloat(addedStock) : 0;
    if (isNaN(parsedAddedStock) || parsedAddedStock < 0) {
      errors.addedStock = "El stock a agregar no puede ser menor a 0.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFlashStatus("error");
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => {
        setFlashStatus(null);
      }, 1500);
      return;
    }

    setIsSaving(true);
    setFieldErrors({});

    try {
      await onSavePrice(selectedProduct.entity.id, {
        costPrice: roundMoney(costPrice),
        profitPercent: roundPercent(profitPercent),
        vatPercent: roundPercent(vatPercent),
        priceWithoutVat: roundMoney(priceWithoutVat),
        finalPrice: roundMoney(finalPrice),
        addedStock: parsedAddedStock > 0 ? parsedAddedStock : undefined,
      });

      setSelectedProduct((prev) =>
        prev
          ? {
              ...prev,
              precioCosto: roundMoney(costPrice),
              porcentajeGanancia: roundPercent(profitPercent),
              porcentajeIva: roundPercent(vatPercent),
              precioSinIva: roundMoney(priceWithoutVat),
              precioFinal: roundMoney(finalPrice),
              stock: roundMoney((prev.stock ?? 0) + (parsedAddedStock > 0 ? parsedAddedStock : 0)),
            }
          : null
      );
      setAddedStock("");

      // Destello verde de confirmación
      setFlashStatus("success");
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => {
        setFlashStatus(null);
      }, 1500);

      const isMobile =
        typeof window !== "undefined" &&
        (window.innerWidth < 768 || window.matchMedia("(max-width: 768px)").matches);

      const scrollToTop = () => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
        productInfoCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      };

      // Desplazar hacia arriba para mostrar la descripción y el nuevo precio
      scrollToTop();
      setTimeout(scrollToTop, 80);

      if (!isMobile) {
        setTimeout(() => {
          searchInputRef.current?.focus({ preventScroll: true });
          searchInputRef.current?.select();
        }, 200);
      } else {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        // Segundo re-ajuste tras el colapso del teclado virtual móvil
        setTimeout(scrollToTop, 280);
      }
    } catch (err) {
      setFlashStatus("error");
      setFieldErrors({
        general:
          err instanceof Error
            ? err.message
            : "Error al guardar el nuevo precio del producto",
      });
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => {
        setFlashStatus(null);
      }, 1500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetForNextProduct = () => {
    if (selectedProduct && isPriceDirty) {
      setPendingProduct(null);
      setPendingCreateQuery(null);
      setShowUnsavedPrompt(true);
      return;
    }

    setSelectedProduct(null);
    setSearchQuery("");
    setAddedStock("");
    setFieldErrors({});
    setFlashStatus(null);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  if (!open) return null;

  return (
    <section
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4 backdrop-blur-xs animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 md:p-6 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Encabezado */}
        <div className="mb-4 flex items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Ícono de etiqueta (con shrink-0 para que nunca se deforme ni corte en pantallas móviles) */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shadow-xs">
              <Tag className="h-5 w-5 shrink-0" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  Consulta Rápida
                </h3>
                {/* Badge En vivo: en una sola línea (whitespace-nowrap) y con punto indicador animado */}
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/40 dark:border-emerald-700/60 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  En vivo
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                Escaneá con lector de barra o buscá para actualizar precios al instante.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onCreateNewProduct && (
              <button
                type="button"
                onClick={() => attemptCreateNew()}
                className="ui-btn-ghost text-xs inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 py-1.5 px-2.5 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl"
                title="Crear un nuevo producto en el catálogo"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Nuevo producto</span>
              </button>
            )}
            <ModalCloseButton label="Cerrar consulta rápida" onClick={onClose} />
          </div>
        </div>

        {/* Barra de Búsqueda y Escáner */}
        <div className="mb-4 relative flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                onKeyDown={handleSearchKeyDown}
                placeholder="Escaneá con lector de barra o buscá por nombre / código (Enter)..."
                className="ui-input w-full pl-10 pr-10 text-sm font-medium py-2.5 shadow-sm"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  title="Limpiar búsqueda"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>

            {/* Botón de cámara destacado con icono nítido y fácil de pulsar en móvil */}
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              title="Abrir lector de cámara"
              aria-label="Escanear con cámara"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500/60 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 shadow-xs"
            >
              <Camera className="h-6 w-6 text-slate-600 transition-colors dark:text-slate-200" />
            </button>
          </div>
        </div>

        {/* Contenido Principal */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pr-1">
          {selectedProduct && searchQuery.trim().length === 0 ? (
            <div className="space-y-4">
              {/* Tarjeta de Información del Producto Seleccionado (Panel de Vista Previa) */}
              <div
                ref={productInfoCardRef}
                className={`rounded-2xl border p-4 transition-all duration-300 ${
                  flashStatus === "success"
                    ? "border-emerald-500 ring-4 ring-emerald-500/30 bg-emerald-50/80 dark:border-emerald-400 dark:bg-emerald-950/40 shadow-lg shadow-emerald-500/20"
                    : flashStatus === "error"
                    ? "border-red-500 ring-4 ring-red-500/30 bg-red-50/60 dark:border-red-400 dark:bg-red-950/40 shadow-lg shadow-red-500/20"
                    : "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/40"
                }`}
              >
                {/* Etiquetas superiores y botón de edición */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="rounded bg-slate-200/80 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {selectedProduct.categoria || "Sin categoría"}
                    </span>
                    {selectedProduct.codigoProducto && (
                      <span className="font-mono text-xs text-slate-500 bg-white/80 dark:bg-slate-850 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                        Cód: {selectedProduct.codigoProducto}
                      </span>
                    )}
                    {selectedProduct.codigoBarras && (
                      <span className="font-mono text-xs text-slate-600 bg-white dark:bg-slate-850 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {selectedProduct.codigoBarras}
                      </span>
                    )}
                  </div>

                  {onEditProduct && (
                    <button
                      type="button"
                      onClick={handleOpenEditProduct}
                      disabled={!canWrite}
                      title="Editar ficha completa (nombre, categoría, códigos, etc.)"
                      aria-label="Editar ficha completa del producto"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-brand-500 hover:bg-slate-100 hover:text-brand-600 active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-400 dark:hover:bg-slate-700 dark:hover:text-brand-300"
                    >
                      <Pencil className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                      <span className="text-[11px]">Editar ficha</span>
                    </button>
                  )}
                </div>

                {/* Título completo del producto: sin corte, con ancho total y salto de línea */}
                <h4 className="mt-2 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 break-words leading-snug">
                  {selectedProduct.nombre}
                </h4>

                {/* Stock y Precio actual integrados directamente sin cartel superpuesto */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/60">
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span>Stock actual:</span>
                    <span
                      className={
                        selectedProduct.stock <= 0
                          ? "font-bold text-amber-600 dark:text-amber-400"
                          : "font-semibold text-slate-700 dark:text-slate-200"
                      }
                    >
                      {selectedProduct.stock} {selectedProduct.saleMode === "weight" ? "kg" : "unid."}
                    </span>
                  </p>

                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Precio actual:
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {currencyFormatter.format(selectedProduct.precioFinal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Editor de Precios Rápido */}
              <form onSubmit={handleSave} className="space-y-4">
                <div
                  className={`rounded-xl border p-4 shadow-sm space-y-4 transition-all duration-300 ${
                    flashStatus === "error"
                      ? "border-red-300 ring-2 ring-red-500/10 bg-red-50/10 dark:border-red-800 dark:bg-red-950/10"
                      : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <DollarSign size={14} className="text-emerald-600" />
                      Configuración de Precios
                      {isPriceDirty && (
                        <span className="ml-1 text-[11px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          Cambios sin guardar
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      Modificá costo, ganancia o precio final para recalcular
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {/* Precio de Costo */}
                    <div>
                      <label
                        className={`mb-1 block text-xs font-semibold transition-colors ${
                          fieldErrors.costPrice
                            ? "text-red-600 dark:text-red-400 font-bold"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        Precio de Costo ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={costPrice}
                        onChange={(e) => handleCostChange(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => handleNumericInputFocus(e, { isNew: false })}
                        disabled={!canWrite || isSaving}
                        className={`ui-input w-full text-sm font-medium transition-colors ${
                          fieldErrors.costPrice
                            ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/40 text-red-700 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200"
                            : ""
                        }`}
                      />
                      {fieldErrors.costPrice && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium animate-in fade-in">
                          <AlertCircle size={13} className="flex-shrink-0" />
                          {fieldErrors.costPrice}
                        </p>
                      )}
                    </div>

                    {/* Margen de Ganancia */}
                    <div>
                      <label
                        className={`mb-1 block text-xs font-semibold transition-colors ${
                          fieldErrors.profitPercent
                            ? "text-red-600 dark:text-red-400 font-bold"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        Margen de Ganancia (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={profitPercent}
                        onChange={(e) => handleProfitChange(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => handleNumericInputFocus(e, { isNew: false })}
                        disabled={!canWrite || isSaving}
                        className={`ui-input w-full text-sm font-medium transition-colors ${
                          fieldErrors.profitPercent
                            ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/40 text-red-700 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200"
                            : ""
                        }`}
                      />
                      {fieldErrors.profitPercent && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium animate-in fade-in">
                          <AlertCircle size={13} className="flex-shrink-0" />
                          {fieldErrors.profitPercent}
                        </p>
                      )}
                    </div>

                    {/* IVA */}
                    <div>
                      <label
                        className={`mb-1 block text-xs font-semibold transition-colors ${
                          fieldErrors.vatPercent
                            ? "text-red-600 dark:text-red-400 font-bold"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        Alícuota IVA (%)
                      </label>
                      <input
                        list="quick-iva-options"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="21"
                        value={vatPercent}
                        onChange={(e) => handleVatChange(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => handleNumericInputFocus(e, { isNew: false })}
                        disabled={!canWrite || isSaving}
                        className={`ui-input w-full text-sm font-medium transition-colors ${
                          fieldErrors.vatPercent
                            ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/40 text-red-700 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200"
                            : ""
                        }`}
                      />
                      <datalist id="quick-iva-options">
                        <option value="0" label="0% (Exento)" />
                        <option value="10.5" label="10.5% (Reducido)" />
                        <option value="21" label="21% (General)" />
                        <option value="27" label="27% (Diferencial)" />
                      </datalist>
                      {fieldErrors.vatPercent && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium animate-in fade-in">
                          <AlertCircle size={13} className="flex-shrink-0" />
                          {fieldErrors.vatPercent}
                        </p>
                      )}
                    </div>

                    {/* Precio Sin IVA */}
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Precio Sin IVA ($)
                        </label>
                        <span className="text-[10px] font-semibold text-slate-400">
                          Calculado
                        </span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={priceWithoutVat}
                        readOnly
                        className="ui-input w-full text-sm font-medium bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 cursor-not-allowed"
                      />
                    </div>

                    {/* Precio Final (Destacado) */}
                    <div>
                      <label
                        className={`mb-1 block text-xs font-bold flex items-center justify-between transition-colors ${
                          fieldErrors.finalPrice
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        <span>Precio Final ($)</span>
                        <span
                          className={`text-[11px] font-normal ${
                            fieldErrors.finalPrice ? "text-red-500" : "text-emerald-600"
                          }`}
                        >
                          (IVA inc.)
                        </span>
                      </label>
                      <input
                        ref={finalPriceInputRef}
                        type="number"
                        step="0.01"
                        min="0"
                        value={finalPrice}
                        onChange={(e) => handleFinalPriceChange(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => handleNumericInputFocus(e, { isNew: false })}
                        disabled={!canWrite || isSaving}
                        className={`ui-input w-full text-base sm:text-lg font-bold transition-colors ${
                          fieldErrors.finalPrice
                            ? "border-red-500 ring-2 ring-red-500/30 bg-red-50/40 text-red-700 focus:border-red-500 focus:ring-red-500/40 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200"
                            : "text-emerald-600 border-emerald-300 focus:border-emerald-600 focus:ring-emerald-500/20 dark:text-emerald-400 dark:border-emerald-800"
                        }`}
                      />
                      {fieldErrors.finalPrice && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium animate-in fade-in">
                          <AlertCircle size={13} className="flex-shrink-0" />
                          {fieldErrors.finalPrice}
                        </p>
                      )}
                    </div>

                    {/* Agregar Stock (+) */}
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label
                          className={`text-xs font-semibold transition-colors ${
                            fieldErrors.addedStock
                              ? "text-red-600 dark:text-red-400 font-bold"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          Agregar Stock (+)
                        </label>
                        {addedStock && Number(addedStock) > 0 ? (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                            Total: {roundMoney((selectedProduct.stock ?? 0) + Number(addedStock))}
                          </span>
                        ) : null}
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        value={addedStock}
                        onChange={(e) => {
                          setAddedStock(e.target.value);
                          clearFieldError("addedStock");
                        }}
                        onFocus={(e) => handleNumericInputFocus(e, { isNew: false })}
                        disabled={!canWrite || isSaving}
                        className={`ui-input w-full text-sm font-medium transition-colors ${
                          fieldErrors.addedStock
                            ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/40 text-red-700 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200"
                            : ""
                        }`}
                      />
                      {fieldErrors.addedStock && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center gap-1 font-medium animate-in fade-in">
                          <AlertCircle size={13} className="flex-shrink-0" />
                          {fieldErrors.addedStock}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Error general si existiera */}
                {fieldErrors.general && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 animate-in fade-in">
                    <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                    <span className="font-semibold">{fieldErrors.general}</span>
                  </div>
                )}

                {/* Botones de acción */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleResetForNextProduct}
                    className="ui-btn-ghost text-xs inline-flex items-center gap-1.5"
                    disabled={isSaving}
                  >
                    <RotateCcw size={14} />
                    Consultar otro producto
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={!canWrite || isSaving}
                      className={`font-semibold text-sm inline-flex items-center gap-2 shadow-sm transition-all duration-200 ${
                        flashStatus === "success"
                          ? "ui-btn-primary bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 ring-offset-1"
                          : flashStatus === "error"
                          ? "ui-btn-primary bg-red-600 hover:bg-red-700 text-white"
                          : "ui-btn-primary bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                    >
                      {isSaving ? (
                        "Guardando..."
                      ) : flashStatus === "success" ? (
                        <>
                          <CheckCircle2 size={16} />
                          ¡Guardado con éxito!
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          {addedStock && Number(addedStock) > 0
                            ? "Guardar precio y stock"
                            : "Guardar nuevo precio"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : searchQuery.trim().length > 0 ? (
            searchResults.length > 0 ? (
              <div className="space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">
                    Coincidencias encontradas ({searchResults.length})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Hacé clic en un producto o presioná Enter para seleccionarlo
                  </span>
                </div>
                <div className="grid gap-2">
                  {searchResults.map((product) => (
                    <button
                      key={product.entity.id}
                      type="button"
                      onClick={() => attemptSelectProduct(product)}
                      className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-left hover:border-emerald-500 hover:bg-emerald-50/30 dark:border-slate-800 dark:bg-slate-850 dark:hover:border-emerald-600/60 dark:hover:bg-emerald-950/20 transition-all shadow-xs group"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {product.nombre}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                          <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-medium">
                            {product.categoria || "Sin categoría"}
                          </span>
                          {product.codigoProducto && (
                            <span className="font-mono">Cód: {product.codigoProducto}</span>
                          )}
                          {product.codigoBarras && (
                            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              {product.codigoBarras}
                            </span>
                          )}
                          <span>
                            Stock: <strong>{product.stock}</strong> {product.saleMode === "weight" ? "kg" : "unid."}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                          {currencyFormatter.format(product.precioFinal)}
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium">Precio final</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-10 px-4 text-center rounded-xl border border-dashed border-amber-300 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/20 animate-in fade-in duration-150">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 mx-auto mb-3">
                  <AlertTriangle size={24} />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  No se encontró ningún producto
                </h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  No hay coincidencias en el catálogo para el código o nombre:
                </p>
                <p className="mt-1.5 font-mono text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 inline-block px-3 py-1 rounded-lg">
                  "{searchQuery}"
                </p>
                {onCreateNewProduct && (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => attemptCreateNew(searchQuery)}
                      className="ui-btn-primary inline-flex items-center gap-2 text-sm py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md transition-transform active:scale-95"
                    >
                      <Plus size={18} />
                      Crear producto nuevo con este código
                    </button>
                  </div>
                )}
              </div>
            )
          ) : notFoundCode ? (
            <div className="py-10 px-4 text-center rounded-xl border border-dashed border-amber-300 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-950/20 animate-in fade-in duration-150">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 mx-auto mb-3">
                <AlertTriangle size={24} />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                No se encontró ningún producto
              </h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                No hay coincidencias en el catálogo para el código o nombre:
              </p>
              <p className="mt-1.5 font-mono text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 inline-block px-3 py-1 rounded-lg">
                "{notFoundCode}"
              </p>
              {onCreateNewProduct && (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => attemptCreateNew(notFoundCode)}
                    className="ui-btn-primary inline-flex items-center gap-2 text-sm py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-md transition-transform active:scale-95"
                  >
                    <Plus size={18} />
                    Crear producto nuevo con este código
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Estado vacío: esperando búsqueda o escaneo */
            <div className="py-12 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100/60 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 mb-3">
                <Package size={24} />
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Esperando producto para consultar
              </h4>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                Escaneá con la pistola de código de barras o buscá arriba para consultar el precio actual y modificarlo al instante.
              </p>
              {onCreateNewProduct && (
                <button
                  type="button"
                  onClick={() => attemptCreateNew()}
                  className="mt-4 ui-btn-secondary inline-flex items-center gap-1.5 text-xs py-1.5 px-3 font-semibold"
                >
                  <Plus size={14} />
                  Crear un producto nuevo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 flex-shrink-0">
          <span>Escaneá otro código para avanzar automáticamente de producto.</span>
          <button type="button" onClick={onClose} className="ui-btn-secondary text-xs py-1.5 px-3">
            Cerrar
          </button>
        </div>

        {/* Modal de Confirmación: Cambios de precio sin guardar */}
        {showUnsavedPrompt && (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-850 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={22} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    ¿Guardar cambios de precio?
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Modificaste el precio de{" "}
                    <strong className="text-slate-900 dark:text-slate-100">
                      {selectedProduct?.nombre}
                    </strong>{" "}
                    a{" "}
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {currencyFormatter.format(finalPrice)}
                    </strong>
                    . ¿Deseas guardar los cambios antes de pasar al siguiente producto?
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveAndProceed}
                  className="ui-btn-primary w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 inline-flex items-center justify-center gap-2 shadow-sm"
                >
                  <Save size={16} />
                  {isSaving ? "Guardando..." : "Guardar y avanzar"}
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleDiscardAndProceed}
                  className="ui-btn-ghost w-full text-xs text-amber-700 hover:text-amber-800 dark:text-amber-400 py-2 inline-flex items-center justify-center"
                >
                  Descartar cambios y avanzar
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleCancelSwitch}
                  className="ui-btn-secondary w-full text-xs py-1.5"
                >
                  Seguir editando este producto
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal secundario de escáner de cámara */}
      <BarcodeScannerModal
        open={scannerOpen}
        title="Escanear código de producto"
        description="Apuntá la cámara al código de barras para consultarlo de inmediato."
        onClose={() => setScannerOpen(false)}
        onDetected={(scannedBarcode) => {
          setScannerOpen(false);
          handleScannedBarcode(scannedBarcode);
        }}
      />
    </section>
  );
};
