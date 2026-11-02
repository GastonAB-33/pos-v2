import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Customer } from "@/types/entities";

const crud = new TenantCrudService<Customer>(dbTables.customers);

export type CreateCustomerInput = CreateEntityInput<Customer>;
export type UpdateCustomerInput = UpdateEntityInput<Customer>;

export const customersService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateCustomerInput) => {
    const rawDoc = input.document_number?.trim();
    const docNumber = rawDoc || `SD-${input.code || Date.now().toString().slice(-6)}`;
    return crud.create(tenantId, {
      ...input,
      document_number: docNumber,
    });
  },
  update: (tenantId: string, id: string, input: UpdateCustomerInput) => {
    let docNumber = input.document_number;
    if (docNumber !== undefined) {
      const rawDoc = docNumber?.trim();
      docNumber = rawDoc || `SD-${input.code || id.slice(-6)}`;
    }
    return crud.update(tenantId, id, {
      ...input,
      ...(docNumber !== undefined ? { document_number: docNumber } : {}),
    });
  },
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),
};