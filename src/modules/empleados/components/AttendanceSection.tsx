import { useState, useEffect } from "react";
import {
  Clock,
  LogIn,
  LogOut,
  Calendar,
  Users,
  PlusCircle,
  Edit2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import type { Employee, EmployeeAttendance } from "@/types/entities";
import { AttendanceManualModal } from "@/modules/empleados/components/AttendanceManualModal";

interface AttendanceSectionProps {
  employees: Employee[];
  attendances: EmployeeAttendance[];
  filteredAttendances: EmployeeAttendance[];
  todayActiveByEmployee: Map<string, EmployeeAttendance>;
  selectedEmployeeId: string;
  onSelectEmployeeId: (id: string) => void;
  filterDate: string;
  onFilterDateChange: (date: string) => void;
  filterStatus: string;
  onFilterStatusChange: (status: string) => void;
  canWrite: boolean;
  onPunchIn: (employeeId: string, notes?: string, time?: string) => Promise<boolean>;
  onPunchOut: (attendanceId: string, notes?: string, time?: string) => Promise<boolean>;
  onCreateManual: (values: {
    employee_id: string;
    date: string;
    check_in: string;
    check_out: string | null;
    status: EmployeeAttendance["status"];
    notes?: string;
  }) => Promise<boolean>;
  onUpdateAttendance: (id: string, values: Partial<EmployeeAttendance>) => Promise<boolean>;
  onDeleteAttendance: (id: string) => Promise<boolean>;
}

const statusLabels: Record<EmployeeAttendance["status"], { label: string; color: string }> = {
  present: {
    label: "Presente",
    color: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  },
  late: {
    label: "Tardanza",
    color: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  },
  early_leave: {
    label: "Salida Temprana",
    color: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
  },
  justified: {
    label: "Justificado",
    color: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  },
  absent: {
    label: "Ausente",
    color: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  },
};

export const AttendanceSection = ({
  employees,
  attendances,
  filteredAttendances,
  todayActiveByEmployee,
  selectedEmployeeId,
  onSelectEmployeeId,
  filterDate,
  onFilterDateChange,
  filterStatus,
  onFilterStatusChange,
  canWrite,
  onPunchIn,
  onPunchOut,
  onCreateManual,
  onUpdateAttendance,
  onDeleteAttendance,
}: AttendanceSectionProps) => {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString("es-AR"));
  const [fastPunchEmployeeId, setFastPunchEmployeeId] = useState<string>(employees[0]?.id || "");
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<EmployeeAttendance | null>(null);

  // Reloj en vivo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("es-AR"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  const selectedFastEmployee = employees.find((e) => e.id === fastPunchEmployeeId);
  const isSelectedActive = selectedFastEmployee
    ? todayActiveByEmployee.get(selectedFastEmployee.id)
    : null;

  const activeEmployeesCount = todayActiveByEmployee.size;
  const todayTotalShifts = attendances.filter(
    (a) => a.date === new Date().toISOString().split("T")[0]
  ).length;

  const totalFilteredHours = filteredAttendances.reduce(
    (sum, a) => sum + (a.total_hours || 0),
    0
  );

  const handleFastPunch = async () => {
    if (!selectedFastEmployee) return;

    if (isSelectedActive) {
      await onPunchOut(isSelectedActive.id);
    } else {
      await onPunchIn(selectedFastEmployee.id);
    }
  };

  const handleEditClick = (att: EmployeeAttendance) => {
    setEditingAttendance(att);
    setManualModalOpen(true);
  };

  const handleDeleteClick = async (att: EmployeeAttendance) => {
    const emp = employeeMap.get(att.employee_id);
    const confirmed = window.confirm(
      `¿Eliminar el registro de horario de ${emp?.full_name || "empleado"} del día ${att.date}?`
    );
    if (!confirmed) return;
    await onDeleteAttendance(att.id);
  };

  return (
    <div className="space-y-4">
      {/* Panel Superior: Terminal de Fichada Rápida y KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Terminal Fichada Rápida */}
        <div className="lg:col-span-1 rounded-2xl border border-indigo-200 dark:border-indigo-900/80 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Terminal de Fichadas
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 dark:border-indigo-800 dark:bg-indigo-950/80 px-2.5 py-0.5 text-xs font-mono font-bold text-indigo-800 dark:text-indigo-200">
              <Clock size={13} />
              {currentTime}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Seleccionar Empleado:
              </label>
              <select
                value={fastPunchEmployeeId}
                onChange={(e) => setFastPunchEmployeeId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm font-medium shadow-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
              >
                {employees.map((emp) => {
                  const inShift = todayActiveByEmployee.has(emp.id);
                  return (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} {inShift ? "(🟢 En turno)" : "(⚪ Fuera de turno)"}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedFastEmployee && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/70 p-3 text-xs">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedFastEmployee.full_name}
                </p>
                <p className="text-slate-600 dark:text-slate-400 font-medium">
                  {selectedFastEmployee.position || "Empleado"} • <span className="font-mono">{selectedFastEmployee.code || "EMP"}</span>
                </p>
                {isSelectedActive ? (
                  <p className="mt-1.5 font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    <span>Ingresó hoy a las {isSelectedActive.check_in}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500 inline-block" />
                    <span>Sin turno abierto actualmente</span>
                  </p>
                )}
              </div>
            )}

            {canWrite && (
              <button
                type="button"
                onClick={handleFastPunch}
                disabled={!selectedFastEmployee}
                className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-50 ${
                  isSelectedActive
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {isSelectedActive ? (
                  <>
                    <LogOut size={16} />
                    <span>Fichar Egreso ({currentTime.slice(0, 5)})</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Fichar Ingreso ({currentTime.slice(0, 5)})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tarjetas KPI de Asistencia */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <article className="rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-slate-900 p-4.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                En Turno Ahora
              </span>
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {activeEmployeesCount}
            </p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              Empleados trabajando actualmente
            </p>
          </article>

          <article className="rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-slate-900 p-4.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                Fichadas de Hoy
              </span>
              <CheckCircle2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {todayTotalShifts}
            </p>
            <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300 font-medium">
              Registros iniciados en el día
            </p>
          </article>

          <article className="rounded-2xl border border-blue-200 dark:border-blue-800/80 bg-blue-50/70 dark:bg-slate-900 p-4.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Horas Computadas
              </span>
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {totalFilteredHours.toFixed(1)} hs
            </p>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-300 font-medium">
              Total en la vista filtrada
            </p>
          </article>
        </div>
      </div>

      {/* Barra de Filtros & Acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Empleado */}
          <div>
            <select
              value={selectedEmployeeId}
              onChange={(e) => onSelectEmployeeId(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Todos los empleados</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Fecha */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100">
            <Calendar size={13} className="text-slate-500 dark:text-slate-300" />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => onFilterDateChange(e.target.value)}
              className="bg-transparent text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none"
            />
            {filterDate && (
              <button
                type="button"
                onClick={() => onFilterDateChange("")}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] ml-1 font-bold cursor-pointer"
                title="Limpiar filtro de fecha"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro Estado */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => onFilterStatusChange(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">Todos los estados</option>
              <option value="present">Presentes</option>
              <option value="late">Tardanzas</option>
              <option value="early_leave">Salidas Tempranas</option>
              <option value="justified">Justificados</option>
              <option value="absent">Ausentes</option>
            </select>
          </div>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => {
              setEditingAttendance(null);
              setManualModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <PlusCircle size={14} className="text-blue-500 dark:text-blue-400" />
            <span>Cargar Horario Manual</span>
          </button>
        )}
      </div>

      {/* Tabla de Fichadas */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Empleado</th>
                <th className="py-3 px-4">Ingreso</th>
                <th className="py-3 px-4">Egreso</th>
                <th className="py-3 px-4">Total Horas</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Observaciones</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-600 dark:text-slate-300 font-medium">
                    No se encontraron registros de horarios con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredAttendances.map((att) => {
                  const emp = employeeMap.get(att.employee_id);
                  const statusInfo = statusLabels[att.status] || {
                    label: att.status,
                    color: "bg-slate-100 text-slate-700",
                  };

                  return (
                    <tr
                      key={att.id}
                      className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-4 font-mono font-medium">{att.date}</td>
                      <td className="py-3 px-4">
                        <span className="block font-bold text-slate-900 dark:text-slate-100">
                          {emp?.full_name || "Desconocido"}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {emp?.position}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        {att.check_in}
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {att.check_out ? (
                          att.check_out
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 animate-pulse font-medium">
                            <Clock size={11} /> En curso...
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {att.total_hours != null ? (
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {att.total_hours} hs
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate font-medium">
                        {att.notes || "-"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite && !att.check_out && (
                            <button
                              type="button"
                              onClick={() => onPunchOut(att.id)}
                              className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200 cursor-pointer"
                              title="Cerrar turno"
                            >
                              Egreso
                            </button>
                          )}
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => handleEditClick(att)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                              title="Editar registro"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(att)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-300 cursor-pointer"
                              title="Eliminar registro"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
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

      {manualModalOpen && (
        <AttendanceManualModal
          open={manualModalOpen}
          employees={employees}
          attendance={editingAttendance}
          onClose={() => {
            setManualModalOpen(false);
            setEditingAttendance(null);
          }}
          onSubmit={async (values) => {
            if (editingAttendance) {
              await onUpdateAttendance(editingAttendance.id, values);
            } else {
              await onCreateManual(values);
            }
            setManualModalOpen(false);
            setEditingAttendance(null);
          }}
        />
      )}
    </div>
  );
};
