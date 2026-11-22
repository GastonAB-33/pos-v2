import { useCallback, useEffect, useState } from "react";
import { auditService } from "@/services/audit.service";
import { invoicesService } from "@/services/invoices.service";
import { receiptsService } from "@/services/receipts.service";
import { salesService } from "@/services/sales.service";
import type { Receipt } from "@/types/entities";

interface ReceiptFeedback {
  type: "success" | "error";
  message: string;
}

export const useReceiptsModule = (tenantId: string | null, userId: string | null) => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<ReceiptFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  // Debounce de búsqueda para no saturar consultas ni gastar egress en cada pulsación
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch((prev) => {
        if (prev !== search) {
          setPage(1); // Reiniciar a página 1 si cambió el término
          return search;
        }
        return prev;
      });
    }, 350);

    return () => clearTimeout(handler);
  }, [search]);

  const loadReceipts = useCallback(async () => {
    if (!tenantId) {
      setReceipts([]);
      setTotalCount(0);
      setTotalPages(1);
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const result = await receiptsService.getPaginatedByTenant(tenantId, {
        page,
        pageSize,
        search: debouncedSearch,
      });

      setReceipts(result.receipts);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.warn("[useReceiptsModule] Error en getPaginatedByTenant, usando fallback directo:", err);
      try {
        const fallbackList = await receiptsService.getRecentByTenant(tenantId, 100);
        const sorted = fallbackList.sort((a, b) => b.issued_at.localeCompare(a.issued_at));
        setReceipts(sorted);
        setTotalCount(sorted.length);
        setTotalPages(1);
      } catch (fallbackErr) {
        console.error("[useReceiptsModule] Fallo crítico cargando comprobantes:", fallbackErr);
        setFeedback({ type: "error", message: "No se pudieron cargar los comprobantes" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, page, pageSize, debouncedSearch]);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  const handleClearSearch = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }, []);

  const generateInvoiceFromReceipt = async (receipt: Receipt) => {
    if (!tenantId) return false;

    setIsSubmitting(true);
    try {
      const sale = await salesService.getById(tenantId, receipt.sale_id);
      const documentType = sale?.customer_id ? "B" : "PRESUPUESTO";

      const created = await invoicesService.createFromSale(tenantId, {
        sale_id: receipt.sale_id,
        document_type: documentType,
        notes: `Generado desde comprobante ${receipt.receipt_number}`,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "facturacion",
        action: "generate_from_sale",
        entity_type: "invoice",
        entity_id: created.id,
        description: `Documento fiscal generado desde comprobante: ${created.document_number}`,
        metadata: {
          receipt_id: receipt.id,
          receipt_number: receipt.receipt_number,
          sale_id: receipt.sale_id,
          document_type: created.document_type,
          total: created.total,
        },
      });

      setFeedback({
        type: "success",
        message: `Documento ${documentType} generado desde ${receipt.receipt_number}`,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo generar factura desde comprobante";
      setFeedback({ type: "error", message });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    receipts,
    search,
    setSearch,
    clearSearch: handleClearSearch,
    debouncedSearch,
    isSearching: isLoading || search !== debouncedSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    totalPages,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadReceipts,
    generateInvoiceFromReceipt,
  };
};
