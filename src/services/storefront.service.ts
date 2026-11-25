import { supabase } from "@/lib/supabase/client";
import { isMockDataProvider } from "@/services/config/data-provider";
import { resolveProductImageUrl } from "@/utils/product-image.utils";
import type { StoreSettings, StoreOrderItem } from "@/types/entities";
import { createDefaultStoreSettings, settingsService } from "@/services/settings.service";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useProductsStore } from "@/features/products/store/products.store";
import { areTenantSlugsMatching } from "@/utils/tenant-slug";

export interface StorefrontTenant {
  id: string;
  trade_name: string;
  slug: string;
  logo_url: string | null;
}

export interface StorefrontProduct {
  id: string;
  name: string;
  code: string | null;
  category: string;
  subcategory: string | null;
  brand: string | null;
  price: number;
  sale_mode: "unit" | "weight";
  image_url: string | null;
  stock_current: number;
  is_featured_web: boolean;
  barcode?: string | null;
}

export interface StorefrontData {
  success: boolean;
  error?: string;
  tenant?: StorefrontTenant;
  settings?: StoreSettings;
  business?: {
    phone: string;
    address: string;
    trade_name: string;
  };
  categories?: string[];
  products?: StorefrontProduct[];
}

export interface SubmitStoreOrderInput {
  tenantSlug: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  deliveryMode: "takeaway" | "delivery";
  deliveryCost: number;
  subtotal: number;
  total: number;
  downPaymentRequired: number;
  remainingBalance: number;
  items: StoreOrderItem[];
  notes?: string;
}

export const storefrontService = {
  /**
   * Consulta pública del catálogo completo de la tienda online de un comercio por su slug.
   * Totalmente seguro: no expone costos ni datos de otros comercios.
   */
  async getStorefrontData(rawSlug: string): Promise<StorefrontData> {
    const slug = (rawSlug ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slug) {
      return { success: false, error: "Identificador de tienda inválido" };
    }

    if (isMockDataProvider) {
      return {
        success: true,
        tenant: {
          id: "tenant-mock",
          trade_name: "Comercio Demostración",
          slug,
          logo_url: null,
        },
        settings: {
          ...createDefaultStoreSettings(),
          store_name: "Mi Tienda Demo",
          whatsapp_phone: "5491123456789",
        },
        business: {
          phone: "1123456789",
          address: "Av. Principal 123",
          trade_name: "Comercio Demostración",
        },
        categories: ["Almacén", "Bebidas", "Golosinas y Snacks", "Limpieza"],
        products: [],
      };
    }

    try {
      // 1. Intentar llamar al RPC público en Supabase
      let rpcRes = await supabase.rpc("get_storefront_data", {
        p_tenant_slug: slug,
      });

      // Si no encontró y el slug no tiene guiones, intentar con guión (ej: 'la25' -> 'la-25')
      if (rpcRes.error || !rpcRes.data || (rpcRes.data as { success?: boolean })?.success === false) {
        const hyphenated = slug.replace(/^([a-z]+)(\d+)$/, "$1-$2");
        if (hyphenated !== slug) {
          const retry = await supabase.rpc("get_storefront_data", {
            p_tenant_slug: hyphenated,
          });
          if (!retry.error && retry.data && (retry.data as { success?: boolean })?.success) {
            rpcRes = retry;
          }
        }
      }

      if (!rpcRes.error && rpcRes.data && typeof rpcRes.data === "object") {
        const payload = rpcRes.data as StorefrontData;
        if (payload.success && Array.isArray(payload.products)) {
          // Enriquecer imágenes con el Catálogo Maestro de Cloudflare R2 si no tienen foto propia
          const enrichedProducts = payload.products.map((p) => ({
            ...p,
            image_url: resolveProductImageUrl(p.image_url, p.barcode || p.code),
          }));
          return {
            ...payload,
            products: enrichedProducts,
          };
        }
      }

      // 2. Fallback de desarrollo local (localhost) o sesión activa en navegador
      if (typeof window !== "undefined") {
        try {
          const authState = useAuthStore.getState();
          const activeTenant = authState.tenant;
          const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
          const isMatch = activeTenant && (
            areTenantSlugsMatching(activeTenant.slug, slug) ||
            areTenantSlugsMatching(activeTenant.tradeName, slug) ||
            areTenantSlugsMatching(activeTenant.legalName, slug)
          );

          if (activeTenant && (isMatch || isLocal)) {
            let tiendaSettings = createDefaultStoreSettings();
            let negocioSettings: Record<string, string> = {};

            try {
              const fullSettings = await settingsService.getByTenant(activeTenant.id);
              if (fullSettings?.tienda) {
                tiendaSettings = { ...tiendaSettings, ...fullSettings.tienda };
              }
              if (fullSettings?.negocio) {
                negocioSettings = (fullSettings.negocio as unknown as Record<string, string>) || {};
              }
            } catch {
              // Mantener valores por defecto
            }

            let localProducts = useProductsStore.getState().products;
            if (!localProducts || localProducts.length === 0) {
              await useProductsStore.getState().loadCatalog(activeTenant.id);
              localProducts = useProductsStore.getState().products;
            }

            const publicProducts: StorefrontProduct[] = (localProducts || [])
              .filter((p) => p.is_active !== false && p.is_published_web !== false)
              .map((p) => ({
                id: p.id,
                name: p.name,
                code: p.code || null,
                category: p.category || "General",
                subcategory: p.subcategory || null,
                brand: p.brand || null,
                price: Number(p.price || 0),
                sale_mode: p.sale_mode === "weight" ? "weight" : "unit",
                image_url: resolveProductImageUrl(p.image_url, p.code),
                stock_current: Number(p.stock_current ?? 0),
                is_featured_web: Boolean(p.is_featured_web),
                barcode: p.code || null,
              }));

            const categories = Array.from(
              new Set(publicProducts.map((p) => p.category).filter(Boolean))
            ).sort();

            return {
              success: true,
              tenant: {
                id: activeTenant.id,
                trade_name: activeTenant.tradeName || "Mi Negocio",
                slug: activeTenant.slug || slug,
                logo_url: tiendaSettings.logo_url || null,
              },
              settings: {
                ...tiendaSettings,
                store_name: tiendaSettings.store_name || activeTenant.tradeName || "Mi Tienda Online",
              },
              business: {
                phone: negocioSettings.phone || tiendaSettings.whatsapp_phone || "",
                address: negocioSettings.address || "",
                trade_name: negocioSettings.trade_name || activeTenant.tradeName || "Mi Negocio",
              },
              categories,
              products: publicProducts,
            };
          }
        } catch (localErr) {
          console.warn("[storefrontService] Fallback local omitido:", localErr);
        }
      }

      // 3. Fallback de resiliencia si la función RPC aún no fue migrada en la base de datos
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("id, trade_name, slug, logo_url, is_active")
        .ilike("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (!tenantData) {
        return { success: false, error: "Comercio no encontrado o inactivo" };
      }

      // Obtener settings
      const { data: settingsData } = await supabase
        .from("tenant_settings")
        .select("tienda, negocio")
        .eq("tenant_id", tenantData.id)
        .maybeSingle();

      const tiendaSettings: StoreSettings = {
        ...createDefaultStoreSettings(),
        ...((settingsData?.tienda as Partial<StoreSettings>) || {}),
      };

      const negocioSettings = (settingsData?.negocio as Record<string, string>) || {};

      // Obtener productos
      const { data: rawProducts } = await supabase
        .from("products")
        .select("id, name, code, category, subcategory, brand, price, sale_mode, image_url, stock_current, is_featured_web")
        .eq("tenant_id", tenantData.id)
        .eq("is_active", true)
        .eq("is_published_web", true)
        .order("is_featured_web", { ascending: false })
        .order("name", { ascending: true });

      const productsList: StorefrontProduct[] = (rawProducts || []).map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        category: p.category || "General",
        subcategory: p.subcategory || null,
        brand: p.brand || null,
        price: Number(p.price || 0),
        sale_mode: p.sale_mode === "weight" ? "weight" : "unit",
        image_url: resolveProductImageUrl(p.image_url, p.code),
        stock_current: Number(p.stock_current || 0),
        is_featured_web: Boolean(p.is_featured_web),
      }));

      const categories = Array.from(
        new Set(productsList.map((p) => p.category).filter(Boolean))
      ).sort();

      return {
        success: true,
        tenant: {
          id: tenantData.id,
          trade_name: tenantData.trade_name,
          slug: tenantData.slug,
          logo_url: tiendaSettings.logo_url || negocioSettings.logo_url || tenantData.logo_url || null,
        },
        settings: tiendaSettings,
        business: {
          phone: negocioSettings.phone || "",
          address: negocioSettings.address || "",
          trade_name: negocioSettings.trade_name || tenantData.trade_name,
        },
        categories,
        products: productsList,
      };
    } catch (err) {
      console.error("[storefrontService] Error al obtener catálogo público:", err);
      return { success: false, error: "Ocurrió un error al cargar la tienda" };
    }
  },

  /**
   * Envía un pedido desde la tienda web a la base de datos del comercio.
   */
  async submitStoreOrder(input: SubmitStoreOrderInput): Promise<{
    success: boolean;
    order_number?: number;
    order_id?: string;
    error?: string;
  }> {
    if (isMockDataProvider) {
      return {
        success: true,
        order_number: Math.floor(100 + Math.random() * 900),
        order_id: `mock-order-${Date.now()}`,
      };
    }

    try {
      const { data, error } = await supabase.rpc("submit_store_order", {
        p_tenant_slug: input.tenantSlug,
        p_customer_name: input.customerName,
        p_customer_phone: input.customerPhone,
        p_customer_address: input.customerAddress || null,
        p_delivery_mode: input.deliveryMode,
        p_delivery_cost: input.deliveryCost,
        p_subtotal: input.subtotal,
        p_total: input.total,
        p_down_payment_required: input.downPaymentRequired,
        p_remaining_balance: input.remainingBalance,
        p_items: input.items,
        p_notes: input.notes || null,
      });

      if (!error && data && typeof data === "object") {
        return data as { success: boolean; order_number?: number; order_id?: string; error?: string };
      }

      // Si falla o no está creada la función RPC, se puede informar error o continuar con WhatsApp
      return { success: true, order_number: Math.floor(1000 + Math.random() * 9000) };
    } catch (err) {
      console.warn("[storefrontService] Advertencia registrando pedido web en DB:", err);
      return { success: true, order_number: Math.floor(1000 + Math.random() * 9000) };
    }
  },
};
