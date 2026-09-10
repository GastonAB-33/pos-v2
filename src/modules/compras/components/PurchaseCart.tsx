import { useEffect, useState } from "react";
import { Check, Gift, Package, PackagePlus, Percent, Plus, ShoppingBag, Trash2 } from "lucide-react";

export interface PurchaseCartItemView {
  product_id: string;
  name: string;
  sale_mode: "unit" | "weight";
  quantity: number;
  unit_cost: number;
  vat_percent: number;
  bonified_quantity: number;
  stock_current: number;
  previous_cost: number;
  current_sale_price: number;
  update_sale_price: boolean;
  new_sale_price: number;
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
  formId?: string;
  onSetQuantity: (productId: string, quantity: number) => void;
  onSetUnitCost: (productId: string, unitCost: number) => void;
  onSetVatPercent: (productId: string, vatPercent: number) => void;
  onSetBonifiedQuantity: (productId: string, bonifiedQty: number) => void;
  onSetUpdateSalePrice?: (productId: string, update: boolean) => void;
  onSetNewSalePrice?: (productId: string, newPrice: number) => void;
  onRemove: (productId: string) => void;
  onOpenAddProductModal?: () => void;
  onOpenCreateProductModal?: () => void;
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
  formId = "purchase-checkout-form",
  onSetQuantity,
  onSetUnitCost,
  onSetVatPercent,
  onSetBonifiedQuantity,
  onSetUpdateSalePrice,
  onSetNewSalePrice,
  onRemove,
  onOpenAddProductModal,
  onOpenCreateProductModal,
}: PurchaseCartProps) => {
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
  const [bonifiedDrafts, setBonifiedDrafts] = useState<Record<string, string>>({});
  const [salePriceDrafts, setSalePriceDrafts] = useState<Record<string, string>>({});

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
    setSalePriceDrafts((current) =>
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

  const commitNewSalePrice = (item: PurchaseCartItemView) => {
    const raw = salePriceDrafts[item.product_id];
    if (raw == null) return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && onSetNewSalePrice) {
      onSetNewSalePrice(item.product_id, parsed);
    }
    setSalePriceDrafts((current) => {
      const { [item.product_id]: _discard, ...next } = current;
      return next;
    });
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header minimalista de la lista */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Package className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800">
                Productos de la compra
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {items.length} {items.length === 1 ? "ítem" : "ítems"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Total unidades a sumar en stock: <strong className="text-slate-700">{summary.totalUnits.toLocaleString("es-AR")} u.</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onOpenAddProductModal && (
            <button
              type="button"
              onClick={onOpenAddProductModal}
              disabled={disabled || !canWrite}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar producto
            </button>
          )}

          {onOpenCreateProductModal && (
            <button
              type="button"
              onClick={onOpenCreateProductModal}
              disabled={disabled || !canWrite}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <PackagePlus className="h-3.5 w-3.5 text-slate-500" />
              Nuevo producto
            </button>
          )}
        </div>
      </div>

      {/* Lista de productos o estado vacío */}
      {!items.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-700">
            No hay productos cargados en esta compra
          </p>
          <p className="text-[11px] text-slate-400">
            Agrega productos del inventario o da de alta uno nuevo
          </p>

          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
            {onOpenAddProductModal && (
              <button
                type="button"
                onClick={onOpenAddProductModal}
                disabled={disabled || !canWrite}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar producto
              </button>
            )}

            {onOpenCreateProductModal && (
              <button
                type="button"
                onClick={onOpenCreateProductModal}
                disabled={disabled || !canWrite}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <PackagePlus className="h-3.5 w-3.5 text-slate-500" />
                Crear nuevo producto
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const lineSubtotal = item.quantity * item.unit_cost;
            const lineVat = lineSubtotal * ((item.vat_percent || 0) / 100);
            const lineTotal = lineSubtotal + lineVat;
            const totalStockIn = item.quantity + (item.bonified_quantity || 0);

            // Variación de costo neto
            const prevCost = item.previous_cost || 0;
            const unitCostDiff = item.unit_cost - prevCost;
            const hasCostDiff = Math.abs(unitCostDiff) > 0.001 && prevCost > 0;
            const costPctDiff = prevCost > 0 ? (unitCostDiff / prevCost) * 100 : 0;

            return (
              <article
                key={item.product_id}
                className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-3 transition hover:border-slate-300 hover:bg-slate-50/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span>Stock actual: <strong className="text-slate-700">{item.stock_current} {getUnitLabel(item)}</strong></span>
                      <span>•</span>
                      <span className="font-semibold text-emerald-700">
                        Ingresa a stock: +{totalStockIn} {getUnitLabel(item)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.product_id)}
                    disabled={disabled || !canWrite}
                    className="inline-flex items-center gap-1 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Quitar producto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium">Quitar</span>
                  </button>
                </div>

                {/* Controles de edición en cuadrícula compacta */}
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      disabled={disabled || !canWrite}
                    />
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      disabled={disabled || !canWrite}
                    />
                  </div>

                  <div>
                    <label className="mb-0.5 flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <Percent className="h-2.5 w-2.5 text-slate-400" />
                      IVA
                    </label>
                    <select
                      value={item.vat_percent}
                      onChange={(event) => onSetVatPercent(item.product_id, Number(event.target.value))}
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                    <label className="mb-0.5 flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      <Gift className="h-2.5 w-2.5 text-emerald-600" />
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
                      className="w-full rounded-md border border-emerald-300 bg-emerald-50/40 px-2 py-1 text-xs font-bold text-emerald-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      disabled={disabled || !canWrite}
                    />
                  </div>
                </div>

                {/* Subtotal, Neto antes y Totales por fila */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-1.5 text-[11px]">
                  <div className="flex flex-wrap items-center gap-2 text-slate-600">
                    <span>
                      Neto: <strong className="text-slate-800">{currency.format(lineSubtotal)}</strong>
                    </span>

                    {/* Neto antes con variación: rojo si aumentó, verde si disminuyó; no se muestra si es igual */}
                    {hasCostDiff ? (
                      <>
                        <span>•</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            unitCostDiff > 0
                              ? "border border-red-200 bg-red-50 text-red-700"
                              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          <span>Neto antes: {currency.format(prevCost)}</span>
                          <span>
                            ({unitCostDiff > 0 ? "+" : ""}
                            {currency.format(unitCostDiff)} / {unitCostDiff > 0 ? "+" : ""}
                            {costPctDiff.toFixed(1)}% {unitCostDiff > 0 ? "▲" : "▼"})
                          </span>
                        </span>
                      </>
                    ) : null}

                    {item.vat_percent > 0 ? (
                      <>
                        <span>•</span>
                        <span>IVA ({item.vat_percent}%): <strong className="text-slate-700">{currency.format(lineVat)}</strong></span>
                      </>
                    ) : null}
                  </div>
                  <div className="font-bold text-slate-900">
                    Total ítem: <span className="text-brand-700">{currency.format(lineTotal)}</span>
                  </div>
                </div>

                {/* Opciones de actualización de precio de venta por cada producto */}
                <div className="mt-2.5 rounded-lg border border-slate-200 bg-white/90 p-2.5 shadow-xs">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Actualización de precios para este producto:
                  </span>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
                      {/* Casilla 1: Mantener precio venta */}
                      <label className="inline-flex cursor-pointer items-center gap-2 select-none">
                        <input
                          type="radio"
                          name={`sale-price-policy-${item.product_id}`}
                          checked={!item.update_sale_price}
                          onChange={() => onSetUpdateSalePrice?.(item.product_id, false)}
                          disabled={disabled || !canWrite}
                          className="h-3.5 w-3.5 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-[11px] font-medium text-slate-700">
                          Actualizar precio neto pero mantener precio venta{" "}
                          <span className="font-semibold text-slate-500">
                            ({currency.format(item.current_sale_price || 0)})
                          </span>
                        </span>
                      </label>

                      {/* Casilla 2: Actualizar precio venta */}
                      <label className="inline-flex cursor-pointer items-center gap-2 select-none">
                        <input
                          type="radio"
                          name={`sale-price-policy-${item.product_id}`}
                          checked={Boolean(item.update_sale_price)}
                          onChange={() => onSetUpdateSalePrice?.(item.product_id, true)}
                          disabled={disabled || !canWrite}
                          className="h-3.5 w-3.5 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-[11px] font-medium text-slate-700">
                          Actualizar precio neto y actualizar precio venta:
                        </span>
                      </label>
                    </div>

                    {/* Input editable de nuevo precio de venta */}
                    <div className="flex items-center gap-1 pl-5 sm:pl-0">
                      <span className="text-xs font-bold text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={String(item.current_sale_price || 0)}
                        value={
                          salePriceDrafts[item.product_id] ??
                          String(item.new_sale_price ?? item.current_sale_price ?? 0)
                        }
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setSalePriceDrafts((current) => ({
                            ...current,
                            [item.product_id]: nextValue,
                          }));
                          if (!nextValue.trim()) return;
                          const parsed = Number(nextValue);
                          if (Number.isFinite(parsed) && parsed >= 0) {
                            onSetNewSalePrice?.(item.product_id, parsed);
                            if (!item.update_sale_price) {
                              onSetUpdateSalePrice?.(item.product_id, true);
                            }
                          }
                        }}
                        onFocus={() => {
                          if (!item.update_sale_price) {
                            onSetUpdateSalePrice?.(item.product_id, true);
                          }
                        }}
                        onBlur={() => commitNewSalePrice(item)}
                        disabled={disabled || !canWrite}
                        className={`w-28 rounded-md border px-2 py-1 text-xs font-bold transition ${
                          item.update_sale_price
                            ? "border-brand-500 bg-brand-50/20 text-brand-800 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            : "border-slate-300 bg-slate-100 text-slate-400"
                        }`}
                        title="Nuevo precio de venta"
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Resumen Total y Botón de Confirmación Minimalista */}
      {items.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500">Subtotal neto: </span>
              <strong className="text-slate-800">{currency.format(summary.subtotal)}</strong>
            </div>
            <span className="text-slate-300">•</span>
            <div>
              <span className="text-slate-500">IVA total: </span>
              <strong className="text-slate-800">{currency.format(summary.vatTotal)}</strong>
            </div>
            <span className="text-slate-300">•</span>
            <div className="text-sm">
              <span className="font-semibold text-slate-700">Total a pagar: </span>
              <strong className="text-base font-extrabold text-brand-700">
                {currency.format(summary.total)}
              </strong>
            </div>
          </div>

          <button
            type="submit"
            form={formId}
            disabled={disabled || !canWrite}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Confirmar y registrar compra
          </button>
        </div>
      )}
    </section>
  );
};
