import { useEffect, useState } from "react";
import { BadgePercent, Check, Percent, Trash2 } from "lucide-react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { CartManualDiscount } from "@/modules/pos/hooks/usePosSale";
import { cn } from "@/utils/cn";

interface PosCartDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDiscount: CartManualDiscount | null;
  cartSubtotal: number;
  onApplyDiscount: (discount: CartManualDiscount | null) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const QUICK_REASONS = [
  "Atención comercial",
  "Cliente habitual",
  "Promoción especial",
  "Descuento contado",
  "Falla / Detalle",
  "Descuento por volumen",
];

export const PosCartDiscountModal = ({
  isOpen,
  onClose,
  currentDiscount,
  cartSubtotal,
  onApplyDiscount,
}: PosCartDiscountModalProps) => {
  useBodyScrollLock(isOpen);

  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [valueStr, setValueStr] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      if (currentDiscount) {
        setMode(currentDiscount.type);
        setValueStr(String(currentDiscount.value));
        setReason(currentDiscount.reason || "");
      } else {
        setMode("percent");
        setValueStr("10");
        setReason("Atención comercial");
      }
    }
  }, [isOpen, currentDiscount]);

  if (!isOpen) return null;

  const rawNum = parseFloat(valueStr.replace(",", ".")) || 0;
  const numValue = Math.max(0, rawNum);

  const calculatedDiscountAmount =
    mode === "percent"
      ? Number((cartSubtotal * (Math.min(100, numValue) / 100)).toFixed(2))
      : Number(Math.min(cartSubtotal, numValue).toFixed(2));

  const resultingTotal = Number(Math.max(0, cartSubtotal - calculatedDiscountAmount).toFixed(2));

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (calculatedDiscountAmount <= 0) {
      onApplyDiscount(null);
      onClose();
      return;
    }

    onApplyDiscount({
      type: mode,
      value: mode === "percent" ? Math.min(100, numValue) : numValue,
      reason: reason.trim() || "Descuento general",
    });
    onClose();
  };

  const handleRemove = () => {
    onApplyDiscount(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs shrink-0">
              <BadgePercent size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Descuento al Carrito
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Subtotal base: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{currency.format(cartSubtotal)}</span>
              </p>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selector de modo (% o $) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Tipo de Descuento
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMode("percent")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer",
                  mode === "percent"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                )}
              >
                <Percent size={14} />
                <span>Porcentaje (%)</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("amount")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer",
                  mode === "amount"
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
              <label htmlFor="discount-value" className="font-bold text-slate-700 dark:text-slate-200">
                {mode === "percent" ? "Porcentaje de descuento (%)" : "Monto de descuento ($)"}
              </label>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                -{currency.format(calculatedDiscountAmount)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                {mode === "percent" ? "%" : "$"}
              </span>
              <input
                id="discount-value"
                type="number"
                step={mode === "percent" ? "1" : "0.01"}
                min="0"
                max={mode === "percent" ? "100" : String(cartSubtotal)}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                placeholder={mode === "percent" ? "10" : "500.00"}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2.5 pl-8 pr-3 text-base font-bold font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Motivo del descuento con atajos rápidos */}
          <div className="space-y-2">
            <label htmlFor="discount-reason" className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
              Motivo o Razón
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn(
                    "px-2 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer",
                    reason === r
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              id="discount-reason"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Escribí un motivo o seleccioná uno de arriba..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 px-3 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition placeholder:text-slate-400"
            />
          </div>

          {/* Resumen del impacto del descuento */}
          <div className="rounded-xl border border-dashed border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal original:</span>
              <span className="font-mono">{currency.format(cartSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-bold">
              <span>Descuento aplicado:</span>
              <span className="font-mono">-{currency.format(calculatedDiscountAmount)}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-emerald-200 dark:border-emerald-900 text-slate-900 dark:text-white font-black text-sm">
              <span>Total con descuento:</span>
              <span className="font-mono text-emerald-700 dark:text-emerald-300">
                {currency.format(resultingTotal)}
              </span>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            {currentDiscount ? (
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Quitar</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={calculatedDiscountAmount <= 0}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <Check size={14} className="stroke-[3]" />
                <span>Aplicar Descuento</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
