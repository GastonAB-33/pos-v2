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
  "balance_after" | "sale_id"
> & {
  sale_id?: string | null;
};

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
  getRecentByTenant: (tenantId: string, limit = 200) =>
    movementsCrud.query(tenantId, { order: { column: "created_at", ascending: false }, limit }),

  getByCustomer: async (tenantId: string, customerId: string): Promise<CurrentAccountMovement[]> => {
    return movementsCrud.query(tenantId, {
      eq: { customer_id: customerId },
      order: { column: "created_at", ascending: true },
    });
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
