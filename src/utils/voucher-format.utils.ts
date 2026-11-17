import { salesService } from "@/services/sales.service";

/**
 * Utilidades para formateo y generación de números de comprobantes (Ventas, Tickets, Recibos)
 * 
 * - Simplifica visualmente comprobantes históricos con timestamps largos (ej: VTA-1794601494624-5947 -> VTA-5947).
 * - Soporta numeración correlativa diaria (ej: VTA-261114-0012 -> VTA-0012).
 * - Garantiza compatibilidad y unicidad contable en base de datos.
 */

/**
 * Formatea un número de venta para visualización clara y concisa en el frontend y tickets
 */
export const formatDisplaySaleNumber = (saleNumber: string | null | undefined): string => {
  if (!saleNumber) return "-";
  const str = String(saleNumber).trim();

  // 1. Formato histórico con timestamp y sufijo de 4 dígitos: VTA-1794601494624-5947 -> VTA-5947
  const mSuffix = str.match(/^VTA-\d{10,14}-(\d{1,6})$/i);
  if (mSuffix) {
    return `VTA-${mSuffix[1].padStart(4, "0")}`;
  }

  // 2. Formato correlativo diario con prefijo de fecha: VTA-261114-0012 -> VTA-0012
  const mDate = str.match(/^VTA-\d{6}-(\d{1,6})$/i);
  if (mDate) {
    return `VTA-${mDate[1].padStart(4, "0")}`;
  }

  // 3. Formato histórico con solo timestamp: VTA-1794601494624 -> VTA-4624
  const mTs = str.match(/^VTA-(\d{10,14})$/i);
  if (mTs) {
    return `VTA-${mTs[1].slice(-4)}`;
  }

  // 4. Formato correlativo directo ya limpio: VTA-12 -> VTA-0012
  const mDirect = str.match(/^VTA-(\d{1,6})$/i);
  if (mDirect) {
    return `VTA-${mDirect[1].padStart(4, "0")}`;
  }

  // 5. UUID puro largo recortado si fuera necesario
  const mUuid = str.match(/^([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (mUuid) {
    return `#${mUuid[1]}`;
  }

  return str;
};

/**
 * Formatea un número de ticket / recibo para visualización clara
 */
export const formatDisplayReceiptNumber = (receiptNumber: string | null | undefined): string => {
  if (!receiptNumber) return "-";
  const str = String(receiptNumber).trim();

  // 1. Formato correlativo diario con fecha: TCK-261114-0012 -> TCK-0012
  const mDate = str.match(/^TCK-(?:SYNC-|OFF-)?\d{6}-(\d{1,6})$/i);
  if (mDate) {
    return `TCK-${mDate[1].padStart(4, "0")}`;
  }

  // 2. Formato histórico con timestamp: TCK-1794601494624 o TCK-SYNC-1794601494624 -> TCK-4624
  const mTs = str.match(/^TCK-(?:SYNC-|OFF-)?(\d{10,14})$/i);
  if (mTs) {
    return `TCK-${mTs[1].slice(-4)}`;
  }

  // 3. Formato correlativo directo ya limpio: TCK-12 -> TCK-0012
  const mDirect = str.match(/^TCK-(\d{1,6})$/i);
  if (mDirect) {
    return `TCK-${mDirect[1].padStart(4, "0")}`;
  }

  return str;
};

/**
 * Simplifica referencias numéricas largas que aparezcan dentro de cadenas de texto (ej: notas de caja o auditoría)
 */
export const formatDisplayNotes = (notes: string | null | undefined): string => {
  if (!notes) return "";
  return notes
    .replace(/VTA-\d{10,14}-(\d{1,6})/gi, (_, p1) => `VTA-${String(p1).padStart(4, "0")}`)
    .replace(/VTA-\d{6}-(\d{1,6})/gi, (_, p1) => `VTA-${String(p1).padStart(4, "0")}`)
    .replace(/VTA-(\d{10,14})/gi, (_, p1) => `VTA-${String(p1).slice(-4)}`)
    .replace(/TCK-(?:SYNC-|OFF-)?\d{10,14}/gi, (match) => {
      const nums = match.match(/\d{10,14}/);
      return `TCK-${nums ? nums[0].slice(-4) : match}`;
    });
};

/**
 * Genera el próximo número correlativo diario para una nueva venta
 * Formato base: VTA-AAMMDD-XXXX (ej: VTA-261114-0012)
 * 
 * Ventajas:
 * - Cumple con la restricción de unicidad de Supabase `sales_tenant_number_key (tenant_id, sale_number)`.
 * - Cada día nuevo reinicia la secuencia correlativa en 0001, 0002...
 * - En la interfaz y el ticket de impresión se muestra limpio como `VTA-0012`.
 */
export const getNextDailySaleNumbers = async (
  tenantId: string,
  targetDate: Date = new Date()
): Promise<{
  saleNumber: string;
  receiptNumber: string;
  displaySaleNumber: string;
  displayReceiptNumber: string;
  dailySequence: number;
}> => {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad4 = (n: number) => String(n).padStart(4, "0");

  const year = targetDate.getFullYear();
  const shortYear = String(year).slice(-2);
  const month = pad2(targetDate.getMonth() + 1);
  const day = pad2(targetDate.getDate());

  const datePrefix = `${shortYear}${month}${day}`; // Ej: "261114"
  const startOfDayIso = new Date(year, targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0).toISOString();

  let maxSequence = 0;
  let countToday = 0;

  try {
    const todaySales = await salesService.getSalesSince(tenantId, startOfDayIso);
    countToday = todaySales.length;

    for (const sale of todaySales) {
      // Extraer secuencia numérica si ya tiene formato correlativo de hoy o directo
      const match = sale.sale_number.match(/VTA-(?:\d{6}-)?(\d{1,6})$/i);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSequence) {
          maxSequence = seq;
        }
      }
    }
  } catch (error) {
    console.warn("[getNextDailySaleNumbers] Error consultando ventas del día para correlativo:", error);
  }

  const nextSeq = Math.max(countToday, maxSequence) + 1;
  const seqPadded = pad4(nextSeq);

  const saleNumber = `VTA-${datePrefix}-${seqPadded}`;
  const receiptNumber = `TCK-${datePrefix}-${seqPadded}`;

  return {
    saleNumber,
    receiptNumber,
    displaySaleNumber: `VTA-${seqPadded}`,
    displayReceiptNumber: `TCK-${seqPadded}`,
    dailySequence: nextSeq,
  };
};
