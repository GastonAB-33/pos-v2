import { useState, useEffect, useMemo } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { useToast } from "@/components/ui/useToast";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { Employee, EmployeeSalaryPayment } from "@/types/entities";
import { Receipt, Coins, ChevronDown, ChevronUp } from "lucide-react";

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
  useBodyScrollLock(open);
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden dark:bg-slate-900 flex flex-col max-h-[92dvh] my-auto">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800 px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <div>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shrink-0">
                <Receipt size={18} />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Registrar Pago de Sueldo
              </h3>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 ml-10 sm:ml-11">
              Liquidá haberes con deducción automática de adelantos del período y compras en cuenta corriente.
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Contenido con Scroll */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Ficha Empleado Receptor y Período Liquidado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <div className="md:col-span-2">
              {selectedEmployee && (
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 font-bold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 text-xs">
                    {selectedEmployee.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {selectedEmployee.full_name}
                      </span>
                      <span className="font-mono text-[10px] font-semibold text-slate-500 bg-slate-200/60 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                        {selectedEmployee.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {selectedEmployee.position || "Personal"} • Sueldo base: {currency.format(selectedEmployee.base_salary)}
                    </p>
                  </div>
                </div>
              )}
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
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
          </div>

          {/* Bloque de Haberes (Base + Bonificaciones) */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              1. Haberes y Asignaciones
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sueldo Base Acordado ($) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Adicionales / Bonos / Horas Extras ($)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={bonuses}
                  onChange={(e) => setBonuses(e.target.value)}
                  placeholder="0.00"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-mono text-emerald-700 dark:text-emerald-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>

          {/* Bloque de Deducciones y Adelantos */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              2. Retenciones y Deducciones de Sueldo
            </span>

            {/* Sub-bloque 2.1: Deducción de Adelantos */}
            <div className="rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Coins size={14} className="text-amber-600 dark:text-amber-400" />
                  <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Deducir Adelantos / Anticipos Otorgados ($)
                  </label>
                </div>

                {recentAdvances.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAdvancesBreakdown(!showAdvancesBreakdown)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
                  >
                    <span>{recentAdvances.length} adelanto(s) detectado(s)</span>
                    {showAdvancesBreakdown ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={advancesDiscount}
                  onChange={(e) => setAdvancesDiscount(e.target.value)}
                  placeholder="0.00"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  className="w-full rounded-xl sm:rounded-2xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-mono font-bold text-amber-900 dark:text-amber-200 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />

                {totalRecentAdvances > 0 && (
                  <button
                    type="button"
                    onClick={() => setAdvancesDiscount(String(totalRecentAdvances))}
                    className="shrink-0 rounded-xl sm:rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200 transition cursor-pointer"
                    title="Aplicar el total de adelantos recientes registrados"
                  >
                    Cargar Total ({currency.format(totalRecentAdvances)})
                  </button>
                )}
              </div>

              {/* Desglose desplegable de adelantos recientes */}
              {showAdvancesBreakdown && recentAdvances.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-white dark:bg-slate-900/80 p-2.5 space-y-1.5 text-xs">
                  <p className="font-bold text-[10px] uppercase text-amber-800 dark:text-amber-400">
                    Historial de adelantos en el rango analizado:
                  </p>
                  <ul className="divide-y divide-amber-100 dark:divide-amber-950 text-slate-700 dark:text-slate-300">
                    {recentAdvances.map((adv) => (
                      <li key={adv.id} className="py-1 flex items-center justify-between">
                        <span className="font-mono text-[11px] text-slate-500">
                          {adv.payment_date} ({adv.period || "Adelanto"})
                        </span>
                        <span className="font-mono font-bold text-amber-800 dark:text-amber-200">
                          {currency.format(adv.net_amount_paid || adv.gross_amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Ventana de detección:</span>
                    <select
                      value={advancesLookbackDays}
                      onChange={(e) => setAdvancesLookbackDays(Number(e.target.value))}
                      className="rounded border border-amber-200 dark:border-amber-800 bg-transparent px-1 py-0.5 text-[10px]"
                    >
                      <option value={7}>Últimos 7 días</option>
                      <option value={14}>Últimos 14 días (quincenal)</option>
                      <option value={31}>Último mes (31 días)</option>
                      <option value={60}>Últimos 60 días</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Sub-bloque 2.2: Descuento por Cuenta Corriente y Otras retenciones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Desc. Cuenta Corriente ($)
                  </label>
                  {employeeDebt > 0 && (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                      Deuda: {currency.format(employeeDebt)}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={currentAccountDiscount}
                  onChange={(e) => setCurrentAccountDiscount(e.target.value)}
                  placeholder="0.00"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-mono text-rose-600 dark:text-rose-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Otras Retenciones / Aportes ($)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={otherDeductions}
                  onChange={(e) => setOtherDeductions(e.target.value)}
                  placeholder="0.00"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Total Neto Calculado */}
            <div className="flex items-center justify-between rounded-2xl bg-indigo-600 p-4 text-white shadow-xs">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">
                  Sueldo Neto a Pagar
                </span>
                <p className="text-[11px] text-indigo-200 mt-0.5">
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
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Medio de Pago *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="transfer">Transferencia Bancaria</option>
                <option value="cash">Efectivo</option>
                <option value="cheque">Cheque</option>
                <option value="mercado_pago">Mercado Pago / Billetera</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Fecha de Pago *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              Observaciones del Recibo / Pago
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle adicional de la liquidación o número de comprobante..."
              className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

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
              disabled={isSubmitting || parsedGross <= 0}
              className="rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 px-5 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              {isSubmitting ? "Registrando..." : "Confirmar Liquidación de Sueldo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};