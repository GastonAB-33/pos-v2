import { useEffect, useState } from "react";
import {
  Banknote,
  Building2,
  Check,
  CreditCard,
  FileCheck2,
  Landmark,
  QrCode,
  Save,
  Users,
  Wallet,
} from "lucide-react";
import { normalizePaymentMethodCode } from "@/services/payment-methods.service";
import type { PaymentMethod } from "@/types/entities";
import { cn } from "@/utils/cn";

interface PaymentMethodConfigCardProps {
  method: PaymentMethod;
  disabled?: boolean;
  onToggle: (id: string) => Promise<boolean>;
  onUpdate: (
    id: string,
    values: { surcharge_percent: number; discount_percent: number; notes?: string | null }
  ) => Promise<boolean>;
}

const getMethodIcon = (code: string) => {
  const normalized = normalizePaymentMethodCode(code);
  switch (normalized) {
    case "cash":
      return Banknote;
    case "card_debit":
    case "card_credit":
      return CreditCard;
    case "transfer":
      return Landmark;
    case "mercado_pago":
      return QrCode;
    case "cheque":
      return FileCheck2;
    case "current_account":
      return Users;
    default:
      return Wallet;
  }
};

export const PaymentMethodConfigCard = ({
  method,
  disabled = false,
  onToggle,
  onUpdate,
}: PaymentMethodConfigCardProps) => {
  const Icon = getMethodIcon(method.code);

  const [discountPercent, setDiscountPercent] = useState<number>(method.discount_percent);
  const [surchargePercent, setSurchargePercent] = useState<number>(method.surcharge_percent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setDiscountPercent(method.discount_percent);
    setSurchargePercent(method.surcharge_percent);
  }, [method.discount_percent, method.surcharge_percent]);

  const isDirty =
    Math.abs(discountPercent - method.discount_percent) > 0.001 ||
    Math.abs(surchargePercent - method.surcharge_percent) > 0.001;

  const handleSave = async () => {
    if (!isDirty || disabled || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const ok = await onUpdate(method.id, {
        discount_percent: discountPercent,
        surcharge_percent: surchargePercent,
        notes: method.notes,
      });
      if (ok) {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async () => {
    if (disabled || isToggling) return;
    setIsToggling(true);
    try {
      await onToggle(method.id);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <article
      className={cn(
        "rounded-2xl sm:rounded-3xl border p-4 sm:p-5 shadow-xs transition-all flex flex-col justify-between gap-4",
        method.is_active
          ? "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-700"
          : "border-slate-200/60 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-950/40 opacity-80"
      )}
    >
      {/* Encabezado de la Tarjeta */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border transition-colors",
                method.is_active
                  ? "bg-blue-50 text-blue-600 border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60"
                  : "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
              )}
            >
              <Icon size={20} />
            </div>

            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {method.name}
              </h4>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {method.code}
              </p>
            </div>
          </div>

          {/* Switch Activo / Inactivo */}
          <button
            type="button"
            onClick={() => void handleToggle()}
            disabled={disabled || isToggling}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer border active:scale-95 disabled:opacity-50",
              method.is_active
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/80 dark:hover:bg-emerald-900/50"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700/80"
            )}
            title={method.is_active ? "Haz clic para desactivar en POS" : "Haz clic para activar en POS"}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                method.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-400 dark:bg-slate-500"
              )}
            />
            <span>{method.is_active ? "Activo" : "Inactivo"}</span>
          </button>
        </div>

        {/* Badge de Impacto en Caja */}
        <div className="flex flex-wrap items-center gap-1.5">
          {method.affects_cash ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-900/50">
              <Wallet size={11} />
              <span>Impacta en caja física</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              <Building2 size={11} />
              <span>Digital / Bancario</span>
            </span>
          )}

          {method.discount_percent > 0 ? (
            <span className="inline-flex items-center text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-900/50">
              -{method.discount_percent}% desc.
            </span>
          ) : null}

          {method.surcharge_percent > 0 ? (
            <span className="inline-flex items-center text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-900/50">
              +{method.surcharge_percent}% recargo
            </span>
          ) : null}
        </div>
      </div>

      {/* Editor Ágil de Descuento y Recargo */}
      <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        <div className="grid grid-cols-2 gap-2.5">
          {/* Descuento % */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Descuento %
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={discountPercent === 0 ? "" : discountPercent}
                onChange={(e) => {
                  const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                  setDiscountPercent(Number.isFinite(val) ? Math.max(0, val) : 0);
                }}
                placeholder="0 = Sin desc."
                disabled={disabled || !method.is_active}
                className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 py-1.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 transition-all"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
              />
            </div>
          </div>

          {/* Recargo % */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Recargo %
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={surchargePercent === 0 ? "" : surchargePercent}
                onChange={(e) => {
                  const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                  setSurchargePercent(Number.isFinite(val) ? Math.max(0, val) : 0);
                }}
                placeholder="0 = Sin recargo"
                disabled={disabled || !method.is_active}
                className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3 py-1.5 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 transition-all"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
              />
            </div>
          </div>
        </div>

        {/* Botón Guardar Cambios (se activa si hay cambios) */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {discountPercent > 0 && surchargePercent === 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Aplica {discountPercent}% desc. en POS
              </span>
            )}
            {surchargePercent > 0 && discountPercent === 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Aplica +{surchargePercent}% recargo en POS
              </span>
            )}
            {surchargePercent === 0 && discountPercent === 0 && (
              <span>Precio de lista (sin ajuste)</span>
            )}
          </p>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || disabled || isSubmitting}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              justSaved
                ? "bg-emerald-600 text-white"
                : isDirty
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-transparent"
            )}
          >
            {justSaved ? (
              <>
                <Check size={13} />
                <span>Guardado</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>{isSubmitting ? "Guardando..." : "Guardar"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
