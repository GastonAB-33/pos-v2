import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Supplier } from "@/types/entities";

const crud = new TenantCrudService<Supplier>(dbTables.suppliers);

export type CreateSupplierInput = CreateEntityInput<Supplier>;
export type UpdateSupplierInput = UpdateEntityInput<Supplier>;

export const suppliersService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateSupplierInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateSupplierInput) => crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),
};

