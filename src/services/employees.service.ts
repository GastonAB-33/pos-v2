import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Employee } from "@/types/entities";

const crud = new TenantCrudService<Employee>(dbTables.employees);

export type CreateEmployeeInput = CreateEntityInput<Employee>;
export type UpdateEmployeeInput = UpdateEntityInput<Employee>;

const generateEmployeeCode = (existingEmployees: Employee[]): string => {
  const existingNumbers = existingEmployees
    .map((emp) => {
      const match = emp.code.match(/EMP-(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n) && n > 0);

  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  return `EMP-${String(nextNumber).padStart(3, "0")}`;
};

const getLocalEmployeeCache = (tenantId: string): Employee[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`pos_employees_cache_${tenantId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Employee[]) : [];
  } catch {
    return [];
  }
};

const setLocalEmployeeCache = (tenantId: string, employees: Employee[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`pos_employees_cache_${tenantId}`, JSON.stringify(employees));
  } catch {
    // Silently ignore storage quota issues
  }
};

export const employeesService = {
  getAllByTenant: async (tenantId: string): Promise<Employee[]> => {
    try {
      const records = await crud.getAllByTenant(tenantId);
      if (records.length > 0) {
        setLocalEmployeeCache(tenantId, records);
        return records;
      }

      // Si la BD remota o almacenamiento devolvió 0, verificamos si existe un cache local
      // que no haya sido limpiado intencionalmente por el usuario.
      const isExplicitlyCleared =
        typeof window !== "undefined" &&
        window.localStorage.getItem(`pos_employees_cleared_${tenantId}`) === "true";

      if (!isExplicitlyCleared) {
        const cached = getLocalEmployeeCache(tenantId);
        if (cached.length > 0) {
          // Si tenemos empleados válidos en cache local y la BD falló o devolvió vacío temporalmente,
          // restauramos los cacheados para evitar pérdida de datos del usuario.
          return cached;
        }
      }

      return records;
    } catch (err) {
      const cached = getLocalEmployeeCache(tenantId);
      if (cached.length > 0) {
        return cached;
      }
      throw err;
    }
  },

  getById: async (tenantId: string, id: string): Promise<Employee | null> => {
    const fromCrud = await crud.getById(tenantId, id);
    if (fromCrud) return fromCrud;
    const cached = getLocalEmployeeCache(tenantId);
    return cached.find((e) => e.id === id) ?? null;
  },

  create: async (
    tenantId: string,
    input: Partial<CreateEmployeeInput> & { full_name: string; document_number: string }
  ): Promise<Employee> => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`pos_employees_cleared_${tenantId}`);
    }

    const existing = await employeesService.getAllByTenant(tenantId);
    const code = input.code?.trim() || generateEmployeeCode(existing);

    const payload: CreateEmployeeInput = {
      code,
      full_name: input.full_name.trim(),
      document_type: input.document_type || "dni",
      document_number: input.document_number.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      position: input.position?.trim() || "Empleado",
      base_salary: Number(input.base_salary) || 0,
      hourly_rate: input.hourly_rate ? Number(input.hourly_rate) : null,
      hire_date: input.hire_date || new Date().toISOString().split("T")[0],
      current_balance: Number(input.current_balance) || 0,
      current_account_enabled: input.current_account_enabled ?? true,
      current_account_limit: input.current_account_limit ? Number(input.current_account_limit) : null,
      observations: input.observations?.trim() || null,
      is_active: input.is_active ?? true,
    };

    const created = await crud.create(tenantId, payload);
    const cached = getLocalEmployeeCache(tenantId);
    const updatedCache = [...cached.filter((e) => e.id !== created.id), created];
    setLocalEmployeeCache(tenantId, updatedCache);
    return created;
  },

  update: async (tenantId: string, id: string, input: UpdateEmployeeInput): Promise<Employee | null> => {
    const updated = await crud.update(tenantId, id, input);
    const cached = getLocalEmployeeCache(tenantId);
    if (updated) {
      const nextCache = cached.map((e) => (e.id === id ? updated : e));
      setLocalEmployeeCache(tenantId, nextCache);
      return updated;
    }
    // Si no se encontró en crud pero sí en cache local
    const localTarget = cached.find((e) => e.id === id);
    if (localTarget) {
      const merged = { ...localTarget, ...input, updated_at: new Date().toISOString() } as Employee;
      setLocalEmployeeCache(
        tenantId,
        cached.map((e) => (e.id === id ? merged : e))
      );
      return merged;
    }
    return null;
  },

  delete: async (tenantId: string, id: string): Promise<boolean> => {
    const ok = await crud.delete(tenantId, id);
    const cached = getLocalEmployeeCache(tenantId);
    const remaining = cached.filter((e) => e.id !== id);
    setLocalEmployeeCache(tenantId, remaining);

    if (remaining.length === 0 && typeof window !== "undefined") {
      window.localStorage.setItem(`pos_employees_cleared_${tenantId}`, "true");
    }

    return ok;
  },
};

