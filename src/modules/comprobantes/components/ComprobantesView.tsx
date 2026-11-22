import { useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { ReceiptTicketPanel } from "@/modules/comprobantes/components/ReceiptTicketPanel";
import { ReceiptsTable } from "@/modules/comprobantes/components/ReceiptsTable";
import { useReceiptsModule } from "@/modules/comprobantes/hooks/useReceiptsModule";
import { receiptsService } from "@/services/receipts.service";
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
    clearSearch,
    debouncedSearch,
    isSearching,
    page,
    setPage,
    pageSize,
    totalCount,
    totalPages,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    generateInvoiceFromReceipt,
  } = useReceiptsModule(tenantId, userId);

  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const handleGenerateInvoice = async (receipt: Receipt) => {
    const success = await generateInvoiceFromReceipt(receipt);
    if (success && onInvoiceGenerated) {
      onInvoiceGenerated();
    }
  };

  /**
   * Carga perezosa (Lazy Loading) del comprobante completo:
   * Abre el modal de inmediato con la información de cabecera y descarga los artículos
   * únicamente para este ticket individual, ahorrando ~95% de datos de salida (egress).
   */
  const handleViewReceipt = async (receipt: Receipt) => {
    setSelectedReceipt(receipt);

    if (receipt.items && receipt.items.length > 0) {
      return;
    }

    setIsLoadingDetail(true);
    try {
      const full = await receiptsService.getById(tenantId, receipt.id);
      if (full) {
        setSelectedReceipt(full);
      }
    } catch (err) {
      console.error("Error al obtener detalle del comprobante:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);
  const isSearchActive = Boolean(search.trim());
  const showSearchSpinner = isSearchActive && (isSearching || isLoading);

  return (
    <div className="space-y-4">
      {/* Barra de Búsqueda y Filtro Integrada */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              {showSearchSpinner ? (
                <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
              ) : (
                <Search className="h-4 w-4 text-slate-400" />
              )}
            </div>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por número (ej. 5734), venta o cliente..."
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
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                title="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 justify-between sm:justify-end">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {debouncedSearch ? (
                totalCount === 0 ? (
                  "Sin coincidencias"
                ) : (
                  `${totalCount} ${totalCount === 1 ? "resultado encontrado" : "resultados encontrados"}`
                )
              ) : (
                `${totalCount.toLocaleString("es-AR")} ${
                  totalCount === 1 ? "ticket registrado" : "tickets registrados"
                }`
              )}
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
          onView={handleViewReceipt}
          canGenerateInvoice={canWriteFacturacion}
          generating={isSubmitting}
          onGenerateInvoice={handleGenerateInvoice}
        />
      )}

      {/* Paginación redondeada moderna (Modern Rounded Design) */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left">
            Mostrando <span className="font-semibold text-slate-700 dark:text-slate-200">{startRecord}</span> a{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{endRecord}</span> de{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{totalCount.toLocaleString("es-AR")}</span>{" "}
            comprobantes
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Anterior</span>
            </button>

            <span className="text-xs font-semibold px-2 text-slate-600 dark:text-slate-300">
              Página {page} de {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              <span>Siguiente</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Modal flotante de visualización / impresión de Ticket */}
      {selectedReceipt ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in-50 duration-200"
          onClick={() => {
            setSelectedReceipt(null);
            setIsLoadingDetail(false);
          }}
        >
          <div
            className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <ReceiptTicketPanel
              receipt={selectedReceipt}
              isLoadingDetail={isLoadingDetail}
              onClose={() => {
                setSelectedReceipt(null);
                setIsLoadingDetail(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
