/**
 * Utilidades para serializar y deserializar múltiples fotos de factura en compras.
 * Permite almacenar 1 o más fotografías en el campo invoice_photo_url manteniendo
 * 100% de compatibilidad hacia atrás con registros que contengan una sola URL.
 */

export const parseInvoicePhotos = (raw?: string | null): string[] => {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === "string" && Boolean(item.trim())
        );
      }
    } catch {
      // Si falla JSON.parse, tratar como string único
    }
  }
  return [trimmed];
};

export const serializeInvoicePhotos = (photos: string[]): string | null => {
  const clean = photos.filter((p) => Boolean(p && p.trim()));
  if (clean.length === 0) return null;
  if (clean.length === 1) return clean[0];
  return JSON.stringify(clean);
};
