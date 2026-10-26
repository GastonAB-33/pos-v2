import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { ReceiptTicketPanel } from "@/modules/comprobantes/components/ReceiptTicketPanel";
import { ReceiptsTable } from "@/modules/comprobantes/components/ReceiptsTable";
import { useReceiptsModule } from "@/modules/comprobantes/hooks/useReceiptsModule";
import type { Receipt } from "@/types/entities";

interface ReceiptsTabContentProps {
  tenantId: string;
  userId: string | null;
  canWriteFacturacion: boolean;
  onInvoiceGenerated?: () => void;
}

export const ReceiptsTabContent = ({
  tenantId,
  userId,
  canWriteFacturacion,
  onInvoiceGenerated,
}: ReceiptsTabContentProps) => {
  const {
    receipts,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    generateInvoiceFromReceipt,
  } = useReceiptsModule(tenantId, userId);

  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const handleGenerateInvoice = async (receipt: Receipt) => {
    const success = await generateInvoiceFromReceipt(receipt);
    if (success && onInvoiceGenerated) {
      onInvoiceGenerated();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Historial de tickets internos y comprobantes no fiscales generados por ventas en el POS
        </p>

        <div className="flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por número, venta o cliente..."
            className="ui-input w-64 sm:w-80"
          />
          <IconButton
            icon={RefreshCw}
            label="Recargar comprobantes"
            onClick={() => {
              clearFeedback();
              void reload();
            }}
            loading={isLoading}
          />
        </div>
      </div>

      {feedback ? (
        <div
          className={
            feedback.type === "success"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "ui-error-state"
          }
        >
          {feedback.message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="ui-loading">Cargando comprobantes...</div>
      ) : (
        <ReceiptsTable
          receipts={receipts}
          onView={setSelectedReceipt}
          canGenerateInvoice={canWriteFacturacion}
          generating={isSubmitting}
          onGenerateInvoice={(receipt) => {
            void handleGenerateInvoice(receipt);
          }}
        />
      )}

      {selectedReceipt ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <ReceiptTicketPanel receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
        </section>
      ) : null}
    </div>
  );
};
