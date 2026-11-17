import { supabase } from "@/lib/supabase/client";
import { isMockDataProvider } from "@/services/config/data-provider";

export interface MasterProduct {
  barcode: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  unit: string;
  image_url: string | null;
  is_verified: boolean;
  created_at?: string;
  updated_at?: string;
}

export const STANDARD_RETAIL_CATEGORIES = [
  "Almacén",
  "Bebidas",
  "Golosinas y Snacks",
  "Lácteos y Frescos",
  "Desayuno y Merienda",
  "Limpieza",
  "Cuidado Personal",
  "Congelados",
  "Cigarrillos y Tabaco",
  "Bazar y Varios",
] as const;

// In-memory cache de alto rendimiento para evitar peticiones repetidas a Supabase
const memoryCache = new Map<string, MasterProduct | null>();

export const masterProductsService = {
  /**
   * Busca un producto por código de barras en el Catálogo Maestro Global
   */
  async getByBarcode(barcode: string): Promise<MasterProduct | null> {
    const cleanBarcode = barcode.trim().replace(/\s+/g, "");
    if (!cleanBarcode || cleanBarcode.length < 5) return null;

    // Si es pesable generado por balanza (prefijo 20), no pertenece al catálogo global
    if (cleanBarcode.startsWith("20") && cleanBarcode.length === 13) {
      return null;
    }

    if (memoryCache.has(cleanBarcode)) {
      return memoryCache.get(cleanBarcode) ?? null;
    }

    if (isMockDataProvider) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("master_products")
        .select("barcode, name, brand, category, subcategory, unit, image_url, is_verified")
        .eq("barcode", cleanBarcode)
        .maybeSingle();

      if (error) {
        console.warn("[masterProductsService] Error consultando catálogo maestro:", error.message);
        return null;
      }

      const product = (data as MasterProduct) || null;
      memoryCache.set(cleanBarcode, product);
      return product;
    } catch (err) {
      console.warn("[masterProductsService] Fallo de red consultando catálogo maestro:", err);
      return null;
    }
  },

  /**
   * Búsqueda por texto en el Catálogo Maestro Global (para autocompletado)
   */
  async search(query: string, limit = 15): Promise<MasterProduct[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) return [];

    if (isMockDataProvider) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from("master_products")
        .select("barcode, name, brand, category, subcategory, unit, image_url, is_verified")
        .ilike("name", `%${cleanQuery}%`)
        .order("is_verified", { ascending: false })
        .limit(limit);

      if (error) {
        console.warn("[masterProductsService] Error en búsqueda de catálogo maestro:", error.message);
        return [];
      }

      const results = (data as MasterProduct[]) || [];
      // Cachear individualmente por código de barras para búsquedas posteriores inmediatas
      for (const item of results) {
        if (item.barcode) {
          memoryCache.set(item.barcode, item);
        }
      }

      return results;
    } catch (err) {
      console.warn("[masterProductsService] Fallo de red buscando en catálogo maestro:", err);
      return [];
    }
  },

  /**
   * Contribución colaborativa: si un comercio da de alta un producto nuevo con código de barras
   * que no existe en el catálogo maestro, se envía como sugerencia para retroalimentar la base.
   */
  async contribute(item: {
    barcode: string;
    name: string;
    brand?: string | null;
    category: string;
    subcategory?: string | null;
    unit?: string;
  }): Promise<boolean> {
    const cleanBarcode = item.barcode.trim().replace(/\s+/g, "");
    if (!cleanBarcode || cleanBarcode.length < 6) return false;
    if (cleanBarcode.startsWith("20") && cleanBarcode.length === 13) return false;

    if (isMockDataProvider) return false;

    try {
      const { error } = await supabase.from("master_products").insert({
        barcode: cleanBarcode,
        name: item.name.trim(),
        brand: item.brand?.trim() || null,
        category: item.category.trim(),
        subcategory: item.subcategory?.trim() || null,
        unit: item.unit?.trim() || "u",
        is_verified: false, // Las sugerencias de comercios entran como no verificadas inicialmente
      });

      if (!error) {
        // Actualizar cache local
        memoryCache.set(cleanBarcode, {
          barcode: cleanBarcode,
          name: item.name.trim(),
          brand: item.brand?.trim() || null,
          category: item.category.trim(),
          subcategory: item.subcategory?.trim() || null,
          unit: item.unit?.trim() || "u",
          image_url: null,
          is_verified: false,
        });
        return true;
      }
      return false;
    } catch {
      // Ignorar silenciosamente errores de duplicado o permisos para no interferir con la venta o guardado local
      return false;
    }
  },

  /**
   * Retorna las categorías estándar preconfiguradas del sistema
   */
  getDefaultCategories(): string[] {
    return [...STANDARD_RETAIL_CATEGORIES];
  },
};
