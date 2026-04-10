import { supabase } from "@/lib/supabase/client";

export const queryByTenant = (table: string, tenantId: string) => {
  return supabase.from(table).select("*").eq("tenant_id", tenantId);
};

export const queryByTenantAndBranch = (
  table: string,
  tenantId: string,
  branchId?: string | null
) => {
  let query = supabase.from(table).select("*").eq("tenant_id", tenantId);

  if (branchId) {
    query = query.eq("branch_id", branchId);
  }

  return query;
};

export const getProductsByTenant = (tenantId: string) => {
  return queryByTenant("products", tenantId);
};