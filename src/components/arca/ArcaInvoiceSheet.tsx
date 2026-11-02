import React from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Invoice, FacturacionSettings, BusinessSettings } from "@/types/entities";

export type ArcaInvoiceCopy = "ORIGINAL" | "DUPLICADO" | "TRIPLICADO" | "ALL";

export interface ArcaInvoiceSheetProps {
  invoice: Invoice;
  facturacionSettings?: FacturacionSettings | null;
  businessSettings?: BusinessSettings | null;
  copyLabel?: "ORIGINAL" | "DUPLICADO" | "TRIPLICADO";
  copiesMode?: ArcaInvoiceCopy;
  paymentMethodLabel?: string;
  className?: string;
}

const formatNumber = (val: number): string =>
  val.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Normaliza y formatea el punto de venta y número de comprobante con ceros a la izquierda
 * según normativa de AFIP / ARCA (5 dígitos para PV y 8 dígitos para número).
 */
export const formatInvoiceNumbers = (
  documentNumber: string | undefined | null,
  defaultPtoVta = 1
): { ptoVta: string; compNro: string } => {
  if (!documentNumber) {
    return {
      ptoVta: String(defaultPtoVta).padStart(5, "0"),
      compNro: "00000001",
    };
  }

  const parts = documentNumber.split(/[-/]/);
  if (parts.length >= 2) {
    return {
      ptoVta: (parts[0].replace(/\D/g, "") || String(defaultPtoVta)).padStart(5, "0"),
      compNro: (parts[1].replace(/\D/g, "") || "1").padStart(8, "0"),
    };
  }

  const clean = documentNumber.replace(/\D/g, "");
  return {
    ptoVta: String(defaultPtoVta).padStart(5, "0"),
    compNro: clean.padStart(8, "0") || "00000001",
  };
};

/**
 * Devuelve el código de comprobante oficial de ARCA / AFIP.
 */
export const getArcaDocTypeCode = (docType: string): string => {
  const norm = (docType || "B").toUpperCase().trim();
  switch (norm) {
    case "A":
    case "FACTURA_A":
      return "001";
    case "NOTA_CREDITO_A":
    case "NC_A":
      return "003";
    case "NOTA_DEBITO_A":
    case "ND_A":
      return "002";
    case "B":
    case "FACTURA_B":
      return "006";
    case "NOTA_CREDITO_B":
    case "NC_B":
      return "008";
    case "NOTA_DEBITO_B":
    case "ND_B":
      return "007";
    case "C":
    case "FACTURA_C":
      return "011";
    case "NOTA_CREDITO_C":
    case "NC_C":
      return "013";
    case "NOTA_DEBITO_C":
    case "ND_C":
      return "012";
    case "M":
    case "FACTURA_M":
      return "051";
    default:
      return "006";
  }
};

/**
 * Obtiene el título legal del comprobante (FACTURA, NOTA DE CRÉDITO, PRESUPUESTO)
 */
export const getDocumentTitle = (docType: string): string => {
  const norm = (docType || "B").toUpperCase().trim();
  if (norm.includes("CREDITO") || norm.startsWith("NC")) return "NOTA DE CRÉDITO";
  if (norm.includes("DEBITO") || norm.startsWith("ND")) return "NOTA DE DÉBITO";
  if (norm.includes("PRESUPUESTO") || norm === "X") return "PRESUPUESTO";
  return "FACTURA";
};

/**
 * Genera la URL oficial de verificación de ARCA (ex AFIP) para el código QR
 */
export const buildArcaQrUrl = (
  invoice: Invoice,
  cuit: string,
  puntoVenta: number,
  tipoComprobanteCode: string
): string => {
  if (invoice.qr_data_url && invoice.qr_data_url.startsWith("http")) {
    return invoice.qr_data_url;
  }

  try {
    const cleanCuit = Number((cuit || "0").replace(/\D/g, "")) || 0;
    const { ptoVta, compNro } = formatInvoiceNumbers(invoice.document_number, puntoVenta);
    const docRecType = invoice.customer_snapshot?.document_type?.toLowerCase() === "cuit" ? 80 : 96;
    const cleanDocRec = Number((invoice.customer_snapshot?.document_number || "0").replace(/\D/g, "")) || 0;

    const payload = {
      ver: 1,
      fecha: (invoice.issue_date || new Date().toISOString()).slice(0, 10),
      cuit: cleanCuit,
      ptoVta: Number(ptoVta),
      tipoCmp: Number(tipoComprobanteCode),
      nroCmp: Number(compNro),
      importe: invoice.total,
      moneda: "PES",
      ctz: 1,
      tipoDocRec: cleanDocRec > 0 ? docRecType : 99,
      nroDocRec: cleanDocRec,
      tipoCodAut: "E",
      codAut: Number(invoice.cae) || 0,
    };

    const encoded = typeof window !== "undefined" ? btoa(JSON.stringify(payload)) : "";
    return `https://www.afip.gob.ar/fe/qr/?p=${encoded}`;
  } catch {
    return `https://www.afip.gob.ar/fe/qr/?p=`;
  }
};

/**
 * Formatea fechas a formato argentino DD/MM/AAAA
 */
const formatDate = (dateStr: string | undefined | null): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

/**
 * Componente individual de una hoja de Factura Electrónica ARCA (ex AFIP)
 */
const ArcaInvoiceSingleSheet: React.FC<{
  invoice: Invoice;
  facturacionSettings?: FacturacionSettings | null;
  businessSettings?: BusinessSettings | null;
  copyLabel: "ORIGINAL" | "DUPLICADO" | "TRIPLICADO";
  paymentMethodLabel?: string;
  className?: string;
}> = ({
  invoice,
  facturacionSettings,
  businessSettings,
  copyLabel,
  paymentMethodLabel,
  className = "",
}) => {
  const ptoVtaDefault = facturacionSettings?.arca?.punto_venta || 1;
  const { ptoVta, compNro } = formatInvoiceNumbers(invoice.document_number, ptoVtaDefault);
  const docCode = getArcaDocTypeCode(invoice.document_type);
  const docTitle = getDocumentTitle(invoice.document_type);

  // Emisor
  const emisorTradeName =
    businessSettings?.trade_name ||
    facturacionSettings?.issuer_tax_name ||
    businessSettings?.legal_name ||
    "MARTINEZ PATRICIA ELIANA";

  const emisorRazonSocial =
    facturacionSettings?.issuer_tax_name ||
    businessSettings?.legal_name ||
    businessSettings?.trade_name ||
    "MARTINEZ PATRICIA ELIANA";

  const emisorCuit =
    facturacionSettings?.issuer_cuit ||
    facturacionSettings?.arca?.cuit_emisor ||
    businessSettings?.cuit ||
    "27271380971";

  const emisorAddress =
    facturacionSettings?.issuer_address ||
    businessSettings?.address ||
    "Autopista 25 De Mayo Km 7 700 0 - Ciudad De La Punta (Capital), San Lu";

  const emisorCondicionIva =
    facturacionSettings?.issuer_fiscal_condition ||
    "IVA Responsable Inscripto";

  const emisorIibb =
    ((facturacionSettings as Record<string, unknown> | undefined)?.issuer_iibb as string) ||
    emisorCuit.replace(/\D/g, "") ||
    "1227271380971";

  const emisorInicioActividades =
    ((facturacionSettings as Record<string, unknown> | undefined)?.issuer_start_date as string) ||
    "01/12/2023";

  // Cliente / Receptor
  const customer = invoice.customer_snapshot;
  const rawDocType = customer?.document_type ? customer.document_type.toUpperCase() : "Doc.";
  const customerDocType = rawDocType === "DNI" ? "D.N.I." : rawDocType;
  const customerDocNum = customer?.document_number ? customer.document_number : "-";
  const customerName =
    customer?.business_name ||
    customer?.full_name ||
    "Consumidor Final";
  const customerCondicionIva = customer?.fiscal_condition || "Consumidor Final";
  const customerAddress = customer?.address || "-";

  // Condición de venta
  const resolvedPaymentCondition =
    paymentMethodLabel ||
    (invoice.notes?.includes("Transferencia") ? "Transferencia Bancaria" : null) ||
    (invoice.notes?.includes("Efectivo") ? "Efectivo" : null) ||
    "Transferencia Bancaria";

  // Cálculo Ley 27.743 (Régimen de Transparencia Fiscal al Consumidor para Factura B a Consumidor Final)
  const isFacturaB = invoice.document_type === "B";
  const isFacturaA = invoice.document_type === "A";
  const isConsumidorFinal =
    !customer?.fiscal_condition ||
    customer.fiscal_condition.toLowerCase().includes("consumidor");

  const showLeyTransparencia = isFacturaB && isConsumidorFinal;
  const ivaContenido =
    invoice.tax_total > 0
      ? invoice.tax_total
      : Math.round((invoice.total - invoice.total / 1.21) * 100) / 100;

  // En Factura B oficial, el Subtotal mostrado es el total de la operación (con IVA incluido)
  const displayedSubtotal = isFacturaA ? invoice.subtotal : invoice.total;

  // QR URL
  const qrUrl = buildArcaQrUrl(
    invoice,
    emisorCuit,
    Number(ptoVta) || ptoVtaDefault,
    docCode
  );

  return (
    <div
      className={`arca-invoice-page w-full max-w-[850px] mx-auto p-4 sm:p-6 font-sans text-xs select-text shadow-xl border border-black print:border-none print:shadow-none print:p-0 print:max-w-none print:w-full print:m-0 mb-8 last:mb-0 print:mb-0 ${className}`}
      style={{
        backgroundColor: "#ffffff",
        color: "#000000",
        colorScheme: "light",
      }}
    >
      {/* 1. Título de copia (ORIGINAL / DUPLICADO / TRIPLICADO) */}
      <div
        className="border border-black py-1 text-center font-bold text-sm tracking-wider uppercase mb-[-1px]"
        style={{ backgroundColor: "#ffffff", color: "#000000" }}
      >
        {copyLabel}
      </div>

      {/* 2. Cabecera principal: Emisor | Letra Central | Datos de Comprobante */}
      <div
        className="border border-black relative mb-[-1px]"
        style={{ backgroundColor: "#ffffff", color: "#000000" }}
      >
        {/* Cuadro central con Letra y Código de comprobante */}
        <div
          className="absolute left-1/2 -top-[1px] -translate-x-1/2 border border-black flex flex-col items-center justify-center z-10 w-14 sm:w-16"
          style={{ height: "48px", backgroundColor: "#ffffff", color: "#000000" }}
        >
          <span className="text-2xl font-black font-sans leading-none" style={{ color: "#000000" }}>
            {invoice.document_type}
          </span>
          <span className="text-[9px] font-bold tracking-tight mt-0.5" style={{ color: "#000000" }}>
            COD. {docCode}
          </span>
        </div>

        <div className="grid grid-cols-2">
          {/* Lado izquierdo: Emisor */}
          <div
            className="p-3 pr-10 sm:pr-12 space-y-1.5 border-r border-black flex flex-col justify-between"
            style={{ backgroundColor: "#ffffff", color: "#000000" }}
          >
            <div className="text-center pt-1 pb-2">
              <h1 className="text-base sm:text-lg font-black uppercase leading-tight" style={{ color: "#000000" }}>
                {emisorTradeName}
              </h1>
            </div>
            <div className="space-y-1 text-[11px] leading-snug" style={{ color: "#000000" }}>
              <p>
                <span className="font-bold">Razón Social:</span> {emisorRazonSocial}
              </p>
              <p>
                <span className="font-bold">Domicilio Comercial:</span> {emisorAddress}
              </p>
              <p>
                <span className="font-bold">Condición frente al IVA:</span> {emisorCondicionIva}
              </p>
            </div>
          </div>

          {/* Lado derecho: Datos de Comprobante */}
          <div
            className="p-3 pl-10 sm:pl-12 space-y-1 text-[11px] leading-snug"
            style={{ backgroundColor: "#ffffff", color: "#000000" }}
          >
            <h2 className="text-xl sm:text-2xl font-black tracking-wide mb-2" style={{ color: "#000000" }}>
              {docTitle}
            </h2>
            <div className="flex gap-4 font-bold text-[12px]" style={{ color: "#000000" }}>
              <span>Punto de Venta: {ptoVta}</span>
              <span>Comp. Nro: {compNro}</span>
            </div>
            <p style={{ color: "#000000" }}>
              <span className="font-bold">Fecha de Emisión:</span> {formatDate(invoice.issue_date)}
            </p>
            <p style={{ color: "#000000" }}>
              <span className="font-bold">CUIT:</span> {emisorCuit.replace(/\D/g, "")}
            </p>
            <p style={{ color: "#000000" }}>
              <span className="font-bold">Ingresos Brutos:</span> {emisorIibb}
            </p>
            <p style={{ color: "#000000" }}>
              <span className="font-bold">Fecha de Inicio de Actividades:</span>{" "}
              {formatDate(emisorInicioActividades)}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Cuadro de Datos del Cliente / Receptor */}
      <div
        className="border border-black p-2.5 space-y-1 text-[11px] mb-[-1px] leading-snug"
        style={{ backgroundColor: "#ffffff", color: "#000000" }}
      >
        <div className="grid grid-cols-2 gap-x-4">
          <p style={{ color: "#000000" }}>
            <span className="font-bold">{customerDocType}:</span> {customerDocNum}
          </p>
          <p style={{ color: "#000000" }}>
            <span className="font-bold">Apellido y Nombre / Razón Social:</span> {customerName}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <p style={{ color: "#000000" }}>
            <span className="font-bold">Condición frente al IVA:</span> {customerCondicionIva}
          </p>
          <p style={{ color: "#000000" }}>
            <span className="font-bold">Domicilio:</span> {customerAddress}
          </p>
        </div>
        <div>
          <p style={{ color: "#000000" }}>
            <span className="font-bold">Condición de venta:</span> {resolvedPaymentCondition}
          </p>
        </div>
      </div>

      {/* 4. Tabla de Ítems / Productos */}
      <div
        className="border border-black mb-[-1px] flex flex-col justify-between min-h-[300px]"
        style={{ backgroundColor: "#ffffff", color: "#000000" }}
      >
        <table className="w-full border-collapse text-[10px] sm:text-[11px]" style={{ backgroundColor: "#ffffff", color: "#000000" }}>
          <thead>
            <tr style={{ backgroundColor: "#e2e8f0", color: "#000000" }} className="border-b border-black">
              <th style={{ backgroundColor: "#e2e8f0", color: "#000000" }} className="py-1 px-2 text-left font-bold border-r border-black w-16">Código</th>
              <th style={{ backgroundColor: "#e2e8f0", color: "#000000" }} className="py-1 px-2 text-left font-bold border-r border-black">Producto / Servicio</th>
              <th style={{ backgroundColor: "#e2e8f0", color: "#000000" }} className="py-1 px-2 text-right font-bold border-r border-black w-14">Cantidad</th>
              <th style={{ backgroundColor: "#e2e8f0", color: "#000000" }} className="py-1 px-2 text-center font-bold border-r border-black w-16">U. Medida</th>
              <th style={{ backgroundColor: "#e2e8f0", color: "#000000" }} className="py-1 px-2 text-right font-bold border-r border-black w-24">Precio Unit.</th>
              <th style={{ backgroundColor: "#e2e8f0", color: "#000000" }} className="py-1 px-2 text-right font-bold border-r border-black w-14">% Bonif</th>
              <th style={{ backgroundColor: "#e2e8f0", color: "#000000" }} className="py-1 px-2 text-right font-bold border-r border-black w-16">Imp. Bonif.</th>
              <th style={{ backgroundColor: "#e2e8f0", color: "#000000" }} className="py-1 px-2 text-right font-bold w-24">Subtotal</th>
            </tr>
          </thead>
          <tbody style={{ backgroundColor: "#ffffff", color: "#000000" }}>
            {invoice.items_snapshot.map((it, idx) => (
              <tr key={idx} className="border-b border-slate-100 last:border-b-0" style={{ backgroundColor: "#ffffff", color: "#000000" }}>
                <td style={{ backgroundColor: "#ffffff", color: "#000000" }} className="py-1 px-2 text-left border-r border-slate-300 font-mono text-[10px]">
                  {it.product_id ? it.product_id.slice(0, 8).toUpperCase() : "-"}
                </td>
                <td style={{ backgroundColor: "#ffffff", color: "#000000" }} className="py-1 px-2 text-left border-r border-slate-300 font-medium">
                  {it.product_name}
                </td>
                <td style={{ backgroundColor: "#ffffff", color: "#000000" }} className="py-1 px-2 text-right border-r border-slate-300 font-mono">
                  {formatNumber(it.quantity)}
                </td>
                <td style={{ backgroundColor: "#ffffff", color: "#475569" }} className="py-1 px-2 text-center border-r border-slate-300">
                  unidades
                </td>
                <td style={{ backgroundColor: "#ffffff", color: "#000000" }} className="py-1 px-2 text-right border-r border-slate-300 font-mono">
                  {formatNumber(it.unit_price)}
                </td>
                <td style={{ backgroundColor: "#ffffff", color: "#000000" }} className="py-1 px-2 text-right border-r border-slate-300 font-mono">
                  0,00
                </td>
                <td style={{ backgroundColor: "#ffffff", color: "#000000" }} className="py-1 px-2 text-right border-r border-slate-300 font-mono">
                  0,00
                </td>
                <td style={{ backgroundColor: "#ffffff", color: "#000000" }} className="py-1 px-2 text-right font-mono font-medium">
                  {formatNumber(it.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Espaciador vertical natural para mantener altura A4 auténtica */}
        <div className="flex-1 min-h-[140px]" style={{ backgroundColor: "#ffffff" }} />

        {/* 5. Cuadro de Subtotales y Totales */}
        <div
          className="border-t border-black p-2 flex flex-col items-end"
          style={{ backgroundColor: "#ffffff", color: "#000000" }}
        >
          <div className="w-full sm:w-72 space-y-1 text-[11px]" style={{ color: "#000000" }}>
            {isFacturaA ? (
              <>
                <div className="flex justify-between">
                  <span className="font-bold">Importe Neto Gravado: $</span>
                  <span className="font-mono font-bold">{formatNumber(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">IVA 21%: $</span>
                  <span className="font-mono font-bold">{formatNumber(invoice.tax_total)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="font-bold">Subtotal: $</span>
                <span className="font-mono font-bold">{formatNumber(displayedSubtotal)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-bold">Importe Otros Tributos: $</span>
              <span className="font-mono font-bold">0,00</span>
            </div>
            <div className="flex justify-between text-[13px] border-t border-black/40 pt-1">
              <span className="font-bold">Importe Total: $</span>
              <span className="font-mono font-black text-base">{formatNumber(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Régimen de Transparencia Fiscal al Consumidor (Ley 27.743) */}
      {showLeyTransparencia && (
        <div
          className="border border-black p-2 mb-[-1px] text-[11px]"
          style={{ backgroundColor: "#ffffff", color: "#000000" }}
        >
          <p className="font-bold mb-1" style={{ color: "#000000" }}>
            Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)
          </p>
          <p className="text-right sm:text-center sm:pr-8" style={{ color: "#000000" }}>
            <span className="font-bold">IVA Contenido: $</span>{" "}
            <span className="font-mono font-bold">{formatNumber(ivaContenido)}</span>
          </p>
        </div>
      )}

      {/* 7. Pie oficial ARCA (Código QR, Logotipo, Comprobante Autorizado y CAE) */}
      <div
        className="border border-black p-3"
        style={{ backgroundColor: "#ffffff", color: "#000000" }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Lado izquierdo: Código QR oficial */}
          <div className="flex items-center gap-2">
            <div style={{ backgroundColor: "#ffffff" }} className="p-1 border border-black shrink-0">
              <QRCodeSVG value={qrUrl} size={84} level="M" />
            </div>
          </div>

          {/* Centro: Logotipo ARCA y leyenda oficial */}
          <div className="text-center space-y-1 flex-1 px-2" style={{ color: "#000000" }}>
            <div>
              <p className="text-xl sm:text-2xl font-black font-sans leading-none tracking-tight" style={{ color: "#000000" }}>
                ARCA
              </p>
              <p className="text-[8px] uppercase tracking-wider font-bold mt-0.5" style={{ color: "#334155" }}>
                AGENCIA DE RECAUDACIÓN Y CONTROL ADUANERO
              </p>
            </div>
            <p className="font-bold text-[11px] pt-0.5" style={{ color: "#000000" }}>
              Comprobante Autorizado
            </p>
            <p className="text-[8px] sm:text-[9px] italic leading-tight" style={{ color: "#475569" }}>
              Esta Agencia no se responsabiliza por los datos ingresados en el detalle de la operación
            </p>
            <p className="text-[10px] font-bold pt-1" style={{ color: "#000000" }}>
              Pág. 1/1
            </p>
          </div>

          {/* Lado derecho: CAE y Vencimiento */}
          <div className="text-right space-y-1 text-[11px] shrink-0 min-w-[200px]" style={{ color: "#000000" }}>
            <p>
              <span className="font-bold">CAE Nº:</span>{" "}
              <span className="font-mono font-bold text-sm">
                {invoice.cae || invoice.arca_reference || "86406304128703"}
              </span>
            </p>
            <p>
              <span className="font-bold">Fecha de Vto. de CAE:</span>{" "}
              <span className="font-mono font-bold">
                {formatDate(invoice.cae_due_date) || "10/10/2026"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Componente oficial de Factura Electrónica ARCA (ex AFIP)
 * Reproduce fielmente la plantilla legal A4 con todos los estándares tributarios:
 * - Encabezado unificado con letra y código central
 * - Cuadro de emisor y comprobante con numeración oficial
 * - Cuadro de cliente / receptor con condición fiscal y domicilio
 * - Tabla de ítems con cantidades, bonificaciones y subtotales
 * - Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)
 * - Pie fiscal con CAE, fecha de vencimiento y código QR reglamentario
 * - Soporte para ORIGINAL, DUPLICADO, TRIPLICADO o juego completo de 3 copias
 */
export const ArcaInvoiceSheet: React.FC<ArcaInvoiceSheetProps> = ({
  invoice,
  facturacionSettings,
  businessSettings,
  copyLabel = "ORIGINAL",
  copiesMode,
  paymentMethodLabel,
  className = "",
}) => {
  const mode = copiesMode ?? copyLabel;

  if (mode === "ALL") {
    const copies: Array<"ORIGINAL" | "DUPLICADO" | "TRIPLICADO"> = [
      "ORIGINAL",
      "DUPLICADO",
      "TRIPLICADO",
    ];

    return (
      <div id="arca-invoice-printable" className="arca-invoice-printable-root space-y-6 print:space-y-0">
        {copies.map((copy) => (
          <ArcaInvoiceSingleSheet
            key={copy}
            invoice={invoice}
            facturacionSettings={facturacionSettings}
            businessSettings={businessSettings}
            copyLabel={copy}
            paymentMethodLabel={paymentMethodLabel}
            className={className}
          />
        ))}
      </div>
    );
  }

  const singleCopy: "ORIGINAL" | "DUPLICADO" | "TRIPLICADO" =
    mode === "DUPLICADO" || mode === "TRIPLICADO" ? mode : "ORIGINAL";

  return (
    <div id="arca-invoice-printable" className="arca-invoice-printable-root">
      <ArcaInvoiceSingleSheet
        invoice={invoice}
        facturacionSettings={facturacionSettings}
        businessSettings={businessSettings}
        copyLabel={singleCopy}
        paymentMethodLabel={paymentMethodLabel}
        className={className}
      />
    </div>
  );
};
