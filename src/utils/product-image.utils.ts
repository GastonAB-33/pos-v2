import { MASTER_CATALOG_IMAGE_BARCODES } from "@/utils/master-catalog-images.generated";

export const MASTER_PRODUCT_CDN_BASE = "https://cdn.jireh.cloud/productos";

/**
 * Normaliza un código de barras eliminando espacios en blanco.
 */
export function normalizeBarcode(rawBarcode: string | null | undefined): string {
  if (!rawBarcode || typeof rawBarcode !== "string") return "";
  return rawBarcode.trim().replace(/\s+/g, "");
}

/**
 * Verifica si un código de barras cuenta con imagen disponible en el CDN global de Cloudflare R2.
 */
export function hasMasterProductImage(rawBarcode: string | null | undefined): boolean {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode || barcode.length < 5) return false;

  if (MASTER_CATALOG_IMAGE_BARCODES.has(barcode)) {
    return true;
  }

  // Comprobar sin ceros a la izquierda (UPC-A vs EAN-13)
  const stripped = barcode.replace(/^0+/, "");
  if (stripped && MASTER_CATALOG_IMAGE_BARCODES.has(stripped)) {
    return true;
  }

  // Comprobar con padding de 13 dígitos
  if (barcode.length < 13) {
    const padded = barcode.padStart(13, "0");
    if (MASTER_CATALOG_IMAGE_BARCODES.has(padded)) {
      return true;
    }
  }

  return false;
}

/**
 * Obtiene la URL pública optimizada en WebP alojada en Cloudflare R2
 * para un código de barras del Catálogo Maestro Global.
 * Si no cuenta con imagen verificada en el CDN, retorna null.
 */
export function getMasterProductImageUrl(rawBarcode: string | null | undefined): string | null {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode || barcode.length < 5) return null;

  if (MASTER_CATALOG_IMAGE_BARCODES.has(barcode)) {
    return `${MASTER_PRODUCT_CDN_BASE}/${barcode}.webp`;
  }

  const stripped = barcode.replace(/^0+/, "");
  if (stripped && MASTER_CATALOG_IMAGE_BARCODES.has(stripped)) {
    return `${MASTER_PRODUCT_CDN_BASE}/${stripped}.webp`;
  }

  if (barcode.length < 13) {
    const padded = barcode.padStart(13, "0");
    if (MASTER_CATALOG_IMAGE_BARCODES.has(padded)) {
      return `${MASTER_PRODUCT_CDN_BASE}/${padded}.webp`;
    }
  }

  return null;
}

/**
 * Resolución inteligente de imagen para productos (Herencia Opción B):
 * 1. Si el producto tiene una imagen personalizada subida por el comercio (customImageUrl), se respeta con máxima prioridad.
 * 2. Si no tiene imagen personalizada y se suministra un código de barras, busca si existe en el Catálogo Maestro Global.
 * 3. Si no existe en el Catálogo Maestro, retorna null (permitiendo mostrar el badge o iniciales sin links caídos ni errores 404).
 */
export function resolveProductImageUrl(
  customImageUrl: string | null | undefined,
  barcode: string | null | undefined
): string | null {
  const trimmed = customImageUrl?.trim();
  if (trimmed) return trimmed;
  return getMasterProductImageUrl(barcode);
}
