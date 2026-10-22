import { useEffect, useState } from "react";
import { CheckCircle2, Download, FileText, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { settingsService } from "@/services/settings.service";
import { invoicesService } from "@/services/invoices.service";
import { ArcaInvoiceSheet, type ArcaInvoiceCopy } from "@/components/arca/ArcaInvoiceSheet";
import type { BusinessSettings, FacturacionSettings, Invoice, Receipt } from "@/types/entities";

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
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [loadedInvoice, setLoadedInvoice] = useState<Invoice | null>(invoice ?? null);
  const [invoiceCopy, setInvoiceCopy] = useState<ArcaInvoiceCopy>("ORIGINAL");
  const [activeTab, setActiveTab] = useState<"ticket" | "invoice">(
    mode === "invoice" ? "invoice" : "ticket"
  );

  useEffect(() => {
    if (invoice !== undefined) {
      setLoadedInvoice(invoice);
      return;
    }
    if (!tenantId || !receipt.sale_id) return;
    invoicesService
      .getBySaleId(tenantId, receipt.sale_id)
      .then((invList) => setLoadedInvoice(invList && invList.length > 0 ? invList[0] : null))
      .catch(() => setLoadedInvoice(null));
  }, [tenantId, receipt.sale_id, invoice]);

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

  const resolvedInvoice = loadedInvoice;
  const hasInvoice = Boolean(resolvedInvoice);

  const showTabs = mode === "both" && hasInvoice;
  const showTicket = mode === "ticket" || (mode === "both" && (!hasInvoice || activeTab === "ticket"));
  const showInvoice = mode === "invoice" || (mode === "both" && activeTab === "invoice");

  const printDocument = () => {
    window.print();
  };

  const downloadTicket = () => {
    const content = buildPlainTextTicket(receipt, resolvedInvoice);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${receipt.receipt_number}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadInvoice = () => {
    if (!resolvedInvoice) return;
    const content = buildPlainTextInvoice(resolvedInvoice, facturacionSettings);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Factura_${resolvedInvoice.document_type}_${resolvedInvoice.document_number}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <article className="mx-auto w-full max-w-4xl space-y-4">
      {/* PESTAÑAS SELECTORAS (CUANDO AMBOS COMPROBANTES ESTÁN DISPONIBLES) */}
      {showTabs && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 print:hidden">
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "ticket"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
            onClick={() => setActiveTab("ticket")}
          >
            <Printer size={13} />
            Ticket de Venta
          </button>
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "invoice"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
            onClick={() => setActiveTab("invoice")}
          >
            <FileText size={13} />
            Factura Oficial ARCA ({resolvedInvoice?.document_type} {resolvedInvoice?.document_number})
          </button>
        </div>
      )}

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
          {resolvedInvoice?.cae ? (
            <div className="rounded-lg border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 flex items-center justify-between gap-3">
              <div className="space-y-0.5 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Factura {resolvedInvoice.document_type} {resolvedInvoice.document_number}</span>
                </div>
                <p className="font-mono text-slate-700 dark:text-slate-300">
                  CAE: <span className="font-bold">{resolvedInvoice.cae}</span>
                </p>
                {resolvedInvoice.cae_due_date ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Vto. CAE: {resolvedInvoice.cae_due_date}
                  </p>
                ) : null}
                <div className="pt-1">
                  <button
                    type="button"
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    onClick={() => setActiveTab("invoice")}
                  >
                    Ver Factura Electrónica ARCA oficial →
                  </button>
                </div>
              </div>
              {resolvedInvoice.qr_data_url ? (
                <div className="bg-white p-1 rounded border border-slate-200 shadow-xs shrink-0 flex flex-col items-center">
                  <QRCodeSVG value={resolvedInvoice.qr_data_url} size={64} level="M" />
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

            <div className="mt-4 flex flex-wrap gap-2 pt-1 print:hidden">
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
        <div className="space-y-3">
          {/* BARRA DE HERRAMIENTAS Y ACCIONES DE FACTURA (PRINT:HIDDEN) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 print:hidden">
            {/* SELECTOR DE COPIA */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300 mr-1">Copia:</span>
              {(["ORIGINAL", "DUPLICADO", "TRIPLICADO", "ALL"] as const).map((copy) => (
                <button
                  key={copy}
                  type="button"
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    invoiceCopy === copy
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                      : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600"
                  }`}
                  onClick={() => setInvoiceCopy(copy)}
                >
                  {copy === "ALL" ? "Todas (3)" : copy}
                </button>
              ))}
            </div>

            {/* BOTONES DE IMPRESIÓN Y DESCARGA */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="ui-btn-primary flex items-center gap-1.5 text-xs"
                onClick={printDocument}
              >
                <Printer size={14} /> Imprimir Factura / PDF
              </button>
              <button
                type="button"
                className="ui-btn-ghost flex items-center gap-1.5 text-xs"
                onClick={downloadInvoice}
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
          </div>

          {/* HOJA OFICIAL ARCA */}
          <div className="py-4 px-2 sm:px-6 bg-slate-200/50 dark:bg-slate-950/70 rounded-xl overflow-x-auto flex justify-center border border-slate-300 dark:border-slate-800">
            <ArcaInvoiceSheet
              invoice={resolvedInvoice!}
              facturacionSettings={facturacionSettings}
              businessSettings={businessSettings}
              copiesMode={invoiceCopy}
              paymentMethodLabel={getPaymentMethodLabel(receipt.payment_method)}
            />
          </div>
        </div>
      ) : null}

      {showInvoice && !hasInvoice ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 p-6 text-center text-sm text-slate-600 dark:text-slate-300 space-y-2">
          <FileText size={32} className="mx-auto text-slate-400" />
          <p className="font-bold text-slate-800 dark:text-slate-200 text-base">
            Este comprobante no tiene factura fiscal asociada
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Podés emitir una Factura Electrónica ARCA oficial seleccionando el comprobante en el módulo de Comprobantes o desde Facturación.
          </p>
          {onClose ? (
            <div className="pt-2">
              <button type="button" className="ui-btn-ghost text-xs" onClick={onClose}>
                Cerrar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};
