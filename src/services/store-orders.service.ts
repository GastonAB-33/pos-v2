import { dbTables } from "@/lib/database/tables";
import { supabase } from "@/lib/supabase/client";
import { isMockDataProvider } from "@/services/config/data-provider";
import type { StoreOrder } from "@/types/entities";

export const storeOrdersService = {
  /**
   * Obtiene la lista de pedidos web recibidos por el comercio.
   */
  async getByTenant(tenantId: string, limit = 50): Promise<StoreOrder[]> {
    if (!tenantId || isMockDataProvider) return [];

    try {
      const { data, error } = await supabase
        .from(dbTables.store_orders)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.warn("[storeOrdersService] Error leyendo pedidos web:", error.message);
        return [];
      }

      return (data as StoreOrder[]) || [];
    } catch (err) {
      console.warn("[storeOrdersService] Fallo de red consultando pedidos web:", err);
      return [];
    }
  },

  /**
   * Actualiza el estado de un pedido web (confirmado, preparando, listo, entregado, cancelado).
   */
  async updateStatus(
    tenantId: string,
    orderId: string,
    orderStatus: StoreOrder["order_status"],
    paymentStatus?: StoreOrder["payment_status"]
  ): Promise<boolean> {
    if (!tenantId || !orderId || isMockDataProvider) return true;

    try {
      const patch: Record<string, unknown> = {
        order_status: orderStatus,
        updated_at: new Date().toISOString(),
      };
      if (paymentStatus) {
        patch.payment_status = paymentStatus;
      }

      const { error } = await supabase
        .from(dbTables.store_orders)
        .update(patch)
        .eq("id", orderId)
        .eq("tenant_id", tenantId);

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Obtiene la cantidad de pedidos web nuevos pendientes de atención.
   */
  async getPendingCount(tenantId: string): Promise<number> {
    if (!tenantId || isMockDataProvider) return 0;

    try {
      const { count, error } = await supabase
        .from(dbTables.store_orders)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("order_status", "new");

      if (error) return 0;
      return count ?? 0;
    } catch {
      return 0;
    }
  },
};
