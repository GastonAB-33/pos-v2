import { useState } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { ReceiptTicketPanel } from "@/modules/comprobantes/components/ReceiptTicketPanel";
import { ReceiptsTable } from "@/modules/comprobantes/components/ReceiptsTable";
import { useReceiptsModule } from "@/modules/comprobantes/hooks/useReceiptsModule";
import type { Receipt } from "@/types/entities";

export interface ComprobantesViewProps {
  tenantId: string;
  userId: string | null;
  onInvoiceGenerated?: () => void;
}

export const ComprobantesView = ({
  tenantId,
  userId,
  onInvoiceGenerated,
}: ComprobantesViewProps) => {
  const { canWrite } = usePermissions();
  const canWriteFacturacion = canWrite("facturacion");

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
      {/* Barra de Búsqueda y Filtro Integrada */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por número, venta o cliente..."
              className="w-full rounded-xl sm:rounded-2xl border border-slate-300 bg-white py-2 pl-10 pr-9 text-xs text-slate-800 placeholder-slate-400 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {receipts.length} {receipts.length === 1 ? "ticket registrado" : "tickets registrados"}
            </span>
            <button
              type="button"
              onClick={() => {
                clearFeedback();
                void reload();
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80 cursor-pointer"
              title="Refrescar comprobantes"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>
          </div>
        </div>
      </div>

      {feedback ? (
        <div
          className={`rounded-xl p-3.5 text-xs font-semibold ${
            feedback.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-500" />
          Cargando comprobantes de venta...
        </div>
      ) : (
        <ReceiptsTable
          receipts={receipts}
          onView={setSelectedReceipt}
          canGenerateInvoice={canWriteFacturacion}
          generating={isSubmitting}
          onGenerateInvoice={handleGenerateInvoice}
        />
      )}

      {/* Modal flotante de visualización / impresión de Ticket */}
      {selectedReceipt ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in-50 duration-200"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <ReceiptTicketPanel
              receipt={selectedReceipt}
              onClose={() => setSelectedReceipt(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
