import { useEffect, useState } from "react";
import { CheckCircle2, Download, ExternalLink, FileText, Printer, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { ARCA_DOCUMENT_TYPE_CODES } from "@/services/arca.service";
import { settingsService } from "@/services/settings.service";
import type { FacturacionSettings, Invoice, Receipt } from "@/types/entities";

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
  const normalized = String(paymentMethod).trim().toLowerCase();
  if (normalized === "cash") return "Efectivo";
  if (normalized === "card_debit") return "Tarjeta de débito";
  if (normalized === "card_credit") return "Tarjeta de crédito";
  if (normalized === "transfer") return "Transferencia bancaria";
  if (normalized === "mercado_pago") return "Mercado Pago";
  if (normalized === "cheque") return "Cheque";
  if (normalized === "current_account") return "Cuenta corriente";
  if (normalized === "card") return "Tarjeta";
  return "Otro";
};

const buildPlainTextTicket = (receipt: Receipt, invoice?: Invoice | null): string => {
  const lines = [
    "========================================",
    "          TICKET DE VENTA               ",
    "========================================",
    `Número: ${receipt.receipt_number}`,
    `Fecha: ${new Date(receipt.issued_at).toLocaleString("es-AR")}`,
    `Venta: ${receipt.sale_number}`,
    `Cliente: ${receipt.customer_name ?? "Consumidor final"}`,
    `Medio de pago: ${getPaymentMethodLabel(receipt.payment_method)}`,
    ...(receipt.notes ? [`Detalle: ${receipt.notes}`] : []),
    "",
    "ITEMS:",
    "----------------------------------------",
    ...receipt.items.map(
      (item) =>
        `${item.name}\n  ${item.quantity.toLocaleString("es-AR")} x ${currency.format(item.unit_price)} = ${currency.format(item.subtotal)}`
    ),
    "----------------------------------------",
    `TOTAL: ${currency.format(receipt.total)}`,
    ...(invoice?.cae
      ? [
          "",
          "DATOS FISCALES ARCA:",
          `Factura: ${invoice.document_type} ${invoice.document_number}`,
          `CAE: ${invoice.cae}`,
          `Vto. CAE: ${invoice.cae_due_date ?? "-"}`,
          ...(invoice.qr_data_url ? [`QR Verificador: ${invoice.qr_data_url}`] : []),
        ]
      : []),
    "========================================",
  ];

  return lines.join("\n");
};

const buildPlainTextInvoice = (
  invoice: Invoice,
  facturacion?: FacturacionSettings | null
): string => {
  const lines = [
    "========================================",
    `          FACTURA ${invoice.document_type}              `,
    "========================================",
    `Razón Social: ${facturacion?.issuer_tax_name ?? "Comercio"}`,
    `CUIT: ${facturacion?.issuer_cuit ?? "-"}`,
    `Condición IVA: ${facturacion?.issuer_fiscal_condition ?? "-"}`,
    "----------------------------------------",
    `Comprobante: ${invoice.document_type} ${invoice.document_number}`,
    `Fecha de Emisión: ${new Date(invoice.issue_date).toLocaleString("es-AR")}`,
    "----------------------------------------",
    `Cliente: ${invoice.customer_snapshot?.business_name ?? invoice.customer_snapshot?.full_name ?? "Consumidor Final"}`,
    `Documento: ${invoice.customer_snapshot?.document_type?.toUpperCase() ?? "DNI"} ${invoice.customer_snapshot?.document_number ?? "0"}`,
    `Condición IVA: ${invoice.customer_snapshot?.fiscal_condition ?? "Consumidor final"}`,
    "----------------------------------------",
    "DETALLE DE ITEMS:",
    ...invoice.items_snapshot.map(
      (item) =>
        `${item.product_name}\n  ${item.quantity.toLocaleString("es-AR")} x ${currency.format(item.unit_price)} = ${currency.format(item.total)}`
    ),
    "----------------------------------------",
    `Subtotal: ${currency.format(invoice.subtotal)}`,
    `Impuestos: ${currency.format(invoice.tax_total)}`,
    `TOTAL FACTURA: ${currency.format(invoice.total)}`,
    "----------------------------------------",
    `Estado ARCA: ${invoice.arca_status}`,
    ...(invoice.cae || invoice.arca_reference
      ? [`CAE: ${invoice.cae || invoice.arca_reference}`]
      : []),
    ...(invoice.cae_due_date ? [`Fecha Vto. CAE: ${invoice.cae_due_date}`] : []),
    ...(invoice.qr_data_url ? [`Verificador Oficial ARCA: ${invoice.qr_data_url}`] : []),
    "========================================",
  ];

  return lines.join("\n");
};

export const ReceiptTicketPanel = ({
  receipt,
  invoice,
  onClose,
  mode = "both",
}: ReceiptTicketPanelProps) => {
  const { tenantId } = useTenant();
  const [facturacionSettings, setFacturacionSettings] = useState<FacturacionSettings | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    settingsService
      .getByTenant(tenantId)
      .then((settings) => {
        if (settings?.facturacion) {
          setFacturacionSettings(settings.facturacion);
        }
      })
      .catch(() => {});
  }, [tenantId]);

  const showTicket = mode !== "invoice";
  const showInvoice = mode !== "ticket";
  const hasInvoice = Boolean(invoice);

  const printDocument = () => {
    window.print();
  };

  const downloadTicket = () => {
    const content = buildPlainTextTicket(receipt, invoice);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${receipt.receipt_number}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadInvoice = () => {
    if (!invoice) return;
    const content = buildPlainTextInvoice(invoice, facturacionSettings);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Factura_${invoice.document_type}_${invoice.document_number}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const invoiceDocCode = invoice
    ? String(ARCA_DOCUMENT_TYPE_CODES[invoice.document_type] ?? 0).padStart(3, "0")
    : "000";

  return (
    <article className="mx-auto w-full max-w-2xl space-y-4">
      {/* VISTA: TICKET INTERNO / COMERCIAL */}
      {showTicket ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-5 shadow-panel space-y-3">
          <header className="border-b border-dashed border-slate-300 dark:border-slate-700 pb-3 text-center">
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Ticket de Venta
            </h3>
            <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
              {receipt.receipt_number}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {new Date(receipt.issued_at).toLocaleString("es-AR")}
            </p>
          </header>

          <div className="space-y-1.5 border-b border-dashed border-slate-300 dark:border-slate-700 py-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Venta:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {receipt.sale_number}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Cliente:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {receipt.customer_name ?? "Consumidor final"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Medio de pago:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {getPaymentMethodLabel(receipt.payment_method)}
              </span>
            </div>
            {receipt.notes ? (
              <div className="flex items-start justify-between text-xs pt-1">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Detalle:</span>
                <span className="text-right text-slate-800 dark:text-slate-200 max-w-[280px]">
                  {receipt.notes}
                </span>
              </div>
            ) : null}
          </div>

          {/* LISTADO DE ITEMS */}
          <div className="space-y-1.5 py-2 text-xs">
            {receipt.items.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {item.quantity.toLocaleString("es-AR")} x {currency.format(item.unit_price)}
                  </p>
                </div>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 shrink-0">
                  {currency.format(item.subtotal)}
                </span>
              </div>
            ))}
          </div>

          {/* SELLO FISCAL EN TICKET (SI TIENE CAE) */}
          {invoice?.cae ? (
            <div className="rounded-lg border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 flex items-center justify-between gap-3">
              <div className="space-y-0.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Factura {invoice.document_type} {invoice.document_number}</span>
                </div>
                <p className="font-mono text-slate-700 dark:text-slate-300">
                  CAE: <span className="font-bold">{invoice.cae}</span>
                </p>
                {invoice.cae_due_date ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Vto. CAE: {invoice.cae_due_date}
                  </p>
                ) : null}
              </div>
              {invoice.qr_data_url ? (
                <div className="bg-white p-1 rounded border border-slate-200 shadow-xs shrink-0 flex flex-col items-center">
                  <QRCodeSVG value={invoice.qr_data_url} size={64} level="M" />
                  <span className="text-[8px] font-mono text-slate-600 font-bold uppercase mt-0.5">
                    ARCA QR
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <footer className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-3">
            <div className="flex items-center justify-between text-base font-bold text-slate-900 dark:text-slate-100">
              <span>Total abonado</span>
              <span className="font-kpi text-xl text-emerald-600 dark:text-emerald-400">
                {currency.format(receipt.total)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="ui-btn-primary flex items-center gap-1.5 text-xs"
                onClick={printDocument}
              >
                <Printer size={14} /> Imprimir ticket
              </button>
              <button
                type="button"
                className="ui-btn-ghost flex items-center gap-1.5 text-xs"
                onClick={downloadTicket}
              >
                <Download size={14} /> Descargar .txt
              </button>
              {onClose ? (
                <button
                  type="button"
                  className="ui-btn-ghost text-xs ml-auto"
                  onClick={onClose}
                >
                  Cerrar
                </button>
              ) : null}
            </div>
          </footer>
        </div>
      ) : null}

      {/* VISTA: FACTURA ELECTRÓNICA OFICIAL ARCA */}
      {showInvoice && hasInvoice ? (
        <div className="rounded-xl border border-slate-300 dark:border-slate-700/90 bg-white dark:bg-slate-900 p-5 shadow-panel space-y-4">
          {/* ENCABEZADO FISCAL CON LETRA EN EL MEDIO (NORMATIVA AFIP / ARCA) */}
          <div className="relative border-b-2 border-slate-300 dark:border-slate-700 pb-4">
            {/* CUADRO CENTRAL CON LA LETRA */}
            <div className="absolute left-1/2 -top-1 -translate-x-1/2 flex flex-col items-center justify-center bg-white dark:bg-slate-900 px-3 py-1 border-2 border-slate-400 dark:border-slate-600 rounded-md shadow-xs z-10">
              <span className="text-2xl font-black font-mono leading-none text-slate-900 dark:text-slate-100">
                {invoice!.document_type}
              </span>
              <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider mt-0.5">
                COD. {invoiceDocCode}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-8 text-xs pt-2">
              {/* LADO IZQUIERDO: EMISOR */}
              <div className="space-y-1 pr-6">
                <h2 className="text-base font-extrabold uppercase text-slate-900 dark:text-slate-100 leading-tight">
                  {facturacionSettings?.issuer_tax_name || "Comercio Emisor"}
                </h2>
                <p className="text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Condición IVA:</span>{" "}
                  {facturacionSettings?.issuer_fiscal_condition || "Monotributo"}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Punto de Venta Oficial ARCA
                </p>
              </div>

              {/* LADO DERECHO: DATOS COMPROBANTE */}
              <div className="space-y-1 text-right pl-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                  FACTURA
                </h3>
                <p className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                  Nº {invoice!.document_number}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Fecha:</span>{" "}
                  {new Date(invoice!.issue_date).toLocaleDateString("es-AR")}
                </p>
                <p className="font-mono text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">CUIT:</span>{" "}
                  {facturacionSettings?.issuer_cuit || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* DATOS DEL CLIENTE / RECEPTOR */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 p-3 text-xs space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Receptor / Cliente: </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {invoice!.customer_snapshot?.business_name ||
                    invoice!.customer_snapshot?.full_name ||
                    "Consumidor Final"}
                </span>
              </div>
              <div className="font-mono">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {invoice!.customer_snapshot?.document_type?.toUpperCase() || "DNI"}:{" "}
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {invoice!.customer_snapshot?.document_number || "0"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Condición frente al IVA: </span>
                <span>{invoice!.customer_snapshot?.fiscal_condition || "Consumidor final"}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Domicilio: </span>
                <span>{invoice!.customer_snapshot?.address || "No especificado"}</span>
              </div>
            </div>
          </div>

          {/* TABLA DE PRODUCTOS / ITEMS FACTURADOS */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2 px-3">Descripción</th>
                  <th className="py-2 px-3 text-right">Cant.</th>
                  <th className="py-2 px-3 text-right">Precio Unit.</th>
                  <th className="py-2 px-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                {invoice!.items_snapshot.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {it.product_name}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {it.quantity.toLocaleString("es-AR")}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {currency.format(it.unit_price)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {currency.format(it.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TOTALES */}
          <div className="flex flex-col items-end gap-1 text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-between w-48 text-slate-600 dark:text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono font-medium">{currency.format(invoice!.subtotal)}</span>
            </div>
            {invoice!.tax_total > 0 && (
              <div className="flex justify-between w-48 text-slate-600 dark:text-slate-400">
                <span>IVA:</span>
                <span className="font-mono font-medium">{currency.format(invoice!.tax_total)}</span>
              </div>
            )}
            <div className="flex justify-between w-56 text-sm font-bold text-slate-900 dark:text-slate-100 pt-1 border-t border-slate-200 dark:border-slate-700">
              <span>Total Facturado:</span>
              <span className="font-kpi text-base text-emerald-600 dark:text-emerald-400">
                {currency.format(invoice!.total)}
              </span>
            </div>
          </div>

          {/* PIE FISCAL OFICIAL ARCA (CAE + VTO + QR CODE) */}
          <footer className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/70 p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1.5 text-xs w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300">CAE:</span>
                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                    {invoice!.cae || invoice!.arca_reference || "En trámite"}
                  </span>
                  <span
                    className={
                      invoice!.arca_status === "accepted"
                        ? "ui-badge ui-badge--success text-[10px]"
                        : invoice!.arca_status === "rejected"
                          ? "ui-badge ui-badge--danger text-[10px]"
                          : "ui-badge ui-badge--warn text-[10px]"
                    }
                  >
                    ARCA {invoice!.arca_status.toUpperCase()}
                  </span>
                </div>

                {invoice!.cae_due_date ? (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="font-medium">Fecha de Vto. de CAE:</span>
                    <span className="font-mono font-semibold">{invoice!.cae_due_date}</span>
                  </div>
                ) : null}

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Comprobante Autorizado por ARCA (Agencia de Recaudación y Control Aduanero)
                </p>

                {invoice!.qr_data_url ? (
                  <div className="pt-1">
                    <a
                      href={invoice!.qr_data_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <ExternalLink size={12} /> Verificar validez en portal oficial de ARCA
                    </a>
                  </div>
                ) : null}
              </div>

              {/* QR CODE VECTORIAL OFICIAL */}
              {invoice!.qr_data_url ? (
                <div className="bg-white p-2.5 rounded-lg border border-slate-300 shadow-xs flex flex-col items-center shrink-0">
                  <QRCodeSVG value={invoice!.qr_data_url} size={96} level="M" />
                  <span className="text-[9px] font-mono font-bold text-slate-700 uppercase mt-1">
                    ARCA QR
                  </span>
                </div>
              ) : (
                <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-center w-24 h-24 shrink-0">
                  <QrCode size={28} className="text-slate-400" />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Sin QR</span>
                </div>
              )}
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/80 flex flex-wrap gap-2">
              <button
                type="button"
                className="ui-btn-primary flex items-center gap-1.5 text-xs"
                onClick={printDocument}
              >
                <Printer size={14} /> Imprimir factura
              </button>
              <button
                type="button"
                className="ui-btn-ghost flex items-center gap-1.5 text-xs"
                onClick={downloadInvoice}
              >
                <Download size={14} /> Descargar comprobante
              </button>
              {onClose ? (
                <button
                  type="button"
                  className="ui-btn-ghost text-xs ml-auto"
                  onClick={onClose}
                >
                  Cerrar
                </button>
              ) : null}
            </div>
          </footer>
        </div>
      ) : null}

      {showInvoice && !hasInvoice ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 p-4 text-center text-sm text-slate-600 dark:text-slate-300">
          <FileText size={28} className="mx-auto mb-2 text-slate-400" />
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Este comprobante no tiene factura fiscal asociada
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Podés emitir una Factura Electrónica ARCA seleccionando el comprobante en la tabla.
          </p>
        </div>
      ) : null}
    </article>
  );
};
