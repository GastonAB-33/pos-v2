import { dbTables } from "@/lib/database/tables";
import { supabase } from "@/lib/supabase/client";
import { dataProvider } from "@/services/config/data-provider";
import { generateEntityId, nowIso } from "@/services/base/entity-factory";
import { getMockTable, persistMockDatabase } from "@/services/mock/mock-db";
import type { TenantRecord } from "@/types/entities";
import type { Tenant } from "@/types/tenant";
import { normalizeTenantSlug } from "@/utils/tenant-slug";

const getMockTenants = (): TenantRecord[] => getMockTable(dbTables.tenants) as TenantRecord[];

const toTenant = (record: TenantRecord): Tenant => ({
  id: record.id,
  legalName: record.legal_name,
  tradeName: record.trade_name,
  slug: record.slug ?? normalizeTenantSlug(record.trade_name),
  cuit: record.cuit,
  isActive: record.is_active,
  createdAt: record.created_at,
  defaultBranchId: null,
  branches: [],
});

const fromTenantInput = (input: {
  legal_name: string;
  trade_name: string;
  slug?: string | null;
  cuit: string;
  is_active: boolean;
}): TenantRecord => {
  const createdAt = nowIso();
  return {
    id: generateEntityId(),
    legal_name: input.legal_name,
    trade_name: input.trade_name,
    slug: normalizeTenantSlug(input.slug ?? input.trade_name),
    cuit: input.cuit,
    is_active: input.is_active,
    created_at: createdAt,
    updated_at: createdAt,
  };
};

export const tenantsService = {
  async getAll(): Promise<TenantRecord[]> {
    if (dataProvider === "mock") {
      return [...getMockTenants()];
    }

    const { data, error } = await supabase.from(dbTables.tenants).select("*");
    if (error) throw error;
    return (data ?? []) as TenantRecord[];
  },

  async getById(id: string): Promise<TenantRecord | null> {
    if (dataProvider === "mock") {
      return getMockTenants().find((tenant) => tenant.id === id) ?? null;
    }

    const { data, error } = await supabase
      .from(dbTables.tenants)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as TenantRecord | null) ?? null;
  },

  async getPublicBySlug(slug: string): Promise<Pick<TenantRecord, "id" | "trade_name" | "slug" | "is_active"> | null> {
    const normalizedSlug = normalizeTenantSlug(slug);
    if (!normalizedSlug) return null;

    if (dataProvider === "mock") {
      const tenant =
        getMockTenants().find((item) => normalizeTenantSlug(item.slug ?? item.trade_name) === normalizedSlug) ??
        null;
      if (!tenant) return null;
      return {
        id: tenant.id,
        trade_name: tenant.trade_name,
        slug: tenant.slug ?? normalizeTenantSlug(tenant.trade_name),
        is_active: tenant.is_active,
      };
    }

    const { data, error } = await supabase.rpc("pos_public_tenant_by_slug", {
      tenant_slug: normalizedSlug,
    });

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const row = rows[0] as Pick<TenantRecord, "id" | "trade_name" | "slug" | "is_active"> | undefined;
    return row ?? null;
  },

  async create(input: {
    legal_name: string;
    trade_name: string;
    slug?: string | null;
    cuit: string;
    is_active?: boolean;
  }): Promise<TenantRecord> {
    const row = fromTenantInput({
      legal_name: input.legal_name,
      trade_name: input.trade_name,
      slug: input.slug,
      cuit: input.cuit,
      is_active: input.is_active ?? true,
    });

    if (dataProvider === "mock") {
      const table = getMockTenants();
      table.push(row);
      persistMockDatabase();
      return row;
    }

    const { data, error } = await supabase
      .from(dbTables.tenants)
      .insert(row)
      .select("*")
      .single();
    if (error) throw error;
    return data as TenantRecord;
  },

  toTenant,
};
