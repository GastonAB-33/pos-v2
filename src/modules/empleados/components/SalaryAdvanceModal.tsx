import { useState, useEffect } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import type { Employee } from "@/types/entities";
import { DollarSign, Coins } from "lucide-react";

interface SalaryAdvanceModalProps {
  open: boolean;
  employees: Employee[];
  initialEmployee?: Employee | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: {
    employee_id: string;
    amount: number;
    payment_method_code: string;
    payment_date: string;
    period?: string;
    notes?: string;
  }) => Promise<boolean>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const getDefaultPeriod = (): string => {
  const date = new Date();
  const day = date.getDate();
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const quincena = day <= 15 ? "1ra Quincena" : "2da Quincena";
  return `Adelanto ${quincena} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

export const SalaryAdvanceModal = ({
  open,
  employees,
  initialEmployee,
  isSubmitting,
  onClose,
  onSubmit,
}: SalaryAdvanceModalProps) => {
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [period, setPeriod] = useState(getDefaultPeriod());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  const selectedEmployee = employees.find((e) => e.id === employeeId) || null;

  useEffect(() => {
    if (!open) return;
    const target = initialEmployee || employees[0];
    if (target) {
      setEmployeeId(target.id);
    }
    setAmount("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPeriod(getDefaultPeriod());
    setPaymentMethod("cash");
    setNotes("");
  }, [open, initialEmployee, employees]);

  if (!open) return null;

  const parsedAmount = parseFloat(amount.replace(",", ".")) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) {
      toast.error("Seleccioná un empleado");
      return;
    }

    if (parsedAmount <= 0) {
      toast.error("Ingresá un importe válido para el adelanto");
      return;
    }

    const success = await onSubmit({
      employee_id: selectedEmployee.id,
      amount: parsedAmount,
      payment_method_code: paymentMethod,
      payment_date: paymentDate,
      period: period.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-300 dark:border-slate-700 overflow-hidden dark:bg-slate-900">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-amber-50/60 dark:bg-amber-950/30">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                <Coins size={18} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Registrar Adelanto de Sueldo
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-10">
              Registrá anticipos de dinero entregados a cuenta de la próxima liquidación o quincena.
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Ficha Empleado Receptor (Informativa, sin dropdown redundante) */}
          {selectedEmployee && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-xs">
                {selectedEmployee.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {selectedEmployee.full_name}
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-slate-500 bg-slate-200/60 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                    {selectedEmployee.code}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {selectedEmployee.position || "Personal"} {selectedEmployee.base_salary ? `• Sueldo Base: ${currency.format(selectedEmployee.base_salary)}` : ""}
                </p>
              </div>
            </div>
          )}

          {/* Importe del Adelanto */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              Monto del Adelanto ($) *
            </label>
            <div className="relative">
              <DollarSign
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="number"
                step="any"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-9 pr-3 text-base font-bold font-mono text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Medio de Pago y Período / Referencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Medio de pago *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia Bancaria</option>
                <option value="mercado_pago">Mercado Pago / Billetera</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Período / Referencia
              </label>
              <input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Ej: Adelanto 1ra Quincena Octubre 2026"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Motivo u Observaciones */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              Motivo u Observaciones (opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Adelanto a cuenta solicitado por gastos imprevistos..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Resumen Visual del Adelanto */}
          {parsedAmount > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3.5">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Desembolso de Adelanto:
                </span>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Quedará registrado para deducirlo automáticamente en la liquidación quincenal.
                </p>
              </div>
              <span className="text-xl font-black font-mono text-amber-900 dark:text-amber-100">
                {currency.format(parsedAmount)}
              </span>
            </div>
          )}

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedAmount <= 0}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Registrando..." : "Confirmar Adelanto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
