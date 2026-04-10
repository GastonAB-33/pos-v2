import { useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { ReceiptTicketPanel } from "@/modules/comprobantes/components/ReceiptTicketPanel";
import { ReceiptsTable } from "@/modules/comprobantes/components/ReceiptsTable";
import { useReceiptsModule } from "@/modules/comprobantes/hooks/useReceiptsModule";
import type { Receipt } from "@/types/entities";

export const ComprobantesPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadReceipts = canRead("comprobantes");
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
  } = useReceiptsModule(tenantId, user?.id ?? null);

  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Comprobantes"
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadReceipts) {
    return (
      <PagePlaceholder
        title="Comprobantes"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Comprobantes"
      description="Historial de tickets internos generados por ventas"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por numero, venta o cliente"
            className="ui-input max-w-sm"
          />
          <button
            type="button"
            className="ui-btn-ghost"
            onClick={() => {
              clearFeedback();
              void reload();
            }}
            disabled={isLoading}
          >
            Recargar
          </button>
        </div>

        {feedback ? <div className="ui-error-state">{feedback.message}</div> : null}

        {isLoading ? (
          <div className="ui-loading">Cargando comprobantes...</div>
        ) : (
          <ReceiptsTable
            receipts={receipts}
            onView={setSelectedReceipt}
            canGenerateInvoice={canWriteFacturacion}
            generating={isSubmitting}
            onGenerateInvoice={(receipt) => {
              void generateInvoiceFromReceipt(receipt);
            }}
          />
        )}

        {selectedReceipt ? (
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <ReceiptTicketPanel receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
          </section>
        ) : null}
      </div>
    </PagePlaceholder>
  );
};
