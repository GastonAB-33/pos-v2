import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { CashMovement, CashSession } from "@/types/entities";

const cashSessionsCrud = new TenantCrudService<CashSession>(dbTables.cash_sessions);
const cashMovementsCrud = new TenantCrudService<CashMovement>(dbTables.cash_movements);

export type CreateCashSessionInput = CreateEntityInput<CashSession>;
export type UpdateCashSessionInput = UpdateEntityInput<CashSession>;
export type CreateCashMovementInput = CreateEntityInput<CashMovement>;

export const cashService = {
  getAllByTenant: (tenantId: string) => cashSessionsCrud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => cashSessionsCrud.getById(tenantId, id),
  create: (tenantId: string, input: CreateCashSessionInput) => cashSessionsCrud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateCashSessionInput) => cashSessionsCrud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => cashSessionsCrud.delete(tenantId, id),
  createMovement: (tenantId: string, input: CreateCashMovementInput) =>
    cashMovementsCrud.create(tenantId, input),

  getOpenSession: async (tenantId: string) => {
    const sessions = await cashSessionsCrud.getAllByTenant(tenantId);

    return sessions
      .filter((session) => session.status === "open")
      .sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0] ?? null;
  },

  getOpenSessionByUser: async (tenantId: string, userId: string) => {
    const sessions = await cashSessionsCrud.getAllByTenant(tenantId);

    return sessions
      .filter((session) => session.status === "open" && session.opened_by_user_id === userId)
      .sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0] ?? null;
  },

  getAllMovementsByTenant: (tenantId: string) => cashMovementsCrud.getAllByTenant(tenantId),

  getMovementsBySessionId: async (tenantId: string, cashSessionId: string) => {
    const allMovements = await cashMovementsCrud.getAllByTenant(tenantId);
    return allMovements.filter((movement) => movement.cash_session_id === cashSessionId);
  },
};
