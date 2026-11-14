import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Download,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  FilterX,
} from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import type { Product } from "@/types/entities";
import { downloadXlsx } from "@/utils/xlsx";
import {
  matchesProductSearch,
  PRODUCT_SEARCH_SCOPE_OPTIONS,
  getSearchPlaceholder,
  type ProductSearchScope,
} from "@/utils/search";
import { BarcodeScannerModal } from "@/components/form/BarcodeScannerModal";
import { useProductsStore } from "@/features/products/store/products.store";
import {
  getStockStatusFromValues,
  stockStatusLabel,
  type StockStatus,
  type StockStatusFilter,
} from "@/modules/stock/utils/stock-labels";
import { cn } from "@/utils/cn";

type BulkScope = "selected" | "category";

interface StockTrackingTableProps {
  products: Product[];
  categories: string[];
  disabled?: boolean;
  statusFilter?: StockStatusFilter;
  onStatusFilterChange?: (filter: StockStatusFilter) => void;
  globalLowThreshold?: number;
  onUpdateOne: (productId: string, values: { stockMin: number | null; stockMax: number | null }) => Promise<void>;
  onUpdateBulk: (productIds: string[], values: { stockMin?: number | null; stockMax?: number | null }) => Promise<void>;
  summary?: {
    activeProducts: number;
    lowStock: number;
    overMax: number;
    unassigned: number;
  };
}

interface StockDraft {
  stockMin: string;
  stockMax: string;
}

const toNullableNumber = (value: string): number | null => {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const normalizeQty = (value: number): string => {
  return Number(value.toFixed(3)).toString();
};

const unitLabel = (product: Product): string => (product.sale_mode === "weight" ? "g" : "u.");

const buildReportDateStamp = (): string => new Date().toISOString().slice(0, 10);

const getProductInitials = (name: string): string => {
  if (!name) return "PR";
  const trimmed = name.trim();
  const firstWord = trimmed.split(/\s+/)[0];
  if (firstWord && firstWord.length <= 4) {
    return firstWord.toUpperCase();
  }
  const words = trimmed.split(/\s+/).slice(0, 3);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 3).toUpperCase();
};

const resolveThresholds = (product: Product, draft: StockDraft | undefined) => {
  if (!draft) {
    return {
      stockMin: product.stock_min,
      stockMax: product.stock_max,
    };
  }

  const isWeight = product.sale_mode === "weight";
  const rawMin = toNullableNumber(draft.stockMin);
  const rawMax = toNullableNumber(draft.stockMax);

  return {
    stockMin: isWeight && rawMin != null ? rawMin / 1000 : rawMin,
    stockMax: isWeight && rawMax != null ? rawMax / 1000 : rawMax,
  };
};

const sameNullableNumber = (left: number | null, right: number | null): boolean => {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return Number(left.toFixed(3)) === Number(right.toFixed(3));
};

export const StockTrackingTable = ({
  products,
  categories,
  disabled,
  statusFilter: controlledStatusFilter,
  onStatusFilterChange,
  onUpdateOne,
  onUpdateBulk,
  summary: _summary,
}: StockTrackingTableProps) => {
  const allBarcodes = useProductsStore((state) => state.allBarcodes);
  const [search, setSearch] = useState("");
  const [searchScope, setSearchScope] = useState<ProductSearchScope>("all");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  useBodyScrollLock(isAdvancedFiltersOpen);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [internalStatusFilter, setInternalStatusFilter] = useState<StockStatusFilter>("all");
  const statusFilter = controlledStatusFilter ?? internalStatusFilter;

  const activeAdvancedFiltersCount =
    (categoryFilter ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (searchScope !== "all" ? 1 : 0);

  const handleStatusFilterChange = (filter: StockStatusFilter) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(filter);
    } else {
      setInternalStatusFilter(filter);
    }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, StockDraft>>({});
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<BulkScope>("selected");
  const [bulkStockMin, setBulkStockMin] = useState("");
  const [bulkStockMax, setBulkStockMax] = useState("");
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [isReportMenuOpen, setIsReportMenuOpen] = useState(false);
  const reportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (reportMenuRef.current && !reportMenuRef.current.contains(event.target as Node)) {
        setIsReportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const barcodesByProductId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of allBarcodes) {
      const list = map.get(item.product_id) ?? [];
      list.push(item.barcode.trim().toLowerCase());
      map.set(item.product_id, list);
    }
    return map;
  }, [allBarcodes]);

  const reportCandidates = useMemo(() => {
    return products.filter((product) => {
      if (!product.is_active) return false;
      if (categoryFilter && product.category !== categoryFilter) return false;
      return true;
    });
  }, [products, categoryFilter]);

  const rows = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      if (!product.is_active) return false;

      if (cleanSearch) {
        const barcodes = barcodesByProductId.get(product.id);
        const matches = matchesProductSearch(
          {
            name: product.name,
            code: product.code,
            category: product.category,
            subcategory: product.subcategory,
            barcodes,
          },
          cleanSearch,
          searchScope
        );

        if (!matches) {
          return false;
        }
      }

      if (categoryFilter && product.category !== categoryFilter) {
        return false;
      }

      const draft = drafts[product.id];
      const { stockMin, stockMax } = resolveThresholds(product, draft);
      const status = getStockStatusFromValues(product.stock_current, stockMin, stockMax);

      if (statusFilter === "low" && status !== "low") {
        return false;
      }

      if (statusFilter === "over" && status !== "over") {
        return false;
      }

      if (statusFilter === "unassigned" && status !== "unassigned") {
        return false;
      }

      if (statusFilter === "normal" && status !== "normal") {
        return false;
      }

      return true;
    });
  }, [products, search, searchScope, categoryFilter, drafts, statusFilter, barcodesByProductId]);

  const handleBarcodeDetected = (code: string) => {
    setSearch(code);
    setIsCameraOpen(false);
  };

  const paginatedRows = usePagination(rows, 12, `${search}-${categoryFilter}-${statusFilter}`);
  const visibleIds = useMemo(() => paginatedRows.pageItems.map((item) => item.id), [paginatedRows.pageItems]);
  const selectedVisibleIds = useMemo(
    () => selectedIds.filter((id) => visibleIds.includes(id)),
    [selectedIds, visibleIds]
  );
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
      return;
    }

    setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, id]));
      }

      return current.filter((currentId) => currentId !== id);
    });
  };

  const getDraft = (product: Product): StockDraft => {
    const existing = drafts[product.id];
    if (existing) return existing;

    const isWeight = product.sale_mode === "weight";
    return {
      stockMin:
        product.stock_min == null
          ? ""
          : normalizeQty(isWeight ? product.stock_min * 1000 : product.stock_min),
      stockMax:
        product.stock_max == null
          ? ""
          : normalizeQty(isWeight ? product.stock_max * 1000 : product.stock_max),
    };
  };

  const updateDraft = (product: Product, patch: Partial<StockDraft>) => {
    const current = getDraft(product);
    setDrafts((prev) => ({
      ...prev,
      [product.id]: {
        ...current,
        ...patch,
      },
    }));
  };

  const persistRowIfChanged = async (product: Product) => {
    const draft = drafts[product.id];
    if (!draft) return;

    const { stockMin, stockMax } = resolveThresholds(product, draft);
    const minChanged = !sameNullableNumber(stockMin, product.stock_min);
    const maxChanged = !sameNullableNumber(stockMax, product.stock_max);

    if (!minChanged && !maxChanged) return;

    await onUpdateOne(product.id, {
      stockMin,
      stockMax,
    });
  };

  const handleApplyBulk = async () => {
    const parsedMin = bulkStockMin.trim() ? toNullableNumber(bulkStockMin) : undefined;
    const parsedMax = bulkStockMax.trim() ? toNullableNumber(bulkStockMax) : undefined;

    if (parsedMin === undefined && parsedMax === undefined) return;

    const targetIds =
      bulkScope === "selected"
        ? selectedVisibleIds
        : rows.filter((row) => (categoryFilter ? row.category === categoryFilter : true)).map((row) => row.id);

    const targetProducts = products.filter((p) => targetIds.includes(p.id));
    const unitTargetIds = targetProducts.filter((p) => p.sale_mode !== "weight").map((p) => p.id);
    const weightTargetIds = targetProducts.filter((p) => p.sale_mode === "weight").map((p) => p.id);

    if (unitTargetIds.length > 0) {
      await onUpdateBulk(unitTargetIds, {
        stockMin: parsedMin,
        stockMax: parsedMax,
      });
    }

    if (weightTargetIds.length > 0) {
      await onUpdateBulk(weightTargetIds, {
        stockMin: parsedMin !== undefined ? (parsedMin != null ? Number((parsedMin / 1000).toFixed(4)) : null) : undefined,
        stockMax: parsedMax !== undefined ? (parsedMax != null ? Number((parsedMax / 1000).toFixed(4)) : null) : undefined,
      });
    }

    setDrafts((current) => {
      const next = { ...current };
      targetIds.forEach((id) => {
        const baseDraft = next[id] ?? { stockMin: "", stockMax: "" };
        next[id] = {
          ...baseDraft,
          ...(parsedMin !== undefined ? { stockMin: parsedMin == null ? "" : normalizeQty(parsedMin) } : {}),
          ...(parsedMax !== undefined ? { stockMax: parsedMax == null ? "" : normalizeQty(parsedMax) } : {}),
        };
      });
      return next;
    });
  };

  const handleDownloadStatusReport = async (targetStatus?: StockStatus) => {
    const reportRows = reportCandidates
      .map((product) => {
        const { stockMin, stockMax } = resolveThresholds(product, drafts[product.id]);
        const status = getStockStatusFromValues(product.stock_current, stockMin, stockMax);
        const isWeight = product.sale_mode === "weight";
        const factor = isWeight ? 1000 : 1;

        return {
          producto: product.name,
          codigo: product.code,
          categoria: product.category,
          subcategoria: product.subcategory ?? "",
          stock_actual: Number((product.stock_current * factor).toFixed(1)),
          unidad: isWeight ? "g" : "u.",
          stock_min: stockMin != null ? Number((stockMin * factor).toFixed(1)) : "",
          stock_max: stockMax != null ? Number((stockMax * factor).toFixed(1)) : "",
          estado: status,
        };
      })
      .filter((row) => (targetStatus ? row.estado === targetStatus : true))
      .map((row) => ({
        ...row,
        estado: stockStatusLabel[row.estado],
      }));

    if (!reportRows.length) {
      setReportMessage(
        targetStatus
          ? `No hay productos en estado "${stockStatusLabel[targetStatus]}" para exportar`
          : "No hay productos para exportar"
      );
      return;
    }

    const fileName = targetStatus ? `informe-stock-${targetStatus}` : "informe-stock-general";
    const ok = await downloadXlsx(
      `${fileName}-${buildReportDateStamp()}.xlsx`,
      "Control de Stock",
      reportRows
    );

    setReportMessage(ok ? "Informe descargado correctamente" : "No hay datos para exportar");
  };

  const renderStatusBadge = (status: StockStatus) => {
    switch (status) {
      case "low":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Stock bajo</span>
          </span>
        );
      case "over":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span>Sobrestock</span>
          </span>
        );
      case "unassigned":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
            <span>Sin asignar</span>
          </span>
        );
      case "normal":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Nivel óptimo</span>
          </span>
        );
    }
  };

  return (
    <section className="space-y-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3.5 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 min-w-0 max-w-full overflow-hidden">
      {/* Encabezado de la Sección con Contador y Exportar */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Productos en Stock
          </h2>
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60">
            {rows.length.toLocaleString("es-AR")} registros
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full border border-slate-200/90 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-300">
            Seleccionados: <strong>{selectedVisibleIds.length}</strong>
          </span>

          <div className="relative" ref={reportMenuRef}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              onClick={() => setIsReportMenuOpen((current) => !current)}
              disabled={!reportCandidates.length}
            >
              <Download size={14} className="text-slate-500 dark:text-slate-400" />
              <span>Exportar</span>
            </button>

            {isReportMenuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[220px] rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  className="block w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50 transition-colors"
                  onClick={() => {
                    setIsReportMenuOpen(false);
                    void handleDownloadStatusReport();
                  }}
                >
                  Exportar listado completo (XLSX)
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                {(["low", "normal", "over", "unassigned"] as StockStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="block w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => {
                      setIsReportMenuOpen(false);
                      void handleDownloadStatusReport(status);
                    }}
                  >
                    Solo: {stockStatusLabel[status]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {reportMessage ? (
        <div className="rounded-2xl ui-info-state text-xs">{reportMessage}</div>
      ) : null}

      {/* Franja Unificada de Búsqueda y Filtros */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 min-w-0">
          {/* Input de Búsqueda Redondeado con Cámara integrada */}
          <div className="flex flex-1 min-w-0 items-center gap-2.5 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700/80 dark:bg-slate-800/40 dark:focus-within:bg-slate-900 transition-all">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="flex-1 min-w-0 border-0 bg-transparent px-1 py-0.5 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder={getSearchPlaceholder(searchScope)}
              aria-label="Buscar en stock"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full shrink-0 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              disabled={disabled}
              className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 shrink-0 transition-colors rounded-lg cursor-pointer"
              title="Escanear código de barras con la cámara"
              aria-label="Escanear con cámara"
            >
              <Camera size={18} />
            </button>
          </div>

          {/* En escritorio ancho (lg:), selectores rápidos inline */}
          <div className="hidden lg:inline-flex items-center gap-2 shrink-0">
            {/* Selector Estado Redondeado */}
            <div className="relative inline-flex items-center shrink-0">
              <select
                value={statusFilter}
                onChange={(event) => handleStatusFilterChange(event.target.value as StockStatusFilter)}
                className="appearance-none cursor-pointer rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 pl-3.5 pr-8 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="all">Todos los estados</option>
                {Object.entries(stockStatusLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 text-slate-400 dark:text-slate-500" />
            </div>

            {/* Selector Categoría Redondeado */}
            <div className="relative inline-flex items-center shrink-0">
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="appearance-none cursor-pointer rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 pl-3.5 pr-8 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 text-slate-400 dark:text-slate-500" />
            </div>
          </div>

          {/* Botón Filtros Avanzados (ancho completo en móvil debajo del buscador, inline en desktop) */}
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setIsAdvancedFiltersOpen(true)}
              className={cn(
                "w-full sm:w-auto flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-200 shrink-0 transition-all cursor-pointer shadow-2xs",
                activeAdvancedFiltersCount > 0 &&
                  "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
              )}
            >
              <SlidersHorizontal size={15} className="text-blue-600 dark:text-blue-400" />
              <span>Filtros avanzados</span>
              {activeAdvancedFiltersCount > 0 ? (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {activeAdvancedFiltersCount}
                </span>
              ) : null}
            </button>

            {(search || activeAdvancedFiltersCount > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("");
                  handleStatusFilterChange("all");
                  setSearchScope("all");
                }}
                className="inline-flex items-center justify-center h-9 w-9 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 text-slate-500 hover:text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors shrink-0 cursor-pointer"
                title="Limpiar todos los filtros"
                aria-label="Limpiar todos los filtros"
              >
                <FilterX size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Banner Desplegable de Cambios Masivos (Imagen 1 y 2) */}
        <details
          open={isBulkOpen}
          onToggle={(e) => setIsBulkOpen((e.target as HTMLDetailsElement).open)}
          className="rounded-2xl border border-blue-200/90 bg-blue-50/50 dark:border-blue-900/60 dark:bg-blue-950/30 overflow-hidden transition-all"
        >
          <summary className="flex items-center justify-between cursor-pointer px-4 py-2.5 text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-200 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition-colors select-none">
            <div className="flex items-center gap-2">
              <RefreshCw size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="hidden sm:inline">Cambios masivos de mínimo / máximo y actualización por lote</span>
              <span className="sm:hidden inline">Cambios masivos de mínimo / máximo</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs font-normal text-blue-700/80 dark:text-blue-300/80">
                Aplica valores simultáneos a filas seleccionadas
              </span>
              <ChevronRight
                size={15}
                className={cn("transition-transform duration-200 text-blue-600 dark:text-blue-400", isBulkOpen && "rotate-90")}
              />
            </div>
          </summary>

          <div className="grid gap-2.5 border-t border-blue-200/70 p-3.5 dark:border-blue-900/60 md:grid-cols-6 bg-white/70 dark:bg-slate-900/70">
            <select
              value={bulkScope}
              onChange={(event) => setBulkScope(event.target.value as BulkScope)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              disabled={disabled}
            >
              <option value="selected">Aplicar a seleccionados ({selectedVisibleIds.length})</option>
              <option value="category">Aplicar a categoría filtrada</option>
            </select>
            <input
              type="number"
              step="0.001"
              value={bulkStockMin}
              onChange={(event) => setBulkStockMin(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              placeholder="Nuevo mínimo"
              disabled={disabled}
            />
            <input
              type="number"
              step="0.001"
              value={bulkStockMax}
              onChange={(event) => setBulkStockMax(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              placeholder="Nuevo máximo"
              disabled={disabled}
            />
            <button
              type="button"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all md:col-span-2 cursor-pointer"
              onClick={() => {
                void handleApplyBulk();
              }}
              disabled={disabled || (!bulkStockMin.trim() && !bulkStockMax.trim())}
            >
              Aplicar cambios masivos
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all active:scale-95 cursor-pointer"
              onClick={() => setSelectedIds([])}
              disabled={disabled || !selectedVisibleIds.length}
            >
              Limpiar selección
            </button>
          </div>
        </details>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          No hay productos para los filtros elegidos.
        </div>
      ) : (
        <>
          {/* VISTA ESCRITORIO: TABLA REDONDEADA SEGÚN IMAGEN 1 (SIN COLUMNA DE ACCIONES) */}
          <div className="hidden md:block ui-table-wrap rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="w-12 px-4 py-3.5 text-left">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => toggleSelectAllVisible(event.target.checked)}
                      disabled={disabled}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    PRODUCTO / REFERENCIA
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    CATEGORÍA
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    STOCK ACTUAL
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-28">
                    MÍNIMO
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-28">
                    MÁXIMO
                  </th>
                  <th className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-36">
                    ESTADO
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginatedRows.pageItems.map((product) => {
                  const draft = getDraft(product);
                  const { stockMin, stockMax } = resolveThresholds(product, draft);
                  const status = getStockStatusFromValues(product.stock_current, stockMin, stockMax);
                  const initials = getProductInitials(product.name);
                  const primaryBarcode = barcodesByProductId.get(product.id)?.[0] ?? "";
                  const isSelected = selectedVisibleIds.includes(product.id);
                  const currentStock = product.sale_mode === "weight" ? product.stock_current * 1000 : product.stock_current;

                  return (
                    <tr
                      key={product.id}
                      className={cn(
                        "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors",
                        isSelected && "bg-blue-50/30 dark:bg-blue-950/20"
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => toggleRow(product.id, event.target.checked)}
                          disabled={disabled}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                        />
                      </td>

                      {/* Producto con Avatar/Iniciales y SKU/Código */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-bold text-xs border border-blue-100/80 dark:border-blue-900/40">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight">
                              {product.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {product.code ? `SKU: ${product.code}` : "Sin código"}
                              {primaryBarcode ? ` · Cód. Barra: ${primaryBarcode}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Categoría en Píldora */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {product.category}
                        </span>
                      </td>

                      {/* Stock Actual en Píldora Verde Suave */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs">
                          {currentStock.toLocaleString("es-AR")} {unitLabel(product)}
                        </span>
                      </td>

                      {/* Mínimo Input Redondeado */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          step="0.001"
                          value={draft.stockMin}
                          onChange={(event) => updateDraft(product, { stockMin: event.target.value })}
                          onBlur={() => {
                            void persistRowIfChanged(product);
                          }}
                          className="w-20 mx-auto rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-white focus:bg-white text-center py-1 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-850 dark:text-slate-100 dark:focus:bg-slate-900 transition-all"
                          placeholder="-"
                          disabled={disabled}
                        />
                      </td>

                      {/* Máximo Input Redondeado */}
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          step="0.001"
                          value={draft.stockMax}
                          onChange={(event) => updateDraft(product, { stockMax: event.target.value })}
                          onBlur={() => {
                            void persistRowIfChanged(product);
                          }}
                          className="w-20 mx-auto rounded-xl border border-slate-200/90 bg-slate-50/60 hover:bg-white focus:bg-white text-center py-1 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-850 dark:text-slate-100 dark:focus:bg-slate-900 transition-all"
                          placeholder="-"
                          disabled={disabled}
                        />
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        {renderStatusBadge(status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* VISTA MÓVIL: TARJETAS INDIVIDUALES (SEGÚN IMAGEN 2, SIN HERRAMIENTAS INTERNAS DE LA IMAGEN 3) */}
          <div className="block md:hidden space-y-3">
            {paginatedRows.pageItems.map((product) => {
              const draft = getDraft(product);
              const { stockMin, stockMax } = resolveThresholds(product, draft);
              const status = getStockStatusFromValues(product.stock_current, stockMin, stockMax);
              const initials = getProductInitials(product.name);
              const isSelected = selectedVisibleIds.includes(product.id);
              const currentStock = product.sale_mode === "weight" ? product.stock_current * 1000 : product.stock_current;

              return (
                <div
                  key={product.id}
                  className={cn(
                    "rounded-2xl border bg-white p-3.5 shadow-xs dark:bg-slate-900 space-y-3 transition-all",
                    isSelected
                      ? "border-blue-500 ring-1 ring-blue-500/25 bg-blue-50/15 dark:border-blue-500/80 dark:bg-blue-950/15"
                      : "border-slate-200/90 dark:border-slate-800"
                  )}
                >
                  {/* Fila Superior: Checkbox + Avatar + Nombre/Cat/Código + Stock Actual */}
                  <div className="flex items-start gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => toggleRow(product.id, event.target.checked)}
                      disabled={disabled}
                      className="mt-2.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 shrink-0"
                      aria-label={`Seleccionar ${product.name}`}
                    />

                    {/* Avatar / Iniciales */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-bold text-xs border border-blue-100/80 dark:border-blue-900/40">
                      {initials}
                    </div>

                    {/* Nombre y metadatos */}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate leading-snug">
                        {product.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 truncate max-w-[120px]">
                          {product.category}
                        </span>
                        {product.code ? (
                          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            #{product.code}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Stock Actual Píldora Verde */}
                    <div className="shrink-0">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>{currentStock.toLocaleString("es-AR")} {unitLabel(product)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Fila Media: Panel de Mínimo Sugerido y Máximo Bodega */}
                  <div className="rounded-xl bg-slate-50/80 border border-slate-200/70 dark:bg-slate-800/40 dark:border-slate-700/60 p-2.5 grid grid-cols-2 text-center divide-x divide-slate-200/70 dark:divide-slate-700/60">
                    <div className="px-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                        MÍNIMO SUGERIDO
                      </p>
                      <input
                        type="number"
                        step="0.001"
                        value={draft.stockMin}
                        onChange={(event) => updateDraft(product, { stockMin: event.target.value })}
                        onBlur={() => {
                          void persistRowIfChanged(product);
                        }}
                        placeholder="-"
                        disabled={disabled}
                        className="mt-0.5 w-20 mx-auto text-center font-bold text-xs text-slate-800 dark:text-slate-200 bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="px-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                        MÁXIMO BODEGA
                      </p>
                      <input
                        type="number"
                        step="0.001"
                        value={draft.stockMax}
                        onChange={(event) => updateDraft(product, { stockMax: event.target.value })}
                        onBlur={() => {
                          void persistRowIfChanged(product);
                        }}
                        placeholder="-"
                        disabled={disabled}
                        className="mt-0.5 w-20 mx-auto text-center font-bold text-xs text-slate-800 dark:text-slate-200 bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Fila Inferior: Indicador de alerta/estado (SIN herramientas internas de ajuste) */}
                  <div className="flex items-center justify-between pt-0.5 text-xs">
                    <div>
                      {status === "low" ? (
                        <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                          <AlertTriangle size={13} />
                          <span>Reponer pronto</span>
                        </span>
                      ) : status === "over" ? (
                        <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                          <AlertCircle size={13} />
                          <span>Exceso de stock</span>
                        </span>
                      ) : status === "unassigned" ? (
                        <span className="flex items-center gap-1 font-medium text-slate-400 dark:text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                          <span>Sin umbrales fijados</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={13} />
                          <span>Nivel óptimo</span>
                        </span>
                      )}
                    </div>

                    <div>
                      {renderStatusBadge(status)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Paginador Redondeado */}
      <PaginationControls
        currentPage={paginatedRows.currentPage}
        pageCount={paginatedRows.pageCount}
        startItem={paginatedRows.startItem}
        endItem={paginatedRows.endItem}
        totalItems={paginatedRows.totalItems}
        onPageChange={paginatedRows.setCurrentPage}
      />

      <BarcodeScannerModal
        open={isCameraOpen}
        title="Buscar producto en stock"
        description="Apuntá la cámara al código de barras del producto para filtrarlo."
        onClose={() => setIsCameraOpen(false)}
        onDetected={handleBarcodeDetected}
      />

      {/* Modal de Filtros Avanzados */}
      {isAdvancedFiltersOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsAdvancedFiltersOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                  <SlidersHorizontal size={17} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    Filtros avanzados
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                    Control de stock y criterios de búsqueda
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvancedFiltersOpen(false)}
                className="!rounded-full h-8 w-8 inline-flex items-center justify-center border border-slate-200/90 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-750 transition-all cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Controles del Modal */}
            <div className="space-y-3.5">
              {/* 1. Estado de Stock */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Estado de stock
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusFilterChange(e.target.value as StockStatusFilter)}
                  className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 p-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer"
                >
                  <option value="all">Todos los estados</option>
                  {Object.entries(stockStatusLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Categoría */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Categoría
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 p-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Alcance de búsqueda */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Criterio de búsqueda
                </label>
                <select
                  value={searchScope}
                  onChange={(e) => setSearchScope(e.target.value as ProductSearchScope)}
                  className="w-full rounded-xl border border-slate-200/90 bg-slate-50/70 p-2.5 text-xs sm:text-sm font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 transition-all cursor-pointer"
                >
                  {PRODUCT_SEARCH_SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("");
                  handleStatusFilterChange("all");
                  setSearchScope("all");
                }}
                disabled={activeAdvancedFiltersCount === 0}
                className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-750 transition-all cursor-pointer"
              >
                Limpiar filtros
              </button>
              <button
                type="button"
                onClick={() => setIsAdvancedFiltersOpen(false)}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all cursor-pointer active:scale-95"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
