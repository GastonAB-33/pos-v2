import { useCallback, useEffect, useMemo, useState } from "react";
import { employeeAttendanceService } from "@/services/employee-attendance.service";
import type { EmployeeAttendance, EmployeeAttendanceStatus } from "@/types/entities";

interface Feedback {
  type: "success" | "error";
  message: string;
}

export const useEmployeeAttendance = (tenantId: string | null, userId: string | null) => {
  const [attendances, setAttendances] = useState<EmployeeAttendance[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const loadAttendances = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    try {
      const data = await employeeAttendanceService.getAllByTenant(tenantId);
      setAttendances(
        data.sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            (b.check_in || "").localeCompare(a.check_in || "")
        )
      );
    } catch {
      setFeedback({ type: "error", message: "Error al cargar registros de asistencia" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadAttendances();
  }, [loadAttendances]);

  // Mapa de fichadas activas de hoy por empleado: empleadoId -> EmployeeAttendance
  const todayActiveByEmployee = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const map = new Map<string, EmployeeAttendance>();
    for (const att of attendances) {
      if (att.date === today && !att.check_out) {
        map.set(att.employee_id, att);
      }
    }
    return map;
  }, [attendances]);

  // Lista de fichadas de hoy (para resumen rápido)
  const todayAttendances = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return attendances.filter((att) => att.date === today);
  }, [attendances]);

  const filteredAttendances = useMemo(() => {
    return attendances.filter((att) => {
      if (selectedEmployeeId !== "all" && att.employee_id !== selectedEmployeeId) {
        return false;
      }
      if (filterDate && att.date !== filterDate) {
        return false;
      }
      if (filterStatus !== "all" && att.status !== filterStatus) {
        return false;
      }
      return true;
    });
  }, [attendances, selectedEmployeeId, filterDate, filterStatus]);

  const punchCheckIn = async (
    employeeId: string,
    notes?: string,
    checkInTime?: string
  ): Promise<boolean> => {
    if (!tenantId) return false;

    setIsSubmitting(true);
    try {
      await employeeAttendanceService.registerCheckIn(tenantId, employeeId, {
        notes,
        checkInTime,
        createdBy: userId,
      });
      setFeedback({ type: "success", message: "Ingreso registrado correctamente" });
      await loadAttendances();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al registrar el ingreso" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const punchCheckOut = async (
    attendanceId: string,
    notes?: string,
    checkOutTime?: string
  ): Promise<boolean> => {
    if (!tenantId) return false;

    setIsSubmitting(true);
    try {
      await employeeAttendanceService.registerCheckOut(tenantId, attendanceId, {
        notes,
        checkOutTime,
      });
      setFeedback({ type: "success", message: "Egreso registrado correctamente" });
      await loadAttendances();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al registrar el egreso" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const createManualAttendance = async (values: {
    employee_id: string;
    date: string;
    check_in: string;
    check_out: string | null;
    status: EmployeeAttendanceStatus;
    notes?: string;
  }): Promise<boolean> => {
    if (!tenantId) return false;

    setIsSubmitting(true);
    try {
      await employeeAttendanceService.createManual(tenantId, {
        employee_id: values.employee_id,
        date: values.date,
        check_in: values.check_in,
        check_out: values.check_out || null,
        total_hours: null, // se calculará automáticamente en el servicio
        status: values.status,
        notes: values.notes?.trim() || null,
        created_by: userId,
      });
      setFeedback({ type: "success", message: "Registro de asistencia guardado" });
      await loadAttendances();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al guardar registro manual" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateAttendance = async (
    id: string,
    values: Partial<EmployeeAttendance>
  ): Promise<boolean> => {
    if (!tenantId) return false;

    setIsSubmitting(true);
    try {
      await employeeAttendanceService.update(tenantId, id, values);
      setFeedback({ type: "success", message: "Registro actualizado" });
      await loadAttendances();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al actualizar registro" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteAttendance = async (id: string): Promise<boolean> => {
    if (!tenantId) return false;

    setIsSubmitting(true);
    try {
      await employeeAttendanceService.delete(tenantId, id);
      setFeedback({ type: "success", message: "Registro eliminado" });
      await loadAttendances();
      return true;
    } catch {
      setFeedback({ type: "error", message: "Error al eliminar registro" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    attendances,
    filteredAttendances,
    todayAttendances,
    todayActiveByEmployee,
    selectedEmployeeId,
    setSelectedEmployeeId,
    filterDate,
    setFilterDate,
    filterStatus,
    setFilterStatus,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadAttendances,
    punchCheckIn,
    punchCheckOut,
    createManualAttendance,
    updateAttendance,
    deleteAttendance,
  };
};
