import { useState, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Search,
  CreditCard,
  ArrowRight,
  ShoppingBag,
  X,
} from "lucide-react";
import type { Employee } from "@/types/entities";
import { EmployeeCurrentAccountPanel } from "@/modules/empleados/components/EmployeeCurrentAccountPanel";
import { EmployeeProductConsumptionModal } from "@/modules/empleados/components/EmployeeProductConsumptionModal";
import { employeeCurrentAccountsService } from "@/services/employee-current-accounts.service";

interface EmployeeCurrentAccountsSectionProps {
  tenantId: string;
  userId: string | null;
  employees: Employee[];
  canWrite: boolean;
  selectedEmployee: Employee | null;
  onSelectEmployee: (employee: Employee | null) => void;
  onBalanceUpdated: () => void;
  onOpenSalaryDisbursement?: (employee: Employee) => void;
  usersById?: Record<string, string>;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const EmployeeCurrentAccountsSection = ({
  tenantId,
  userId,
  employees,
  canWrite,
  selectedEmployee,
  onSelectEmployee,
  onBalanceUpdated,
  onOpenSalaryDisbursement,
  usersById = {},
}: EmployeeCurrentAccountsSectionProps) => {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "debt" | "upToDate">("all");
  const [productModalEmployee, setProductModalEmployee] = useState<Employee | null>(null);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);

  // Si hay un empleado seleccionado, mostramos directamente su panel detallado
  if (selectedEmployee) {
    return (
      <EmployeeCurrentAccountPanel
        tenantId={tenantId}
        userId={userId}
        employee={selectedEmployee}
        canWrite={canWrite}
        usersById={usersById}
        onClose={() => onSelectEmployee(null)}
        onBalanceUpdated={onBalanceUpdated}
        onOpenSalaryDisbursement={onOpenSalaryDisbursement}
      />
    );
  }

  const handleProductSubmit = async (values: {
    amount: number;
    notes: string;
    category: "product_purchase";
  }) => {
    if (!productModalEmployee) return false;
    try {
      await employeeCurrentAccountsService.createMovement(tenantId, {
        employee_id: productModalEmployee.id,
        type: "debt",
        amount: values.amount,
        category: values.category,
        notes: values.notes,
        created_by: userId,
      });
      onBalanceUpdated();
      setProductModalEmployee(null);
      return true;
    } catch (err) {
      console.error("Error al registrar compra de productos:", err);
      return false;
    }
  };

  // Cálculos de KPIs
  const totalDebt = useMemo(() => {
    return employees.reduce((sum, emp) => {
      const bal = emp.current_balance ?? 0;
      return bal > 0 ? sum + bal : sum;
    }, 0);
  }, [employees]);

  const employeesWithDebtCount = useMemo(() => {
    return employees.filter((emp) => (emp.current_balance ?? 0) > 0).length;
  }, [employees]);

  const employeesUpToDateCount = useMemo(() => {
    return employees.filter((emp) => (emp.current_balance ?? 0) <= 0).length;
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let list = employees;

    if (filterMode === "debt") {
      list = list.filter((emp) => (emp.current_balance ?? 0) > 0);
    } else if (filterMode === "upToDate") {
      list = list.filter((emp) => (emp.current_balance ?? 0) <= 0);
    }

    const term = search.trim().toLowerCase();
    if (!term) return list;

    return list.filter(
      (emp) =>
        emp.full_name.toLowerCase().includes(term) ||
        emp.code.toLowerCase().includes(term) ||
        emp.document_number.toLowerCase().includes(term) ||
        emp.position.toLowerCase().includes(term)
    );
  }, [employees, filterMode, search]);

  return (
    <div className="space-y-5">
      {/* 3 Paneles KPI Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <article className="rounded-2xl sm:rounded-3xl border border-rose-200/90 bg-rose-50/70 p-5 shadow-xs dark:border-rose-900/60 dark:bg-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              Deuda Total Empleados
            </span>
            <ShoppingBag className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black font-mono tracking-tight text-rose-900 dark:text-rose-100">
            {currency.format(totalDebt)}
          </p>
          <p className="mt-1 text-xs text-rose-700 dark:text-rose-400 font-medium">
            Consumos y retiros a descontar del sueldo
          </p>
        </article>

        <article className="rounded-2xl sm:rounded-3xl border border-amber-200/90 bg-amber-50/70 p-5 shadow-xs dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Empleados con Saldo Pendiente
            </span>
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-amber-900 dark:text-amber-100">
            {employeesWithDebtCount}
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
            De {employees.length} empleados registrados
          </p>
        </article>

        <article className="rounded-2xl sm:rounded-3xl border border-emerald-200/90 bg-emerald-50/70 p-5 shadow-xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Empleados al Día
            </span>
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-emerald-900 dark:text-emerald-100">
            {employeesUpToDateCount}
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
            Sin consumos pendientes de descuento
          </p>
        </article>
      </div>

      {/* Barra de Filtros y Buscador */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por empleado, legajo, DNI..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            className="w-full rounded-xl sm:rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/90 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-2xl bg-slate-100/90 p-1 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                filterMode === "all"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              Todos ({employees.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("debt")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                filterMode === "debt"
                  ? "bg-white text-rose-700 shadow-xs dark:bg-slate-900 dark:text-rose-300"
                  : "text-slate-600 hover:text-rose-700 dark:text-slate-400 dark:hover:text-rose-300"
              }`}
            >
              Con Deuda ({employeesWithDebtCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("upToDate")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                filterMode === "upToDate"
                  ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-900 dark:text-emerald-300"
                  : "text-slate-600 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300"
              }`}
            >
              Al Día ({employeesUpToDateCount})
            </button>
          </div>

          {canWrite && employees.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (filteredEmployees.length === 1) {
                  setProductModalEmployee(filteredEmployees[0]);
                } else {
                  setEmployeePickerOpen(true);
                }
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-xs transition dark:bg-indigo-600 dark:hover:bg-indigo-500 cursor-pointer shrink-0 active:scale-[0.98]"
              title="Cargar productos a cuenta corriente de empleado"
            >
              <ShoppingBag size={15} />
              <span>+ Cargar Productos</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Empleados y Cuentas Corrientes */}
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/90 bg-slate-50/90 font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-300">
              <tr>
                <th className="py-3 px-4">Empleado / Legajo</th>
                <th className="py-3 px-4">Documento</th>
                <th className="py-3 px-4">Puesto</th>
                <th className="py-3 px-4">Sueldo Base</th>
                <th className="py-3 px-4">Límite Crédito</th>
                <th className="py-3 px-4 text-right">Saldo Adeudado</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400 font-medium">
                    No se encontraron empleados con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const balance = emp.current_balance ?? 0;
                  const hasDebt = balance > 0;
                  const hasCredit = balance < 0;

                  return (
                    <tr
                      key={emp.id}
                      className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60">
                            {emp.full_name.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <span className="block font-bold text-slate-900 dark:text-slate-100">
                              {emp.full_name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {emp.code}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <span className="uppercase text-slate-500 mr-1 text-[10px]">
                          {emp.document_type}
                        </span>
                        {emp.document_number}
                      </td>

                      <td className="py-3.5 px-4 font-medium">{emp.position || "Empleado"}</td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {currency.format(emp.base_salary || 0)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                        {emp.current_account_limit
                          ? currency.format(emp.current_account_limit)
                          : "Ilimitado"}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            hasDebt
                              ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                              : hasCredit
                              ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                          }`}
                        >
                          {currency.format(balance)}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => setProductModalEmployee(emp)}
                              className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition dark:bg-indigo-600 dark:hover:bg-indigo-500 cursor-pointer active:scale-[0.98]"
                              title={`Cargar productos a cuenta corriente de ${emp.full_name}`}
                            >
                              <ShoppingBag size={13} />
                              <span>Cargar Productos</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectEmployee(emp)}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition cursor-pointer active:scale-[0.98]"
                          >
                            <CreditCard size={13} />
                            <span>Ver Cuenta</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selector modal si hay múltiples empleados y se pulsa el botón del header */}
      {employeePickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="flex flex-col w-full max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Cargar Productos a Empleado
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Seleccioná el empleado a imputar el consumo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmployeePickerOpen(false)}
                className="!rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    setProductModalEmployee(emp);
                    setEmployeePickerOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-300 dark:hover:border-indigo-600 transition text-left cursor-pointer"
                >
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white">{emp.full_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {emp.code} • {emp.position}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    Cargar <ArrowRight size={13} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Consumo / Retiro de Productos */}
      {productModalEmployee && (
        <EmployeeProductConsumptionModal
          open={Boolean(productModalEmployee)}
          tenantId={tenantId}
          employee={productModalEmployee}
          onClose={() => setProductModalEmployee(null)}
          onSubmit={handleProductSubmit}
        />
      )}
    </div>
  );
};