import { supabase } from "@/lib/supabase/client";
import type { TenantScopedTableName } from "@/lib/database/tables";
import { dataProvider } from "@/services/config/data-provider";
import { nowIso, generateEntityId } from "@/services/base/entity-factory";
import { getMockTable, persistMockDatabase } from "@/services/mock/mock-db";
import type { TenantScopedEntity } from "@/types/entities";

export type CreateEntityInput<TEntity extends TenantScopedEntity> = Omit<
  TEntity,
  "id" | "tenant_id" | "created_at" | "updated_at"
>;

export type UpdateEntityInput<TEntity extends TenantScopedEntity> = Partial<
  Omit<TEntity, "id" | "tenant_id" | "created_at" | "updated_at">
>;

const isAuthExpiredError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string; status?: number };
  const message = String(candidate.message ?? "").toLowerCase();
  const code = String(candidate.code ?? "");
  const status = Number(candidate.status ?? 0);
  return (
    status === 401 ||
    code === "PGRST301" ||
    message.includes("jwt expired") ||
    message.includes("invalid claim") ||
    message.includes("token is expired")
  );
};

export class TenantCrudService<TEntity extends TenantScopedEntity> {
  constructor(private readonly tableName: TenantScopedTableName) {}

  private getMockRows(): TEntity[] {
    return getMockTable(this.tableName) as unknown as TEntity[];
  }

  private async execWithAuthRetry<TResult>(
    operation: () => Promise<{ data: TResult | null; error: unknown }>
  ): Promise<TResult | null> {
    const firstResult = await operation();
    if (!firstResult.error) {
      return firstResult.data;
    }

    if (dataProvider === "supabase" && isAuthExpiredError(firstResult.error)) {
      try {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          const retryResult = await operation();
          if (!retryResult.error) {
            return retryResult.data;
          }
        }
      } catch {
        // Ignorar y lanzar error original
      }
    }

    throw firstResult.error;
  }

  async getAllByTenant(tenantId: string): Promise<TEntity[]> {
    if (dataProvider === "mock") {
      const table = this.getMockRows();
      return table.filter((row) => row.tenant_id === tenantId);
    }

    const data = await this.execWithAuthRetry(async () =>
      supabase.from(this.tableName).select("*").eq("tenant_id", tenantId)
    );

    return (data ?? []) as TEntity[];
  }

  async getById(tenantId: string, id: string): Promise<TEntity | null> {
    if (dataProvider === "mock") {
      const table = this.getMockRows();
      return table.find((row) => row.tenant_id === tenantId && row.id === id) ?? null;
    }

    const data = await this.execWithAuthRetry(async () =>
      supabase
        .from(this.tableName)
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .maybeSingle()
    );

    return (data as TEntity | null) ?? null;
  }

  async create(tenantId: string, input: CreateEntityInput<TEntity>): Promise<TEntity> {
    const createdAt = nowIso();

    const row = {
      ...input,
      id: generateEntityId(),
      tenant_id: tenantId,
      created_at: createdAt,
      updated_at: createdAt,
    } as TEntity;

    if (dataProvider === "mock") {
      const table = this.getMockRows();
      table.push(row);
      persistMockDatabase();
      return row;
    }

    const data = await this.execWithAuthRetry(async () =>
      supabase.from(this.tableName).insert(row).select("*").single()
    );

    if (!data) {
      throw new Error("No se pudo crear el registro");
    }

    return data;
  }

  async update(tenantId: string, id: string, input: UpdateEntityInput<TEntity>): Promise<TEntity | null> {
    const payload = {
      ...input,
      updated_at: nowIso(),
    };

    if (dataProvider === "mock") {
      const table = this.getMockRows();
      const index = table.findIndex((row) => row.tenant_id === tenantId && row.id === id);

      if (index < 0) return null;

      const updated = {
        ...table[index],
        ...payload,
      } as TEntity;

      table[index] = updated;
      persistMockDatabase();
      return updated;
    }

    const data = await this.execWithAuthRetry(async () =>
      supabase
        .from(this.tableName)
        .update(payload)
        .eq("tenant_id", tenantId)
        .eq("id", id)
        .select("*")
        .maybeSingle()
    );

    return (data as TEntity | null) ?? null;
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    if (dataProvider === "mock") {
      const table = this.getMockRows();
      const index = table.findIndex((row) => row.tenant_id === tenantId && row.id === id);

      if (index < 0) return false;

      table.splice(index, 1);
      persistMockDatabase();
      return true;
    }

    const result = await this.execWithAuthRetry(async () => {
      const response = await supabase
        .from(this.tableName)
        .delete({ count: "exact" })
        .eq("tenant_id", tenantId)
        .eq("id", id);
      return { data: response.count, error: response.error };
    });

    return Boolean(result && result > 0);
  }
}
