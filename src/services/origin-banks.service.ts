import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { OriginBank } from "@/types/entities";

const crud = new TenantCrudService<OriginBank>(dbTables.origin_banks);

export type CreateOriginBankInput = CreateEntityInput<OriginBank>;
export type UpdateOriginBankInput = UpdateEntityInput<OriginBank>;

interface ConflictLikeError {
  code?: string;
  status?: number;
  message?: string;
  details?: string;
}

const isUniqueConflictError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const conflict = error as ConflictLikeError;
  if (conflict.code === "23505" || conflict.status === 409) return true;
  const text = `${conflict.message ?? ""} ${conflict.details ?? ""}`.toLowerCase();
  return text.includes("duplicate key") || text.includes("unique constraint");
};

const defaultOriginBanks = [
  "Banco Nación",
  "Banco Provincia",
  "Banco Galicia",
  "Banco Santander",
  "BBVA",
  "Banco Macro",
  "Banco Credicoop",
  "Brubank",
];

const toBankCode = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32) || "banco";

export const originBanksService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),

  getActiveByTenant: async (tenantId: string) => {
    const rows = await crud.getAllByTenant(tenantId);
    return rows.filter((row) => row.is_active);
  },

  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateOriginBankInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateOriginBankInput) =>
    crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),

  ensureDefaults: async (tenantId: string) => {
    const rows = await crud.getAllByTenant(tenantId);
    const existingCodes = new Set(rows.map((row) => row.code.trim().toLowerCase()));
    const created: OriginBank[] = [];

    for (const name of defaultOriginBanks) {
      const code = toBankCode(name);
      if (existingCodes.has(code)) continue;

      try {
        const next = await crud.create(tenantId, {
          code,
          name,
          is_active: true,
        });
        created.push(next);
      } catch (error) {
        if (!isUniqueConflictError(error)) throw error;
      }
      existingCodes.add(code);
    }

    return created;
  },

  createOrFindByName: async (tenantId: string, rawName: string) => {
    const name = rawName.trim();
    if (!name) return null;

    const rows = await crud.getAllByTenant(tenantId);
    const existing =
      rows.find((row) => row.name.trim().toLowerCase() === name.toLowerCase()) ?? null;
    if (existing) return existing;

    let code = toBankCode(name);
    let suffix = 1;
    const existingCodes = new Set(rows.map((row) => row.code.trim().toLowerCase()));
    while (existingCodes.has(code)) {
      suffix += 1;
      code = `${toBankCode(name)}_${suffix}`;
    }

    return crud.create(tenantId, {
      code,
      name,
      is_active: true,
    });
  },

  toggleActive: async (tenantId: string, id: string) => {
    const row = await crud.getById(tenantId, id);
    if (!row) return null;
    return crud.update(tenantId, id, { is_active: !row.is_active });
  },
};
