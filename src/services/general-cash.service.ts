import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { GeneralCashMovement } from "@/types/entities";

const generalCashCrud = new TenantCrudService<GeneralCashMovement>(
  dbTables.general_cash_movements
);

export type CreateGeneralCashMovementInput = Omit<
  CreateEntityInput<GeneralCashMovement>,
  "balance_after" | "notes" | "reference_id" | "created_by"
> & {
  notes?: string | null;
  reference_id?: string | null;
  created_by?: string | null;
};

export interface GeneralCashSummary {
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
  inflowFromDailyCash: number;
  outflowToDailyCash: number;
  totalMovements: number;
}

export const generalCashService = {
  getAllByTenant: (tenantId: string) => generalCashCrud.getAllByTenant(tenantId),

  createMovement: async (
    tenantId: string,
    payload: CreateGeneralCashMovementInput
  ): Promise<GeneralCashMovement> => {
    const movements = await generalCashCrud.getAllByTenant(tenantId);

    const sorted = [...movements].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    const lastMovement = sorted[sorted.length - 1];
    const previousBalance = lastMovement?.balance_after ?? 0;

    const delta =
      payload.type === "income" ? Math.abs(payload.amount) : -Math.abs(payload.amount);
    const balanceAfter = Number((previousBalance + delta).toFixed(2));

    return generalCashCrud.create(tenantId, {
      ...payload,
      notes: payload.notes ?? null,
      reference_id: payload.reference_id ?? null,
      created_by: payload.created_by ?? null,
      balance_after: balanceAfter,
    });
  },

  getBalanceSummary: async (tenantId: string): Promise<GeneralCashSummary> => {
    const movements = await generalCashCrud.getAllByTenant(tenantId);
    const sorted = [...movements].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    const currentBalance =
      sorted.length > 0 ? sorted[sorted.length - 1].balance_after : 0;

    let totalIncome = 0;
    let totalExpense = 0;
    let inflowFromDailyCash = 0;
    let outflowToDailyCash = 0;

    for (const mov of movements) {
      if (mov.type === "income") {
        totalIncome += mov.amount;
        if (mov.origin_type === "daily_cash_close") {
          inflowFromDailyCash += mov.amount;
        }
      } else {
        totalExpense += mov.amount;
        if (mov.origin_type === "daily_cash_open") {
          outflowToDailyCash += mov.amount;
        }
      }
    }

    return {
      currentBalance: Number(currentBalance.toFixed(2)),
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpense: Number(totalExpense.toFixed(2)),
      inflowFromDailyCash: Number(inflowFromDailyCash.toFixed(2)),
      outflowToDailyCash: Number(outflowToDailyCash.toFixed(2)),
      totalMovements: movements.length,
    };
  },
};
