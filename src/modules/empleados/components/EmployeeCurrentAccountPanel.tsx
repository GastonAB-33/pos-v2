import { useState, useEffect } from "react";
import {
  ArrowLeft,
  DollarSign,
  PlusCircle,
  RefreshCw,
  User,
  ShoppingBag,
} from "lucide-react";
import type { Employee, EmployeeCurrentAccountCategory, PaymentMethod, BankAccount } from "@/types/entities";
import { useEmployeeCurrentAccount } from "@/modules/empleados/hooks/useEmployeeCurrentAccount";
import { EmployeeManualMovementModal } from "@/modules/empleados/components/EmployeeManualMovementModal";
import { EmployeeProductConsumptionModal } from "@/modules/empleados/components/EmployeeProductConsumptionModal";
import { EmployeeSmartDebtModal } from "@/modules/empleados/components/EmployeeSmartDebtModal";
import { EmployeeSmartPaymentModal } from "@/modules/empleados/components/EmployeeSmartPaymentModal";
import { paymentMethodsService } from "@/services/payment-methods.service";
import { bankAccountsService } from "@/services/bank-accounts.service";

interface EmployeeCurrentAccountPanelProps {
  tenantId: string;
  userId: string | null;
  employee: Employee;
  canWrite: boolean;
  onClose?: () => void;
  hideBackButton?: boolean;
  hideHeaderBanner?: boolean;
  hideActions?: boolean;
  onBalanceUpdated: () => void;
  onOpenSalaryDisbursement?: (employee: Employee) => void;
  usersById?: Record<string, string>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const categoryLabels: Record<EmployeeCurrentAccountCategory, { label: string; color: string }> = {
  product_purchase: {
    label: "Retiro Productos",
    color: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900",
  },
  salary_deduction: {
    label: "Descuento Sueldo",
    color: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  },
  advance: {
    label: "Anticipo / Vale",
    color: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  },
  cash_payment: {
    label: "Pago Directo",
    color: "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900",
  },
  adjustment: {
    label: "Ajuste",
    color: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
  other: {
    label: "Otro",
    color: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
};

export const EmployeeCurrentAccountPanel = ({
  tenantId,
  userId,
  employee,
  canWrite,
  onClose,
  hideBackButton = false,
  hideHeaderBanner = false,
  hideActions = false,
  onBalanceUpdated,
  onOpenSalaryDisbursement: _onOpenSalaryDisbursement,
  usersById = {},
}: EmployeeCurrentAccountPanelProps) => {
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualType, setManualType] = useState<"debt" | "payment" | "adjustment">("debt");
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [smartDebtOpen, setSmartDebtOpen] = useState(false);
  const [smartPaymentOpen, setSmartPaymentOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      paymentMethodsService.getActiveByTenant(tenantId).catch(() => []),
      bankAccountsService.getActiveByTenant(tenantId).catch(() => []),
    ]).then(([m, a]) => {
      setPaymentMethods(m);
      setBankAccounts(a);
    });
  }, [tenantId]);

  const {
    movements,
    balance,
    isSubmitting,
    feedback,
    registerDebt,
    registerPayment,
    registerAdjustment,
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

  return (
    <section className="current-account-detail space-y-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
      {/* Barra de navegación superior si no está en ficha integrada */}
      {!hideBackButton && onClose && (
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Volver al listado de cuentas corrientes</span>
          </button>
        </div>
      )}

      {/* Encabezado y Saldo Destacado (se oculta si está embebido en Ficha del empleado para no duplicar datos) */}
      {!hideHeaderBanner && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 font-black text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 text-lg border border-indigo-200/70 dark:border-indigo-800/60 shadow-xs">
              {employee.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  {employee.full_name}
                </h3>
                <span className="font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  {employee.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Puesto: <span className="font-semibold text-slate-700 dark:text-slate-300">{employee.position || "Empleado"}</span> • Sueldo Base:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">{currency.format(employee.base_salary)}</span>
                {employee.phone ? ` • Tel: ${employee.phone}` : ""}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
              Saldo Adeudado por el Empleado
            </span>
            <span
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
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
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                Límite de crédito pactado: {currency.format(employee.current_account_limit)}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-2xl p-4 text-sm font-medium ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Acciones principales de la Cuenta Corriente */}
      {canWrite && !hideActions && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Botón Registrar Deuda en Cuenta Corriente (Rojo) */}
          <button
            type="button"
            onClick={() => setSmartDebtOpen(true)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl shadow-xs transition dark:border-rose-800/80 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer active:scale-[0.98]"
            title="Registrar deuda directa en cuenta corriente sin escanear productos"
          >
            <PlusCircle size={16} />
            <span>Registrar deuda en cuenta corriente</span>
          </button>

          {/* Botón Retiro de Productos */}
          <button
            type="button"
            onClick={() => setProductModalOpen(true)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xs transition dark:bg-indigo-600 dark:hover:bg-indigo-500 cursor-pointer active:scale-[0.98]"
          >
            <ShoppingBag size={16} />
            <span>Retirar Mercadería</span>
          </button>

          {/* Botón Registrar Pago en Cuenta Corriente (Verde) */}
          <button
            type="button"
            onClick={() => setSmartPaymentOpen(true)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl shadow-xs transition dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer active:scale-[0.98]"
            title="Registrar pago inteligente con efectivo, bancos, alias y cálculo de vuelto"
          >
            <DollarSign size={16} />
            <span>Registrar pago en cuenta corriente</span>
          </button>

          {/* Botón Ajuste */}
          <button
            type="button"
            onClick={() => {
              setManualType("adjustment");
              setManualModalOpen(true);
            }}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 text-xs sm:text-sm font-semibold shadow-xs transition ml-auto cursor-pointer active:scale-[0.98]"
          >
            <RefreshCw size={14} />
            <span>Ajuste</span>
          </button>
        </div>
      )}

      {/* Tabla de Movimientos Históricos de la Cuenta Corriente */}
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200/90 bg-slate-50/90 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/70 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Historial de Movimientos de Cuenta Corriente
          </h4>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            {movements.length} movimientos registrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/90 bg-slate-50/70 font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
              <tr>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Operación</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Detalle / Concepto</th>
                <th className="py-3 px-4">Registrado por</th>
                <th className="py-3 px-4 text-right">Importe</th>
                <th className="py-3 px-4 text-right">Saldo Posterior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400 font-medium">
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
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(mov.created_at).toLocaleString("es-AR")}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${catInfo.color}`}
                        >
                          {catInfo.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-medium">
                        {mov.notes || "-"}
                      </td>

                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        {mov.created_by ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                            <User size={13} className="text-slate-400 shrink-0" />
                            <span className="truncate max-w-[130px]" title={usersById[mov.created_by] || mov.created_by}>
                              {usersById[mov.created_by] || mov.created_by}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td
                        className={`py-3.5 px-4 text-right font-bold font-mono ${
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

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
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

      {smartDebtOpen && (
        <EmployeeSmartDebtModal
          open={smartDebtOpen}
          tenantId={tenantId}
          userId={userId}
          employee={employee}
          onClose={() => setSmartDebtOpen(false)}
          onSuccess={async () => {
            onBalanceUpdated();
          }}
        />
      )}

      {smartPaymentOpen && (
        <EmployeeSmartPaymentModal
          open={smartPaymentOpen}
          tenantId={tenantId}
          userId={userId}
          employee={employee}
          paymentMethods={paymentMethods}
          bankAccounts={bankAccounts}
          onClose={() => setSmartPaymentOpen(false)}
          onSuccess={async () => {
            onBalanceUpdated();
          }}
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