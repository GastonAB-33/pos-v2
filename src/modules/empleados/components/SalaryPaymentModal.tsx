import { useState, useEffect, useMemo } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import type { Employee } from "@/types/entities";
import { Receipt, AlertCircle } from "lucide-react";

interface SalaryPaymentModalProps {
  open: boolean;
  employees: Employee[];
  initialEmployee?: Employee | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: {
    employee_id: string;
    period: string;
    gross_amount: number;
    deductions_amount: number;
    current_account_discount_applied: number;
    bonuses_amount: number;
    net_amount_paid: number;
    payment_method_code: string;
    payment_date: string;
    notes?: string;
  }) => Promise<boolean>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const getCurrentMonthPeriod = (): string => {
  const date = new Date();
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
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
};

export const SalaryPaymentModal = ({
  open,
  employees,
  initialEmployee,
  isSubmitting,
  onClose,
  onSubmit,
}: SalaryPaymentModalProps) => {
  const toast = useToast();
  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState(getCurrentMonthPeriod());
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [grossAmount, setGrossAmount] = useState("");
  const [bonuses, setBonuses] = useState("");
  const [currentAccountDiscount, setCurrentAccountDiscount] = useState("");
  const [otherDeductions, setOtherDeductions] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [notes, setNotes] = useState("");

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) || null,
    [employees, employeeId]
  );

  useEffect(() => {
    if (!open) return;

    const target = initialEmployee || employees[0];
    if (target) {
      setEmployeeId(target.id);
      setGrossAmount(target.base_salary ? String(target.base_salary) : "0");
      // Si el empleado tiene deuda en cuenta corriente por productos, sugerir descuento
      const debt = (target.current_balance ?? 0) > 0 ? target.current_balance : 0;
      setCurrentAccountDiscount(debt > 0 ? String(debt) : "0");
    }
    setPeriod(getCurrentMonthPeriod());
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setBonuses("0");
    setOtherDeductions("0");
    setNotes("");
  }, [open, initialEmployee, employees]);

  // Cuando cambia el empleado seleccionado
  const handleEmployeeChange = (id: string) => {
    setEmployeeId(id);
    const emp = employees.find((e) => e.id === id);
    if (emp) {
      setGrossAmount(emp.base_salary ? String(emp.base_salary) : "0");
      const debt = (emp.current_balance ?? 0) > 0 ? emp.current_balance : 0;
      setCurrentAccountDiscount(debt > 0 ? String(debt) : "0");
    }
  };

  const parsedGross = parseFloat(grossAmount.replace(",", ".")) || 0;
  const parsedBonuses = parseFloat(bonuses.replace(",", ".")) || 0;
  const parsedCtaCteDiscount = parseFloat(currentAccountDiscount.replace(",", ".")) || 0;
  const parsedOtherDeductions = parseFloat(otherDeductions.replace(",", ".")) || 0;

  const totalDeductions = parsedCtaCteDiscount + parsedOtherDeductions;
  const netAmount = Math.max(0, parsedGross + parsedBonuses - totalDeductions);

  const employeeDebt = Math.max(0, selectedEmployee?.current_balance ?? 0);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    if (parsedGross <= 0) {
      toast.error("Ingresá un sueldo base válido");
      return;
    }

    if (parsedCtaCteDiscount > employeeDebt && employeeDebt > 0) {
      const confirmed = window.confirm(
        `El descuento por cuenta corriente (${currency.format(
          parsedCtaCteDiscount
        )}) es mayor que la deuda actual del empleado (${currency.format(
          employeeDebt
        )}). El empleado quedará con saldo a favor. ¿Deseás continuar?`
      );
      if (!confirmed) return;
    }

    const success = await onSubmit({
      employee_id: selectedEmployee.id,
      period: period.trim(),
      gross_amount: parsedGross,
      deductions_amount: totalDeductions,
      current_account_discount_applied: parsedCtaCteDiscount,
      bonuses_amount: parsedBonuses,
      net_amount_paid: netAmount,
      payment_method_code: paymentMethod,
      payment_date: paymentDate,
      notes: notes.trim() || undefined,
    });

    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Registrar Pago de Sueldo
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Liquidá haberes con descuento automático de consumos en cuenta corriente.
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Selección de Empleado y Periodo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Empleado *
              </label>
              <select
                value={employeeId}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.position}) - Deuda Cta Cte: {currency.format(emp.current_balance ?? 0)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Período Liquidado *
              </label>
              <input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Ej: Septiembre 2026"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
              />
            </div>
          </div>

          {/* Información de Deuda en Cuenta Corriente del Empleado */}
          {selectedEmployee && employeeDebt > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 dark:border-rose-900/60 dark:bg-rose-950/30">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    Consumos / Productos pendientes en Cuenta Corriente: {currency.format(employeeDebt)}
                  </p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400">
                    Podés descontar la totalidad o parte de esta deuda en este pago de sueldo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentAccountDiscount(String(employeeDebt))}
                className="shrink-0 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
              >
                Descontar todo
              </button>
            </div>
          )}

          {/* Desglose de Haberes y Deducciones */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b pb-1 dark:border-slate-700">
              Cálculo de Haberes y Descuentos
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sueldo Base */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sueldo Base ($) *
                </label>
                <input
                  type="text"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  required
                />
              </div>

              {/* Bonos / Horas Extras */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Adicionales / Bonos / Horas Extras ($)
                </label>
                <input
                  type="text"
                  value={bonuses}
                  onChange={(e) => setBonuses(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Descuento Cuenta Corriente */}
              <div>
                <label className="block text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">
                  Descuento por Cuenta Corriente ($)
                </label>
                <input
                  type="text"
                  value={currentAccountDiscount}
                  onChange={(e) => setCurrentAccountDiscount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-rose-300 bg-rose-50/40 px-3 py-2 text-sm font-bold text-rose-800 focus:border-rose-500 focus:outline-none dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300"
                />
                <span className="text-[10px] text-slate-400">
                  Al confirmar, se descontará automáticamente del saldo deudor del empleado.
                </span>
              </div>

              {/* Otras Deducciones */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Otras Deducciones / Retenciones ($)
                </label>
                <input
                  type="text"
                  value={otherDeductions}
                  onChange={(e) => setOtherDeductions(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Total Neto Calculado */}
            <div className="flex items-center justify-between rounded-xl bg-indigo-600 p-4 text-white shadow-md">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">
                  Sueldo Neto a Pagar
                </span>
                <p className="text-[11px] text-indigo-200">
                  (Base: {currency.format(parsedGross)} + Adic: {currency.format(parsedBonuses)} -
                  Desc. Cta. Cte: {currency.format(parsedCtaCteDiscount)} - Otros:{" "}
                  {currency.format(parsedOtherDeductions)})
                </p>
              </div>
              <span className="text-2xl font-bold tracking-tight">
                {currency.format(netAmount)}
              </span>
            </div>
          </div>

          {/* Medio de Pago y Fecha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Medio de Pago *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="transfer">Transferencia Bancaria</option>
                <option value="cash">Efectivo</option>
                <option value="cheque">Cheque</option>
                <option value="mercado_pago">Mercado Pago / Billetera</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fecha de Pago *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observaciones del Recibo / Pago
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle adicional de la liquidación o número de comprobante..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedGross <= 0}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {isSubmitting ? "Registrando..." : "Confirmar y Registrar Pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
