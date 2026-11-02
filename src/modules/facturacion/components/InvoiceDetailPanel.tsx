import { useEffect, useState } from "react";
import type { BusinessSettings, FacturacionSettings, Invoice } from "@/types/entities";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { AlertTriangle, ChevronDown, ChevronUp, Download, ExternalLink, Printer, RotateCcw, Send } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { settingsService } from "@/services/settings.service";
import { ArcaInvoiceSheet, type ArcaInvoiceCopy } from "@/components/arca/ArcaInvoiceSheet";

interface InvoiceDetailPanelProps {
  invoice: Invoice;
  canSendToArca: boolean;
  isSendingToArca: boolean;
  canCancelWithCreditNote?: boolean;
  isCancellingWithCreditNote?: boolean;
  arcaUnavailableReason?: string | null;
  onSendToArca: (invoice: Invoice) => void;
  onCancelWithCreditNote?: (invoice: Invoice) => void;
  onClose: () => void;
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const statusBadgeClass = (status: string): string => {
  if (status === "issued" || status === "accepted") return "ui-badge ui-badge--success";
  if (status === "cancelled" || status === "rejected") return "ui-badge ui-badge--danger";
  if (status === "not_sent" || status === "pending") return "ui-badge ui-badge--warn";
  return "ui-badge ui-badge--info";
};

export const InvoiceDetailPanel = ({
  invoice,
  canSendToArca,
  isSendingToArca,
  canCancelWithCreditNote = true,
  isCancellingWithCreditNote = false,
  arcaUnavailableReason,
  onSendToArca,
  onCancelWithCreditNote,
  onClose,
}: InvoiceDetailPanelProps) => {
  const { tenantId } = useTenant();
  const [facturacionSettings, setFacturacionSettings] = useState<FacturacionSettings | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [invoiceCopy, setInvoiceCopy] = useState<ArcaInvoiceCopy>("ORIGINAL");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    settingsService
      .getByTenant(tenantId)
      .then((settings) => {
        if (settings?.facturacion) {
          setFacturacionSettings(settings.facturacion);
        }
        if (settings?.negocio) {
          setBusinessSettings(settings.negocio);
        }
      })
      .catch(() => {});
  }, [tenantId]);

  const canTriggerArca =
    canSendToArca &&
    !isSendingToArca &&
    (invoice.arca_status === "not_sent" || invoice.arca_status === "rejected");

  const sendButtonLabel =
    invoice.arca_status === "rejected" ? "Reintentar envío a ARCA" : "Enviar a ARCA";

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTxt = () => {
    const lines = [
      "========================================",
      `FACTURA ELECTRÓNICA OFICIAL ARCA - ${invoice.document_type} ${invoice.document_number}`,
      "========================================",
      `Emisor: ${facturacionSettings?.issuer_tax_name || "Comercio"}`,
      `CUIT: ${facturacionSettings?.issuer_cuit || "-"}`,
      `Fecha de Emisión: ${new Date(invoice.issue_date).toLocaleString("es-AR")}`,
      "----------------------------------------",
      `Cliente: ${invoice.customer_snapshot?.business_name || invoice.customer_snapshot?.full_name || "Consumidor Final"}`,
      `Documento: ${invoice.customer_snapshot?.document_type?.toUpperCase() || "DNI"} ${invoice.customer_snapshot?.document_number || "-"}`,
      `Condición IVA: ${invoice.customer_snapshot?.fiscal_condition || "Consumidor Final"}`,
      "----------------------------------------",
      "ITEMS:",
      ...invoice.items_snapshot.map(
        (it) => `${it.product_name} - Cant: ${it.quantity} x ${currency.format(it.unit_price)} = ${currency.format(it.total)}`
      ),
      "----------------------------------------",
      `Subtotal: ${currency.format(invoice.subtotal)}`,
      `IVA: ${currency.format(invoice.tax_total)}`,
      `TOTAL: ${currency.format(invoice.total)}`,
      "----------------------------------------",
      `CAE: ${invoice.cae || invoice.arca_reference || "No asignado"}`,
      `Vto. CAE: ${invoice.cae_due_date || "-"}`,
      `Estado ARCA: ${invoice.arca_status.toUpperCase()}`,
      "========================================",
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Factura_${invoice.document_type}_${invoice.document_number}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className="space-y-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-panel text-slate-800 dark:text-slate-100">
      {/* 1. BARRA SUPERIOR DE ACCIONES Y METADATOS (PRINT:HIDDEN) */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
              Factura {invoice.document_type} Nº {invoice.document_number}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Emisión: {new Date(invoice.issue_date).toLocaleDateString("es-AR")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <span className={statusBadgeClass(invoice.status)}>
              {invoice.status === "cancelled" ? "ANULADA CON NC" : invoice.status.toUpperCase()}
            </span>
            <span className={statusBadgeClass(invoice.arca_status)}>
              ARCA {invoice.arca_status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* SELECTOR DE COPIA */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400 px-1 text-[11px]">
              Copia:
            </span>
            {(["ORIGINAL", "DUPLICADO", "TRIPLICADO", "ALL"] as const).map((copy) => (
              <button
                key={copy}
                type="button"
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  invoiceCopy === copy
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
                onClick={() => setInvoiceCopy(copy)}
              >
                {copy === "ALL" ? "Todas (3)" : copy}
              </button>
            ))}
          </div>

          {/* BOTÓN IMPRIMIR / PDF */}
          <button
            type="button"
            className="ui-btn-primary flex items-center gap-1.5 text-xs font-bold"
            onClick={handlePrint}
            title="Imprimir la factura oficial en hoja A4 o guardar como PDF"
          >
            <Printer size={14} /> Imprimir / PDF
          </button>

          {/* BOTÓN DESCARGAR .TXT */}
          <button
            type="button"
            className="ui-btn-ghost flex items-center gap-1 text-xs"
            onClick={handleDownloadTxt}
            title="Descargar copia en texto plano"
          >
            <Download size={13} /> .txt
          </button>

          {/* BOTÓN ENVIAR A ARCA */}
          {(invoice.arca_status === "not_sent" ||
            invoice.arca_status === "rejected" ||
            invoice.arca_status === "pending" ||
            isSendingToArca) && (
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              onClick={() => onSendToArca(invoice)}
              disabled={!canTriggerArca}
            >
              <Send size={13} />
              {isSendingToArca || invoice.arca_status === "pending" ? "Enviando..." : sendButtonLabel}
            </button>
          )}

          {/* BOTÓN ANULAR CON NOTA DE CRÉDITO */}
          {invoice.arca_status === "accepted" &&
            invoice.status !== "cancelled" &&
            canCancelWithCreditNote &&
            onCancelWithCreditNote && (
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700/80 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                onClick={() => setShowCancelConfirm(true)}
                disabled={isCancellingWithCreditNote}
                title="Emitir Nota de Crédito oficial para anular este comprobante en ARCA"
              >
                <RotateCcw size={13} />
                {isCancellingWithCreditNote ? "Anulando en ARCA..." : "Anular con Nota de Crédito"}
              </button>
            )}

          <ModalCloseButton label="Cerrar detalle" onClick={onClose} />
        </div>
      </header>

      {/* 2. CONFIRMACIÓN DE ANULACIÓN CON NOTA DE CRÉDITO */}
      {showCancelConfirm && (
        <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50/90 dark:bg-red-950/40 p-4 space-y-3 print:hidden">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={18} />
            <div className="text-xs space-y-1">
              <p className="font-bold text-red-900 dark:text-red-200 text-sm">
                ¿Emitir Nota de Crédito oficial en ARCA (ex AFIP)?
              </p>
              <p className="text-red-800 dark:text-red-300 leading-relaxed">
                Por normativa fiscal de ARCA, los comprobantes emitidos con CAE no pueden eliminarse ni modificarse.
                Se solicitará una <strong>Nota de Crédito oficial ({invoice.document_type})</strong> vinculada a esta factura por un total de{" "}
                <strong>{currency.format(invoice.total)}</strong>, dejando la obligación fiscal en $0.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-red-200 dark:border-red-900/60">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              onClick={() => setShowCancelConfirm(false)}
              disabled={isCancellingWithCreditNote}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              onClick={() => {
                setShowCancelConfirm(false);
                onCancelWithCreditNote?.(invoice);
              }}
              disabled={isCancellingWithCreditNote}
            >
              <RotateCcw size={13} />
              Confirmar Emisión de Nota de Crédito
            </button>
          </div>
        </div>
      )}

      {/* 3. ALERTA DE ARCA NO DISPONIBLE */}
      {!canSendToArca && (invoice.arca_status === "not_sent" || invoice.arca_status === "rejected") && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 print:hidden">
          {arcaUnavailableReason ?? "ARCA no disponible para enviar esta factura."}
        </div>
      )}

      {/* 4. HOJA OFICIAL DE FACTURA ELECTRÓNICA ARCA (EXACTA AL MODELO OFICIAL A4) */}
      <div className="py-4 px-2 sm:px-6 bg-slate-200/50 dark:bg-slate-950/70 rounded-xl overflow-x-auto flex justify-center border border-slate-300 dark:border-slate-800">
        <ArcaInvoiceSheet
          invoice={invoice}
          facturacionSettings={facturacionSettings}
          businessSettings={businessSettings}
          copiesMode={invoiceCopy}
        />
      </div>

      {/* 5. SECCIÓN TÉCNICA Y AUDITORÍA ARCA (COLAPSABLE / PRINT:HIDDEN) */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-3 print:hidden">
        <button
          type="button"
          className="flex items-center justify-between w-full text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 py-1 cursor-pointer"
          onClick={() => setShowTechnicalDetails((prev) => !prev)}
        >
          <span>Telemetría fiscal y auditoría ARCA</span>
          {showTechnicalDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showTechnicalDetails && (
          <div className="mt-3 grid gap-3 md:grid-cols-2 text-xs">
            <div className="space-y-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3">
              <p className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                Validación ARCA
              </p>
              <p>
                <span className="font-semibold">CAE:</span>{" "}
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {invoice.cae || invoice.arca_reference || "No asignado"}
                </span>
              </p>
              <p>
                <span className="font-semibold">Vencimiento CAE:</span>{" "}
                <span className="font-mono">{invoice.cae_due_date || "-"}</span>
              </p>
              <p>
                <span className="font-semibold">Respuesta ARCA:</span>{" "}
                <span>{invoice.arca_message || "Comprobante registrado."}</span>
              </p>
              {invoice.qr_data_url && (
                <div className="pt-2 flex items-center gap-2">
                  <ExternalLink size={12} className="text-blue-600" />
                  <a
                    href={invoice.qr_data_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    Verificar comprobante en portal ARCA
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3">
              <p className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                Notas y Trazabilidad
              </p>
              <p>
                <span className="font-semibold">ID interno:</span>{" "}
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">{invoice.id}</span>
              </p>
              <p>
                <span className="font-semibold">Venta vinculada:</span>{" "}
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  {invoice.sale_id || "Venta directa"}
                </span>
              </p>
              {invoice.notes && (
                <p>
                  <span className="font-semibold">Notas:</span> {invoice.notes}
                </p>
              )}
              {invoice.qr_data_url && (
                <div className="pt-1 flex items-center gap-3">
                  <div className="bg-white p-1 rounded border border-slate-200">
                    <QRCodeSVG value={invoice.qr_data_url} size={64} level="M" />
                  </div>
                  <span className="text-[10px] text-slate-500">QR oficial generado para AFIP/ARCA</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
