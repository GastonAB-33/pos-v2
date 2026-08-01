import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { BudgetForm } from "@/modules/facturacion/components/BudgetForm";
import { GenerateFromSaleForm } from "@/modules/facturacion/components/GenerateFromSaleForm";
import { InvoiceDetailPanel } from "@/modules/facturacion/components/InvoiceDetailPanel";
import { InvoicesTable } from "@/modules/facturacion/components/InvoicesTable";
import { useFacturacionModule } from "@/modules/facturacion/hooks/useFacturacionModule";

export const FacturacionPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadFacturacion = canRead("facturacion");
  const canWriteFacturacion = canWrite("facturacion");

  const {
    invoices,
    allInvoices,
    customers,
    salesCandidates,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    isLoading,
    isSubmitting,
    arcaProcessingInvoiceId,
    feedback,
    clearFeedback,
    summary,
    arcaSettings,
    arcaOperationalStatus,
    reload,
    createBudget,
    generateFromSale,
    sendInvoiceToArca,
  } = useFacturacionModule(tenantId, user?.id ?? null);

  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const selectedInvoice =
    (selectedInvoiceId
      ? allInvoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null
      : null);

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Facturacion"
        description="No hay un comercio activo"
      />
    );
  }

  if (!canReadFacturacion) {
    return (
      <PagePlaceholder
        title="Facturacion"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Facturacion"
      description="Comprobantes fiscales internos listos para integracion ARCA"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Documentos: {summary.totalDocuments} | Emitidos: {summary.issuedDocuments} | Borradores: {summary.draftDocuments}
          </p>

          <div className="flex items-center gap-2">
            <IconButton
              icon={RefreshCw}
              label="Recargar facturación"
              onClick={() => {
                clearFeedback();
                void reload();
              }}
              loading={isLoading}
              disabled={isSubmitting}
            />

            <button
              type="button"
              className="ui-btn-ghost"
              onClick={() => {
                setShowGenerateForm((current) => !current);
                setShowBudgetForm(false);
              }}
              disabled={!canWriteFacturacion || isSubmitting}
            >
              Generar desde venta
            </button>

            <button
              type="button"
              className="ui-btn-primary"
              onClick={() => {
                setShowBudgetForm((current) => !current);
                setShowGenerateForm(false);
              }}
              disabled={!canWriteFacturacion || isSubmitting}
            >
              Nuevo presupuesto
            </button>
          </div>
        </div>

        <section className="ui-card">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-600">ARCA</span>
              <span
                className={[
                  "ui-badge",
                  arcaOperationalStatus.mode === "mock"
                    ? "ui-badge--info"
                    : arcaOperationalStatus.mode === "sandbox"
                      ? "ui-badge--warn"
                      : arcaOperationalStatus.mode === "real"
                        ? "ui-badge--success"
                        : "ui-badge--danger",
                ].join(" ")}
              >
                {arcaOperationalStatus.mode === "mock"
                  ? "Mock"
                  : arcaOperationalStatus.mode === "sandbox"
                    ? "Sandbox"
                    : arcaOperationalStatus.mode === "real"
                      ? "Real"
                      : "No configurado"}
              </span>
              <span className={arcaOperationalStatus.available ? "ui-badge ui-badge--success" : "ui-badge ui-badge--danger"}>
                {arcaOperationalStatus.available ? "Disponible" : "No disponible"}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Entorno fiscal: {arcaSettings.fiscal_environment}
            </span>
          </div>
          {arcaOperationalStatus.reason ? (
            <p className="mt-2 text-xs text-amber-700">{arcaOperationalStatus.reason}</p>
          ) : null}
        </section>

        <section className="ui-summary-grid md:grid-cols-5">
          <article className="ui-summary-card">
            <p className="ui-summary-label">Documentos</p>
            <p className="ui-kpi">{summary.totalDocuments.toLocaleString("es-AR")}</p>
          </article>
          <article className="ui-summary-card">
            <p className="ui-summary-label">Emitidos</p>
            <p className="ui-kpi">{summary.issuedDocuments.toLocaleString("es-AR")}</p>
          </article>
          <article className="ui-summary-card">
            <p className="ui-summary-label">Borradores</p>
            <p className="ui-kpi">{summary.draftDocuments.toLocaleString("es-AR")}</p>
          </article>
          <article className="ui-summary-card">
            <p className="ui-summary-label">Total emitido</p>
            <p className="ui-kpi">{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(summary.issuedTotal)}</p>
          </article>
          <article className="ui-summary-card">
            <p className="ui-summary-label">ARCA rechazados</p>
            <p className="ui-kpi">{summary.rejectedArca.toLocaleString("es-AR")}</p>
          </article>
        </section>

        {feedback ? <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>{feedback.message}</div> : null}

        {showBudgetForm ? (
          <section className="ui-card space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Crear presupuesto</h2>
            <BudgetForm
              customers={customers}
              disabled={isSubmitting}
              onCancel={() => setShowBudgetForm(false)}
              onSubmit={async (values) => {
                await createBudget(values);
                setShowBudgetForm(false);
              }}
            />
          </section>
        ) : null}

        {showGenerateForm ? (
          <section className="ui-card space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Generar documento desde venta</h2>
            <GenerateFromSaleForm
              saleCandidates={salesCandidates}
              disabled={isSubmitting}
              onCancel={() => setShowGenerateForm(false)}
              onSubmit={async (values) => {
                await generateFromSale(values);
                setShowGenerateForm(false);
              }}
            />
          </section>
        ) : null}

        <section className="ui-card space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
              className="ui-input"
            >
              <option value="all">Todos los tipos</option>
              <option value="A">Factura A</option>
              <option value="B">Factura B</option>
              <option value="C">Factura C</option>
              <option value="PRESUPUESTO">Presupuesto</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="ui-input"
            >
              <option value="all">Todos los estados</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="ui-input" />
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="ui-input" />
          </div>

          {isLoading ? (
            <div className="ui-loading">Cargando facturacion...</div>
          ) : (
            <InvoicesTable invoices={invoices} onViewDetail={(invoice) => setSelectedInvoiceId(invoice.id)} />
          )}
        </section>

        {selectedInvoice ? (
          <InvoiceDetailPanel
            invoice={selectedInvoice}
            canSendToArca={canWriteFacturacion && arcaOperationalStatus.available}
            isSendingToArca={arcaProcessingInvoiceId === selectedInvoice.id}
            arcaUnavailableReason={!arcaOperationalStatus.available ? arcaOperationalStatus.reason : null}
            onSendToArca={(invoice) => {
              void sendInvoiceToArca(invoice.id);
            }}
            onClose={() => setSelectedInvoiceId(null)}
          />
        ) : null}
      </div>
    </PagePlaceholder>
  );
};
