import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { InstallmentPlan } from "@/types/entities";

const crud = new TenantCrudService<InstallmentPlan>(dbTables.installment_plans);

export type CreateInstallmentPlanInput = CreateEntityInput<InstallmentPlan>;
export type UpdateInstallmentPlanInput = UpdateEntityInput<InstallmentPlan>;

const defaultInstallmentPlans: Array<
  Omit<CreateInstallmentPlanInput, "tenant_id" | "id" | "created_at" | "updated_at">
> = [
  {
    code: "cuotas_1_0",
    name: "1 cuota sin interes",
    installments: 1,
    interest_percent: 0,
    card_brand: null,
    notes: "Plan base",
    is_active: true,
  },
  {
    code: "cuotas_3_10",
    name: "3 cuotas",
    installments: 3,
    interest_percent: 10,
    card_brand: null,
    notes: "Plan base",
    is_active: true,
  },
  {
    code: "cuotas_6_20",
    name: "6 cuotas",
    installments: 6,
    interest_percent: 20,
    card_brand: null,
    notes: "Plan base",
    is_active: true,
  },
];

export const installmentPlansService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),

  getActiveByTenant: async (tenantId: string) => {
    const rows = await crud.getAllByTenant(tenantId);
    return rows.filter((row) => row.is_active);
  },

  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateInstallmentPlanInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateInstallmentPlanInput) =>
    crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),

  ensureDefaults: async (tenantId: string) => {
    const rows = await crud.getAllByTenant(tenantId);
    const existingCodes = new Set(rows.map((row) => row.code.trim().toLowerCase()));
    const created: InstallmentPlan[] = [];

    for (const template of defaultInstallmentPlans) {
      if (existingCodes.has(template.code)) continue;
      const next = await crud.create(tenantId, template);
      created.push(next);
      existingCodes.add(template.code);
    }

    return created;
  },

  toggleActive: async (tenantId: string, id: string) => {
    const row = await crud.getById(tenantId, id);
    if (!row) return null;
    return crud.update(tenantId, id, { is_active: !row.is_active });
  },

  calculateTotalWithInterest: (baseAmount: number, interestPercent: number): number =>
    Number((baseAmount + baseAmount * (interestPercent / 100)).toFixed(2)),
};

