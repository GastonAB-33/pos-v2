import { dbTables } from "@/lib/database/tables";
import { supabase } from "@/lib/supabase/client";
import { generateEntityId, nowIso } from "@/services/base/entity-factory";
import { dataProvider } from "@/services/config/data-provider";
import { getMockTable, persistMockDatabase } from "@/services/mock/mock-db";
import type { AuditLog } from "@/types/entities";
import { downloadCsv } from "@/utils/csv";

export interface AuditFilters {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  module?: string;
  action?: string;
}

export type CreateAuditLogInput = Omit<AuditLog, "id" | "tenant_id" | "created_at">;

const getAuditMockRows = (): AuditLog[] => getMockTable(dbTables.audit_logs) as AuditLog[];

const sortByCreatedAtDesc = (rows: AuditLog[]): AuditLog[] =>
  [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));

const matchesFilter = (row: AuditLog, filters: AuditFilters): boolean => {
  if (filters.userId && row.user_id !== filters.userId) return false;
  if (filters.module && row.module !== filters.module) return false;
  if (filters.action && row.action !== filters.action) return false;
  if (filters.dateFrom && row.created_at.slice(0, 10) < filters.dateFrom) return false;
  if (filters.dateTo && row.created_at.slice(0, 10) > filters.dateTo) return false;
  return true;
};

export const auditService = {
  async getAllByTenant(tenantId: string): Promise<AuditLog[]> {
    if (dataProvider === "mock") {
      const rows = getAuditMockRows().filter((row) => row.tenant_id === tenantId);
      return sortByCreatedAtDesc(rows);
    }

    const { data, error } = await supabase
      .from(dbTables.audit_logs)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as AuditLog[];
  },

  async create(tenantId: string, input: CreateAuditLogInput): Promise<AuditLog> {
    const row: AuditLog = {
      id: generateEntityId(),
      tenant_id: tenantId,
      user_id: input.user_id ?? null,
      module: input.module,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      description: input.description,
      metadata: input.metadata ?? null,
      created_at: nowIso(),
    };

    if (dataProvider === "mock") {
      getAuditMockRows().push(row);
      persistMockDatabase();
      return row;
    }

    const { data, error } = await supabase
      .from(dbTables.audit_logs)
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return data as AuditLog;
  },

  async createSafe(tenantId: string | null, input: CreateAuditLogInput): Promise<void> {
    if (!tenantId) return;

    try {
      await auditService.create(tenantId, input);
    } catch {
      // No romper flujo principal por fallas de auditoria.
    }
  },

  async getByFilters(tenantId: string, filters: AuditFilters): Promise<AuditLog[]> {
    const all = await auditService.getAllByTenant(tenantId);
    return all.filter((row) => matchesFilter(row, filters));
  },

  async deleteOlderThan(tenantId: string, cutoffDateIso: string): Promise<number> {
    if (dataProvider === "mock") {
      const table = getAuditMockRows();
      let deleted = 0;

      for (let index = table.length - 1; index >= 0; index -= 1) {
        const row = table[index];
        if (row.tenant_id !== tenantId) continue;
        if (row.created_at >= cutoffDateIso) continue;
        table.splice(index, 1);
        deleted += 1;
      }

      if (deleted > 0) {
        persistMockDatabase();
      }

      return deleted;
    }

    const { data, error } = await supabase
      .from(dbTables.audit_logs)
      .delete()
      .eq("tenant_id", tenantId)
      .lt("created_at", cutoffDateIso)
      .select("id");

    if (error) throw error;
    return (data ?? []).length;
  },

  exportCsv: (fileName: string, rows: AuditLog[]) => {
    return downloadCsv(
      fileName,
      rows.map((row) => ({
        fecha: row.created_at,
        user_id: row.user_id ?? "",
        modulo: row.module,
        accion: row.action,
        entidad: row.entity_type,
        entidad_id: row.entity_id ?? "",
        descripcion: row.description,
        metadata: row.metadata ? JSON.stringify(row.metadata) : "",
      }))
    );
  },
};
