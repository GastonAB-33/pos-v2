import { useMemo, useState } from "react";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { usePagination } from "@/hooks/usePagination";
import type { Product } from "@/types/entities";
import type { StockBatchAdjustmentValues } from "@/modules/stock/types/stock-adjustment.types";

interface StockAdjustmentModalProps {
  open: boolean;
  products: Product[];
  disabled?: boolean;
  canWrite: boolean;
  onClose: () => void;
  onSubmit: (values: StockBatchAdjustmentValues) => Promise<boolean>;
}

interface DraftValues {
  quantityIn: string;
  quantityOut: string;
}

const toPositiveNumber = (value: string): number => {
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Number(parsed.toFixed(3));
};

const unitLabel = (product: Product): string => (product.sale_mode === "weight" ? "kg" : "u.");

export const StockAdjustmentModal = ({
  open,
  products,
  disabled,
  canWrite,
  onClose,
  onSubmit,
}: StockAdjustmentModalProps) => {
  useBodyScrollLock(open);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<Record<string, DraftValues>>({});
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

  const busy = Boolean(disabled || isSubmittingLocal);

  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return products;

    return products.filter((product) => {
      const target = `${product.name} ${product.code} ${product.category} ${product.subcategory ?? ""}`.toLowerCase();
      return target.includes(normalizedSearch);
    });
  }, [products, search]);

  const rowsToSubmit = useMemo(() => {
    return products
      .map((product) => {
        const draft = drafts[product.id];
        const quantityIn = toPositiveNumber(draft?.quantityIn ?? "");
        const quantityOut = toPositiveNumber(draft?.quantityOut ?? "");
        return {
          productId: product.id,
          quantityIn,
          quantityOut,
        };
      })
      .filter((row) => row.quantityIn > 0 || row.quantityOut > 0);
  }, [drafts, products]);

  const paginatedProducts = usePagination(
    visibleProducts,
    10,
    `${search}|${visibleProducts.length}`
  );

  const updateDraft = (productId: string, patch: Partial<DraftValues>) => {
    setDrafts((current) => {
      const currentDraft = current[productId] ?? { quantityIn: "", quantityOut: "" };
      return {
        ...current,
        [productId]: {
          ...currentDraft,
          ...patch,
        },
      };
    });
  };

  const resetDrafts = () => {
    setDrafts({});
    setNotes("");
  };

  const submit = async () => {
    if (!rowsToSubmit.length || !canWrite || busy) return;

    setIsSubmittingLocal(true);
    try {
      const ok = await onSubmit({
        adjustments: rowsToSubmit,
        notes,
      });

      if (ok) {
        resetDrafts();
        onClose();
      }
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Ajustar stock</h3>
            <p className="text-xs text-slate-500">Cargar ingresos o salidas manuales.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="ui-btn-ghost" onClick={resetDrafts} disabled={busy}>
              Limpiar
            </button>
            <ModalCloseButton label="Cerrar ajuste" onClick={onClose} disabled={busy} />
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_280px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="ui-input"
            placeholder="Buscar por nombre, codigo o categoria"
            disabled={busy}
          />

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="ui-input"
            placeholder="Motivo general (opcional)"
            disabled={busy}
          />
        </div>

        <div className="mt-3 rounded-xl border border-slate-200">
          {visibleProducts.length === 0 ? (
            <div className="ui-empty-state">No hay productos para los filtros elegidos.</div>
          ) : (
            <div className="max-h-[56vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-left">Stock actual</th>
                    <th className="px-3 py-2 text-left">Entra</th>
                    <th className="px-3 py-2 text-left">Sale</th>
                    <th className="px-3 py-2 text-left">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.pageItems.map((product) => {
                    const draft = drafts[product.id] ?? { quantityIn: "", quantityOut: "" };
                    const quantityIn = toPositiveNumber(draft.quantityIn);
                    const quantityOut = toPositiveNumber(draft.quantityOut);
                    const net = Number((quantityIn - quantityOut).toFixed(3));

                    return (
                      <tr key={product.id}>
                        <td className="px-3 py-2 text-slate-700">
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.code}</p>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {product.stock_current.toLocaleString("es-AR")} {unitLabel(product)}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={draft.quantityIn}
                            onChange={(event) => updateDraft(product.id, { quantityIn: event.target.value })}
                            className="ui-input"
                            placeholder="0"
                            title={product.sale_mode === "weight" ? "Cantidad en kg" : "Cantidad en unidades"}
                            disabled={busy || !canWrite}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            value={draft.quantityOut}
                            onChange={(event) => updateDraft(product.id, { quantityOut: event.target.value })}
                            className="ui-input"
                            placeholder="0"
                            title={product.sale_mode === "weight" ? "Cantidad en kg" : "Cantidad en unidades"}
                            disabled={busy || !canWrite}
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {net === 0 ? "-" : `${net > 0 ? "+" : ""}${net.toLocaleString("es-AR")} ${unitLabel(product)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-3">
          <PaginationControls
            currentPage={paginatedProducts.currentPage}
            pageCount={paginatedProducts.pageCount}
            startItem={paginatedProducts.startItem}
            endItem={paginatedProducts.endItem}
            totalItems={paginatedProducts.totalItems}
            onPageChange={paginatedProducts.setCurrentPage}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
          <p className="text-xs text-slate-500">
            Productos con ajuste: <strong>{rowsToSubmit.length}</strong>
          </p>
          <button
            type="button"
            className="ui-btn-primary"
            onClick={() => {
              void submit();
            }}
            disabled={busy || !canWrite || rowsToSubmit.length === 0}
          >
            {busy ? "Aplicando..." : "Aplicar ajustes"}
          </button>
        </div>
      </div>
    </section>
  );
};
