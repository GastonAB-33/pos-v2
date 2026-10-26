/**
 * Utilidades y helpers para la configuración de seguimiento de stock por producto.
 * Permite deshabilitar el seguimiento y alertas de inventario para productos específicos
 * (e.g. servicios, artículos a pedido, consumibles sin control estricto).
 */

const NO_STOCK_TRACK_TAG = "[NO_STOCK_TRACK]";

/**
 * Determina si el seguimiento de stock está habilitado para un producto.
 * Por defecto devuelve true a menos que la descripción contenga el tag [NO_STOCK_TRACK].
 */
export const isStockTrackingEnabled = (description: string | null | undefined): boolean => {
  if (!description) return true;
  return !description.includes(NO_STOCK_TRACK_TAG);
};

/**
 * Serializa la preferencia de seguimiento de stock dentro de la descripción del producto,
 * preservando cualquier texto y etiquetas previas (como envases retornables).
 */
export const serializeStockTracking = (
  baseDescription: string | null | undefined,
  enabled: boolean = true
): string => {
  const clean = (baseDescription ?? "")
    .replace(/\s*\[NO_STOCK_TRACK\]\s*/g, " ")
    .trim();

  if (enabled) {
    return clean;
  }

  return clean ? `${clean} ${NO_STOCK_TRACK_TAG}` : NO_STOCK_TRACK_TAG;
};
