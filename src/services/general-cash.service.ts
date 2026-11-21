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

  getRecentByTenant: (tenantId: string, limit = 300) =>
    generalCashCrud.query(tenantId, {
      order: { column: "created_at", ascending: false },
      limit,
    }),

  createMovement: async (
    tenantId: string,
    payload: CreateGeneralCashMovementInput
  ): Promise<GeneralCashMovement> => {
    // Optimización crítica de egress: Traer UNICAMENTE el último movimiento para balance_after
    const latestMovements = await generalCashCrud.query(tenantId, {
      order: { column: "created_at", ascending: false },
      limit: 1,
    });
    const previousBalance = Number(latestMovements[0]?.balance_after) || 0;

    const numAmount = Number(payload.amount) || 0;
    const delta =
      payload.type === "income" ? Math.abs(numAmount) : -Math.abs(numAmount);
    const balanceAfter = Number((previousBalance + delta).toFixed(2));

    return generalCashCrud.create(tenantId, {
      ...payload,
      amount: Math.abs(numAmount),
      notes: payload.notes ?? null,
      reference_id: payload.reference_id ?? null,
      created_by: payload.created_by ?? null,
      balance_after: balanceAfter,
    });
  },

  getBalanceSummary: async (tenantId: string): Promise<GeneralCashSummary> => {
    // Acotado a los últimos 500 movimientos para evitar escanear toda la tabla
    const movements = await generalCashCrud.query(tenantId, {
      order: { column: "created_at", ascending: true },
      limit: 500,
    });
    const currentBalance =
      movements.length > 0 ? Number(movements[movements.length - 1].balance_after) || 0 : 0;

    let totalIncome = 0;
    let totalExpense = 0;
    let inflowFromDailyCash = 0;
    let outflowToDailyCash = 0;

    for (const mov of movements) {
      const amt = Number(mov.amount) || 0;
      if (mov.type === "income") {
        totalIncome += amt;
        if (mov.origin_type === "daily_cash_close") {
          inflowFromDailyCash += amt;
        }
      } else {
        totalExpense += amt;
        if (mov.origin_type === "daily_cash_open") {
          outflowToDailyCash += amt;
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
