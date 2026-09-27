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
  createItem: (tenantId: string, input: CreateSaleItemInput) => {
    // Compatibilidad con esquemas legacy que todavia exigen columnas `price` y `subtotal`.
    const payload = {
      ...input,
      price: input.unit_price,
      subtotal: input.line_total,
    };
    return saleItemsCrud.create(tenantId, payload);
  },
  createPayment: (tenantId: string, input: CreateSalePaymentInput) =>
    salePaymentsCrud.create(tenantId, input),

  getAllItemsByTenant: (tenantId: string) => saleItemsCrud.getAllByTenant(tenantId),
  getAllPaymentsByTenant: (tenantId: string) => salePaymentsCrud.getAllByTenant(tenantId),

  getItemsBySaleId: (tenantId: string, saleId: string) =>
    saleItemsCrud.query(tenantId, { eq: { sale_id: saleId } }),

  // Relacion preparada para medios de pago y futuras integraciones (Mercado Pago/ARCA).
  getPaymentsBySaleId: (tenantId: string, saleId: string) =>
    salePaymentsCrud.query(tenantId, { eq: { sale_id: saleId } }),
};
