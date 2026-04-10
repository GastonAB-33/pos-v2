import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { StockMovement } from "@/types/entities";

const crud = new TenantCrudService<StockMovement>(dbTables.stock_movements);

export type CreateStockMovementInput = CreateEntityInput<StockMovement>;
export type UpdateStockMovementInput = UpdateEntityInput<StockMovement>;

export const stockService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateStockMovementInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateStockMovementInput) => crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),
};