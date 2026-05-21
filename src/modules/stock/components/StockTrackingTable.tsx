import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/types/entities";
import { downloadXlsx } from "@/utils/xlsx";
import {
  getStockStatusFromValues,
  stockStatusLabel,
  type StockStatus,
  type StockStatusFilter,
} from "@/modules/stock/utils/stock-labels";

type BulkScope = "selected" | "category";

interface StockTrackingTableProps {
  products: Product[];
  categories: string[];
  disabled?: boolean;
  onUpdateOne: (productId: string, values: { stockMin: number | null; stockMax: number | null }) => Promise<void>;
  onUpdateBulk: (productIds: string[], values: { stockMin?: number | null; stockMax?: number | null }) => Promise<void>;
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

const unitLabel = (product: Product): string => (product.sale_mode === "weight" ? "kg" : "u.");

const buildReportDateStamp = (): string => new Date().toISOString().slice(0, 10);

const getStatusBadgeClassName = (status: StockStatus): string => {
  if (status === "low") return "ui-badge ui-badge--warn";
  if (status === "over") return "ui-badge ui-badge--info";
  if (status === "unassigned") return "ui-badge ui-badge--danger";
  return "ui-badge ui-badge--success";
};

const resolveThresholds = (product: Product, draft: StockDraft | undefined) => {
  if (!draft) {
    return {
      stockMin: product.stock_min,
      stockMax: product.stock_max,
    };
  }

  return {
    stockMin: toNullableNumber(draft.stockMin),
    stockMax: toNullableNumber(draft.stockMax),
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
  onUpdateOne,
  onUpdateBulk,
}: StockTrackingTableProps) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, StockDraft>>({});
  const [bulkScope, setBulkScope] = useState<BulkScope>("selected");
  const [bulkStockMin, setBulkStockMin] = useState("");
  const [bulkStockMax, setBulkStockMax] = useState("");
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [isReportMenuOpen, setIsReportMenuOpen] = useState(false);
  const reportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isReportMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!reportMenuRef.current) return;
      if (reportMenuRef.current.contains(event.target as Node)) return;
      setIsReportMenuOpen(false);
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isReportMenuOpen]);

  const rows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      if (!product.is_active) return false;
      if (categoryFilter && product.category !== categoryFilter) return false;

      const { stockMin, stockMax } = resolveThresholds(product, drafts[product.id]);
      const status = getStockStatusFromValues(product.stock_current, stockMin, stockMax);
      if (statusFilter !== "all" && status !== statusFilter) return false;

      if (!normalizedSearch) return true;

      const searchTarget = `${product.name} ${product.code} ${product.category} ${product.subcategory ?? ""}`.toLowerCase();
      return searchTarget.includes(normalizedSearch);
    });
  }, [products, search, categoryFilter, statusFilter, drafts]);

  const reportCandidates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      if (!product.is_active) return false;
      if (categoryFilter && product.category !== categoryFilter) return false;

      if (!normalizedSearch) return true;

      const searchTarget = `${product.name} ${product.code} ${product.category} ${product.subcategory ?? ""}`.toLowerCase();
      return searchTarget.includes(normalizedSearch);
    });
  }, [products, search, categoryFilter]);

  const selectedVisibleIds = useMemo(
    () => selectedIds.filter((id) => rows.some((row) => row.id === id)),
    [rows, selectedIds]
  );

  const allVisibleSelected = rows.length > 0 && selectedVisibleIds.length === rows.length;

  const updateDraft = (product: Product, patch: Partial<StockDraft>) => {
    setDrafts((current) => {
      const currentDraft = current[product.id] ?? {
        stockMin: product.stock_min != null ? normalizeQty(product.stock_min) : "",
        stockMax: product.stock_max != null ? normalizeQty(product.stock_max) : "",
      };

      return {
        ...current,
        [product.id]: { ...currentDraft, ...patch },
      };
    });
  };

  const getDraft = (product: Product): StockDraft => {
    return (
      drafts[product.id] ?? {
        stockMin: product.stock_min != null ? normalizeQty(product.stock_min) : "",
        stockMax: product.stock_max != null ? normalizeQty(product.stock_max) : "",
      }
    );
  };

  const persistRowIfChanged = async (product: Product) => {
    const draft = getDraft(product);
    const nextMin = toNullableNumber(draft.stockMin);
    const nextMax = toNullableNumber(draft.stockMax);

    const currentMin = product.stock_min;
    const currentMax = product.stock_max;

    if (sameNullableNumber(nextMin, currentMin) && sameNullableNumber(nextMax, currentMax)) {
      return;
    }

    await onUpdateOne(product.id, {
      stockMin: nextMin,
      stockMax: nextMax,
    });
  };

  const toggleRow = (productId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        if (current.includes(productId)) return current;
        return [...current, productId];
      }
      return current.filter((id) => id !== productId);
    });
  };

  const toggleSelectAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((current) => current.filter((id) => !rows.some((row) => row.id === id)));
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      rows.forEach((row) => next.add(row.id));
      return [...next];
    });
  };

  const handleApplyBulk = async () => {
    const parsedMin = bulkStockMin.trim() ? toNullableNumber(bulkStockMin) : undefined;
    const parsedMax = bulkStockMax.trim() ? toNullableNumber(bulkStockMax) : undefined;

    const targetIds =
      bulkScope === "selected"
        ? selectedVisibleIds
        : rows.filter((row) => (categoryFilter ? row.category === categoryFilter : true)).map((row) => row.id);

    await onUpdateBulk(targetIds, {
      stockMin: parsedMin,
      stockMax: parsedMax,
    });

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

  const handleDownloadStatusReport = async (targetStatus: StockStatus) => {
    const reportRows = reportCandidates
      .map((product) => {
        const { stockMin, stockMax } = resolveThresholds(product, drafts[product.id]);
        const status = getStockStatusFromValues(product.stock_current, stockMin, stockMax);

        return {
          producto: product.name,
          codigo: product.code,
          categoria: product.category,
          subcategoria: product.subcategory ?? "",
          stock_actual: Number(product.stock_current.toFixed(3)),
          stock_min: stockMin ?? "",
          stock_max: stockMax ?? "",
          estado: status,
        };
      })
      .filter((row) => row.estado === targetStatus)
      .map((row) => ({
        ...row,
        estado: stockStatusLabel[row.estado],
      }));

    if (!reportRows.length) {
      setReportMessage(`No hay productos en estado "${stockStatusLabel[targetStatus]}" para exportar`);
      return;
    }

    const fileNameByStatus: Record<StockStatus, string> = {
      low: "stock-bajo",
      normal: "normal",
      over: "sobrestock",
      unassigned: "sin-asignar",
    };

    const ok = await downloadXlsx(
      `informe-estado-${fileNameByStatus[targetStatus]}-${buildReportDateStamp()}.xlsx`,
      `Estado ${stockStatusLabel[targetStatus]}`,
      reportRows
    );

    setReportMessage(ok ? `Informe "${stockStatusLabel[targetStatus]}" descargado` : "No hay datos para exportar");
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Productos</h2>
          <p className="text-xs text-slate-500">Mostrando {rows.length} de {products.filter((product) => product.is_active).length}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
            Seleccionados: {selectedVisibleIds.length}
          </span>
          <div className="relative" ref={reportMenuRef}>
            <button
              type="button"
              className="ui-btn-ghost px-2 py-1 text-xs"
              onClick={() => setIsReportMenuOpen((current) => !current)}
              disabled={!reportCandidates.length}
            >
              Exportar
            </button>

            {isReportMenuOpen ? (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-[220px] rounded-lg border border-slate-200 bg-white p-1 shadow-panel">
                {(["low", "normal", "over", "unassigned"] as StockStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setIsReportMenuOpen(false);
                      void handleDownloadStatusReport(status);
                    }}
                  >
                    {stockStatusLabel[status]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {reportMessage ? <div className="ui-info-state">{reportMessage}</div> : null}

      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="ui-input"
          placeholder="Buscar por nombre o codigo"
        />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="ui-input">
          <option value="">Todas las categorias</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StockStatusFilter)}
          className="ui-input"
        >
          {Object.entries(stockStatusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700">
          Cambios masivos de minimo/maximo
        </summary>
        <div className="grid gap-2 border-t border-slate-200 p-3 md:grid-cols-6">
          <select
            value={bulkScope}
            onChange={(event) => setBulkScope(event.target.value as BulkScope)}
            className="ui-input"
            disabled={disabled}
          >
            <option value="selected">Aplicar a seleccionados</option>
            <option value="category">Aplicar a categoria filtrada</option>
          </select>
          <input
            type="number"
            step="0.001"
            value={bulkStockMin}
            onChange={(event) => setBulkStockMin(event.target.value)}
            className="ui-input"
            placeholder="Nuevo minimo"
            disabled={disabled}
          />
          <input
            type="number"
            step="0.001"
            value={bulkStockMax}
            onChange={(event) => setBulkStockMax(event.target.value)}
            className="ui-input"
            placeholder="Nuevo maximo"
            disabled={disabled}
          />
          <button
            type="button"
            className="ui-btn-primary h-10 md:col-span-2"
            onClick={() => {
              void handleApplyBulk();
            }}
            disabled={disabled || (!bulkStockMin.trim() && !bulkStockMax.trim())}
          >
            Aplicar cambios masivos
          </button>
          <button
            type="button"
            className="ui-btn-ghost h-10"
            onClick={() => setSelectedIds([])}
            disabled={disabled || !selectedVisibleIds.length}
          >
            Limpiar seleccion
          </button>
        </div>
      </details>

      {rows.length === 0 ? (
        <div className="ui-empty-state">No hay productos para los filtros elegidos.</div>
      ) : (
        <div className="ui-table-wrap max-h-[520px] overflow-auto">
          <table className="min-w-full table-auto text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => toggleSelectAllVisible(event.target.checked)}
                    disabled={disabled}
                  />
                </th>
                <th className="w-[28%] px-3 py-2 text-left">Producto</th>
                <th className="w-[15%] px-3 py-2 text-left">Categoria</th>
                <th className="w-[12%] px-3 py-2 text-left">Stock actual</th>
                <th className="w-[16%] px-3 py-2 text-left">Minimo</th>
                <th className="w-[16%] px-3 py-2 text-left">Maximo</th>
                <th className="w-[13%] px-3 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((product) => {
                const draft = getDraft(product);
                const { stockMin, stockMax } = resolveThresholds(product, draft);
                const status = getStockStatusFromValues(product.stock_current, stockMin, stockMax);

                return (
                  <tr key={product.id}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedVisibleIds.includes(product.id)}
                        onChange={(event) => toggleRow(product.id, event.target.checked)}
                        disabled={disabled}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.code}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{product.category}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {product.stock_current.toLocaleString("es-AR")} {unitLabel(product)}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.001"
                        value={draft.stockMin}
                        onChange={(event) => updateDraft(product, { stockMin: event.target.value })}
                        onBlur={() => {
                          void persistRowIfChanged(product);
                        }}
                        className="ui-input"
                        placeholder="-"
                        disabled={disabled}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.001"
                        value={draft.stockMax}
                        onChange={(event) => updateDraft(product, { stockMax: event.target.value })}
                        onBlur={() => {
                          void persistRowIfChanged(product);
                        }}
                        className="ui-input"
                        placeholder="-"
                        disabled={disabled}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className={getStatusBadgeClassName(status)}>{stockStatusLabel[status]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
