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

const isMissingColumnError = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { message?: string; details?: string };
  const message = String(candidate.message ?? "");
  const details = String(candidate.details ?? "");
  const pgrst = message.match(/could not find the '([^']+)' column/i);
  if (pgrst) return pgrst[1];
  const pg = message.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);
  if (pg) return pg[1];
  const pgDetails = details.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);
  if (pgDetails) return pgDetails[1];
  return null;
};

const isMissingTableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  // Si es un error de columna faltante en PostgREST/Postgres, NO es tabla faltante
  if (isMissingColumnError(error)) return false;

  const candidate = error as { code?: string; message?: string; status?: number; details?: string };
  const message = String(candidate.message ?? "").toLowerCase();
  const code = String(candidate.code ?? "");
  const status = Number(candidate.status ?? 0);

  if (message.includes("column") || message.includes("columna")) {
    return false;
  }

  return (
    code === "PGRST205" ||
    code === "42P01" ||
    status === 404 ||
    message.includes("could not find the table") ||
    (message.includes("schema cache") && (message.includes("table") || message.includes("relation"))) ||
    (message.includes("does not exist") && (message.includes("table") || message.includes("relation")))
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

    const pageSize = 1000;
    let from = 0;
    const allRecords: TEntity[] = [];

    try {
      while (true) {
        const to = from + pageSize - 1;
        const data = await this.execWithAuthRetry(async () =>
          supabase
            .from(this.tableName)
            .select("*")
            .eq("tenant_id", tenantId)
            .range(from, to)
        );

        const chunk = (data ?? []) as TEntity[];
        if (chunk.length === 0) break;
        allRecords.push(...chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }

      return allRecords;
    } catch (error) {
      if (isMissingTableError(error)) {
        console.warn(
          `[TenantCrudService] Tabla "${this.tableName}" no encontrada en Supabase (PGRST205). Utilizando almacenamiento local de respaldo.`
        );
        const table = this.getMockRows();
        return table.filter((row) => row.tenant_id === tenantId);
      }
      throw error;
    }
  }

  async query(
    tenantId: string,
    options: {
      eq?: Record<string, unknown>;
      order?: { column: string; ascending?: boolean };
      limit?: number;
    } = {}
  ): Promise<TEntity[]> {
    if (dataProvider === "mock") {
      let rows = this.getMockRows().filter((row) => {
        if (row.tenant_id !== tenantId) return false;
        if (options.eq) {
          for (const [key, val] of Object.entries(options.eq)) {
            if ((row as unknown as Record<string, unknown>)[key] !== val) return false;
          }
        }
        return true;
      });
      if (options.order) {
        const col = options.order.column;
        const asc = options.order.ascending ?? true;
        rows = [...rows].sort((a, b) => {
          const valA = (a as unknown as Record<string, unknown>)[col];
          const valB = (b as unknown as Record<string, unknown>)[col];
          if (valA == null && valB == null) return 0;
          if (valA == null) return asc ? -1 : 1;
          if (valB == null) return asc ? 1 : -1;
          if (valA < valB) return asc ? -1 : 1;
          if (valA > valB) return asc ? 1 : -1;
          return 0;
        });
      }
      if (options.limit != null) {
        rows = rows.slice(0, options.limit);
      }
      return rows;
    }

    try {
      const data = await this.execWithAuthRetry(async () => {
        let builder = supabase.from(this.tableName).select("*").eq("tenant_id", tenantId);
        if (options.eq) {
          for (const [key, val] of Object.entries(options.eq)) {
            builder = builder.eq(key, val);
          }
        }
        if (options.order) {
          builder = builder.order(options.order.column, {
            ascending: options.order.ascending ?? true,
          });
        }
        if (options.limit != null) {
          builder = builder.limit(options.limit);
        }
        return builder;
      });

      return (data as TEntity[] | null) ?? [];
    } catch (error) {
      if (isMissingTableError(error)) {
        console.warn(
          `[TenantCrudService] Tabla "${this.tableName}" no encontrada en Supabase al consultar. Utilizando almacenamiento local de respaldo.`
        );
        let rows = this.getMockRows().filter((row) => {
          if (row.tenant_id !== tenantId) return false;
          if (options.eq) {
            for (const [key, val] of Object.entries(options.eq)) {
              if ((row as unknown as Record<string, unknown>)[key] !== val) return false;
            }
          }
          return true;
        });
        if (options.order) {
          const col = options.order.column;
          const asc = options.order.ascending ?? true;
          rows = [...rows].sort((a, b) => {
            const valA = (a as unknown as Record<string, unknown>)[col];
            const valB = (b as unknown as Record<string, unknown>)[col];
            if (valA == null && valB == null) return 0;
            if (valA == null) return asc ? -1 : 1;
            if (valB == null) return asc ? 1 : -1;
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
          });
        }
        if (options.limit != null) {
          rows = rows.slice(0, options.limit);
        }
        return rows;
      }
      throw error;
    }
  }

  async getById(tenantId: string, id: string): Promise<TEntity | null> {
    if (dataProvider === "mock") {
      const table = this.getMockRows();
      return table.find((row) => row.tenant_id === tenantId && row.id === id) ?? null;
    }

    try {
      const data = await this.execWithAuthRetry(async () =>
        supabase
          .from(this.tableName)
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("id", id)
          .maybeSingle()
      );

      return (data as TEntity | null) ?? null;
    } catch (error) {
      if (isMissingTableError(error)) {
        const table = this.getMockRows();
        return table.find((row) => row.tenant_id === tenantId && row.id === id) ?? null;
      }
      throw error;
    }
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

    const payload: Record<string, unknown> = { ...(row as unknown as Record<string, unknown>) };

    while (true) {
      try {
        const data = await this.execWithAuthRetry(async () =>
          supabase.from(this.tableName).insert(payload).select("*").single()
        );

        if (!data) {
          throw new Error("No se pudo crear el registro");
        }

        return data as TEntity;
      } catch (error) {
        const missingCol = isMissingColumnError(error);
        if (missingCol && missingCol in payload) {
          console.warn(
            `[TenantCrudService] Columna "${missingCol}" no existe en "${this.tableName}". Reintentando inserción sin este campo.`
          );
          if (missingCol === "tax_id" && payload.tax_id) {
            const currentObs = typeof payload.observations === "string" ? payload.observations : "";
            if (!currentObs.includes(String(payload.tax_id))) {
              payload.observations = currentObs
                ? `${currentObs} | CUIT: ${payload.tax_id}`
                : `CUIT: ${payload.tax_id}`;
            }
          }
          delete payload[missingCol];
          continue;
        }

        if (isMissingTableError(error)) {
          console.warn(
            `[TenantCrudService] Tabla "${this.tableName}" no encontrada en Supabase al crear. Guardando en almacenamiento local.`
          );
          const table = this.getMockRows();
          table.push(row);
          persistMockDatabase();
          return row;
        }
        throw error;
      }
    }
  }

  async update(tenantId: string, id: string, input: UpdateEntityInput<TEntity>): Promise<TEntity | null> {
    const payload: Record<string, unknown> = {
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

    while (true) {
      try {
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
      } catch (error) {
        const missingCol = isMissingColumnError(error);
        if (missingCol && missingCol in payload) {
          console.warn(
            `[TenantCrudService] Columna "${missingCol}" no existe en "${this.tableName}". Reintentando actualización sin este campo.`
          );
          if (missingCol === "tax_id" && payload.tax_id) {
            const currentObs = typeof payload.observations === "string" ? payload.observations : "";
            if (!currentObs.includes(String(payload.tax_id))) {
              payload.observations = currentObs
                ? `${currentObs} | CUIT: ${payload.tax_id}`
                : `CUIT: ${payload.tax_id}`;
            }
          }
          delete payload[missingCol];
          continue;
        }

        if (isMissingTableError(error)) {
          const table = this.getMockRows();
          const index = table.findIndex((row) => row.tenant_id === tenantId && row.id === id);
          if (index < 0) return null;
          const updated = { ...table[index], ...payload } as TEntity;
          table[index] = updated;
          persistMockDatabase();
          return updated;
        }
        throw error;
      }
    }
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

    try {
      const result = await this.execWithAuthRetry(async () => {
        const response = await supabase
          .from(this.tableName)
          .delete({ count: "exact" })
          .eq("tenant_id", tenantId)
          .eq("id", id);
        return { data: response.count, error: response.error };
      });

      return Boolean(result && result > 0);
    } catch (error) {
      if (isMissingTableError(error)) {
        const table = this.getMockRows();
        const index = table.findIndex((row) => row.tenant_id === tenantId && row.id === id);
        if (index < 0) return false;
        table.splice(index, 1);
        persistMockDatabase();
        return true;
      }
      throw error;
    }
  }
}
