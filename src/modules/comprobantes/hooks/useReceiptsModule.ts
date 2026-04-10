import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<ReceiptFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadReceipts = useCallback(async () => {
    if (!tenantId) {
      setReceipts([]);
      return;
    }

    setIsLoading(true);

    try {
      const list = await receiptsService.getAllByTenant(tenantId);
      setReceipts(list.sort((a, b) => b.issued_at.localeCompare(a.issued_at)));
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar los comprobantes" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  const filteredReceipts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return receipts;

    return receipts.filter((receipt) =>
      [receipt.receipt_number, receipt.sale_number, receipt.customer_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [receipts, search]);

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
    receipts: filteredReceipts,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadReceipts,
    generateInvoiceFromReceipt,
  };
};
