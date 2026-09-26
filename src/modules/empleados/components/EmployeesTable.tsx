import {
  CreditCard,
  Edit2,
  Trash2,
  Power,
  Clock,
  LogOut,
  LogIn,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import type { Employee, EmployeeAttendance } from "@/types/entities";

interface EmployeesTableProps {
  employees: Employee[];
  todayActiveByEmployee: Map<string, EmployeeAttendance>;
  canWrite: boolean;
  onOpenCurrentAccount: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onToggleActive: (employee: Employee) => void;
  onPunchIn: (employee: Employee) => void;
  onPunchOut: (attendanceId: string, employee: Employee) => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const EmployeesTable = ({
  employees,
  todayActiveByEmployee,
  canWrite,
  onOpenCurrentAccount,
  onEdit,
  onDelete,
  onToggleActive,
  onPunchIn,
  onPunchOut,
}: EmployeesTableProps) => {
  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          No se encontraron empleados registrados
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Hacé clic en &quot;Nuevo Empleado&quot; para registrar el primer integrante del equipo.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="py-3 px-4">Código / Nombre</th>
              <th className="py-3 px-4">Documento</th>
              <th className="py-3 px-4">Puesto</th>
              <th className="py-3 px-4">Sueldo Base</th>
              <th className="py-3 px-4">Cta. Corriente (Deuda)</th>
              <th className="py-3 px-4">Turno Hoy</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            {employees.map((employee) => {
              const activeShift = todayActiveByEmployee.get(employee.id);
              const balance = employee.current_balance ?? 0;
              const hasDebt = balance > 0;
              const hasCredit = balance < 0;

              return (
                <tr
                  key={employee.id}
                  className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                        {employee.full_name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <span className="block font-bold text-slate-900 dark:text-slate-100">
                          {employee.full_name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {employee.code}
                          {employee.phone ? ` • ${employee.phone}` : ""}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 font-mono">
                    <span className="uppercase text-slate-500 mr-1 text-[10px]">
                      {employee.document_type}
                    </span>
                    {employee.document_number}
                  </td>

                  <td className="py-3 px-4 font-medium">{employee.position}</td>

                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                    {currency.format(employee.base_salary || 0)}
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          hasDebt
                            ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
                            : hasCredit
                            ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                        }`}
                      >
                        {hasDebt && <AlertTriangle size={11} />}
                        {!hasDebt && !hasCredit && <CheckCircle size={11} />}
                        {currency.format(balance)}
                      </span>
                      {employee.current_account_limit ? (
                        <span className="text-[10px] text-slate-400" title="Límite autorizado">
                          (Lím: {currency.format(employee.current_account_limit)})
                        </span>
                      ) : null}
                    </div>
                  </td>

                  {/* Estado de Fichada Hoy */}
                  <td className="py-3 px-4">
                    {activeShift ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 animate-pulse">
                        <Clock size={12} />
                        En turno ({activeShift.check_in})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        Fuera de turno
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        employee.is_active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {employee.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Botón rápido fichar */}
                      {canWrite && employee.is_active && (
                        activeShift ? (
                          <button
                            type="button"
                            title="Fichar Egreso de Turno"
                            onClick={() => onPunchOut(activeShift.id, employee)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                          >
                            <LogOut size={12} />
                            <span>Egreso</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Fichar Ingreso a Turno"
                            onClick={() => onPunchIn(employee)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            <LogIn size={12} />
                            <span>Ingreso</span>
                          </button>
                        )
                      )}

                      {/* Botón Cuenta Corriente */}
                      <button
                        type="button"
                        title="Ver Cuenta Corriente y Consumos"
                        onClick={() => onOpenCurrentAccount(employee)}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
                      >
                        <CreditCard size={12} />
                        <span>Cta. Cte.</span>
                      </button>

                      {/* Editar */}
                      {canWrite && (
                        <button
                          type="button"
                          title="Editar Legajo"
                          onClick={() => onEdit(employee)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}

                      {/* Activar/Desactivar */}
                      {canWrite && (
                        <button
                          type="button"
                          title={employee.is_active ? "Desactivar empleado" : "Activar empleado"}
                          onClick={() => onToggleActive(employee)}
                          className={`rounded-lg p-1.5 ${
                            employee.is_active
                              ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                              : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          }`}
                        >
                          <Power size={13} />
                        </button>
                      )}

                      {/* Eliminar */}
                      {canWrite && (
                        <button
                          type="button"
                          title="Eliminar empleado"
                          onClick={() => onDelete(employee)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
