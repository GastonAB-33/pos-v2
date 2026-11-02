import { useState, useEffect } from "react";
import {
  Clock,
  User,
  LogIn,
  LogOut,
  CheckCircle2,
  X,
} from "lucide-react";
import type { Employee, EmployeeAttendance, EmployeeAttendanceStatus } from "@/types/entities";
import { calculateAttendanceHours } from "@/services/employee-attendance.service";

interface AttendanceManualModalProps {
  open: boolean;
  employees: Employee[];
  attendance?: EmployeeAttendance | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: {
    employee_id: string;
    date: string;
    check_in: string;
    check_out: string | null;
    status: EmployeeAttendanceStatus;
    notes?: string;
  }) => Promise<void>;
}

const STATUS_OPTIONS: {
  id: EmployeeAttendanceStatus;
  label: string;
  shortLabel: string;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    id: "present",
    label: "Presente",
    shortLabel: "Presente",
    activeClass:
      "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-600 dark:border-emerald-500 shadow-xs",
    inactiveClass:
      "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/30",
  },
  {
    id: "late",
    label: "Tardanza",
    shortLabel: "Tardanza",
    activeClass:
      "bg-amber-600 text-white border-amber-600 dark:bg-amber-600 dark:border-amber-500 shadow-xs",
    inactiveClass:
      "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/30",
  },
  {
    id: "early_leave",
    label: "Salida Temprana",
    shortLabel: "Salida Temp.",
    activeClass:
      "bg-orange-600 text-white border-orange-600 dark:bg-orange-600 dark:border-orange-500 shadow-xs",
    inactiveClass:
      "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/80 hover:bg-orange-50 dark:hover:bg-orange-950/30",
  },
  {
    id: "justified",
    label: "Justificado",
    shortLabel: "Justificado",
    activeClass:
      "bg-blue-600 text-white border-blue-600 dark:bg-blue-600 dark:border-blue-500 shadow-xs",
    inactiveClass:
      "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-950/30",
  },
  {
    id: "absent",
    label: "Ausente",
    shortLabel: "Ausente",
    activeClass:
      "bg-rose-600 text-white border-rose-600 dark:bg-rose-600 dark:border-rose-500 shadow-xs",
    inactiveClass:
      "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/30",
  },
];

export const AttendanceManualModal = ({
  open,
  employees,
  attendance,
  isSubmitting,
  onClose,
  onSubmit,
}: AttendanceManualModalProps) => {
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkIn, setCheckIn] = useState("08:00");
  const [checkOut, setCheckOut] = useState("16:00");
  const [status, setStatus] = useState<EmployeeAttendanceStatus>("present");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;

    if (attendance) {
      setEmployeeId(attendance.employee_id);
      setDate(attendance.date);
      setCheckIn(attendance.check_in);
      setCheckOut(attendance.check_out || "");
      setStatus(attendance.status);
      setNotes(attendance.notes || "");
    } else {
      setEmployeeId(employees[0]?.id || "");
      setDate(new Date().toISOString().split("T")[0]);
      setCheckIn("08:00");
      setCheckOut("16:00");
      setStatus("present");
      setNotes("");
    }
  }, [open, attendance, employees]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, isSubmitting]);

  if (!open) return null;

  const selectedEmployee = employees.find((e) => e.id === employeeId);
  const calculatedHours = checkIn && checkOut ? calculateAttendanceHours(checkIn, checkOut) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;

    await onSubmit({
      employee_id: employeeId,
      date,
      check_in: checkIn,
      check_out: checkOut ? checkOut : null,
      status,
      notes: notes.trim() || undefined,
    });
  };

  const handleApplyPreset = (inTime: string, outTime: string) => {
    setCheckIn(inTime);
    setCheckOut(outTime);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-300 dark:border-slate-700 overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50 dark:bg-slate-800/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {attendance ? "Editar Registro de Horario" : "Cargar Horario Manual"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Registrá o rectificá el horario de ingreso y egreso del empleado
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </header>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Bloque 1: Empleado y Fecha */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 uppercase tracking-wider">
                Empleado *
              </label>

              {attendance && selectedEmployee ? (
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200 dark:border-blue-800/60">
                      <User size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {selectedEmployee.full_name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {selectedEmployee.position || "Empleado"} •{" "}
                        <span className="font-mono">{selectedEmployee.code || "EMP"}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-700/80 px-2 py-0.5 rounded">
                    Registro Existente
                  </span>
                </div>
              ) : (
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm font-medium shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  required
                >
                  <option value="" disabled>
                    Seleccionar empleado...
                  </option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.position || "Empleado"})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 uppercase tracking-wider">
                Fecha del Horario *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm font-mono font-medium shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Bloque 2: Turno de Trabajo (Ingreso y Egreso) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-2.5">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-blue-600 dark:text-blue-400" />
                Horarios de Turno
              </span>

              {calculatedHours !== null ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  ⏱️ {calculatedHours} hs computadas
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Turno abierto (En curso)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                  <LogIn size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Ingreso *</span>
                </label>
                <input
                  type="time"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm font-mono font-bold text-center shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                    <LogOut size={13} className="text-amber-600 dark:text-amber-400" />
                    <span>Egreso</span>
                  </label>
                  {checkOut && (
                    <button
                      type="button"
                      onClick={() => setCheckOut("")}
                      className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold hover:underline cursor-pointer"
                      title="Dejar turno abierto"
                    >
                      Borrar egreso
                    </button>
                  )}
                </div>
                <input
                  type="time"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  placeholder="--:--"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm font-mono font-bold text-center shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>
            </div>

            {/* Accesos rápidos de turnos frecuentes */}
            <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Turnos sugeridos:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset("08:00", "16:00")}
                className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-mono text-[10px] font-semibold transition cursor-pointer"
              >
                08-16 (8h)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("09:00", "18:00")}
                className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-mono text-[10px] font-semibold transition cursor-pointer"
              >
                09-18 (9h)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("14:00", "22:00")}
                className="px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-mono text-[10px] font-semibold transition cursor-pointer"
              >
                14-22 (8h)
              </button>
            </div>
          </div>

          {/* Bloque 3: Estado de Asistencia */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 uppercase tracking-wider">
              Estado de la Asistencia
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = status === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatus(opt.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center justify-between cursor-pointer ${
                      isSelected ? opt.activeClass : opt.inactiveClass
                    }`}
                  >
                    <span>{opt.shortLabel}</span>
                    {isSelected && <CheckCircle2 size={13} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bloque 4: Observaciones */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5 uppercase tracking-wider">
              Observaciones (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle o justificación (ej: cambio de turno, horas extras, permiso particular)..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 p-3 text-xs shadow-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>

          {/* Pie de Acciones */}
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !employeeId || !checkIn}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              <span>{isSubmitting ? "Guardando..." : attendance ? "Guardar Cambios" : "Registrar Horario"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
