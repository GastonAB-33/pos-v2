import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Sale, SaleItem, SalePayment } from "@/types/entities";

const salesCrud = new TenantCrudService<Sale>(dbTables.sales);
const saleItemsCrud = new TenantCrudService<SaleItem>(dbTables.sale_items);
const salePaymentsCrud = new TenantCrudService<SalePayment>(dbTables.sale_payments);

export type CreateSaleInput = CreateEntityInput<Sale>;
export type UpdateSaleInput = UpdateEntityInput<Sale>;
export type CreateSaleItemInput = CreateEntityInput<SaleItem>;
export type CreateSalePaymentInput = CreateEntityInput<SalePayment>;

export const salesService = {
  getAllByTenant: (tenantId: string) => salesCrud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => salesCrud.getById(tenantId, id),
  create: (tenantId: string, input: CreateSaleInput) => salesCrud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateSaleInput) => salesCrud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => salesCrud.delete(tenantId, id),
  createItem: (tenantId: string, input: CreateSaleItemInput) => saleItemsCrud.create(tenantId, input),
  createPayment: (tenantId: string, input: CreateSalePaymentInput) =>
    salePaymentsCrud.create(tenantId, input),

  getAllItemsByTenant: (tenantId: string) => saleItemsCrud.getAllByTenant(tenantId),
  getAllPaymentsByTenant: (tenantId: string) => salePaymentsCrud.getAllByTenant(tenantId),

  getItemsBySaleId: async (tenantId: string, saleId: string) => {
    const allItems = await saleItemsCrud.getAllByTenant(tenantId);
    return allItems.filter((item) => item.sale_id === saleId);
  },

  // Relacion preparada para medios de pago y futuras integraciones (Mercado Pago/ARCA).
  getPaymentsBySaleId: async (tenantId: string, saleId: string) => {
    const allPayments = await salePaymentsCrud.getAllByTenant(tenantId);
    return allPayments.filter((payment) => payment.sale_id === saleId);
  },
};
