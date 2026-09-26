import { useState, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Search,
  CreditCard,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";
import type { Employee } from "@/types/entities";
import { EmployeeCurrentAccountPanel } from "@/modules/empleados/components/EmployeeCurrentAccountPanel";

interface EmployeeCurrentAccountsSectionProps {
  tenantId: string;
  userId: string | null;
  employees: Employee[];
  canWrite: boolean;
  selectedEmployee: Employee | null;
  onSelectEmployee: (employee: Employee | null) => void;
  onBalanceUpdated: () => void;
  onOpenSalaryDisbursement?: (employee: Employee) => void;
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
}: EmployeeCurrentAccountsSectionProps) => {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "debt" | "upToDate">("all");

  // Si hay un empleado seleccionado, mostramos directamente su panel detallado
  if (selectedEmployee) {
    return (
      <EmployeeCurrentAccountPanel
        tenantId={tenantId}
        userId={userId}
        employee={selectedEmployee}
        canWrite={canWrite}
        onClose={() => onSelectEmployee(null)}
        onBalanceUpdated={onBalanceUpdated}
        onOpenSalaryDisbursement={onOpenSalaryDisbursement}
      />
    );
  }

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
    <div className="space-y-4">
      {/* 3 Paneles KPI Superiores (mismo estilo que Cuentas Corrientes Clientes) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <article className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              Deuda Total Empleados
            </span>
            <ShoppingBag className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-rose-900 dark:text-rose-100">
            {currency.format(totalDebt)}
          </p>
          <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
            Consumos y retiros a descontar del sueldo
          </p>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Empleados con Saldo Pendiente
            </span>
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-900 dark:text-amber-100">
            {employeesWithDebtCount}
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            De {employees.length} empleados registrados
          </p>
        </article>

        <article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Empleados al Día
            </span>
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100">
            {employeesUpToDateCount}
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
            Sin consumos pendientes de descuento
          </p>
        </article>
      </div>

      {/* Barra de Filtros y Buscador */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por empleado, legajo, DNI..."
            className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
              filterMode === "all"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            Todos ({employees.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("debt")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
              filterMode === "debt"
                ? "bg-white text-rose-700 shadow-sm dark:bg-slate-700 dark:text-rose-300"
                : "text-slate-500 hover:text-rose-700 dark:hover:text-rose-300"
            }`}
          >
            Con Deuda ({employeesWithDebtCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("upToDate")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
              filterMode === "upToDate"
                ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-300"
                : "text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-300"
            }`}
          >
            Al Día ({employeesUpToDateCount})
          </button>
        </div>
      </div>

      {/* Tabla de Empleados y Cuentas Corrientes */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
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
                  <td colSpan={7} className="py-8 text-center text-slate-500">
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
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
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

                      <td className="py-3 px-4 font-mono">
                        <span className="uppercase text-slate-500 mr-1 text-[10px]">
                          {emp.document_type}
                        </span>
                        {emp.document_number}
                      </td>

                      <td className="py-3 px-4 font-medium">{emp.position}</td>

                      <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {currency.format(emp.base_salary || 0)}
                      </td>

                      <td className="py-3 px-4 text-slate-500">
                        {emp.current_account_limit
                          ? currency.format(emp.current_account_limit)
                          : "Ilimitado"}
                      </td>

                      <td className="py-3 px-4 text-right font-mono">
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

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectEmployee(emp)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
                        >
                          <CreditCard size={13} />
                          <span>Ver Cuenta</span>
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
