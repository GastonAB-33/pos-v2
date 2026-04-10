import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import { customersService } from "@/services/customers.service";
import { salesService } from "@/services/sales.service";
import type {
  ArcaInvoiceStatus,
  Customer,
  FiscalCustomerSnapshot,
  Invoice,
  InvoiceDocumentType,
  InvoiceItemSnapshot,
  Sale,
  SaleItem,
} from "@/types/entities";

const invoicesCrud = new TenantCrudService<Invoice>(dbTables.invoices);

export type CreateInvoiceInput = CreateEntityInput<Invoice>;
export type UpdateInvoiceInput = UpdateEntityInput<Invoice>;

const roundAmount = (value: number): number => Number(value.toFixed(2));

const documentPrefixByType: Record<InvoiceDocumentType, string> = {
  A: "A",
  B: "B",
  C: "C",
  PRESUPUESTO: "PRES",
};

const extractSequenceFromDocumentNumber = (documentNumber: string): number => {
  const numericPart = documentNumber.split("-").pop() ?? "";
  const parsed = Number.parseInt(numericPart, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildFiscalCustomerSnapshot = (
  saleCustomerId: string | null,
  customer: Customer | null
): FiscalCustomerSnapshot | null => {
  if (!customer && !saleCustomerId) return null;

  if (!customer) {
    return {
      customer_id: saleCustomerId,
      full_name: "Cliente sin datos",
      business_name: null,
      document_type: "dni",
      document_number: "0",
      address: null,
      fiscal_condition: null,
    };
  }

  return {
    customer_id: customer.id,
    full_name: customer.full_name,
    business_name: customer.fiscal_business_name ?? customer.full_name,
    document_type: customer.document_type,
    document_number: customer.document_number,
    address: customer.fiscal_address ?? customer.address,
    fiscal_condition: customer.fiscal_condition ?? "Consumidor final",
  };
};

const mapSaleItemsToInvoiceSnapshot = (saleItems: SaleItem[]): InvoiceItemSnapshot[] =>
  saleItems.map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name_snapshot,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: roundAmount(item.quantity * item.unit_price),
    tax_total: roundAmount(item.tax_total),
    total: roundAmount(item.line_total),
  }));

const generateNextDocumentNumber = async (
  tenantId: string,
  documentType: InvoiceDocumentType
): Promise<string> => {
  const allInvoices = await invoicesCrud.getAllByTenant(tenantId);
  const sameType = allInvoices.filter((invoice) => invoice.document_type === documentType);
  const maxSequence = sameType.reduce((max, invoice) => {
    const current = extractSequenceFromDocumentNumber(invoice.document_number);
    return current > max ? current : max;
  }, 0);

  const nextSequence = maxSequence + 1;
  return `${documentPrefixByType[documentType]}-${String(nextSequence).padStart(8, "0")}`;
};

const validateInvoiceGenerationFromSale = (
  sale: Sale | null,
  documentType: InvoiceDocumentType
): { valid: boolean; message?: string } => {
  if (!sale) {
    return { valid: false, message: "Venta no encontrada" };
  }

  if (sale.status !== "completed") {
    return { valid: false, message: "Solo se puede facturar una venta completada" };
  }

  if (!sale.customer_id && documentType !== "PRESUPUESTO") {
    return {
      valid: false,
      message: "Sin cliente solo se puede generar PRESUPUESTO",
    };
  }

  return { valid: true };
};

export const invoicesService = {
  getAllByTenant: (tenantId: string) => invoicesCrud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => invoicesCrud.getById(tenantId, id),
  create: (tenantId: string, input: CreateInvoiceInput) => invoicesCrud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateInvoiceInput) =>
    invoicesCrud.update(tenantId, id, input),
  updateArcaStatus: async (
    tenantId: string,
    id: string,
    input: {
      arca_status: ArcaInvoiceStatus;
      arca_reference?: string | null;
      arca_message?: string | null;
    }
  ): Promise<Invoice> => {
    const updated = await invoicesCrud.update(tenantId, id, {
      arca_status: input.arca_status,
      arca_reference: input.arca_reference ?? null,
      arca_message: input.arca_message ?? null,
    });

    if (!updated) {
      throw new Error("Factura no encontrada");
    }

    return updated;
  },
  delete: (tenantId: string, id: string) => invoicesCrud.delete(tenantId, id),

  getBySaleId: async (tenantId: string, saleId: string) => {
    const all = await invoicesCrud.getAllByTenant(tenantId);
    return all.filter((invoice) => invoice.sale_id === saleId);
  },

  generateDocumentNumber: generateNextDocumentNumber,

  createBudget: async (
    tenantId: string,
    input: {
      customer_id?: string | null;
      subtotal: number;
      tax_total?: number;
      notes?: string | null;
      status?: Invoice["status"];
    }
  ): Promise<Invoice> => {
    const documentType: InvoiceDocumentType = "PRESUPUESTO";
    const customer =
      input.customer_id != null ? await customersService.getById(tenantId, input.customer_id) : null;
    const documentNumber = await generateNextDocumentNumber(tenantId, documentType);
    const subtotal = roundAmount(input.subtotal);
    const taxTotal = roundAmount(input.tax_total ?? 0);

    return invoicesCrud.create(tenantId, {
      sale_id: null,
      customer_id: input.customer_id ?? null,
      document_type: documentType,
      document_number: documentNumber,
      issue_date: new Date().toISOString(),
      customer_snapshot: buildFiscalCustomerSnapshot(input.customer_id ?? null, customer),
      items_snapshot: [],
      subtotal,
      tax_total: taxTotal,
      total: roundAmount(subtotal + taxTotal),
      status: input.status ?? "draft",
      arca_status: "not_sent",
      arca_reference: null,
      arca_message: null,
      notes: input.notes?.trim() || null,
    });
  },

  createFromSale: async (
    tenantId: string,
    input: {
      sale_id: string;
      document_type: InvoiceDocumentType;
      notes?: string | null;
    }
  ): Promise<Invoice> => {
    const sale = await salesService.getById(tenantId, input.sale_id);
    const validation = validateInvoiceGenerationFromSale(sale, input.document_type);
    if (!validation.valid) {
      throw new Error(validation.message ?? "No se pudo generar factura");
    }

    const existingForSale = await invoicesService.getBySaleId(tenantId, input.sale_id);
    const duplicated = existingForSale.find(
      (invoice) =>
        invoice.document_type === input.document_type &&
        invoice.status !== "cancelled"
    );
    if (duplicated) {
      throw new Error(`Ya existe un documento ${input.document_type} para esta venta`);
    }

    const customer =
      sale?.customer_id != null ? await customersService.getById(tenantId, sale.customer_id) : null;
    const saleItems = await salesService.getItemsBySaleId(tenantId, input.sale_id);
    const itemsSnapshot = mapSaleItemsToInvoiceSnapshot(saleItems);
    const documentNumber = await generateNextDocumentNumber(tenantId, input.document_type);

    return invoicesCrud.create(tenantId, {
      sale_id: input.sale_id,
      customer_id: sale?.customer_id ?? null,
      document_type: input.document_type,
      document_number: documentNumber,
      issue_date: new Date().toISOString(),
      customer_snapshot: buildFiscalCustomerSnapshot(sale?.customer_id ?? null, customer),
      items_snapshot: itemsSnapshot,
      subtotal: roundAmount(sale?.subtotal ?? 0),
      tax_total: roundAmount(sale?.tax_total ?? 0),
      total: roundAmount(sale?.total ?? 0),
      status: "issued",
      arca_status: "not_sent",
      arca_reference: null,
      arca_message: null,
      notes: input.notes?.trim() || null,
    });
  },
};
