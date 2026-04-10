import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
} from "@/services/base/tenant-crud.service";
import { customersService } from "@/services/customers.service";
import type { CurrentAccountMovement } from "@/types/entities";

const movementsCrud = new TenantCrudService<CurrentAccountMovement>(dbTables.current_account_movements);

export type CreateCurrentAccountMovementInput = Omit<
  CreateEntityInput<CurrentAccountMovement>,
  "balance_after"
>;

const normalizeAmountByType = (
  type: CurrentAccountMovement["type"],
  amount: number
): number => {
  const absAmount = Math.abs(amount);

  if (type === "debt") return absAmount;
  if (type === "payment") return -absAmount;
  return amount;
};

export const currentAccountsService = {
  getAllByTenant: (tenantId: string) => movementsCrud.getAllByTenant(tenantId),

  getByCustomer: async (tenantId: string, customerId: string): Promise<CurrentAccountMovement[]> => {
    const all = await movementsCrud.getAllByTenant(tenantId);

    return all
      .filter((movement) => movement.customer_id === customerId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  getCustomerBalance: async (tenantId: string, customerId: string): Promise<number> => {
    const customer = await customersService.getById(tenantId, customerId);
    return customer?.current_balance ?? 0;
  },

  createMovement: async (
    tenantId: string,
    payload: CreateCurrentAccountMovementInput
  ): Promise<CurrentAccountMovement> => {
    const customer = await customersService.getById(tenantId, payload.customer_id);
    if (!customer) {
      throw new Error("Cliente no encontrado para registrar movimiento");
    }

    const signedDelta = normalizeAmountByType(payload.type, payload.amount);
    const nextBalance = Number((customer.current_balance + signedDelta).toFixed(2));

    const movement = await movementsCrud.create(tenantId, {
      customer_id: payload.customer_id,
      sale_id: payload.sale_id ?? null,
      type: payload.type,
      amount: payload.amount,
      balance_after: nextBalance,
      notes: payload.notes ?? null,
      created_by: payload.created_by ?? null,
    });

    await customersService.update(tenantId, payload.customer_id, { current_balance: nextBalance });

    return movement;
  },

  recalculateCustomerBalance: async (tenantId: string, customerId: string): Promise<number> => {
    const customer = await customersService.getById(tenantId, customerId);
    if (!customer) {
      throw new Error("Cliente no encontrado para recalcular saldo");
    }

    const movements = await currentAccountsService.getByCustomer(tenantId, customerId);

    let runningBalance = 0;
    for (const movement of movements) {
      const signedDelta = normalizeAmountByType(movement.type, movement.amount);
      runningBalance = Number((runningBalance + signedDelta).toFixed(2));

      await movementsCrud.update(tenantId, movement.id, {
        balance_after: runningBalance,
      });
    }

    await customersService.update(tenantId, customerId, { current_balance: runningBalance });
    return runningBalance;
  },
};
