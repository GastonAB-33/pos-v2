import { useState } from "react";
import {
  ArrowLeft,
  DollarSign,
  PlusCircle,
  RefreshCw,
  ShoppingBag,
  Receipt,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { Employee, EmployeeCurrentAccountCategory } from "@/types/entities";
import { useEmployeeCurrentAccount } from "@/modules/empleados/hooks/useEmployeeCurrentAccount";
import { EmployeeManualMovementModal } from "@/modules/empleados/components/EmployeeManualMovementModal";
import { EmployeeProductConsumptionModal } from "@/modules/empleados/components/EmployeeProductConsumptionModal";

interface EmployeeCurrentAccountPanelProps {
  tenantId: string;
  userId: string | null;
  employee: Employee;
  canWrite: boolean;
  onClose: () => void;
  onBalanceUpdated: () => void;
  onOpenSalaryDisbursement?: (employee: Employee) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const categoryLabels: Record<EmployeeCurrentAccountCategory, { label: string; color: string }> = {
  product_purchase: {
    label: "Retiro Productos",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900",
  },
  salary_deduction: {
    label: "Descuento Sueldo",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  },
  advance: {
    label: "Anticipo / Vale",
    color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  },
  cash_payment: {
    label: "Pago Directo",
    color: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900",
  },
  adjustment: {
    label: "Ajuste",
    color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
  other: {
    label: "Otro",
    color: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
};

export const EmployeeCurrentAccountPanel = ({
  tenantId,
  userId,
  employee,
  canWrite,
  onClose,
  onBalanceUpdated,
  onOpenSalaryDisbursement,
}: EmployeeCurrentAccountPanelProps) => {
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualType, setManualType] = useState<"debt" | "payment" | "adjustment">("debt");
  const [productModalOpen, setProductModalOpen] = useState(false);

  const {
    movements,
    balance,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    registerDebt,
    registerPayment,
    registerAdjustment,
    recalculate,
  } = useEmployeeCurrentAccount(tenantId, employee, userId);

  const hasDebt = balance > 0;
  const hasCredit = balance < 0;

  const handleManualSubmit = async (values: {
    amount: number;
    notes: string;
    category?: EmployeeCurrentAccountCategory;
  }) => {
    let ok = false;
    if (manualType === "debt") {
      ok = await registerDebt(values);
    } else if (manualType === "payment") {
      ok = await registerPayment(values);
    } else {
      ok = await registerAdjustment(values);
    }
    if (ok) {
      onBalanceUpdated();
    }
    return ok;
  };

  const handleProductSubmit = async (values: {
    amount: number;
    notes: string;
    category: "product_purchase";
  }) => {
    const ok = await registerDebt(values);
    if (ok) {
      onBalanceUpdated();
    }
    return ok;
  };

  const handleRecalculate = async () => {
    await recalculate();
    onBalanceUpdated();
  };

  return (
    <section className="current-account-detail ui-card space-y-4">
      {/* Barra de navegación superior con botón Volver */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <ArrowLeft size={14} />
          <span>Volver al listado de cuentas corrientes</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={isSubmitting || isLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            title="Recalcular saldo acumulado a partir de todos los movimientos históricos"
          >
            <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
            <span>Recalcular Saldo</span>
          </button>

          <IconButton
            icon={RefreshCw}
            label="Recargar cuenta corriente"
            onClick={() => {
              clearFeedback();
              void reload();
            }}
            loading={isLoading}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Encabezado y Saldo Destacado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              {employee.full_name.charAt(0).toUpperCase()}
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {employee.full_name}
              </h3>
              <p className="text-xs text-slate-500">
                Legajo: <span className="font-mono font-semibold">{employee.code}</span> • Puesto:{" "}
                <span className="font-semibold">{employee.position}</span> • Sueldo Base:{" "}
                {currency.format(employee.base_salary)}
                {employee.phone ? ` • Tel: ${employee.phone}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 block font-semibold">
            Saldo Adeudado por el Empleado
          </span>
          <span
            className={`text-2xl font-bold tracking-tight ${
              hasDebt
                ? "text-rose-600 dark:text-rose-400"
                : hasCredit
                ? "text-blue-600 dark:text-blue-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {currency.format(balance)}
          </span>
          {employee.current_account_limit ? (
            <p className="text-[10px] text-slate-400">
              Límite de crédito asignado: {currency.format(employee.current_account_limit)}
            </p>
          ) : null}
        </div>
      </div>

      {feedback && (
        <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>
          {feedback.message}
        </div>
      )}

      {/* Acciones principales de la Cuenta Corriente */}
      {canWrite && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          {/* Botón Retiro de Productos */}
          <button
            type="button"
            onClick={() => setProductModalOpen(true)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            <ShoppingBag size={14} />
            <span>Retiro de productos</span>
          </button>

          {/* Botón Adeudar manual / Anticipo */}
          <button
            type="button"
            onClick={() => {
              setManualType("debt");
              setManualModalOpen(true);
            }}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl shadow-sm transition dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <PlusCircle size={14} />
            <span>Adeudar / Anticipo manual</span>
          </button>

          {/* Botón Registrar Cobro / Pago */}
          <button
            type="button"
            onClick={() => {
              setManualType("payment");
              setManualModalOpen(true);
            }}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl shadow-sm transition dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <DollarSign size={14} />
            <span>Registrar cobro</span>
          </button>

          {/* Botón Descontar de Sueldo */}
          {onOpenSalaryDisbursement && (
            <button
              type="button"
              onClick={() => onOpenSalaryDisbursement(employee)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl shadow-sm transition dark:bg-slate-800 dark:text-slate-200"
            >
              <Receipt size={14} />
              <span>Descontar de sueldo / Liquidar</span>
            </button>
          )}

          {/* Botón Ajuste */}
          <button
            type="button"
            onClick={() => {
              setManualType("adjustment");
              setManualModalOpen(true);
            }}
            disabled={isSubmitting}
            className="ui-btn-ghost text-xs py-2 ml-auto"
          >
            <RefreshCw size={13} className="mr-1" />
            <span>Ajuste</span>
          </button>
        </div>
      )}

      {/* Tabla de Movimientos Históricos de la Cuenta Corriente */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/40 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Historial de Movimientos de Cuenta Corriente
          </h4>
          <span className="text-[11px] text-slate-400">
            {movements.length} movimientos registrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-4">Fecha y Hora</th>
                <th className="py-2.5 px-4">Operación</th>
                <th className="py-2.5 px-4">Categoría</th>
                <th className="py-2.5 px-4">Detalle / Concepto</th>
                <th className="py-2.5 px-4 text-right">Importe</th>
                <th className="py-2.5 px-4 text-right">Saldo Posterior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No hay movimientos registrados para este empleado.
                  </td>
                </tr>
              ) : (
                movements.map((mov) => {
                  const isDebt = mov.type === "debt";
                  const isPayment = mov.type === "payment";
                  const catInfo = categoryLabels[mov.category] || categoryLabels.other;

                  return (
                    <tr
                      key={mov.id}
                      className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(mov.created_at).toLocaleString("es-AR")}
                      </td>

                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isDebt
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : isPayment
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          {isDebt ? "Deuda" : isPayment ? "Pago" : "Ajuste"}
                        </span>
                      </td>

                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${catInfo.color}`}
                        >
                          {catInfo.label}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200">
                        {mov.notes || "-"}
                      </td>

                      <td
                        className={`py-2.5 px-4 text-right font-bold font-mono ${
                          isDebt
                            ? "text-rose-600 dark:text-rose-400"
                            : isPayment
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {isDebt ? "+" : isPayment ? "-" : ""}
                        {currency.format(mov.amount)}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {currency.format(mov.balance_after)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {manualModalOpen && (
        <EmployeeManualMovementModal
          open={manualModalOpen}
          employee={employee}
          initialType={manualType}
          onClose={() => setManualModalOpen(false)}
          onSubmit={handleManualSubmit}
        />
      )}

      {productModalOpen && (
        <EmployeeProductConsumptionModal
          open={productModalOpen}
          tenantId={tenantId}
          employee={employee}
          onClose={() => setProductModalOpen(false)}
          onSubmit={handleProductSubmit}
        />
      )}
    </section>
  );
};
