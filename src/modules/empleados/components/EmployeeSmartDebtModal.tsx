import { useEffect, useMemo, useRef, useState } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { employeeCurrentAccountsService } from "@/services/employee-current-accounts.service";
import type { Employee, EmployeeCurrentAccountCategory } from "@/types/entities";
import { PlusCircle, TrendingUp } from "lucide-react";

interface EmployeeSmartDebtModalProps {
  open: boolean;
  tenantId: string;
  userId: string | null;
  employee: Employee;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const QUICK_CONCEPT_PRESETS = [
  "Consumo de mercadería sin ticket",
  "Retiro de mercadería varios",
  "Diferencia de saldo en turno",
  "Anticipo de compra personal",
  "Gasto a cuenta de sueldo",
];

export const EmployeeSmartDebtModal = ({
  open,
  tenantId,
  userId,
  employee,
  onClose,
  onSuccess,
}: EmployeeSmartDebtModalProps) => {
  useBodyScrollLock(open);
  const toast = useToast();

  const [amountInput, setAmountInput] = useState("");
  const [concept, setConcept] = useState("");
  const [category] = useState<EmployeeCurrentAccountCategory>("product_purchase");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountRef = useRef<HTMLInputElement | null>(null);

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

  if (!open) return null;

  const currentBalance = Number(employee.current_balance ?? 0);

  const numericAmount = useMemo(() => {
    const clean = amountInput.replace(",", ".");
    const val = parseFloat(clean);
    return !isNaN(val) && val > 0 ? Number(val.toFixed(2)) : 0;
  }, [amountInput]);

  const projectedBalance = useMemo(() => {
    return Number((currentBalance + numericAmount).toFixed(2));
  }, [currentBalance, numericAmount]);

  const canSubmit = numericAmount > 0 && concept.trim().length > 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await employeeCurrentAccountsService.createMovement(tenantId, {
        employee_id: employee.id,
        type: "debt",
        amount: numericAmount,
        category,
        notes: concept.trim(),
        created_by: userId,
      });

      toast.success(
        `Deuda de ${currency.format(numericAmount)} registrada en la cuenta corriente de ${employee.full_name}`
      );
      await onSuccess();
      onClose();
    } catch (err) {
      console.error("Error al registrar deuda de empleado:", err);
      toast.error("Ocurrió un error al registrar la deuda en cuenta corriente");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden dark:bg-slate-900 flex flex-col max-h-[92dvh] my-auto">
        {/* Encabezado Fijo */}
        <div className="flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800 px-4 py-3 sm:px-6 sm:py-4 bg-rose-50/60 dark:bg-rose-950/30 shrink-0">
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl sm:rounded-2xl bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 shrink-0">
                <PlusCircle size={18} />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Registrar Deuda en Cuenta Corriente
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 ml-10 sm:ml-11">
              Empleado: <strong className="text-slate-700 dark:text-slate-200">{employee.full_name}</strong> • Saldo actual:{" "}
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currency.format(currentBalance)}</span>
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        {/* Formulario con Scroll Interno */}
        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Importe */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Importe de la Deuda ($) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400 font-mono">
                  $
                </span>
                <input
                  ref={amountRef}
                  type="number"
                  step="any"
                  min="0.01"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 pl-8 pr-4 text-xl font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  required
                />
              </div>
            </div>

            {/* Concepto / Motivo */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Motivo / Concepto del Movimiento *
              </label>
              <input
                type="text"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ej: Retiro mercadería turno noche"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                required
              />

              {/* Chips de conceptos predefinidos */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {QUICK_CONCEPT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setConcept(preset)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 transition cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Proyección de Saldo */}
            {numericAmount > 0 && (
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Saldo actual adeudado:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{currency.format(currentBalance)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  <span>+ Nueva deuda a registrar:</span>
                  <span className="font-mono font-bold">+{currency.format(numericAmount)}</span>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <TrendingUp size={13} className="text-rose-500" />
                    Nuevo saldo adeudado:
                  </span>
                  <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400">
                    {currency.format(projectedBalance)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Fijo */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-900 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 rounded-xl sm:rounded-2xl bg-rose-600 hover:bg-rose-700 px-5 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {isSubmitting ? "Registrando..." : "Confirmar Deuda en Cta. Cte."}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
