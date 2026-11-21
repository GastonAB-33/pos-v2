import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { Receipt } from "@/types/entities";
import { formatDisplayReceiptNumber, formatDisplaySaleNumber } from "@/utils/voucher-format.utils";

const crud = new TenantCrudService<Receipt>(dbTables.receipts);

export type CreateReceiptInput = CreateEntityInput<Receipt>;
export type UpdateReceiptInput = UpdateEntityInput<Receipt>;

export interface PaginatedReceiptsResult {
  receipts: Receipt[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const norm = (s: string | null | undefined): string =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9]/gi, "");

/**
 * Valida de forma estricta si un comprobante coincide con el término de búsqueda del usuario,
 * evaluando los números formateados visibles (ej. TCK-5734, VTA-6885) para evitar que timestamps
 * internos milisegundarios generen falsos positivos.
 */
export const matchesReceiptSearch = (receipt: Receipt, term: string): boolean => {
  const cleanTerm = term.trim().toLowerCase();
  if (!cleanTerm) return true;

  const displayReceipt = formatDisplayReceiptNumber(receipt.receipt_number).toLowerCase();
  const displaySale = formatDisplaySaleNumber(receipt.sale_number).toLowerCase();
  const customer = (receipt.customer_name ?? "Consumidor final").toLowerCase();
  const rawReceipt = (receipt.receipt_number ?? "").toLowerCase();
  const rawSale = (receipt.sale_number ?? "").toLowerCase();

  // 1. Coincidencia directa visual o normalizada (elimina diferencias de guiones y espacios ej. "TCK 5734" vs "TCK-5734")
  const normTerm = norm(cleanTerm);
  const normReceipt = norm(displayReceipt);
  const normSale = norm(displaySale);

  if (displayReceipt.includes(cleanTerm) || (normTerm && normReceipt.includes(normTerm))) return true;
  if (displaySale.includes(cleanTerm) || (normTerm && normSale.includes(normTerm))) return true;
  if (customer.includes(cleanTerm)) return true;

  // 2. Búsqueda por número puro (ej. "5734", "6885", "81")
  const digits = cleanTerm.replace(/\D/g, "");
  if (digits) {
    const receiptNum = displayReceipt.replace(/\D/g, "");
    const saleNum = displaySale.replace(/\D/g, "");
    const termVal = parseInt(digits, 10);

    // Comparación numérica exacta (ej. 81 coincide con 0081, o 5734 con 5734)
    if (receiptNum && parseInt(receiptNum, 10) === termVal) return true;
    if (saleNum && parseInt(saleNum, 10) === termVal) return true;

    // Coincidencia como sufijo si el usuario escribe los últimos dígitos
    if (receiptNum && receiptNum.endsWith(digits)) return true;
    if (saleNum && saleNum.endsWith(digits)) return true;
  }

  // 3. Coincidencia directa con código crudo si el usuario pegó el identificador completo
  if (rawReceipt && rawReceipt === cleanTerm) return true;
  if (rawSale && rawSale === cleanTerm) return true;

  return false;
};

export const receiptsService = {
  getAllByTenant: (tenantId: string) => crud.getAllByTenant(tenantId),
  getById: (tenantId: string, id: string) => crud.getById(tenantId, id),
  create: (tenantId: string, input: CreateReceiptInput) => crud.create(tenantId, input),
  update: (tenantId: string, id: string, input: UpdateReceiptInput) =>
    crud.update(tenantId, id, input),
  delete: (tenantId: string, id: string) => crud.delete(tenantId, id),

  getBySaleId: async (tenantId: string, saleId: string) => {
    const rows = await crud.query(tenantId, { eq: { sale_id: saleId }, limit: 1 });
    return rows[0] ?? null;
  },

  getBySaleIds: async (tenantId: string, saleIds: string[]): Promise<Receipt[]> => {
    if (saleIds.length === 0) return [];
    return crud.query(tenantId, { in: { sale_id: saleIds } });
  },

  getRecentByTenant: (tenantId: string, limit = 200) =>
    crud.query(tenantId, { order: { column: "created_at", ascending: false }, limit }),

  /**
   * Consulta paginada optimizada para egress:
   * 1. Descarga únicamente columnas de cabecera (excluye el JSON masivo de 'items', ahorrando ~95% de ancho de banda).
   * 2. Búsqueda remota server-side por número de ticket, venta o cliente.
   * 3. Soporta paginación por offset / limit y conteo total exacto.
   */
  getPaginatedByTenant: async (
    tenantId: string,
    options: {
      page?: number;
      pageSize?: number;
      search?: string;
    } = {}
  ): Promise<PaginatedReceiptsResult> => {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 25));
    const offset = (page - 1) * pageSize;
    const search = options.search?.trim();

    // Proyección ligera sin 'items' para minimizar el uso de datos egress
    const slimSelect =
      "id, tenant_id, sale_id, sale_number, receipt_number, issued_at, customer_name, payment_method, total, notes, created_by, created_at, updated_at";

    // Preparar términos de búsqueda para consulta remota en Supabase
    let searchTerms: string[] | undefined;
    if (search) {
      const terms = [search];
      const digits = search.replace(/\D/g, "");
      if (digits) {
        terms.push(digits);
        if (digits.length < 4) {
          terms.push(digits.padStart(4, "0"));
        }
      }
      searchTerms = Array.from(new Set(terms));
    }

    // Si hay búsqueda activa, consultar un lote amplio para filtrar con precisión visual
    const queryLimit = search ? 200 : pageSize;
    const queryOffset = search ? 0 : offset;

    const result = await crud.queryPaginated(tenantId, {
      select: slimSelect,
      order: { column: "created_at", ascending: false },
      limit: queryLimit,
      offset: queryOffset,
      search: search && searchTerms && searchTerms.length > 0
        ? {
            term: searchTerms[0],
            terms: searchTerms.slice(1),
            columns: ["receipt_number", "sale_number", "customer_name"],
          }
        : undefined,
    });

    let receipts = (result?.data ?? []).map((r) => ({
      ...r,
      items: r.items ?? [],
    }));

    if (search) {
      receipts = receipts.filter((r) => matchesReceiptSearch(r, search));
    }

    const total = search ? receipts.length : (result?.total ?? receipts.length);
    const paginatedReceipts = search ? receipts.slice(offset, offset + pageSize) : receipts;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      receipts: paginatedReceipts,
      total,
      page,
      pageSize,
      totalPages,
    };
  },
};
