import { useState, useMemo } from "react";
import {
  DollarSign,
  Receipt,
  PlusCircle,
  Trash2,
  ShoppingBag,
  Coins,
} from "lucide-react";
import type { Employee, EmployeeSalaryPayment } from "@/types/entities";
import { SalaryPaymentModal } from "@/modules/empleados/components/SalaryPaymentModal";
import { SalaryAdvanceModal } from "@/modules/empleados/components/SalaryAdvanceModal";
import {
  isAdvancePayment,
  type SalaryPaymentFilterType,
  type SalaryDatePreset,
} from "@/modules/empleados/hooks/useEmployeeSalaryPayments";

interface SalaryPaymentsSectionProps {
  employees: Employee[];
  payments: EmployeeSalaryPayment[];
  filteredPayments: EmployeeSalaryPayment[];
  totalPaid: number;
  totalSalariesPaid?: number;
  totalAdvancesPaid?: number;
  totalCurrentAccountDiscounts: number;
  selectedEmployeeId: string;
  onSelectEmployeeId: (id: string) => void;
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  selectedType?: SalaryPaymentFilterType;
  onSelectType?: (type: SalaryPaymentFilterType) => void;
  datePreset?: SalaryDatePreset;
  onSelectDatePreset?: (preset: SalaryDatePreset) => void;
  customStartDate?: string;
  onSelectCustomStartDate?: (date: string) => void;
  customEndDate?: string;
  onSelectCustomEndDate?: (date: string) => void;
  canWrite: boolean;
  initialEmployeeForDisbursement?: Employee | null;
  onDisbursementModalClosed?: () => void;
  onCreateSalaryPayment: (values: {
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
  onCreateSalaryAdvance?: (values: {
    employee_id: string;
    amount: number;
    payment_method_code: string;
    payment_date: string;
    period?: string;
    notes?: string;
  }) => Promise<boolean>;
  onDeletePayment: (id: string) => Promise<boolean>;
  onBalanceUpdated: () => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const paymentMethodLabels: Record<string, string> = {
  transfer: "Transferencia",
  cash: "Efectivo",
  cheque: "Cheque",
  mercado_pago: "Mercado Pago",
};

export const SalaryPaymentsSection = ({
  employees,
  payments,
  filteredPayments,
  totalPaid,
  totalSalariesPaid,
  totalAdvancesPaid,
  totalCurrentAccountDiscounts,
  selectedEmployeeId,
  onSelectEmployeeId,
  selectedPeriod,
  onSelectPeriod,
  selectedType = "all",
  onSelectType,
  datePreset = "all",
  onSelectDatePreset,
  customStartDate = "",
  onSelectCustomStartDate,
  customEndDate = "",
  onSelectCustomEndDate,
  canWrite,
  initialEmployeeForDisbursement,
  onDisbursementModalClosed,
  onCreateSalaryPayment,
  onCreateSalaryAdvance,
  onDeletePayment,
  onBalanceUpdated,
}: SalaryPaymentsSectionProps) => {
  const [modalOpen, setModalOpen] = useState(Boolean(initialEmployeeForDisbursement));
  const [modalEmployee, setModalEmployee] = useState<Employee | null>(
    initialEmployeeForDisbursement || null
  );

  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceModalEmployee, setAdvanceModalEmployee] = useState<Employee | null>(null);

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  // Lista única de períodos con formato de texto
  const availableNamedPeriods = useMemo(
    () =>
      Array.from(
        new Set(
          payments
            .map((p) => p.period)
            .filter((p) => p && !p.toLowerCase().startsWith("adelanto"))
        )
      ),
    [payments]
  );

  // Cálculos de KPI de respaldo
  const computedAdvancesTotal = useMemo(() => {
    if (totalAdvancesPaid !== undefined) return totalAdvancesPaid;
    return filteredPayments
      .filter((p) => isAdvancePayment(p))
      .reduce((acc, p) => acc + (p.net_amount_paid || 0), 0);
  }, [totalAdvancesPaid, filteredPayments]);

  const computedSalariesTotal = useMemo(() => {
    if (totalSalariesPaid !== undefined) return totalSalariesPaid;
    return filteredPayments
      .filter((p) => !isAdvancePayment(p))
      .reduce((acc, p) => acc + (p.net_amount_paid || 0), 0);
  }, [totalSalariesPaid, filteredPayments]);

  const handleOpenSalaryModal = (employee?: Employee) => {
    const selected = employee || (selectedEmployeeId !== "all" ? employeeMap.get(selectedEmployeeId) : null);
    setModalEmployee(selected || null);
    setModalOpen(true);
  };

  const handleCloseSalaryModal = () => {
    setModalOpen(false);
    setModalEmployee(null);
    if (onDisbursementModalClosed) {
      onDisbursementModalClosed();
    }
  };

  const handleOpenAdvanceModal = (employee?: Employee) => {
    const selected = employee || (selectedEmployeeId !== "all" ? employeeMap.get(selectedEmployeeId) : null);
    setAdvanceModalEmployee(selected || null);
    setAdvanceModalOpen(true);
  };

  const handleDelete = async (payment: EmployeeSalaryPayment) => {
    const emp = employeeMap.get(payment.employee_id);
    const isAdv = isAdvancePayment(payment);
    const confirmed = window.confirm(
      `¿Eliminar el registro de ${isAdv ? "adelanto" : "liquidación"} de ${
        emp?.full_name || "empleado"
      } (${payment.period}) por ${currency.format(payment.net_amount_paid)}?`
    );
    if (!confirmed) return;
    await onDeletePayment(payment.id);
  };

  return (
    <div className="space-y-4">
      {/* 4 Tarjetas KPI Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total General Desembolsado */}
        <article className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Total Desembolsado
            </span>
            <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
            {currency.format(totalPaid)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Sueldos + adelantos en la vista actual
          </p>
        </article>

        {/* Total Adelantos */}
        <article className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
              Adelantos Otorgados
            </span>
            <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-black font-mono tracking-tight text-amber-950 dark:text-amber-100">
            {currency.format(computedAdvancesTotal)}
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-400">
            {filteredPayments.filter((p) => isAdvancePayment(p)).length} adelanto(s) en este período
          </p>
        </article>

        {/* Total Sueldos Liquidados */}
        <article className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
              Sueldos Liquidados
            </span>
            <Receipt className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-black font-mono tracking-tight text-indigo-950 dark:text-indigo-100">
            {currency.format(computedSalariesTotal)}
          </p>
          <p className="mt-1 text-xs text-indigo-800 dark:text-indigo-400">
            {filteredPayments.filter((p) => !isAdvancePayment(p)).length} liquidación(es) neta(s)
          </p>
        </article>

        {/* Descontado por Cta. Cte. */}
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
              Descontado por Cta. Cte.
            </span>
            <ShoppingBag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-black font-mono tracking-tight text-emerald-950 dark:text-emerald-100">
            {currency.format(totalCurrentAccountDiscounts)}
          </p>
          <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-400">
            Productos cobrados en recibos de sueldo
          </p>
        </article>
      </div>

      {/* Barra de Filtros y Acciones */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {/* Controles de Filtros */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filtro Empleado */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedEmployeeId}
              onChange={(e) => onSelectEmployeeId(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Todos los empleados</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo: Sueldos / Adelantos / Todos */}
          {onSelectType && (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedType}
                onChange={(e) => onSelectType(e.target.value as SalaryPaymentFilterType)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">Todos los tipos (Sueldos y Adelantos)</option>
                <option value="salary">Solo Pagos de Sueldo</option>
                <option value="advance">Solo Adelantos</option>
              </select>
            </div>
          )}

          {/* Filtro Período / Semanas */}
          {onSelectDatePreset && (
            <div className="flex items-center gap-1.5">
              <select
                value={datePreset}
                onChange={(e) => onSelectDatePreset(e.target.value as SalaryDatePreset)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">Todos los períodos</option>
                <option value="last_2_weeks">Últimas 2 semanas (Quincenal)</option>
                <option value="last_week">Última semana (7 días)</option>
                <option value="this_month">Este mes</option>
                <option value="last_month">Mes anterior</option>
                <option value="custom">Rango de fechas personalizado...</option>
              </select>
            </div>
          )}

          {/* Si se eligen fechas personalizadas */}
          {datePreset === "custom" && onSelectCustomStartDate && onSelectCustomEndDate && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => onSelectCustomStartDate(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-800 dark:text-slate-200"
                title="Fecha inicio"
              />
              <span className="text-xs text-slate-400">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => onSelectCustomEndDate(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-800 dark:text-slate-200"
                title="Fecha fin"
              />
            </div>
          )}

          {/* Filtro Período Específico por Nombre si hubiera */}
          {availableNamedPeriods.length > 0 && (
            <select
              value={selectedPeriod}
              onChange={(e) => onSelectPeriod(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="all">Cualquier liquidación nominal</option>
              {availableNamedPeriods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Botones de Acción */}
        {canWrite && (
          <div className="flex items-center gap-2 shrink-0">
            {onCreateSalaryAdvance && (
              <button
                type="button"
                onClick={() => handleOpenAdvanceModal()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition cursor-pointer"
              >
                <Coins size={14} />
                <span>+ Registrar Adelanto</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenSalaryModal()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition cursor-pointer"
            >
              <PlusCircle size={14} />
              <span>Registrar Pago de Sueldo</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabla de Pagos de Sueldo y Adelantos */}
      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
              <tr>
                <th className="py-3 px-3.5">Fecha</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3.5">Empleado</th>
                <th className="py-3 px-3.5">Período / Referencia</th>
                <th className="py-3 px-3.5 text-right">Monto / Base</th>
                <th className="py-3 px-3 text-right">Adicionales</th>
                <th className="py-3 px-3 text-right">Adelantos Deducidos</th>
                <th className="py-3 px-3 text-right">Desc. Cta Cte</th>
                <th className="py-3 px-3.5 text-right font-black">Neto Desembolsado</th>
                <th className="py-3 px-3">Medio de Pago</th>
                <th className="py-3 px-3.5">Notas / Observaciones</th>
                <th className="py-3 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <p className="font-semibold text-sm">No hay registros de sueldos o adelantos con los filtros seleccionados.</p>
                    <p className="text-xs text-slate-400 mt-1">Probá cambiando el rango de fechas o el empleado seleccionado.</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const emp = employeeMap.get(p.employee_id);
                  const isAdv = isAdvancePayment(p);
                  const hasCtaCteDiscount = p.current_account_discount_applied > 0;
                  const hasAdvanceDiscount = (p.advances_discount_applied ?? 0) > 0;

                  return (
                    <tr
                      key={p.id}
                      className={`transition ${
                        isAdv
                          ? "bg-amber-50/20 hover:bg-amber-50/40 dark:bg-amber-950/10 dark:hover:bg-amber-950/20"
                          : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="py-3 px-3.5 font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {p.payment_date}
                      </td>

                      {/* Tipo: Adelanto vs Sueldo */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isAdv ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2 py-0.5 text-[10px] font-bold">
                            <Coins size={11} />
                            Adelanto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 text-[10px] font-bold">
                            <Receipt size={11} />
                            Sueldo
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3.5">
                        <span className="block font-bold text-slate-900 dark:text-slate-100">
                          {emp?.full_name || "Desconocido"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {emp?.position || "Personal"}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 font-semibold text-slate-800 dark:text-slate-200">
                        {p.period}
                      </td>

                      <td className="py-3 px-3.5 text-right font-mono font-semibold">
                        {currency.format(p.gross_amount)}
                      </td>

                      {/* Adicionales */}
                      <td className="py-3 px-3 text-right font-mono">
                        {isAdv ? (
                          <span className="text-slate-400">-</span>
                        ) : (p.bonuses_amount || 0) > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            +{currency.format(p.bonuses_amount)}
                          </span>
                        ) : (
                          <span className="text-slate-400">$0,00</span>
                        )}
                      </td>

                      {/* Adelantos Deducidos */}
                      <td className="py-3 px-3 text-right font-mono">
                        {isAdv ? (
                          <span className="text-slate-400">-</span>
                        ) : hasAdvanceDiscount ? (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            -{currency.format(p.advances_discount_applied!)}
                          </span>
                        ) : (
                          <span className="text-slate-400">$0,00</span>
                        )}
                      </td>

                      {/* Desc Cta Cte */}
                      <td className="py-3 px-3 text-right font-mono">
                        {isAdv ? (
                          <span className="text-slate-400">-</span>
                        ) : hasCtaCteDiscount ? (
                          <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                            -{currency.format(p.current_account_discount_applied)}
                          </span>
                        ) : (
                          <span className="text-slate-400">$0,00</span>
                        )}
                      </td>

                      {/* Neto Desembolsado */}
                      <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900 dark:text-white text-sm whitespace-nowrap">
                        {currency.format(p.net_amount_paid)}
                      </td>

                      {/* Medio de Pago */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {paymentMethodLabels[p.payment_method_code] || p.payment_method_code}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={p.notes || ""}>
                        {p.notes || "-"}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition cursor-pointer"
                            title={isAdv ? "Eliminar adelanto" : "Eliminar liquidación"}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Liquidación de Sueldo */}
      {modalOpen && (
        <SalaryPaymentModal
          open={modalOpen}
          employees={employees}
          initialEmployee={modalEmployee}
          payments={payments}
          onClose={handleCloseSalaryModal}
          onSubmit={async (values) => {
            const ok = await onCreateSalaryPayment(values);
            if (ok) {
              onBalanceUpdated();
              handleCloseSalaryModal();
            }
            return ok;
          }}
        />
      )}

      {/* Modal de Registro de Adelanto */}
      {advanceModalOpen && onCreateSalaryAdvance && (
        <SalaryAdvanceModal
          open={advanceModalOpen}
          employees={employees}
          initialEmployee={advanceModalEmployee}
          onClose={() => {
            setAdvanceModalOpen(false);
            setAdvanceModalEmployee(null);
          }}
          onSubmit={async (values) => {
            const ok = await onCreateSalaryAdvance(values);
            if (ok) {
              onBalanceUpdated();
              setAdvanceModalOpen(false);
              setAdvanceModalEmployee(null);
            }
            return ok;
          }}
        />
      )}
    </div>
  );
};
