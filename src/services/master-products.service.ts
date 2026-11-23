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

/**
 * Sanitiza textos con posibles caracteres corruptos (mojibake)
 * provenientes de conversiones erróneas CP850/UTF-8 en catálogos importados.
 */
export function cleanCatalogText(str: string): string {
  if (!str || typeof str !== "string") return str;

  let res = str;

  // 1. Palabras específicas con ambigüedad de ├ü (que puede ser ú, ü o á)
  res = res.replace(/Tarag├üi/g, "Taragüí");
  res = res.replace(/Az├ücar/g, "Azúcar");
  res = res.replace(/H├ümedas/g, "Húmedas");
  res = res.replace(/At├ün/g, "Atún");
  res = res.replace(/Psta├æa/g, "Pestaña");

  // 2. Correcciones de eñes (ñ y Ñ)
  res = res.replace(/├▒/g, "ñ");
  // ├æ al inicio de palabra -> Ñ (ej: ├æoquis -> Ñoquis)
  res = res.replace(/(^|[^a-zA-ZáéíóúÁÉÍÓÚñÑ])├æ/g, "$1Ñ");
  // ├æ dentro de una palabra -> ñ (ej: Ba├æo -> Baño)
  res = res.replace(/├æ/g, "ñ");

  // 3. Vocales acentuadas
  res = res.replace(/├®/g, "é");
  res = res.replace(/├ë/g, "é");
  res = res.replace(/├ì/g, "í");
  res = res.replace(/├¡/g, "í");
  res = res.replace(/├í/g, "á");
  res = res.replace(/├ü/g, "á");
  res = res.replace(/├ôn/g, "ón");
  res = res.replace(/├ô/g, "ó");
  res = res.replace(/├│/g, "ó");
  res = res.replace(/├║/g, "ú");

  return res;
}

export function cleanMasterProduct(item: MasterProduct): MasterProduct {
  return {
    ...item,
    name: cleanCatalogText(item.name),
    brand: item.brand ? cleanCatalogText(item.brand) : null,
    category: cleanCatalogText(item.category),
    subcategory: item.subcategory ? cleanCatalogText(item.subcategory) : null,
  };
}

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

      const rawProduct = (data as MasterProduct) || null;
      const product = rawProduct ? cleanMasterProduct(rawProduct) : null;
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
      // Reemplazar caracteres especiales y acentos por '_' en SQL para que coincida
      // tanto si la base de datos tiene tilde/eñe normal como si aún tiene mojibake
      const flexibleQuery = cleanQuery
        .replace(/[áÁàÀ]/g, "_")
        .replace(/[éÉèÈ]/g, "_")
        .replace(/[íÍìÌ]/g, "_")
        .replace(/[óÓòÒ]/g, "_")
        .replace(/[úÚùÙüÜ]/g, "_")
        .replace(/[ñÑ]/g, "_");

      const { data, error } = await supabase
        .from("master_products")
        .select("barcode, name, brand, category, subcategory, unit, image_url, is_verified")
        .ilike("name", `%${flexibleQuery}%`)
        .order("is_verified", { ascending: false })
        .limit(limit);

      if (error) {
        console.warn("[masterProductsService] Error en búsqueda de catálogo maestro:", error.message);
        return [];
      }

      const rawResults = (data as MasterProduct[]) || [];
      const results = rawResults.map(cleanMasterProduct);

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
