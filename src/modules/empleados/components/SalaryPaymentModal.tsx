import { useState, useEffect, useMemo } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import type { Employee, EmployeeSalaryPayment } from "@/types/entities";
import { Receipt, AlertCircle, Coins, ChevronDown, ChevronUp } from "lucide-react";

interface SalaryPaymentModalProps {
  open: boolean;
  employees: Employee[];
  initialEmployee?: Employee | null;
  payments?: EmployeeSalaryPayment[];
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: {
    employee_id: string;
    period: string;
    gross_amount: number;
    deductions_amount: number;
    current_account_discount_applied: number;
    advances_discount_applied?: number;
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
  return `${quincena} - ${months[date.getMonth()]} ${date.getFullYear()}`;
};

export const SalaryPaymentModal = ({
  open,
  employees,
  initialEmployee,
  payments = [],
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
  const [advancesDiscount, setAdvancesDiscount] = useState("");
  const [currentAccountDiscount, setCurrentAccountDiscount] = useState("");
  const [otherDeductions, setOtherDeductions] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [notes, setNotes] = useState("");
  const [advancesLookbackDays, setAdvancesLookbackDays] = useState<number>(14);
  const [showAdvancesBreakdown, setShowAdvancesBreakdown] = useState(false);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) || null,
    [employees, employeeId]
  );

  // Buscar adelantos registrados para este empleado en el período configurado (ej: últimas 2 semanas)
  const recentAdvances = useMemo(() => {
    if (!employeeId || !payments.length) return [];
    const now = new Date();
    const minDateStr = new Date(now.getTime() - advancesLookbackDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    return payments.filter((p) => {
      if (p.employee_id !== employeeId) return false;
      const isAdv =
        p.payment_type === "advance" ||
        p.notes?.startsWith("[ADELANTO]") ||
        p.period?.toLowerCase().includes("adelanto");
      if (!isAdv) return false;
      if (p.payment_date && p.payment_date < minDateStr) return false;
      return true;
    });
  }, [employeeId, payments, advancesLookbackDays]);

  const totalRecentAdvances = useMemo(() => {
    return recentAdvances.reduce((sum, a) => sum + (a.net_amount_paid || a.gross_amount || 0), 0);
  }, [recentAdvances]);

  useEffect(() => {
    if (!open) return;

    const target = initialEmployee || employees[0];
    if (target) {
      setEmployeeId(target.id);
      setGrossAmount(target.base_salary ? String(target.base_salary) : "0");
      const debt = (target.current_balance ?? 0) > 0 ? target.current_balance : 0;
      setCurrentAccountDiscount(debt > 0 ? String(debt) : "0");
    }
    setPeriod(getCurrentMonthPeriod());
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setBonuses("0");
    setOtherDeductions("0");
    setNotes("");
  }, [open, initialEmployee, employees]);

  // Si hay adelantos recientes detectados al cambiar de empleado, precargar o sugerir
  useEffect(() => {
    if (totalRecentAdvances > 0) {
      setAdvancesDiscount(String(totalRecentAdvances));
    } else {
      setAdvancesDiscount("0");
    }
  }, [totalRecentAdvances, employeeId]);

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
  const parsedAdvancesDiscount = parseFloat(advancesDiscount.replace(",", ".")) || 0;
  const parsedCtaCteDiscount = parseFloat(currentAccountDiscount.replace(",", ".")) || 0;
  const parsedOtherDeductions = parseFloat(otherDeductions.replace(",", ".")) || 0;

  const totalDeductions = parsedAdvancesDiscount + parsedCtaCteDiscount + parsedOtherDeductions;
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

    let composedNotes = notes.trim();
    const deductionsBreakdownParts: string[] = [];
    if (parsedAdvancesDiscount > 0) {
      deductionsBreakdownParts.push(`Adelantos deducidos: ${currency.format(parsedAdvancesDiscount)}`);
    }
    if (parsedCtaCteDiscount > 0) {
      deductionsBreakdownParts.push(`Desc. Cta Cte: ${currency.format(parsedCtaCteDiscount)}`);
    }
    if (deductionsBreakdownParts.length > 0) {
      composedNotes = composedNotes
        ? `${composedNotes} [${deductionsBreakdownParts.join(" • ")}]`
        : `[${deductionsBreakdownParts.join(" • ")}]`;
    }

    const success = await onSubmit({
      employee_id: selectedEmployee.id,
      period: period.trim(),
      gross_amount: parsedGross,
      deductions_amount: totalDeductions,
      current_account_discount_applied: parsedCtaCteDiscount,
      advances_discount_applied: parsedAdvancesDiscount,
      bonuses_amount: parsedBonuses,
      net_amount_paid: netAmount,
      payment_method_code: paymentMethod,
      payment_date: paymentDate,
      notes: composedNotes || undefined,
    });

    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-300 dark:border-slate-700 overflow-hidden dark:bg-slate-900">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/50">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
                <Receipt size={18} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Registrar Pago de Sueldo
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-10">
              Liquidá haberes con deducción automática de adelantos del período y compras en cuenta corriente.
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Selección de Empleado y Periodo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Empleado *
              </label>
              <select
                value={employeeId}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                required
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.position || "Personal"}) - Deuda Cta Cte: {currency.format(emp.current_balance ?? 0)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Período Liquidado *
              </label>
              <input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Ej: 1ra Quincena Octubre 2026"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* ALERTA 1: Adelantos Entregados en el Período */}
          <div className="rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 p-3.5 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Coins size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Adelantos registrados: <span className="font-mono text-sm">{currency.format(totalRecentAdvances)}</span>
                    </p>
                    <select
                      value={advancesLookbackDays}
                      onChange={(e) => setAdvancesLookbackDays(Number(e.target.value))}
                      className="rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-200 cursor-pointer"
                    >
                      <option value={14}>Últimas 2 semanas (Quincena)</option>
                      <option value={7}>Última semana (7 días)</option>
                      <option value={30}>Último mes (30 días)</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    {recentAdvances.length === 0
                      ? "No se registraron adelantos en este período."
                      : `${recentAdvances.length} adelanto(s) entregado(s) en este período.`}
                  </p>
                </div>
              </div>

              {totalRecentAdvances > 0 && (
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowAdvancesBreakdown(!showAdvancesBreakdown)}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 dark:border-amber-700 px-2 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 cursor-pointer"
                  >
                    <span>Ver detalle</span>
                    {showAdvancesBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvancesDiscount(String(totalRecentAdvances))}
                    className="rounded-lg bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow-2xs cursor-pointer"
                  >
                    Descontar adelantos
                  </button>
                </div>
              )}
            </div>

            {/* Desglose desplegable de adelantos del período */}
            {showAdvancesBreakdown && recentAdvances.length > 0 && (
              <div className="pt-2 border-t border-amber-200 dark:border-amber-800/80 space-y-1.5 text-xs">
                {recentAdvances.map((adv) => (
                  <div
                    key={adv.id}
                    className="flex items-center justify-between rounded-lg bg-white/70 dark:bg-slate-900/70 p-2 border border-amber-200 dark:border-amber-900/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-500">{adv.payment_date}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{adv.period}</span>
                      {adv.notes && (
                        <span className="text-[11px] text-slate-500 italic max-w-xs truncate">
                          ({adv.notes})
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                      {currency.format(adv.net_amount_paid || adv.gross_amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ALERTA 2: Deuda en Cuenta Corriente (Retiro de Productos) */}
          {selectedEmployee && employeeDebt > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-rose-300 dark:border-rose-900/80 bg-rose-50/80 dark:bg-rose-950/30 p-3.5">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    Productos pendientes en Cuenta Corriente: <span className="font-mono text-sm">{currency.format(employeeDebt)}</span>
                  </p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400">
                    Podés descontar la totalidad o parte de esta deuda en este pago de sueldo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentAccountDiscount(String(employeeDebt))}
                className="shrink-0 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs hover:bg-rose-700 cursor-pointer"
              >
                Descontar todo
              </button>
            </div>
          )}

          {/* Desglose de Haberes y Deducciones */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 border-b pb-1 dark:border-slate-700">
              Cálculo de Haberes y Descuentos
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sueldo Base */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Sueldo Base ($) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bold font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Bonos / Horas Extras */}
              <div>
                <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                  Adicionales / Bonos / Horas Extras ($)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={bonuses}
                  onChange={(e) => setBonuses(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Deducción de Adelantos */}
              <div>
                <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                  Descuento por Adelantos entregados ($)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={advancesDiscount}
                  onChange={(e) => setAdvancesDiscount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 px-3 py-2 text-sm font-bold font-mono text-amber-800 dark:text-amber-300 focus:border-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400">
                  Anticipos en efectivo o transferencia ya otorgados durante la quincena.
                </span>
              </div>

              {/* Descuento Cuenta Corriente */}
              <div>
                <label className="block text-xs font-bold text-rose-700 dark:text-rose-400 mb-1">
                  Descuento por Cuenta Corriente (Productos) ($)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={currentAccountDiscount}
                  onChange={(e) => setCurrentAccountDiscount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 px-3 py-2 text-sm font-bold font-mono text-rose-800 dark:text-rose-300 focus:border-rose-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400">
                  Descuenta automáticamente el saldo deudor de mercadería del empleado.
                </span>
              </div>

              {/* Otras Deducciones */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Otras Deducciones / Retenciones ($)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={otherDeductions}
                  onChange={(e) => setOtherDeductions(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
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
                  (Base: {currency.format(parsedGross)}
                  {parsedBonuses > 0 ? ` + Adic: ${currency.format(parsedBonuses)}` : ""}
                  {parsedAdvancesDiscount > 0 ? ` - Adelantos: ${currency.format(parsedAdvancesDiscount)}` : ""}
                  {parsedCtaCteDiscount > 0 ? ` - Cta. Cte: ${currency.format(parsedCtaCteDiscount)}` : ""}
                  {parsedOtherDeductions > 0 ? ` - Otros: ${currency.format(parsedOtherDeductions)}` : ""})
                </p>
              </div>
              <span className="text-2xl font-black font-mono tracking-tight">
                {currency.format(netAmount)}
              </span>
            </div>
          </div>

          {/* Medio de Pago y Fecha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Medio de Pago *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                <option value="transfer">Transferencia Bancaria</option>
                <option value="cash">Efectivo</option>
                <option value="cheque">Cheque</option>
                <option value="mercado_pago">Mercado Pago / Billetera</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Fecha de Pago *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              Observaciones del Recibo / Pago
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle adicional de la liquidación o número de comprobante..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedGross <= 0}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Registrando..." : "Confirmar Liquidación de Sueldo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
