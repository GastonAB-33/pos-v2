import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Flame, Layers, Package } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { convertInputToStockQuantity } from "@/services/production.service";
import type { EnrichedRecipe } from "@/modules/produccion/hooks/useProductionModule";
import type { Product, ProductionInputMode } from "@/types/entities";

interface ProduceOrderModalProps {
  open: boolean;
  enriched: EnrichedRecipe | null;
  productsById: Map<string, Product>;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (params: {
    enriched: EnrichedRecipe;
    inputMode: ProductionInputMode;
    amount: number;
    wasteUnits?: number;
    notes?: string;
  }) => Promise<void>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const ProduceOrderModal = ({
  open,
  enriched,
  productsById,
  isSubmitting,
  onClose,
  onConfirm,
}: ProduceOrderModalProps) => {
  useBodyScrollLock(open);

  const [inputMode, setInputMode] = useState<ProductionInputMode>("units");
  const [amountStr, setAmountStr] = useState<string>("1");
  const [wasteStr, setWasteStr] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !enriched) return;
    setInputMode("units");
    setAmountStr(String(enriched.recipe.batch_yield || 1));
    setWasteStr("");
    setNotes("");
    const timer = setTimeout(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    }, 60);
    return () => clearTimeout(timer);
  }, [open, enriched]);

  const preview = useMemo(() => {
    if (!enriched) return null;
    const { recipe, items, finishedProduct } = enriched;
    const safeYield = Math.max(0.001, Number(recipe.batch_yield) || 1);
    const amount = Math.max(0, Number(amountStr) || 0);
    const waste = Math.max(0, Number(wasteStr) || 0);

    let batchesCount = 0;
    let unitsProduced = 0;

    if (inputMode === "batches") {
      batchesCount = amount;
      unitsProduced = Math.max(0, Number((amount * safeYield - waste).toFixed(3)));
    } else {
      unitsProduced = amount;
      batchesCount = Number(((amount + waste) / safeYield).toFixed(4));
    }

    let ingredientsCost = 0;
    let hasShortage = false;

    const ingredientsBreakdown = items.map((item) => {
      const ing = productsById.get(item.ingredient_product_id);
      const qtyUsed = Number((Number(item.quantity_per_batch) * batchesCount).toFixed(3));
      const stockDeducted = ing
        ? convertInputToStockQuantity(qtyUsed, item.input_unit, ing.sale_mode)
        : qtyUsed;
      const currentStock = Number(ing?.stock_current) || 0;
      const nextStock = Number((currentStock - stockDeducted).toFixed(3));
      const isShort = currentStock < stockDeducted;
      if (isShort) hasShortage = true;

      const lineCost = Number((stockDeducted * (Number(ing?.cost_price) || 0)).toFixed(2));
      ingredientsCost += lineCost;

      return {
        id: item.ingredient_product_id,
        name: ing?.name ?? "Insumo eliminado",
        inputUnit: item.input_unit,
        stockUnit: ing?.sale_mode === "weight" ? "kg" : "u.",
        qtyUsed,
        stockDeducted,
        currentStock,
        nextStock,
        isShort,
        lineCost,
      };
    });

    const totalCost = Number((ingredientsCost + (Number(recipe.indirect_cost) || 0) * batchesCount).toFixed(2));
    const unitCost = unitsProduced > 0 ? Number((totalCost / unitsProduced).toFixed(2)) : 0;
    const salePrice = Number(finishedProduct?.price) || 0;
    const estimatedSale = Number((unitsProduced * salePrice).toFixed(2));
    const estimatedProfit = Number((estimatedSale - totalCost).toFixed(2));

    return {
      batchesCount: Number(batchesCount.toFixed(2)),
      unitsProduced,
      ingredientsBreakdown,
      hasShortage,
      totalCost,
      unitCost,
      estimatedSale,
      estimatedProfit,
      currentFinishedStock: Number(finishedProduct?.stock_current) || 0,
      nextFinishedStock: Number(((Number(finishedProduct?.stock_current) || 0) + unitsProduced).toFixed(3)),
    };
  }, [enriched, inputMode, amountStr, wasteStr, productsById]);

  if (!open || !enriched || !preview) return null;

  const unitLabel = enriched.recipe.yield_unit === "kg" ? "kg" : "u.";
  const amountNum = Number(amountStr) || 0;
  const canSubmit = amountNum > 0 && preview.unitsProduced > 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await onConfirm({
      enriched,
      inputMode,
      amount: amountNum,
      wasteUnits: Number(wasteStr) || 0,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Flame size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  Registrar Producción: {enriched.recipe.name}
                </h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  1 tanda = {enriched.recipe.batch_yield} {unitLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Descuenta insumos automáticamente y suma el elaborado al stock
              </p>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} />
        </header>

        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Selector Por Unidades vs Por Tandas */}
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  ¿Cómo querés cargar la producción?
                </span>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900 border border-slate-300/60 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("units");
                      setAmountStr(String(preview.unitsProduced || enriched.recipe.batch_yield));
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      inputMode === "units"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    }`}
                  >
                    <Package size={14} />
                    Por Unidades ({unitLabel})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputMode("batches");
                      setAmountStr("1");
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                      inputMode === "batches"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    }`}
                  >
                    <Layers size={14} />
                    Por Tandas
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {inputMode === "batches"
                      ? "Cantidad de tandas elaboradas"
                      : `Cantidad elaborada (${unitLabel})`}
                  </label>
                  <input
                    ref={amountInputRef}
                    type="number"
                    step="any"
                    min="0.001"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    autoComplete="off"
                    data-lpignore="true"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold font-mono text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                  />
                  {inputMode === "units" && enriched.recipe.yield_unit === "unit" && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {[
                        { label: "+1 u.", val: 1 },
                        { label: "+6 u. (½ doc.)", val: 6 },
                        { label: "+12 u. (1 doc.)", val: 12 },
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => {
                            const current = Math.max(0, Number(amountStr) || 0);
                            setAmountStr(String(current + btn.val));
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-blue-500 transition cursor-pointer"
                        >
                          {btn.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAmountStr("0")}
                        className="rounded-lg border border-transparent px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
                        title="Reiniciar cantidad a 0"
                      >
                        Limpiar
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Merma / Desperdicio ({unitLabel}){" "}
                    <span className="font-normal text-slate-400">(opcional)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0"
                    value={wasteStr}
                    onChange={(e) => setWasteStr(e.target.value)}
                    autoComplete="off"
                    data-lpignore="true"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs border border-slate-200/80 dark:bg-slate-900 dark:border-slate-700/80">
                <span className="text-slate-600 dark:text-slate-300">
                  Equivale a{" "}
                  <strong className="font-mono text-slate-900 dark:text-white">
                    {preview.batchesCount} tanda/s
                  </strong>{" "}
                  → Suma{" "}
                  <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                    +{preview.unitsProduced} {unitLabel}
                  </strong>
                </span>
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  Stock producto: {preview.currentFinishedStock} →{" "}
                  <strong className="text-slate-900 dark:text-white">{preview.nextFinishedStock}</strong>
                </span>
              </div>
            </div>

            {/* Desglose de insumos que se descuentan */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Insumos a descontar del inventario
                </h4>
                {preview.hasShortage ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    <AlertTriangle size={12} />
                    Stock insuficiente (se permitirá descontar a 0)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 size={12} />
                    Insumos disponibles
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white divide-y divide-slate-100 dark:border-slate-800 dark:bg-slate-900/70 dark:divide-slate-800">
                {preview.ingredientsBreakdown.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500 dark:text-slate-400">
                    Esta receta no tiene insumos cargados.
                  </p>
                ) : (
                  preview.ingredientsBreakdown.map((ing) => (
                    <div
                      key={ing.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {ing.name}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          Stock: {ing.currentStock} {ing.stockUnit} →{" "}
                          <span
                            className={
                              ing.isShort
                                ? "font-bold text-amber-600 dark:text-amber-400"
                                : "text-slate-700 dark:text-slate-300"
                            }
                          >
                            {Math.max(0, ing.nextStock)} {ing.stockUnit}
                          </span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          -{ing.qtyUsed} {ing.inputUnit === "unit" ? "u." : ing.inputUnit}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {currency.format(ing.lineCost)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Nota opcional */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Nota o referencia <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Pedido especial mediodía / Turno mañana"
                autoComplete="off"
                data-lpignore="true"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
              />
            </div>

            {/* KPI Resumen Costo / Ganancia */}
            <div className="grid grid-cols-3 gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Costo total lote
                </span>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {currency.format(preview.totalCost)}
                </span>
                <span className="block text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  ({currency.format(preview.unitCost)}/{unitLabel})
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Valor en venta
                </span>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {currency.format(preview.estimatedSale)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Ganancia estimada
                </span>
                <span
                  className={`font-mono text-sm font-bold ${
                    preview.estimatedProfit >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {preview.estimatedProfit >= 0 ? "+" : ""}
                  {currency.format(preview.estimatedProfit)}
                </span>
                <span className="block text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  ({currency.format(preview.unitsProduced > 0 ? preview.estimatedProfit / preview.unitsProduced : 0)}/{unitLabel})
                </span>
              </div>
            </div>
          </div>

          <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmitting ? "Registrando..." : "Confirmar Producción"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
