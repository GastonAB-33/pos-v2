import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, FileText, BookOpen, Receipt } from "lucide-react";
import { LoadingState } from "@/components/ui/UiStates";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { BudgetForm } from "@/modules/facturacion/components/BudgetForm";
import { GenerateFromSaleForm } from "@/modules/facturacion/components/GenerateFromSaleForm";
import { InvoiceDetailPanel } from "@/modules/facturacion/components/InvoiceDetailPanel";
import { InvoicesTable } from "@/modules/facturacion/components/InvoicesTable";
import { LibroIvaView } from "@/modules/facturacion/components/libro-iva/LibroIvaView";
import { ComprobantesView } from "@/modules/comprobantes/components/ComprobantesView";
import { useFacturacionModule } from "@/modules/facturacion/hooks/useFacturacionModule";

type FacturacionMainTab = "facturas" | "comprobantes" | "libro-iva";

export const FacturacionPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadFacturacion = canRead("facturacion");
  const canReadReceipts = canRead("comprobantes");
  const canWriteFacturacion = canWrite("facturacion");
  const canAccessPage = canReadFacturacion || canReadReceipts;

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [mainTab, setMainTab] = useState<FacturacionMainTab>(() => {
    if (tabParam === "libro-iva") return "libro-iva";
    if (tabParam === "comprobantes" || tabParam === "tickets") return "comprobantes";
    return "facturas";
  });
  const [comprobantesReloadKey, setComprobantesReloadKey] = useState(0);

  useEffect(() => {
    if (tabParam === "libro-iva") {
      setMainTab("libro-iva");
    } else if (tabParam === "comprobantes" || tabParam === "tickets") {
      setMainTab("comprobantes");
    } else {
      setMainTab("facturas");
    }
  }, [tabParam]);

  // Si el usuario no puede leer facturación pero sí comprobantes, forzar pestaña "comprobantes"
  useEffect(() => {
    if (!canReadFacturacion && canReadReceipts && mainTab !== "comprobantes") {
      setMainTab("comprobantes");
    }
  }, [canReadFacturacion, canReadReceipts, mainTab]);

  const handleTabChange = (newTab: FacturacionMainTab) => {
    setMainTab(newTab);
    const nextParams = new URLSearchParams(searchParams);
    if (newTab === "facturas") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", newTab);
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
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        No hay un comercio activo
      </div>
    );
  }

  if (!canAccessPage) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        No tenés permisos de lectura para este módulo
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header flotante moderno */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {mainTab === "libro-iva"
              ? "CONTABLE › LIBRO IVA DIGITAL"
              : mainTab === "comprobantes"
              ? "CONTABLE › COMPROBANTES DE VENTA"
              : "CONTABLE › FACTURACIÓN ELECTRÓNICA"}
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            {mainTab === "libro-iva"
              ? "Libro IVA Digital"
              : mainTab === "comprobantes"
              ? "Comprobantes de Venta"
              : "Facturación & ARCA"}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {mainTab === "libro-iva"
              ? "Régimen de información consolidado de ventas y compras (ARCA F. 2083)"
              : mainTab === "comprobantes"
              ? "Historial de tickets internos generados por ventas en el punto de venta"
              : "Gestión de comprobantes fiscales electrónicos, presupuestos y Libro IVA Digital"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              clearFeedback();
              void reload();
              setComprobantesReloadKey((prev) => prev + 1);
            }}
            disabled={isLoading || isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>

          {canWriteFacturacion && mainTab === "facturas" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowGenerateForm((current) => !current);
                  setShowBudgetForm(false);
                }}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80 cursor-pointer"
              >
                <span>Generar desde venta</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowBudgetForm((current) => !current);
                  setShowGenerateForm(false);
                }}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <span>Nuevo presupuesto</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Tabs Strip Segmentado Moderno */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 gap-1">
          {canReadFacturacion && (
            <button
              type="button"
              onClick={() => handleTabChange("facturas")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                mainTab === "facturas"
                  ? "bg-slate-900 text-white shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Facturación & ARCA</span>
              <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                {summary.totalDocuments}
              </span>
            </button>
          )}

          {canReadReceipts && (
            <button
              type="button"
              onClick={() => handleTabChange("comprobantes")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                mainTab === "comprobantes"
                  ? "bg-slate-900 text-white shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Receipt className="h-4 w-4 text-emerald-500" />
              <span>Comprobantes de Venta</span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                Tickets POS
              </span>
            </button>
          )}

          {canReadFacturacion && (
            <button
              type="button"
              onClick={() => handleTabChange("libro-iva")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                mainTab === "libro-iva"
                  ? "bg-slate-900 text-white shadow-sm dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <BookOpen className="h-4 w-4 text-blue-500" />
              <span>Libro IVA Digital (Ventas & Compras)</span>
              <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:text-blue-300">
                ARCA F. 2083
              </span>
            </button>
          )}
        </div>
      </div>

      {/* CONTENIDO SEGÚN LA PESTAÑA ACTIVA */}
      {mainTab === "libro-iva" ? (
        <LibroIvaView tenantId={tenantId} />
      ) : mainTab === "comprobantes" ? (
        <ComprobantesView
          key={comprobantesReloadKey}
          tenantId={tenantId}
          userId={user?.id ?? null}
          onInvoiceGenerated={() => {
            void reload();
          }}
        />
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2.5">
                <span className="font-semibold text-slate-800 dark:text-slate-200">ARCA</span>
                <span
                  className={[
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                    arcaOperationalStatus.mode === "mock"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300"
                      : arcaOperationalStatus.mode === "sandbox"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                        : arcaOperationalStatus.mode === "real"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300",
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
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    arcaOperationalStatus.available
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300"
                  }`}
                >
                  {arcaOperationalStatus.available ? "Disponible" : "No disponible"}
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Entorno fiscal: <span className="font-semibold text-slate-700 dark:text-slate-300">{arcaSettings.fiscal_environment}</span>
              </span>
            </div>
            {arcaOperationalStatus.reason ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{arcaOperationalStatus.reason}</p>
            ) : null}
          </section>

          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Documentos</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{summary.totalDocuments.toLocaleString("es-AR")}</p>
            </article>
            <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Emitidos</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{summary.issuedDocuments.toLocaleString("es-AR")}</p>
            </article>
            <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Borradores</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-700 dark:text-slate-300">{summary.draftDocuments.toLocaleString("es-AR")}</p>
            </article>
            <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total emitido</p>
              <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(summary.issuedTotal)}</p>
            </article>
            <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">ARCA rechazados</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">{summary.rejectedArca.toLocaleString("es-AR")}</p>
            </article>
          </section>

          {feedback ? (
            <div className={`p-4 rounded-xl text-xs ${feedback.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900" : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"}`}>
              {feedback.message}
            </div>
          ) : null}

          {showBudgetForm ? (
            <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
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
            <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
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

          <section className="space-y-4">
            <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
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
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                >
                  <option value="all">Todos los estados</option>
                  <option value="draft">Borrador</option>
                  <option value="issued">Emitido</option>
                  <option value="cancelled">Cancelado</option>
                </select>

                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                />
              </div>
            </div>

            {isLoading ? (
              <LoadingState
                message="Cargando facturación y comprobantes..."
                description="Consultando facturas emitidas, estados de ARCA y libros contables..."
              />
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
  );
};

