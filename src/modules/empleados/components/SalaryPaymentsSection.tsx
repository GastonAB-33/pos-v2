import { useState } from "react";
import {
  DollarSign,
  Receipt,
  PlusCircle,
  Trash2,
  ShoppingBag,
} from "lucide-react";
import type { Employee, EmployeeSalaryPayment } from "@/types/entities";
import { SalaryPaymentModal } from "@/modules/empleados/components/SalaryPaymentModal";

interface SalaryPaymentsSectionProps {
  employees: Employee[];
  payments: EmployeeSalaryPayment[];
  filteredPayments: EmployeeSalaryPayment[];
  totalPaid: number;
  totalCurrentAccountDiscounts: number;
  selectedEmployeeId: string;
  onSelectEmployeeId: (id: string) => void;
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  canWrite: boolean;
  initialEmployeeForDisbursement?: Employee | null;
  onDisbursementModalClosed?: () => void;
  onCreateSalaryPayment: (values: {
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
  totalCurrentAccountDiscounts,
  selectedEmployeeId,
  onSelectEmployeeId,
  selectedPeriod,
  onSelectPeriod,
  canWrite,
  initialEmployeeForDisbursement,
  onDisbursementModalClosed,
  onCreateSalaryPayment,
  onDeletePayment,
  onBalanceUpdated,
}: SalaryPaymentsSectionProps) => {
  const [modalOpen, setModalOpen] = useState(Boolean(initialEmployeeForDisbursement));
  const [modalEmployee, setModalEmployee] = useState<Employee | null>(
    initialEmployeeForDisbursement || null
  );

  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  // Obtener lista única de períodos para el filtro
  const availablePeriods = Array.from(new Set(payments.map((p) => p.period)));

  const handleOpenModal = (employee?: Employee) => {
    setModalEmployee(employee || null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalEmployee(null);
    if (onDisbursementModalClosed) {
      onDisbursementModalClosed();
    }
  };

  const handleDelete = async (payment: EmployeeSalaryPayment) => {
    const emp = employeeMap.get(payment.employee_id);
    const confirmed = window.confirm(
      `¿Eliminar el registro de pago de sueldo de ${emp?.full_name || "empleado"} correspondiente a ${payment.period}?`
    );
    if (!confirmed) return;
    await onDeletePayment(payment.id);
  };

  return (
    <div className="space-y-4">
      {/* 3 Tarjetas KPI Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <article className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm dark:border-indigo-900/60 dark:bg-indigo-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
              Total Neto Desembolsado
            </span>
            <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100">
            {currency.format(totalPaid)}
          </p>
          <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-400">
            Sueldos netos pagados al personal
          </p>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Descontado por Cta. Cte.
            </span>
            <ShoppingBag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100">
            {currency.format(totalCurrentAccountDiscounts)}
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
            Productos y anticipos deducidos del sueldo
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-300">
              Recibos Registrados
            </span>
            <Receipt className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {filteredPayments.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Liquidaciones en la vista actual
          </p>
        </article>
      </div>

      {/* Barra de Filtros y Acción de Pago */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Empleado */}
          <select
            value={selectedEmployeeId}
            onChange={(e) => onSelectEmployeeId(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">Todos los empleados</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>

          {/* Filtro Periodo */}
          <select
            value={selectedPeriod}
            onChange={(e) => onSelectPeriod(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">Todos los períodos</option>
            {availablePeriods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            <PlusCircle size={14} />
            <span>Registrar Pago de Sueldo</span>
          </button>
        )}
      </div>

      {/* Tabla de Pagos de Sueldo */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4">Fecha Pago</th>
                <th className="py-3 px-4">Empleado</th>
                <th className="py-3 px-4">Período</th>
                <th className="py-3 px-4 text-right">Sueldo Base</th>
                <th className="py-3 px-4 text-right">Adicionales</th>
                <th className="py-3 px-4 text-right">Desc. Cta Cte</th>
                <th className="py-3 px-4 text-right">Neto Pagado</th>
                <th className="py-3 px-4">Medio de Pago</th>
                <th className="py-3 px-4">Notas / Observaciones</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    No hay liquidaciones o pagos de sueldo registrados con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const emp = employeeMap.get(p.employee_id);
                  const hasCtaCteDiscount = p.current_account_discount_applied > 0;

                  return (
                    <tr
                      key={p.id}
                      className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-600 dark:text-slate-400">
                        {p.payment_date}
                      </td>

                      <td className="py-3 px-4">
                        <span className="block font-bold text-slate-900 dark:text-slate-100">
                          {emp?.full_name || "Desconocido"}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {emp?.position}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {p.period}
                      </td>

                      <td className="py-3 px-4 text-right font-mono">
                        {currency.format(p.gross_amount)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        +{currency.format(p.bonuses_amount || 0)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono">
                        {hasCtaCteDiscount ? (
                          <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                            -{currency.format(p.current_account_discount_applied)}
                          </span>
                        ) : (
                          <span className="text-slate-400">$0,00</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {currency.format(p.net_amount_paid)}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {paymentMethodLabels[p.payment_method_code] || p.payment_method_code}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {p.notes || "-"}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                            title="Eliminar liquidación"
                          >
                            <Trash2 size={13} />
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

      {modalOpen && (
        <SalaryPaymentModal
          open={modalOpen}
          employees={employees}
          initialEmployee={modalEmployee}
          onClose={handleCloseModal}
          onSubmit={async (values) => {
            const ok = await onCreateSalaryPayment(values);
            if (ok) {
              onBalanceUpdated();
              handleCloseModal();
            }
            return ok;
          }}
        />
      )}
    </div>
  );
};
