import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Receipt } from "@/types/entities";

const crud = new TenantCrudService<Receipt>(dbTables.receipts);

export type CreateReceiptInput = CreateEntityInput<Receipt>;
export type UpdateReceiptInput = UpdateEntityInput<Receipt>;

export const receiptsService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateReceiptInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateReceiptInput) =>
    crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),

  getBySaleId: async (tenantId: string, saleId: string) => {
    const all = await crud.getAllByTenant(tenantId);
    return all.find((receipt) => receipt.sale_id === saleId) ?? null;
  },
};
