import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { BankAccount } from "@/types/entities";

const crud = new TenantCrudService<BankAccount>(dbTables.bank_accounts);

export type CreateBankAccountInput = CreateEntityInput<BankAccount>;
export type UpdateBankAccountInput = UpdateEntityInput<BankAccount>;

export const bankAccountsService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),

  getActiveByTenant: async (tenantId: string) => {
    const rows = await crud.getAllByTenant(tenantId);
    return rows.filter((row) => row.is_active);
  },

  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateBankAccountInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateBankAccountInput) =>
    crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),

  toggleActive: async (tenantId: string, id: string) => {
    const row = await crud.getById(tenantId, id);
    if (!row) return null;
    return crud.update(tenantId, id, { is_active: !row.is_active });
  },
};

