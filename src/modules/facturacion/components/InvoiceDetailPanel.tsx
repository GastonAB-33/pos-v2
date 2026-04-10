import type { Invoice } from "@/types/entities";

interface InvoiceDetailPanelProps {
  invoice: Invoice;
  canSendToArca: boolean;
  isSendingToArca: boolean;
  arcaUnavailableReason?: string | null;
  onSendToArca: (invoice: Invoice) => void;
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
  arcaUnavailableReason,
  onSendToArca,
  onClose,
}: InvoiceDetailPanelProps) => {
  const canTriggerArca =
    canSendToArca &&
    !isSendingToArca &&
    (invoice.arca_status === "not_sent" || invoice.arca_status === "rejected");

  const sendButtonLabel =
    invoice.arca_status === "rejected" ? "Reintentar envio a ARCA" : "Enviar a ARCA";

  return (
    <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {invoice.document_type} {invoice.document_number}
          </h3>
          <p className="text-xs text-slate-500">
            Emision: {new Date(invoice.issue_date).toLocaleString("es-AR")}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <button type="button" className="ui-btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Cliente fiscal</p>
          <p className="text-sm font-medium text-slate-900">
            {invoice.customer_snapshot?.business_name ??
              invoice.customer_snapshot?.full_name ??
              "Sin cliente"}
          </p>
          <p className="text-xs text-slate-600">
            {invoice.customer_snapshot
              ? `${invoice.customer_snapshot.document_type.toUpperCase()} ${invoice.customer_snapshot.document_number}`
              : "Sin datos fiscales"}
          </p>
          <p className="text-xs text-slate-600">
            {invoice.customer_snapshot?.fiscal_condition ?? "Condicion fiscal no informada"}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Estado</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={statusBadgeClass(invoice.status)}>{invoice.status}</span>
            <span className={statusBadgeClass(invoice.arca_status)}>ARCA {invoice.arca_status}</span>
          </div>
          <p className="text-xs text-slate-600">
            Referencia ARCA: {invoice.arca_reference ?? "No informada"}
          </p>
          <p className="text-xs text-slate-600">
            Mensaje ARCA: {invoice.arca_message ?? "Sin respuesta registrada"}
          </p>
          {invoice.sale_id ? (
            <p className="text-xs text-slate-600">Venta origen: {invoice.sale_id}</p>
          ) : (
            <p className="text-xs text-slate-600">Sin venta origen</p>
          )}
        </div>
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Items</h4>
        {!invoice.items_snapshot.length ? (
          <div className="ui-empty-state">Documento sin items detallados.</div>
        ) : (
          <div className="ui-table-wrap">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Precio</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {invoice.items_snapshot.map((item, index) => (
                  <tr key={`${item.product_id}-${index}`}>
                    <td className="px-3 py-2">{item.product_name}</td>
                    <td className="px-3 py-2 text-right">{item.quantity.toLocaleString("es-AR")}</td>
                    <td className="px-3 py-2 text-right">{currency.format(item.unit_price)}</td>
                    <td className="px-3 py-2 text-right">{currency.format(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="space-y-1 border-t border-slate-200 pt-3 text-right">
        <p className="text-xs text-slate-600">Subtotal: {currency.format(invoice.subtotal)}</p>
        <p className="text-xs text-slate-600">Impuestos: {currency.format(invoice.tax_total)}</p>
        <p className="font-kpi text-base text-slate-900">Total: {currency.format(invoice.total)}</p>
      </footer>

      {invoice.notes ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {invoice.notes}
        </div>
      ) : null}

      {!canSendToArca && (invoice.arca_status === "not_sent" || invoice.arca_status === "rejected") ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {arcaUnavailableReason ?? "ARCA no disponible para enviar esta factura."}
        </div>
      ) : null}
    </article>
  );
};
