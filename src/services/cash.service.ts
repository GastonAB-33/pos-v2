import { dbTables } from "@/lib/database/tables";
import { supabase } from "@/lib/supabase/client";
import { generateEntityId, nowIso } from "@/services/base/entity-factory";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import { dataProvider } from "@/services/config/data-provider";
import type { CashMovement, CashSession } from "@/types/entities";

const cashSessionsCrud = new TenantCrudService<CashSession>(dbTables.cash_sessions);
const cashMovementsCrud = new TenantCrudService<CashMovement>(dbTables.cash_movements);

export type CreateCashSessionInput = CreateEntityInput<CashSession>;
export type UpdateCashSessionInput = UpdateEntityInput<CashSession>;
export type CreateCashMovementInput = CreateEntityInput<CashMovement>;

type CashMovementDbCompat = CashMovement & {
  type?: CashMovement["movement_type"] | null;
};

const normalizeMovement = (row: CashMovementDbCompat): CashMovement => {
  const movementType = row.movement_type ?? row.type ?? "adjustment";

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    cash_session_id: row.cash_session_id,
    movement_type: movementType,
    amount: row.amount,
    currency_code: row.currency_code,
    reference_type: row.reference_type,
    reference_id: row.reference_id,
    notes: row.notes,
    created_by: row.created_by ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const createMovementRow = (
  tenantId: string,
  input: CreateCashMovementInput
): Omit<CashMovement, never> => {
  const timestamp = nowIso();
  return {
    id: generateEntityId(),
    tenant_id: tenantId,
    cash_session_id: input.cash_session_id,
    movement_type: input.movement_type,
    amount: input.amount,
    currency_code: input.currency_code,
    reference_type: input.reference_type,
    reference_id: input.reference_id ?? null,
    notes: input.notes ?? null,
    created_by: input.created_by ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  };
};

const getLatestOpenSession = async (tenantId: string, userId?: string): Promise<CashSession | null> => {
  if (dataProvider === "mock") {
    const sessions = await cashSessionsCrud.getAllByTenant(tenantId);
    return sessions
      .filter((session) =>
        userId
          ? session.status === "open" && session.opened_by_user_id === userId
          : session.status === "open"
      )
      .sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0] ?? null;
  }

  let query = supabase
    .from(dbTables.cash_sessions)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "open");

  if (userId) {
    query = query.eq("opened_by_user_id", userId);
  }

  const { data, error } = await query.order("opened_at", { ascending: false }).limit(1).maybeSingle();

  if (error) {
    throw error;
  }

  return (data as CashSession | null) ?? null;
};

export const cashService = {
  getAllByTenant: (tenantId: string) => cashSessionsCrud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => cashSessionsCrud.getById(tenantId, id),
  create: (tenantId: string, input: CreateCashSessionInput) => cashSessionsCrud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateCashSessionInput) => cashSessionsCrud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => cashSessionsCrud.delete(tenantId, id),
  createMovement: async (tenantId: string, input: CreateCashMovementInput) => {
    if (dataProvider === "mock") {
      return cashMovementsCrud.create(tenantId, input);
    }

    const baseRow = createMovementRow(tenantId, input);

    const firstAttempt = await supabase
      .from(dbTables.cash_movements)
      .insert(baseRow)
      .select("*")
      .single();

    if (!firstAttempt.error) {
      return normalizeMovement(firstAttempt.data as CashMovementDbCompat);
    }

    const compatAttempt = await supabase
      .from(dbTables.cash_movements)
      .insert({
        ...baseRow,
        type: baseRow.movement_type,
      })
      .select("*")
      .single();

    if (!compatAttempt.error) {
      return normalizeMovement(compatAttempt.data as CashMovementDbCompat);
    }

    const legacyRow = {
      id: baseRow.id,
      tenant_id: baseRow.tenant_id,
      cash_session_id: baseRow.cash_session_id,
      type: baseRow.movement_type,
      amount: baseRow.amount,
      currency_code: baseRow.currency_code,
      reference_type: baseRow.reference_type,
      reference_id: baseRow.reference_id,
      notes: baseRow.notes,
      created_by: baseRow.created_by,
      created_at: baseRow.created_at,
      updated_at: baseRow.updated_at,
    };

    const legacyAttempt = await supabase
      .from(dbTables.cash_movements)
      .insert(legacyRow)
      .select("*")
      .single();

    if (!legacyAttempt.error) {
      return normalizeMovement(legacyAttempt.data as CashMovementDbCompat);
    }

    throw legacyAttempt.error ?? compatAttempt.error ?? firstAttempt.error;
  },

  getOpenSession: async (tenantId: string) => getLatestOpenSession(tenantId),

  getOpenSessionByUser: async (tenantId: string, userId: string) =>
    getLatestOpenSession(tenantId, userId),

  getAllMovementsByTenant: async (tenantId: string) => {
    const rows = await cashMovementsCrud.getAllByTenant(tenantId);
    return rows.map((row) => normalizeMovement(row as CashMovementDbCompat));
  },

  getMovementsBySessionId: async (tenantId: string, cashSessionId: string) => {
    const allMovements = await cashService.getAllMovementsByTenant(tenantId);
    return allMovements.filter((movement) => movement.cash_session_id === cashSessionId);
  },
};
