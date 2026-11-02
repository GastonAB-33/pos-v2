import { dbTables } from "@/lib/database/tables";
import { supabase } from "@/lib/supabase/client";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import { dataProvider } from "@/services/config/data-provider";
import { getMockTable } from "@/services/mock/mock-db";
import type { UserRecord } from "@/types/entities";

const crud = new TenantCrudService<UserRecord>(dbTables.users);

export type CreateUserInput = CreateEntityInput<UserRecord>;
export type UpdateUserInput = UpdateEntityInput<UserRecord>;

export const usersService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateUserInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateUserInput) => crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),

  getByAuthUserId: async (authUserId: string) => {
    const normalized = authUserId.trim();
    if (!normalized) return null;

    if (dataProvider === "mock") {
      const rows = getMockTable(dbTables.users) as UserRecord[];
      return rows.find((user) => user.auth_user_id === normalized) ?? null;
    }

    const { data, error } = await supabase
      .from(dbTables.users)
      .select("*")
      .eq("auth_user_id", normalized)
      .maybeSingle();

    if (error) throw error;
    return (data as UserRecord | null) ?? null;
  },

  getByEmailOrUsername: async (tenantId: string, value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;

    const users = await crud.getAllByTenant(tenantId);
    return (
      users.find((user) => {
        const byEmail = user.email?.toLowerCase() === normalized;
        const byUsername = user.username?.toLowerCase() === normalized;
        return byEmail || byUsername;
      }) ?? null
    );
  },

  toggleActive: async (tenantId: string, id: string) => {
    const user = await crud.getById(tenantId, id);
    if (!user) return null;
    return crud.update(tenantId, id, { is_active: !user.is_active });
  },
};
