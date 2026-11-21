import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { BankAccountMovement } from "@/types/entities";

const bankAccountMovementsCrud = new TenantCrudService<BankAccountMovement>(
  dbTables.bank_account_movements
);

export type CreateBankAccountMovementInput = Omit<
  CreateEntityInput<BankAccountMovement>,
  "balance_after" | "notes" | "reference_id" | "voucher_number" | "created_by"
> & {
  notes?: string | null;
  reference_id?: string | null;
  voucher_number?: string | null;
  created_by?: string | null;
};

export interface BankAccountBalanceSummary {
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalMovements: number;
}

export const bankAccountMovementsService = {
  getAllByTenant: (tenantId: string) =>
    bankAccountMovementsCrud.getAllByTenant(tenantId),

  getRecentByTenant: (
    tenantId: string,
    limit = 500
  ): Promise<BankAccountMovement[]> => {
    return bankAccountMovementsCrud.query(tenantId, {
      order: { column: "created_at", ascending: false },
      limit,
    });
  },

  getByBankAccount: async (
    tenantId: string,
    bankAccountId: string,
    limit?: number
  ): Promise<BankAccountMovement[]> => {
    return bankAccountMovementsCrud.query(tenantId, {
      eq: { bank_account_id: bankAccountId },
      order: { column: "created_at", ascending: false },
      limit,
    });
  },

  getBalanceByBankAccount: async (
    tenantId: string,
    bankAccountId: string
  ): Promise<BankAccountBalanceSummary> => {
    const movements = await bankAccountMovementsService.getByBankAccount(
      tenantId,
      bankAccountId,
      500
    );

    // Los movimientos vienen desc, invertimos para reconstruir cronológicamente
    const chronological = [...movements].reverse();
    const lastMovement = chronological[chronological.length - 1];
    const currentBalance = Number(lastMovement?.balance_after) || 0;

    let totalIncome = 0;
    let totalExpense = 0;

    for (const mov of movements) {
      const amt = Number(mov.amount) || 0;
      if (mov.type === "income") {
        totalIncome += amt;
      } else {
        totalExpense += amt;
      }
    }

    return {
      currentBalance: Number(currentBalance.toFixed(2)),
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpense: Number(totalExpense.toFixed(2)),
      totalMovements: movements.length,
    };
  },

  getAllBalancesByTenant: async (
    tenantId: string
  ): Promise<Record<string, number>> => {
    const all = await bankAccountMovementsCrud.query(tenantId, {
      order: { column: "created_at", ascending: true },
      limit: 1000,
    });

    const balances: Record<string, number> = {};
    for (const mov of all) {
      balances[mov.bank_account_id] = Number(mov.balance_after) || 0;
    }
    return balances;
  },

  createMovement: async (
    tenantId: string,
    payload: CreateBankAccountMovementInput
  ): Promise<BankAccountMovement> => {
    // Optimización crítica de egress: Traer UNICAMENTE el último movimiento para balance_after
    const latestMovements = await bankAccountMovementsCrud.query(tenantId, {
      eq: { bank_account_id: payload.bank_account_id },
      order: { column: "created_at", ascending: false },
      limit: 1,
    });
    const previousBalance = Number(latestMovements[0]?.balance_after) || 0;

    const numAmount = Number(payload.amount) || 0;
    const delta =
      payload.type === "income" ? Math.abs(numAmount) : -Math.abs(numAmount);
    const balanceAfter = Number((previousBalance + delta).toFixed(2));

    return bankAccountMovementsCrud.create(tenantId, {
      ...payload,
      amount: Math.abs(numAmount),
      notes: payload.notes ?? null,
      reference_id: payload.reference_id ?? null,
      voucher_number: payload.voucher_number ?? null,
      created_by: payload.created_by ?? null,
      balance_after: balanceAfter,
    });
  },
};
