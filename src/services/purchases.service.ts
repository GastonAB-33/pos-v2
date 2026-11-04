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
export type UpdatePurchaseItemInput = UpdateEntityInput<PurchaseItem>;

export const purchasesService = {
  getAllByTenant: (tenantId: string) => purchasesCrud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => purchasesCrud.getById(tenantId, id),
  create: (tenantId: string, input: CreatePurchaseInput) => purchasesCrud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdatePurchaseInput) =>
    purchasesCrud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => purchasesCrud.delete(tenantId, id),

  createItem: (tenantId: string, input: CreatePurchaseItemInput) =>
    purchaseItemsCrud.create(tenantId, input),
  updateItem: (tenantId: string, id: string, input: UpdatePurchaseItemInput) =>
    purchaseItemsCrud.update(tenantId, id, input),

  getAllItemsByTenant: (tenantId: string) => purchaseItemsCrud.getAllByTenant(tenantId),

  getRecentByTenant: (tenantId: string, limit = 100) =>
    purchasesCrud.query(tenantId, { order: { column: "created_at", ascending: false }, limit }),

  getPurchasesSince: (tenantId: string, sinceIso: string) =>
    purchasesCrud.query(tenantId, {
      gte: { created_at: sinceIso },
      order: { column: "created_at", ascending: false },
    }),

  getItemsByPurchaseIds: async (tenantId: string, purchaseIds: string[]): Promise<PurchaseItem[]> => {
    if (purchaseIds.length === 0) return [];
    return purchaseItemsCrud.query(tenantId, { in: { purchase_id: purchaseIds } });
  },

  getItemsByPurchaseId: (tenantId: string, purchaseId: string) =>
    purchaseItemsCrud.query(tenantId, { eq: { purchase_id: purchaseId } }),
};

