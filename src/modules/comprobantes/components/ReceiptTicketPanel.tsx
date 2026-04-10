import type { Invoice, Receipt } from "@/types/entities";

interface ReceiptTicketPanelProps {
  receipt: Receipt;
  invoice?: Invoice | null;
  onClose?: () => void;
  mode?: "ticket" | "invoice" | "both";
}

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const getPaymentMethodLabel = (paymentMethod: Receipt["payment_method"]) => {
  if (paymentMethod === "cash") return "Efectivo";
  if (paymentMethod === "transfer") return "Transferencia";
  if (paymentMethod === "card") return "Tarjeta";
  if (paymentMethod === "mercado_pago") return "Mercado Pago";
  if (paymentMethod === "current_account") return "Cuenta corriente";
  return "Otro";
};

const buildPlainTextTicket = (receipt: Receipt): string => {
  const lines = [
    "COMPROBANTE INTERNO",
    `Numero: ${receipt.receipt_number}`,
    `Fecha: ${new Date(receipt.issued_at).toLocaleString("es-AR")}`,
    `Venta: ${receipt.sale_number}`,
    `Cliente: ${receipt.customer_name ?? "Consumidor final"}`,
    `Medio de pago: ${getPaymentMethodLabel(receipt.payment_method)}`,
    "",
    "Items:",
    ...receipt.items.map(
      (item) =>
        `- ${item.name} | ${item.quantity.toLocaleString("es-AR")} x ${currency.format(item.unit_price)} = ${currency.format(item.subtotal)}`
    ),
    "",
    `TOTAL: ${currency.format(receipt.total)}`,
  ];

  return lines.join("\n");
};

const buildPlainTextInvoice = (invoice: Invoice): string => {
  const lines = [
    "FACTURA INTERNA",
    `Documento: ${invoice.document_type} ${invoice.document_number}`,
    `Fecha: ${new Date(invoice.issue_date).toLocaleString("es-AR")}`,
    `Estado ARCA: ${invoice.arca_status}`,
    `Referencia ARCA: ${invoice.arca_reference ?? "-"}`,
    "",
    "Items:",
    ...invoice.items_snapshot.map(
      (item) =>
        `- ${item.product_name} | ${item.quantity.toLocaleString("es-AR")} x ${currency.format(item.unit_price)} = ${currency.format(item.total)}`
    ),
    "",
    `TOTAL: ${currency.format(invoice.total)}`,
  ];

  return lines.join("\n");
};

export const ReceiptTicketPanel = ({
  receipt,
  invoice,
  onClose,
  mode = "both",
}: ReceiptTicketPanelProps) => {
  const showTicket = mode !== "invoice";
  const showInvoice = mode !== "ticket";
  const hasInvoice = Boolean(invoice);

  const printTicket = () => {
    window.print();
  };

  const downloadTicket = () => {
    const content = buildPlainTextTicket(receipt);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${receipt.receipt_number}.txt`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const printInvoice = () => {
    window.print();
  };

  const downloadInvoice = () => {
    if (!invoice) return;

    const content = buildPlainTextInvoice(invoice);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoice.document_number}.txt`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <article className="mx-auto w-full max-w-2xl space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      {showTicket ? (
        <>
          <header className="border-b border-dashed border-slate-300 pb-3 text-center">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-900">Ticket interno</h3>
            <p className="mt-1 font-mono text-base text-slate-900">{receipt.receipt_number}</p>
            <p className="text-xs text-slate-500">{new Date(receipt.issued_at).toLocaleString("es-AR")}</p>
          </header>

          <div className="space-y-1 border-b border-dashed border-slate-300 py-3 text-sm">
            <p className="flex items-center justify-between">
              <span className="text-slate-500">Venta</span>
              <span className="font-medium text-slate-900">{receipt.sale_number}</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-slate-500">Cliente</span>
              <span className="font-medium text-slate-900">{receipt.customer_name ?? "Consumidor final"}</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-slate-500">Pago</span>
              <span className="font-medium text-slate-900">{getPaymentMethodLabel(receipt.payment_method)}</span>
            </p>
          </div>

          <div className="space-y-2 py-3 text-sm">
            {receipt.items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="rounded-lg border border-slate-200 p-2">
                <p className="font-medium text-slate-900">{item.name}</p>
                <p className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {item.quantity.toLocaleString("es-AR")} x {currency.format(item.unit_price)}
                  </span>
                  <span className="font-mono text-sm text-slate-900">{currency.format(item.subtotal)}</span>
                </p>
              </div>
            ))}
          </div>

          <footer className="border-t border-dashed border-slate-300 pt-3">
            <p className="flex items-center justify-between text-base font-semibold text-slate-900">
              <span>Total</span>
              <span className="font-kpi">{currency.format(receipt.total)}</span>
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="ui-btn-primary" onClick={printTicket}>
                Imprimir ticket
              </button>
              <button type="button" className="ui-btn-ghost" onClick={downloadTicket}>
                Descargar ticket
              </button>
              {onClose ? (
                <button type="button" className="ui-btn-ghost" onClick={onClose}>
                  Cerrar
                </button>
              ) : null}
            </div>
          </footer>
        </>
      ) : null}

      {showInvoice && hasInvoice ? (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900">
              Factura {invoice!.document_type} {invoice!.document_number}
            </h4>
            <span
              className={
                invoice!.arca_status === "accepted"
                  ? "ui-badge ui-badge--success"
                  : invoice!.arca_status === "rejected"
                    ? "ui-badge ui-badge--danger"
                    : "ui-badge ui-badge--warn"
              }
            >
              ARCA {invoice!.arca_status}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Referencia: {invoice!.arca_reference ?? "Sin referencia"}{" "}
            {invoice!.arca_message ? `| ${invoice!.arca_message}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-600">Total factura: {currency.format(invoice!.total)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="ui-btn-primary" onClick={printInvoice}>
              Imprimir factura
            </button>
            <button type="button" className="ui-btn-ghost" onClick={downloadInvoice}>
              Descargar factura
            </button>
          </div>
        </section>
      ) : null}

      {showInvoice && !hasInvoice ? (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Este comprobante no tiene factura asociada.
        </section>
      ) : null}
    </article>
  );
};
