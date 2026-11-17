import { useEffect, useMemo, useRef, useState } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { currentAccountsService } from "@/services/current-accounts.service";
import type { Customer } from "@/types/entities";
import {
  DollarSign,
  PlusCircle,
  Receipt,
  Check,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface CustomerManualMovementModalProps {
  open: boolean;
  tenantId: string;
  userId: string | null;
  customer: Customer;
  onClose: () => void;
  onSuccess: () => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const QUICK_AMOUNT_PRESETS = [1000, 2000, 5000, 10000, 20000];

const QUICK_CONCEPT_PRESETS = [
  "Venta fiada de mostrador",
  "Mercadería entregada sin ticket",
  "Diferencia de saldo",
  "Pedido a domicilio / Envío",
  "Recargo / Interés acordado",
];

export const CustomerManualMovementModal = ({
  open,
  tenantId,
  userId,
  customer,
  onClose,
  onSuccess,
}: CustomerManualMovementModalProps) => {
  useBodyScrollLock(open);
  const toast = useToast();

  const [amountInput, setAmountInput] = useState("");
  const [concept, setConcept] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountRef = useRef<HTMLInputElement | null>(null);
  const conceptRef = useRef<HTMLInputElement | null>(null);

  // Limpiar y enfocar al abrir
  useEffect(() => {
    if (!open) return;
    setAmountInput("");
    setConcept("");
    setIsSubmitting(false);

    const timer = window.setTimeout(() => {
      amountRef.current?.focus();
      amountRef.current?.select();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Manejo de teclado global: Escape para salir
  useEffect(() => {
    if (!open) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [open, onClose]);

  const currentBalance = Number(customer?.current_balance ?? 0);

  const numericAmount = useMemo(() => {
    const clean = amountInput.replace(",", ".");
    const val = parseFloat(clean);
    return !isNaN(val) && val > 0 ? Number(val.toFixed(2)) : 0;
  }, [amountInput]);

  const projectedBalance = useMemo(() => {
    return Number((currentBalance + numericAmount).toFixed(2));
  }, [currentBalance, numericAmount]);

  const canSubmit = numericAmount > 0 && concept.trim().length > 0 && !isSubmitting;

  const handleAddPresetAmount = (preset: number) => {
    const current = numericAmount;
    const next = current + preset;
    setAmountInput(next.toString());
  };

  const handleSelectConceptPreset = (preset: string) => {
    setConcept(preset);
    conceptRef.current?.focus();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await currentAccountsService.createMovement(tenantId, {
        customer_id: customer.id,
        sale_id: null,
        type: "debt",
        amount: numericAmount,
        notes: concept.trim(),
        created_by: userId ?? null,
      });

      toast.success(`Deuda de ${currency.format(numericAmount)} registrada correctamente a ${customer.full_name}`);
      setAmountInput("");
      setConcept("");
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error al registrar deuda manual en CC:", err);
      toast.error("Error al registrar la deuda en cuenta corriente");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (numericAmount > 0) {
        conceptRef.current?.focus();
        conceptRef.current?.select();
      }
    }
  };

  const handleConceptKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canSubmit) {
        void handleSubmit();
      }
    }
  };

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabecera del modal */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 shadow-xs shrink-0">
              <Receipt size={20} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                CUENTA CORRIENTE › ADEUDAR MANUAL
              </span>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Cargar Deuda al Cliente
              </h3>
            </div>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        {/* Sub-tarjeta con información del cliente */}
        <div className="shrink-0 px-5 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2.5 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                {customer.full_name}
              </span>
              {customer.document_number && (
                <span className="font-mono text-slate-500 shrink-0">
                  ({customer.document_type ? `${customer.document_type.toUpperCase()} ` : ""}{customer.document_number})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-slate-500">Deuda actual:</span>
              <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold">
                {currency.format(currentBalance)}
              </strong>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Tarjetas KPI de proyección en vivo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-2.5 text-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate">
                Saldo Actual
              </span>
              <span className="text-xs sm:text-sm font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                {currency.format(currentBalance)}
              </span>
            </div>

            <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 p-2.5 text-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block truncate">
                + A Cargar
              </span>
              <span className="text-xs sm:text-sm font-black font-mono text-rose-700 dark:text-rose-300 mt-0.5 block truncate">
                +{currency.format(numericAmount)}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-2.5 text-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block truncate flex items-center justify-center gap-1">
                <TrendingUp size={11} className="text-rose-500" />
                <span>Nuevo Saldo</span>
              </span>
              <span className="text-xs sm:text-sm font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5 block truncate">
                {currency.format(projectedBalance)}
              </span>
            </div>
          </div>

          {/* Campo Monto a Adeudar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Monto a Adeudar ($) <span className="text-rose-600">*</span>
              </label>
              {numericAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountInput("")}
                  className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 dark:text-slate-500">
                <DollarSign size={18} />
              </div>
              <input
                ref={amountRef}
                type="number"
                step="0.01"
                min="0.01"
                required
                autoFocus
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                onKeyDown={handleAmountKeyDown}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                disabled={isSubmitting}
                className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 py-3 pl-10 pr-4 text-base sm:text-lg font-mono font-black text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-xs"
              />
            </div>

            {/* Accesos rápidos de monto */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
                Sumar:
              </span>
              {QUICK_AMOUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAddPresetAmount(preset)}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-200/90 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold font-mono text-slate-700 dark:text-slate-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 active:scale-95 transition cursor-pointer"
                >
                  +{currency.format(preset)}
                </button>
              ))}
            </div>
          </div>

          {/* Campo Concepto / Motivo */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Concepto / Motivo de la Deuda <span className="text-rose-600">*</span>
            </label>

            <input
              ref={conceptRef}
              type="text"
              required
              placeholder="Ej: Venta fiada de mostrador, mercadería retirada, etc."
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              onKeyDown={handleConceptKeyDown}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              disabled={isSubmitting}
              className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 shadow-xs"
            />

            {/* Chips de motivos frecuentes */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {QUICK_CONCEPT_PRESETS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleSelectConceptPreset(item)}
                  disabled={isSubmitting}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition cursor-pointer active:scale-95 ${
                    concept === item
                      ? "border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 font-bold"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Nota explicativa amigable */}
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed flex items-start gap-2">
            <PlusCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
            <span>
              Este movimiento suma saldo adeudado directamente a la cuenta del cliente sin afectar el stock de productos ni la caja física.
            </span>
          </div>

          {/* Botones de acción inferiores */}
          <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              disabled={isSubmitting}
            >
              Cancelar (Esc)
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-rose-500/25 transition active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Adeudando...</span>
                </>
              ) : numericAmount > 0 ? (
                <>
                  <Check size={14} strokeWidth={3} />
                  <span>Adeudar {currency.format(numericAmount)} (Enter)</span>
                </>
              ) : (
                <span>Ingresá un monto a adeudar</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
