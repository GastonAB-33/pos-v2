import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { EmployeeAttendance, EmployeeAttendanceStatus } from "@/types/entities";

const crud = new TenantCrudService<EmployeeAttendance>(dbTables.employee_attendance);

export type CreateAttendanceInput = CreateEntityInput<EmployeeAttendance>;
export type UpdateAttendanceInput = UpdateEntityInput<EmployeeAttendance>;

export const calculateAttendanceHours = (checkIn: string, checkOut: string | null): number | null => {
  if (!checkOut) return null;

  try {
    let inMinutes: number;
    let outMinutes: number;

    if (checkIn.includes("T")) {
      const dIn = new Date(checkIn);
      const dOut = new Date(checkOut);
      const diffMs = dOut.getTime() - dIn.getTime();
      if (diffMs <= 0) return 0;
      return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
    } else {
      const [hIn, mIn] = checkIn.split(":").map(Number);
      const [hOut, mOut] = checkOut.split(":").map(Number);
      inMinutes = hIn * 60 + (mIn || 0);
      outMinutes = hOut * 60 + (mOut || 0);
      let diff = outMinutes - inMinutes;
      if (diff < 0) diff += 24 * 60; // Crosses midnight
      return Number((diff / 60).toFixed(2));
    }
  } catch {
    return null;
  }
};

export const employeeAttendanceService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),

  getByEmployee: async (tenantId: string, employeeId: string): Promise<EmployeeAttendance[]> => {
    const all = await crud.getAllByTenant(tenantId);
    return all
      .filter((att) => att.employee_id === employeeId)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.check_in || "").localeCompare(a.check_in || ""));
  },

  getByDate: async (tenantId: string, date: string): Promise<EmployeeAttendance[]> => {
    const all = await crud.getAllByTenant(tenantId);
    return all.filter((att) => att.date === date);
  },

  getTodayActiveCheckIn: async (tenantId: string, employeeId: string): Promise<EmployeeAttendance | null> => {
    const today = new Date().toISOString().split("T")[0];
    const all = await crud.getAllByTenant(tenantId);
    const active = all.find(
      (att) => att.employee_id === employeeId && att.date === today && !att.check_out
    );
    return active || null;
  },

  registerCheckIn: async (
    tenantId: string,
    employeeId: string,
    options?: {
      date?: string;
      checkInTime?: string;
      notes?: string;
      status?: EmployeeAttendanceStatus;
      createdBy?: string | null;
    }
  ): Promise<EmployeeAttendance> => {
    const now = new Date();
    const date = options?.date || now.toISOString().split("T")[0];
    const checkInTime = options?.checkInTime || now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

    return crud.create(tenantId, {
      employee_id: employeeId,
      date,
      check_in: checkInTime,
      check_out: null,
      total_hours: null,
      status: options?.status || "present",
      notes: options?.notes || null,
      created_by: options?.createdBy || null,
    });
  },

  registerCheckOut: async (
    tenantId: string,
    attendanceId: string,
    options?: {
      checkOutTime?: string;
      notes?: string;
    }
  ): Promise<EmployeeAttendance> => {
    const attendance = await crud.getById(tenantId, attendanceId);
    if (!attendance) {
      throw new Error("Registro de asistencia no encontrado");
    }

    const now = new Date();
    const checkOutTime = options?.checkOutTime || now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
    const totalHours = calculateAttendanceHours(attendance.check_in, checkOutTime);

    const updated = await crud.update(tenantId, attendanceId, {
      check_out: checkOutTime,
      total_hours: totalHours,
      notes: options?.notes !== undefined ? options.notes : attendance.notes,
    });
    if (!updated) {
      throw new Error("No se pudo actualizar el egreso");
    }
    return updated;
  },

  createManual: async (tenantId: string, input: CreateAttendanceInput): Promise<EmployeeAttendance> => {
    const totalHours =
      input.total_hours != null
        ? Number(input.total_hours)
        : calculateAttendanceHours(input.check_in, input.check_out);

    return crud.create(tenantId, {
      ...input,
      total_hours: totalHours,
    });
  },

  update: async (tenantId: string, id: string, input: UpdateAttendanceInput): Promise<EmployeeAttendance> => {
    const existing = await crud.getById(tenantId, id);
    const checkIn = input.check_in ?? existing?.check_in ?? "";
    const checkOut = input.check_out ?? existing?.check_out ?? null;
    const totalHours =
      input.total_hours !== undefined
        ? input.total_hours
        : calculateAttendanceHours(checkIn, checkOut);

    const updated = await crud.update(tenantId, id, {
      ...input,
      total_hours: totalHours,
    });
    if (!updated) {
      throw new Error("No se pudo actualizar el registro");
    }
    return updated;
  },

  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),
};
