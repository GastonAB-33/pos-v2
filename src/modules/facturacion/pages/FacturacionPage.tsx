import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, FileText, BookOpen } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { BudgetForm } from "@/modules/facturacion/components/BudgetForm";
import { GenerateFromSaleForm } from "@/modules/facturacion/components/GenerateFromSaleForm";
import { InvoiceDetailPanel } from "@/modules/facturacion/components/InvoiceDetailPanel";
import { InvoicesTable } from "@/modules/facturacion/components/InvoicesTable";
import { LibroIvaView } from "@/modules/facturacion/components/libro-iva/LibroIvaView";
import { useFacturacionModule } from "@/modules/facturacion/hooks/useFacturacionModule";

export const FacturacionPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadFacturacion = canRead("facturacion");
  const canWriteFacturacion = canWrite("facturacion");

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [mainTab, setMainTab] = useState<"comprobantes" | "libro-iva">(
    tabParam === "libro-iva" ? "libro-iva" : "comprobantes"
  );

  const handleTabChange = (newTab: "comprobantes" | "libro-iva") => {
    setMainTab(newTab);
    const nextParams = new URLSearchParams(searchParams);
    if (newTab === "libro-iva") {
      nextParams.set("tab", "libro-iva");
    } else {
      nextParams.delete("tab");
    }
    setSearchParams(nextParams, { replace: true });
  };

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
    isCancellingWithCreditNote,
    feedback,
    clearFeedback,
    summary,
    arcaSettings,
    arcaOperationalStatus,
    reload,
    createBudget,
    generateFromSale,
    sendInvoiceToArca,
    cancelInvoiceWithCreditNote,
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
      title="Facturación & ARCA"
      description="Gestión de comprobantes fiscales electrónicos, presupuestos y Libro IVA Digital"
    >
      <div className="space-y-4">
        {/* NAVEGACIÓN PRINCIPAL DE PESTAÑAS */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:border dark:border-slate-800 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => handleTabChange("comprobantes")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              mainTab === "comprobantes"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Comprobantes y Emisión</span>
            <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              {summary.totalDocuments}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("libro-iva")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              mainTab === "libro-iva"
                ? "bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <BookOpen className="h-4 w-4 text-blue-500" />
            <span>Libro IVA Digital (Ventas & Compras)</span>
            <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
              ARCA F. 2083
            </span>
          </button>
        </div>

        {/* CONTENIDO SEGÚN LA PESTAÑA ACTIVA */}
        {mainTab === "libro-iva" ? (
          <LibroIvaView tenantId={tenantId} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
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
                  <span className="text-slate-600 dark:text-slate-400">ARCA</span>
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
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Entorno fiscal: {arcaSettings.fiscal_environment}
                </span>
              </div>
              {arcaOperationalStatus.reason ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{arcaOperationalStatus.reason}</p>
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

            {feedback ? (
              <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>
                {feedback.message}
              </div>
            ) : null}

            {showBudgetForm ? (
              <section className="ui-card space-y-3">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Crear presupuesto</h2>
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
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Generar documento desde venta</h2>
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
                canCancelWithCreditNote={canWriteFacturacion}
                isCancellingWithCreditNote={isCancellingWithCreditNote}
                arcaUnavailableReason={!arcaOperationalStatus.available ? arcaOperationalStatus.reason : null}
                onSendToArca={(invoice) => {
                  void sendInvoiceToArca(invoice.id);
                }}
                onCancelWithCreditNote={(invoice) => {
                  void cancelInvoiceWithCreditNote(invoice.id);
                }}
                onClose={() => setSelectedInvoiceId(null)}
              />
            ) : null}
          </div>
        )}
      </div>
    </PagePlaceholder>
  );
};
