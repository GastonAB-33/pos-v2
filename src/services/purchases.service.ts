import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Purchase, PurchaseItem } from "@/types/entities";

const purchasesCrud = new TenantCrudService<Purchase>(dbTables.purchases);
const purchaseItemsCrud = new TenantCrudService<PurchaseItem>(dbTables.purchase_items);

export type CreatePurchaseInput = CreateEntityInput<Purchase>;
export type UpdatePurchaseInput = UpdateEntityInput<Purchase>;
export type CreatePurchaseItemInput = CreateEntityInput<PurchaseItem>;

export const purchasesService = {
  getAllByTenant: (tenantId: string) => purchasesCrud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => purchasesCrud.getById(tenantId, id),
  create: (tenantId: string, input: CreatePurchaseInput) => purchasesCrud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdatePurchaseInput) =>
    purchasesCrud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => purchasesCrud.delete(tenantId, id),

  createItem: (tenantId: string, input: CreatePurchaseItemInput) =>
    purchaseItemsCrud.create(tenantId, input),

  getAllItemsByTenant: (tenantId: string) => purchaseItemsCrud.getAllByTenant(tenantId),

  getItemsByPurchaseId: async (tenantId: string, purchaseId: string) => {
    const allItems = await purchaseItemsCrud.getAllByTenant(tenantId);
    return allItems.filter((item) => item.purchase_id === purchaseId);
  },
};
