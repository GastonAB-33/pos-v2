import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { PaymentMethod } from "@/types/entities";

const crud = new TenantCrudService<PaymentMethod>(dbTables.payment_methods);

export type CreatePaymentMethodInput = CreateEntityInput<PaymentMethod>;
export type UpdatePaymentMethodInput = UpdateEntityInput<PaymentMethod>;

const defaultPaymentMethodTemplates: Array<
  Omit<CreatePaymentMethodInput, "tenant_id" | "id" | "created_at" | "updated_at">
> = [
  {
    name: "Efectivo",
    code: "cash",
    type: "cash",
    is_active: true,
    affects_cash: true,
    surcharge_percent: 0,
    discount_percent: 0,
    notes: "Medio predeterminado POS",
  },
  {
    name: "Tarjeta de debito",
    code: "card_debit",
    type: "card",
    is_active: true,
    affects_cash: false,
    surcharge_percent: 0,
    discount_percent: 0,
    notes: "Medio predeterminado POS",
  },
  {
    name: "Tarjeta de credito",
    code: "card_credit",
    type: "card",
    is_active: true,
    affects_cash: false,
    surcharge_percent: 0,
    discount_percent: 0,
    notes: "Medio predeterminado POS",
  },
  {
    name: "Transferencia",
    code: "transfer",
    type: "transfer",
    is_active: true,
    affects_cash: false,
    surcharge_percent: 0,
    discount_percent: 0,
    notes: "Medio predeterminado POS",
  },
  {
    name: "Cuenta corriente",
    code: "current_account",
    type: "current_account",
    is_active: true,
    affects_cash: false,
    surcharge_percent: 0,
    discount_percent: 0,
    notes: "Medio predeterminado POS",
  },
  {
    name: "Mercado Pago",
    code: "mercado_pago",
    type: "mercado_pago",
    is_active: true,
    affects_cash: false,
    surcharge_percent: 0,
    discount_percent: 0,
    notes: "Medio predeterminado POS",
  },
];

export const paymentMethodsService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),

  getActiveByTenant: async (tenantId: string) => {
    const all = await crud.getAllByTenant(tenantId);
    return all.filter((method) => method.is_active);
  },

  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreatePaymentMethodInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdatePaymentMethodInput) =>
    crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),

  ensureDefaultMethods: async (tenantId: string) => {
    const rows = await crud.getAllByTenant(tenantId);
    const existingCodes = new Set(rows.map((row) => row.code.trim().toLowerCase()));
    const created: PaymentMethod[] = [];

    for (const template of defaultPaymentMethodTemplates) {
      if (existingCodes.has(template.code)) continue;

      const next = await crud.create(tenantId, template);
      created.push(next);
      existingCodes.add(template.code);
    }

    return created;
  },

  toggleActive: async (tenantId: string, id: string) => {
    const paymentMethod = await crud.getById(tenantId, id);
    if (!paymentMethod) return null;

    return crud.update(tenantId, id, {
      is_active: !paymentMethod.is_active,
    });
  },
};
