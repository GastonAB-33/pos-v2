import { useEffect, useState } from "react";
import { Check, Percent, Sparkles, Tag, Trash2 } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { PosCartItemComputed } from "@/modules/pos/hooks/usePosSale";
import { calculateProductPromotionDiscount, type PromotionWithDetails } from "@/services/promotions.service";
import { cn } from "@/utils/cn";

interface PosItemPromoModalProps {
  isOpen: boolean;
  item: PosCartItemComputed | null;
  promotions: PromotionWithDetails[];
  onClose: () => void;
  onApplyDiscount: (
    productId: string,
    discount: { type: "percent" | "amount"; value: number; reason: string } | null
  ) => void;
  onApplyPromotion: (productId: string, promo: PromotionWithDetails | null) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const QUICK_ITEM_REASONS = [
  "Atención cliente",
  "Vencimiento próximo",
  "Embalaje dañado",
  "Precio mayorista",
  "Detalle estético",
  "Muestra / Oferta",
];

export const PosItemPromoModal = ({
  isOpen,
  item,
  promotions,
  onClose,
  onApplyDiscount,
  onApplyPromotion,
}: PosItemPromoModalProps) => {
  useBodyScrollLock(isOpen);

  const [activeTab, setActiveTab] = useState<"system_promo" | "manual_discount">("system_promo");

  // Estado para descuento manual
  const [manualMode, setManualMode] = useState<"percent" | "amount">("percent");
  const [manualValueStr, setManualValueStr] = useState<string>("10");
  const [manualReason, setManualReason] = useState<string>("Atención cliente");
  const [showAllPromotions, setShowAllPromotions] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      if (item.manual_discount) {
        setActiveTab("manual_discount");
        setManualMode(item.manual_discount.type);
        setManualValueStr(String(item.manual_discount.value));
        setManualReason(item.manual_discount.reason || "");
      } else if (item.manual_promotion) {
        setActiveTab("system_promo");
      } else {
        // Por defecto, si hay promos que apliquen a este producto, ir a system_promo, sino manual
        const hasMatching = promotions.some(
          (p) =>
            p.is_active &&
            (p.product_id === item.product_id ||
              p.items?.some((i) => i.product_id === item.product_id) ||
              (p.scope === "product" && !p.product_id))
        );
        setActiveTab(hasMatching ? "system_promo" : "manual_discount");
        setManualMode("percent");
        setManualValueStr("10");
        setManualReason("Atención cliente");
      }
      setShowAllPromotions(false);
    }
  }, [isOpen, item, promotions]);

  if (!isOpen || !item) return null;

  const grossLineTotal = Number((item.quantity * item.unit_price).toFixed(2));

  // Promociones del módulo de promociones vinculadas o aplicables
  const matchingPromotions = promotions.filter((p) => {
    if (!p.is_active) return false;
    if (showAllPromotions) return true;

    // Vinculadas específicamente por ID de producto
    if (p.product_id === item.product_id) return true;

    // Vinculadas como ítem de un combo o bundle
    if (p.items?.some((i) => i.product_id === item.product_id)) return true;

    // Promoción de producto general sin producto_id específico
    if (p.scope === "product" && !p.product_id) return true;

    return false;
  });

  // Cálculos de descuento manual
  const rawNum = parseFloat(manualValueStr.replace(",", ".")) || 0;
  const numValue = Math.max(0, rawNum);

  const calculatedManualDiscount =
    manualMode === "percent"
      ? Number((grossLineTotal * (Math.min(100, numValue) / 100)).toFixed(2))
      : Number(Math.min(grossLineTotal, numValue).toFixed(2));

  const resultingManualTotal = Number(Math.max(0, grossLineTotal - calculatedManualDiscount).toFixed(2));

  const handleApplyManualDiscount = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (calculatedManualDiscount <= 0) {
      onApplyDiscount(item.product_id, null);
      onClose();
      return;
    }

    onApplyDiscount(item.product_id, {
      type: manualMode,
      value: manualMode === "percent" ? Math.min(100, numValue) : numValue,
      reason: manualReason.trim() || "Descuento en producto",
    });
    onClose();
  };

  const handleSelectPromotion = (promo: PromotionWithDetails) => {
    onApplyPromotion(item.product_id, promo);
    onClose();
  };

  const handleRemoveAllDiscounts = () => {
    onApplyDiscount(item.product_id, null);
    onApplyPromotion(item.product_id, null);
    onClose();
  };

  const hasAnyActiveDiscountOrPromo = Boolean(
    item.manual_discount || item.manual_promotion || item.promotion_discount_total > 0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs shrink-0">
              <Sparkles size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {item.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currency.format(item.unit_price)} / {item.sale_mode === "weight" ? "kg" : "u."} • Cantidad:{" "}
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {item.quantity} {item.sale_mode === "weight" ? "kg" : "u."}
                </span>{" "}
                • Total línea: <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currency.format(grossLineTotal)}</span>
              </p>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        {/* Selector de Pestañas: Promos del Módulo vs Descuento Manual */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("system_promo")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer",
              activeTab === "system_promo"
                ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Sparkles size={14} />
            <span>Promociones del Sistema</span>
            {matchingPromotions.length > 0 && (
              <span className="ml-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 text-[10px] font-bold">
                {matchingPromotions.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual_discount")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer",
              activeTab === "manual_discount"
                ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <Percent size={14} />
            <span>Descuento Manual</span>
          </button>
        </div>

        {/* PESTAÑA 1: PROMOCIONES DEL MÓDULO PROMOCIONES */}
        {activeTab === "system_promo" ? (
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Promociones configuradas en el módulo Promociones
              </span>
              <button
                type="button"
                onClick={() => setShowAllPromotions(!showAllPromotions)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                {showAllPromotions ? "Solo vinculadas a este producto" : "Ver todas las promociones"}
              </button>
            </div>

            {matchingPromotions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center space-y-3">
                <Tag size={28} className="mx-auto text-slate-400" />
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  No hay promociones activas vinculadas específicamente a{" "}
                  <span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span> en el módulo Promociones.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAllPromotions(true)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Ver todas las promociones activas
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("manual_discount")}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                  >
                    Aplicar Descuento Manual
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {matchingPromotions.map((promo) => {
                  const isCurrentPromo = item.manual_promotion?.id === promo.id;
                  const estimatedDiscount = calculateProductPromotionDiscount(
                    promo,
                    item.quantity,
                    item.unit_price
                  );
                  const newTotal = Number(Math.max(0, grossLineTotal - estimatedDiscount).toFixed(2));

                  return (
                    <div
                      key={promo.id}
                      onClick={() => handleSelectPromotion(promo)}
                      className={cn(
                        "rounded-xl border p-3 flex items-center justify-between gap-3 transition cursor-pointer shadow-2xs group",
                        isCurrentPromo
                          ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/40"
                          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 hover:border-indigo-400 dark:hover:border-indigo-500"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {promo.name}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.2 text-[9px] font-bold uppercase",
                              promo.type === "percentage_discount"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : promo.type === "fixed_discount"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            )}
                          >
                            {promo.type === "percentage_discount"
                              ? `${promo.discount_percent}% OFF`
                              : promo.type === "fixed_discount"
                              ? `-$${promo.discount_amount}`
                              : `Combo $${promo.combo_price}`}
                          </span>
                          {promo.min_quantity && promo.min_quantity > 1 && (
                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600 dark:text-slate-400">
                              Mín. {promo.min_quantity} u.
                            </span>
                          )}
                          {isCurrentPromo && (
                            <span className="flex items-center gap-1 rounded bg-emerald-600 text-white px-1.5 py-0.2 text-[9px] font-bold">
                              <Check size={10} strokeWidth={3} />
                              <span>Aplicada</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          Código: <span className="font-mono">{promo.code}</span>
                          {promo.description ? ` • ${promo.description}` : ""}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                          -{currency.format(estimatedDiscount)}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Total: {currency.format(newTotal)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* PESTAÑA 2: DESCUENTO MANUAL */
          <form onSubmit={handleApplyManualDiscount} className="space-y-4 flex-1 overflow-y-auto pr-1">
            {/* Selector de modo (% o $) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Tipo de Descuento
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setManualMode("percent")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer",
                    manualMode === "percent"
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <Percent size={14} />
                  <span>Porcentaje (%)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManualMode("amount")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer",
                    manualMode === "amount"
                      ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  )}
                >
                  <span className="font-mono font-black text-xs">$</span>
                  <span>Monto Fijo ($)</span>
                </button>
              </div>
            </div>

            {/* Input del valor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="item-discount-value" className="font-bold text-slate-700 dark:text-slate-200">
                  {manualMode === "percent" ? "Porcentaje de descuento (%)" : "Monto de descuento ($)"}
                </label>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  -{currency.format(calculatedManualDiscount)}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                  {manualMode === "percent" ? "%" : "$"}
                </span>
                <input
                  id="item-discount-value"
                  type="number"
                  step={manualMode === "percent" ? "1" : "0.01"}
                  min="0"
                  max={manualMode === "percent" ? "100" : String(grossLineTotal)}
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  value={manualValueStr}
                  onChange={(e) => setManualValueStr(e.target.value)}
                  placeholder={manualMode === "percent" ? "10" : "500.00"}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2.5 pl-8 pr-3 text-base font-bold font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* Motivo del descuento con atajos rápidos */}
            <div className="space-y-2">
              <label htmlFor="item-discount-reason" className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                Motivo del Descuento
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ITEM_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setManualReason(r)}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer",
                      manualReason === r
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                id="item-discount-reason"
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="Escribí un motivo o seleccioná uno de arriba..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition placeholder:text-slate-400"
              />
            </div>

            {/* Resumen del impacto del descuento */}
            <div className="rounded-xl border border-dashed border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Total línea original:</span>
                <span className="font-mono">{currency.format(grossLineTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                <span>Descuento a aplicar:</span>
                <span className="font-mono">-{currency.format(calculatedManualDiscount)}</span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-emerald-200 dark:border-emerald-900 text-slate-900 dark:text-white font-black text-sm">
                <span>Nuevo total producto:</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-300">
                  {currency.format(resultingManualTotal)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={calculatedManualDiscount <= 0}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <Check size={14} className="stroke-[3]" />
                <span>Aplicar a este Producto</span>
              </button>
            </div>
          </form>
        )}

        {/* Footer del modal */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 shrink-0">
          {hasAnyActiveDiscountOrPromo ? (
            <button
              type="button"
              onClick={handleRemoveAllDiscounts}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Quitar Descuento / Promo</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
