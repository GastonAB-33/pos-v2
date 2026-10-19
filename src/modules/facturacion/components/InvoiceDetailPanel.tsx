import { useState } from "react";
import type { Invoice } from "@/types/entities";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { AlertTriangle, ExternalLink, RotateCcw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const canTriggerArca =
    canSendToArca &&
    !isSendingToArca &&
    (invoice.arca_status === "not_sent" || invoice.arca_status === "rejected");

  const sendButtonLabel =
    invoice.arca_status === "rejected" ? "Reintentar envio a ARCA" : "Enviar a ARCA";

  return (
    <article className="space-y-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm text-slate-800 dark:text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {invoice.document_type} {invoice.document_number}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Emisión: {new Date(invoice.issue_date).toLocaleString("es-AR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* BOTÓN ENVIAR A ARCA */}
          {(invoice.arca_status === "pending" || canTriggerArca || isSendingToArca) && (
            <button
              type="button"
              className="ui-btn-primary"
              onClick={() => onSendToArca(invoice)}
              disabled={!canTriggerArca}
            >
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

      {/* CONFIRMACIÓN DE ANULACIÓN CON NOTA DE CRÉDITO */}
      {showCancelConfirm && (
        <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50/90 dark:bg-red-950/40 p-4 space-y-3">
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

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            Cliente fiscal
          </p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {invoice.customer_snapshot?.business_name ??
              invoice.customer_snapshot?.full_name ??
              "Consumidor Final"}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {invoice.customer_snapshot
              ? `${invoice.customer_snapshot.document_type.toUpperCase()} ${invoice.customer_snapshot.document_number}`
              : "Sin identificación requerida"}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {invoice.customer_snapshot?.fiscal_condition ?? "Consumidor Final"}
          </p>
        </div>

        <div className="space-y-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            Estado Fiscal ARCA
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={statusBadgeClass(invoice.status)}>
              {invoice.status === "cancelled" ? "ANULADA CON NC" : invoice.status.toUpperCase()}
            </span>
            <span className={statusBadgeClass(invoice.arca_status)}>
              ARCA {invoice.arca_status.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 pt-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">CAE / Ref:</span>{" "}
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {invoice.cae || invoice.arca_reference || "No asignado"}
            </span>
          </p>
          {invoice.cae_due_date ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Vto. CAE:</span>{" "}
              <span className="font-mono">{invoice.cae_due_date}</span>
            </p>
          ) : null}
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Mensaje: {invoice.arca_message ?? "Comprobante registrado."}
          </p>

          {invoice.qr_data_url ? (
            <div className="pt-2 flex items-center gap-3">
              <div className="bg-white p-1.5 rounded-lg border border-slate-300 shadow-xs shrink-0">
                <QRCodeSVG value={invoice.qr_data_url} size={70} level="M" />
              </div>
              <a
                href={invoice.qr_data_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink size={12} /> Verificar en Portal ARCA
              </a>
            </div>
          ) : null}
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Detalle de Items</h4>
        {!invoice.items_snapshot.length ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-center text-xs text-slate-500">
            Documento global sin items discriminados.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Precio Unit.</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {invoice.items_snapshot.map((item, index) => (
                  <tr key={`${item.product_id}-${index}`}>
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{item.product_name}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                      {item.quantity.toLocaleString("es-AR")}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                      {currency.format(item.unit_price)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {currency.format(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="space-y-1 border-t border-slate-200 dark:border-slate-800 pt-3 text-right">
        <p className="text-xs text-slate-600 dark:text-slate-400">Subtotal Neto: {currency.format(invoice.subtotal)}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">IVA / Impuestos: {currency.format(invoice.tax_total)}</p>
        <p className="font-black text-lg text-slate-900 dark:text-slate-100">Total: {currency.format(invoice.total)}</p>
      </footer>

      {invoice.notes ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
          <span className="font-semibold">Notas:</span> {invoice.notes}
        </div>
      ) : null}

      {!canSendToArca && (invoice.arca_status === "not_sent" || invoice.arca_status === "rejected") ? (
        <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          {arcaUnavailableReason ?? "ARCA no disponible para enviar esta factura."}
        </div>
      ) : null}
    </article>
  );
};
