import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import { productsService } from "@/services/products.service";
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
  createItem: async (tenantId: string, input: CreateSaleItemInput) => {
    let resolvedProductId = input.product_id;

    if (
      resolvedProductId.startsWith("manual-") ||
      resolvedProductId.startsWith("temp-") ||
      resolvedProductId.startsWith("debt-") ||
      resolvedProductId.startsWith("returnable-pkg-")
    ) {
      const specialCode = resolvedProductId.startsWith("debt-")
        ? "SISTEMA_COBRO_CTA_CTE"
        : resolvedProductId.startsWith("returnable-pkg-")
        ? "SISTEMA_COBRO_ENVASE"
        : "SISTEMA_VENTA_MANUAL";
      const specialName = resolvedProductId.startsWith("debt-")
        ? "Cobro Cuenta Corriente"
        : resolvedProductId.startsWith("returnable-pkg-")
        ? "Cobro de Envase Retornable"
        : "Venta Manual / Producto Temporal";

      const specialProduct = await productsService.ensureSpecialProduct(
        tenantId,
        specialCode,
        specialName
      );
      resolvedProductId = specialProduct.id;
    }

    // Compatibilidad con esquemas legacy que todavia exigen columnas `price` y `subtotal`.
    const payload = {
      ...input,
      product_id: resolvedProductId,
      price: input.unit_price,
      subtotal: input.line_total,
      metadata: {
        ...(input.metadata ?? {}),
        original_product_id: input.product_id,
      },
    };

    try {
      return await saleItemsCrud.create(tenantId, payload);
    } catch (error) {
      const errorMsg = String(
        error && typeof error === "object"
          ? (error as { message?: string; details?: string }).message ?? ""
          : ""
      ).toLowerCase();
      const errorCode = String(
        error && typeof error === "object" ? (error as { code?: string }).code ?? "" : ""
      );

      if (
        errorCode === "23503" ||
        errorMsg.includes("foreign key") ||
        errorMsg.includes("violates foreign key")
      ) {
        console.warn(
          `[SalesService] product_id "${resolvedProductId}" no existe en "products". Utilizando SISTEMA_VENTA_MANUAL para no frenar la venta.`
        );
        const fallbackProduct = await productsService.ensureSpecialProduct(
          tenantId,
          "SISTEMA_VENTA_MANUAL",
          "Venta Manual / Producto Temporal"
        );
        payload.product_id = fallbackProduct.id;
        return await saleItemsCrud.create(tenantId, payload);
      }
      throw error;
    }
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
