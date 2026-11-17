import { useState, useEffect } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { Employee, EmployeeCurrentAccountCategory } from "@/types/entities";
import { PlusCircle, RefreshCw, DollarSign } from "lucide-react";

interface EmployeeManualMovementModalProps {
  open: boolean;
  employee: Employee;
  initialType?: "debt" | "payment" | "adjustment";
  onClose: () => void;
  onSubmit: (values: {
    amount: number;
    notes: string;
    category?: EmployeeCurrentAccountCategory;
  }) => Promise<boolean>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const EmployeeManualMovementModal = ({
  open,
  employee,
  initialType = "debt",
  onClose,
  onSubmit,
}: EmployeeManualMovementModalProps) => {
  useBodyScrollLock(open);
  const toast = useToast();
  const [movementType, setMovementType] = useState<"debt" | "payment" | "adjustment">(initialType);
  const [amount, setAmount] = useState("");
  const [concept, setConcept] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMovementType(initialType);
    }
  }, [initialType, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Ingresá un monto válido mayor a 0");
      return;
    }

    if (!concept.trim()) {
      toast.error("Ingresá un motivo o concepto para el movimiento");
      return;
    }

    setIsSubmitting(true);
    try {
      const category: EmployeeCurrentAccountCategory =
        movementType === "debt"
          ? "product_purchase"
          : movementType === "payment"
          ? "cash_payment"
          : "adjustment";

      const success = await onSubmit({
        amount: numAmount,
        notes: concept.trim(),
        category,
      });

      if (success) {
        toast.success(
          movementType === "debt"
            ? `Deuda de ${currency.format(numAmount)} registrada`
            : movementType === "payment"
            ? `Cobro de ${currency.format(numAmount)} registrado`
            : `Ajuste de ${currency.format(numAmount)} registrado`
        );
        setAmount("");
        setConcept("");
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-2.5 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800 flex flex-col max-h-[92dvh] my-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Movimiento en Cuenta Corriente
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Empleado: <strong className="text-slate-700 dark:text-slate-300">{employee.full_name}</strong> • Saldo actual: {currency.format(employee.current_balance ?? 0)}
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Tipo de Operación
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementType("debt")}
                  className={`flex items-center justify-center gap-1 rounded-xl border p-2 text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                    movementType === "debt"
                      ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  <PlusCircle size={13} />
                  <span>Reg. Deuda</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementType("payment")}
                  className={`flex items-center justify-center gap-1 rounded-xl border p-2 text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                    movementType === "payment"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  <DollarSign size={13} />
                  <span>Reg. Pago</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMovementType("adjustment")}
                  className={`flex items-center justify-center gap-1 rounded-xl border p-2 text-[11px] sm:text-xs font-bold transition cursor-pointer ${
                    movementType === "adjustment"
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  <RefreshCw size={13} />
                  <span>Ajuste</span>
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                {movementType === "debt"
                  ? "Registrar deuda directa en cuenta corriente (consumos de productos o deuda directa)."
                  : movementType === "payment"
                  ? "Registrar pago en cuenta corriente (cobro en caja, transferencia o abono directo)."
                  : "Ajusta o rectifica el saldo sin generar un comprobante de cobro."}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Importe ($) *
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Concepto / Motivo *
              </label>
              <input
                type="text"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder={
                  movementType === "debt"
                    ? "Ej: Retiro mercadería varios productos sin detallar"
                    : movementType === "payment"
                    ? "Ej: Cobro en efectivo saldo cuenta corriente"
                    : "Ej: Rectificación por error de carga"
                }
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount || !concept}
              className={`rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-xs transition cursor-pointer ${
                movementType === "debt"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : movementType === "payment"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {isSubmitting
                ? "Registrando..."
                : movementType === "debt"
                ? "Confirmar Deuda"
                : movementType === "payment"
                ? "Confirmar Pago"
                : "Confirmar Ajuste"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
