import { productsService } from "@/services/products.service";
import { customersService } from "@/services/customers.service";
import { salesService } from "@/services/sales.service";

export const createDraftSaleExample = async (tenantId: string) => {
  const customers = await customersService.getAllByTenant(tenantId);
  const products = await productsService.getAllByTenant(tenantId);

  const sale = await salesService.create(tenantId, {
    sale_number: "BORRADOR-0001",
    customer_id: customers[0]?.id ?? null,
    cash_session_id: null,
    status: "draft",
    subtotal: 0,
    discount_total: 0,
    tax_total: 0,
    total: 0,
    currency_code: "ARS",
    notes: "Ejemplo base sin logica de negocio",
    current_account_id: null,
    arca_document_id: null,
    mercado_pago_preference_id: null,
    items: [],
    payments: [],
    customer: null,
  });

  return {
    sale,
    products_count: products.length,
  };
};