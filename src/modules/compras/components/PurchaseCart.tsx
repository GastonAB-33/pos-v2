import { useEffect, useState } from "react";
import { Gift, Percent, Trash2 } from "lucide-react";

export interface PurchaseCartItemView {
  product_id: string;
  name: string;
  sale_mode: "unit" | "weight";
  quantity: number;
  unit_cost: number;
  vat_percent: number;
  bonified_quantity: number;
  stock_current: number;
}

export interface PurchaseSummary {
  subtotal: number;
  vatTotal: number;
  total: number;
  totalUnits: number;
}

interface PurchaseCartProps {
  items: PurchaseCartItemView[];
  summary: PurchaseSummary;
  canWrite: boolean;
  disabled?: boolean;
  onSetQuantity: (productId: string, quantity: number) => void;
  onSetUnitCost: (productId: string, unitCost: number) => void;
  onSetVatPercent: (productId: string, vatPercent: number) => void;
  onSetBonifiedQuantity: (productId: string, bonifiedQty: number) => void;
  onRemove: (productId: string) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

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
  disabled,
  onSetQuantity,
  onSetUnitCost,
  onSetVatPercent,
  onSetBonifiedQuantity,
  onRemove,
}: PurchaseCartProps) => {
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
  const [bonifiedDrafts, setBonifiedDrafts] = useState<Record<string, string>>({});

  const getUnitLabel = (item: PurchaseCartItemView) =>
    item.sale_mode === "weight" ? "kg" : "u.";

  useEffect(() => {
    const ids = new Set(items.map((item) => item.product_id));
    setQuantityDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id)))
    );
    setCostDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id)))
    );
    setBonifiedDrafts((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id)))
    );
  }, [items]);

  const commitQuantity = (item: PurchaseCartItemView) => {
    const raw = quantityDrafts[item.product_id];
    if (raw == null) return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSetQuantity(item.product_id, parsed);
    }
    setQuantityDrafts((current) => {
      const { [item.product_id]: _discard, ...next } = current;
      return next;
    });
  };

  const commitCost = (item: PurchaseCartItemView) => {
    const raw = costDrafts[item.product_id];
    if (raw == null) return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSetUnitCost(item.product_id, parsed);
    }
    setCostDrafts((current) => {
      const { [item.product_id]: _discard, ...next } = current;
      return next;
    });
  };

  const commitBonified = (item: PurchaseCartItemView) => {
    const raw = bonifiedDrafts[item.product_id];
    if (raw == null) return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSetBonifiedQuantity(item.product_id, parsed);
    }
    setBonifiedDrafts((current) => {
      const { [item.product_id]: _discard, ...next } = current;
      return next;
    });
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <h2 className="text-base font-semibold text-slate-900">
          Items de compra ({items.length})
        </h2>
        <span className="text-xs text-slate-500">
          Total unidades ingresando: {summary.totalUnits.toLocaleString("es-AR")}
        </span>
      </div>

      {!items.length ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Aún no agregaste productos a la compra. Escanea un código o selecciónalos de la lista.
        </div>
      ) : (
        <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
          {items.map((item) => {
            const lineSubtotal = item.quantity * item.unit_cost;
            const lineVat = lineSubtotal * ((item.vat_percent || 0) / 100);
            const lineTotal = lineSubtotal + lineVat;
            const totalStockIn = item.quantity + (item.bonified_quantity || 0);

            return (
              <article
                key={item.product_id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>Stock actual: {item.stock_current} {getUnitLabel(item)}</span>
                      <span>•</span>
                      <span className="font-medium text-brand-700">
                        Ingresa a stock: +{totalStockIn} {getUnitLabel(item)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.product_id)}
                    disabled={disabled || !canWrite}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    title="Quitar de la compra"
                  >
                    <Trash2 className="h-3 w-3" />
                    Quitar
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Cant. a pagar ({getUnitLabel(item)})
                    </label>
                    <input
                      type="number"
                      step={item.sale_mode === "weight" ? "0.001" : "1"}
                      min="0"
                      value={quantityDrafts[item.product_id] ?? String(item.quantity)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setQuantityDrafts((current) => ({
                          ...current,
                          [item.product_id]: nextValue,
                        }));
                        if (!nextValue.trim()) return;
                        const parsed = Number(nextValue);
                        if (Number.isFinite(parsed) && parsed >= 0) {
                          onSetQuantity(item.product_id, parsed);
                        }
                      }}
                      onBlur={() => commitQuantity(item)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                      disabled={disabled || !canWrite}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Costo unit. ({item.sale_mode === "weight" ? "$/kg" : "$/u"})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={costDrafts[item.product_id] ?? String(item.unit_cost)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setCostDrafts((current) => ({
                          ...current,
                          [item.product_id]: nextValue,
                        }));
                        if (!nextValue.trim()) return;
                        const parsed = Number(nextValue);
                        if (Number.isFinite(parsed) && parsed >= 0) {
                          onSetUnitCost(item.product_id, parsed);
                        }
                      }}
                      onBlur={() => commitCost(item)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                      disabled={disabled || !canWrite}
                    />
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-700">
                      <Percent className="h-3 w-3 text-slate-400" />
                      IVA
                    </label>
                    <select
                      value={item.vat_percent}
                      onChange={(event) => onSetVatPercent(item.product_id, Number(event.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                      disabled={disabled || !canWrite}
                    >
                      {VAT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Gift className="h-3 w-3 text-emerald-600" />
                      Bonificados ({getUnitLabel(item)})
                    </label>
                    <input
                      type="number"
                      step={item.sale_mode === "weight" ? "0.001" : "1"}
                      min="0"
                      placeholder="0"
                      value={bonifiedDrafts[item.product_id] ?? String(item.bonified_quantity || 0)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setBonifiedDrafts((current) => ({
                          ...current,
                          [item.product_id]: nextValue,
                        }));
                        if (!nextValue.trim()) return;
                        const parsed = Number(nextValue);
                        if (Number.isFinite(parsed) && parsed >= 0) {
                          onSetBonifiedQuantity(item.product_id, parsed);
                        }
                      }}
                      onBlur={() => commitBonified(item)}
                      className="w-full rounded-lg border border-emerald-300 bg-emerald-50/40 px-2.5 py-1.5 text-sm font-medium text-emerald-900"
                      disabled={disabled || !canWrite}
                    />
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between border-t border-slate-200/80 pt-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span>Neto: {currency.format(lineSubtotal)}</span>
                    {item.vat_percent > 0 ? (
                      <>
                        <span>•</span>
                        <span>IVA ({item.vat_percent}%): {currency.format(lineVat)}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="font-semibold text-slate-900">
                    Total ítem: {currency.format(lineTotal)}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Subtotal neto:</span>
          <span className="font-medium text-slate-800">{currency.format(summary.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>IVA total:</span>
          <span className="font-medium text-slate-800">{currency.format(summary.vatTotal)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-900">
          <span>Total a pagar:</span>
          <span className="text-brand-700">{currency.format(summary.total)}</span>
        </div>
      </div>
    </section>
  );
};
