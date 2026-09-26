import { useState, useEffect } from "react";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import type { Employee, EmployeeAttendance, EmployeeAttendanceStatus } from "@/types/entities";

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

  if (!open) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {attendance ? "Editar Registro de Horario" : "Cargar Horario Manual"}
            </h3>
            <p className="text-xs text-slate-500">
              Registrá o rectificá el horario de ingreso y egreso del empleado.
            </p>
          </div>
          <ModalCloseButton label="Cerrar modal" onClick={onClose} disabled={isSubmitting} />
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Empleado *
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={Boolean(attendance)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              required
            >
              <option value="" disabled>
                Seleccionar empleado...
              </option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.position})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Fecha *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EmployeeAttendanceStatus)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="present">Presente</option>
                <option value="late">Tardanza</option>
                <option value="early_leave">Salida Temprana</option>
                <option value="justified">Justificado</option>
                <option value="absent">Ausente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Horario Ingreso *
              </label>
              <input
                type="time"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Horario Egreso (Opcional)
              </label>
              <input
                type="time"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Observaciones
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle o motivo (ej: cambio de turno, horas extras)..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !employeeId}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {isSubmitting ? "Guardando..." : "Guardar Registro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
