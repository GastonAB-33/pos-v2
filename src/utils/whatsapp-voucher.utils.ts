import type {
  BusinessSettings,
  FacturacionSettings,
  Invoice,
  Receipt,
} from "@/types/entities";
import {
  formatDisplayNotes,
  formatDisplayReceiptNumber,
  formatDisplaySaleNumber,
} from "@/utils/voucher-format.utils";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

export const formatCurrency = (amount: number): string => currencyFormatter.format(amount);

/**
 * Traduce el código de método de pago a una etiqueta legible
 */
export const getPaymentMethodLabel = (paymentMethod: Receipt["payment_method"] | string): string => {
  const normalized = String(paymentMethod).trim().toLowerCase();
  if (normalized === "cash") return "Efectivo";
  if (normalized === "card_debit") return "Tarjeta de débito";
  if (normalized === "card_credit") return "Tarjeta de crédito";
  if (normalized === "transfer") return "Transferencia bancaria";
  if (normalized === "mercado_pago") return "Mercado Pago";
  if (normalized === "cheque") return "Cheque";
  if (normalized === "current_account") return "Cuenta corriente";
  if (normalized === "card") return "Tarjeta";
  return "Otro medio";
};

/**
 * Sanitiza y normaliza un número de teléfono para WhatsApp en estándar internacional (E.164).
 * Especialmente optimizado para Argentina (+54 9) y adaptable a números internacionales.
 */
export const cleanPhoneForWhatsApp = (rawPhone: string | null | undefined): string => {
  if (!rawPhone) return "";
  let digits = String(rawPhone).replace(/\D/g, "");
  if (!digits) return "";

  // Quitar ceros iniciales de discado internacional erróneo (ej: 0054...)
  digits = digits.replace(/^00+/, "");

  // Si ya tiene el formato completo de Argentina con 549 (ej: 5492664689173)
  if (digits.startsWith("549") && digits.length >= 12) {
    return digits;
  }

  // Si empieza con 54 pero le falta el 9 de celular móvil argentino
  if (digits.startsWith("54") && digits.length >= 11) {
    // Si tiene 540... quitar el 0
    if (digits.startsWith("540")) {
      digits = `54${digits.slice(3)}`;
    }
    // Si viene como 54 + área + número (12 dígitos aprox), insertar el 9
    if (!digits.startsWith("549")) {
      return `549${digits.slice(2)}`;
    }
  }

  // Si empieza con 0 (código interurbano nacional ej: 0266..., 011...)
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Si incluye '15' después del prefijo telefónico en Argentina
  // Prefijos típicos: 11 (2 dígitos), 266 (3 dígitos), 2964 (4 dígitos)
  // Ej: 266-15-4689173 -> 2664689173
  if (/^(\d{2,4})15(\d{6,8})$/.test(digits)) {
    digits = digits.replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
  }

  // Si tiene 10 dígitos (típico celular argentino sin 0 y sin 15 ej: 2664689173 o 1145678901)
  if (digits.length === 10) {
    return `549${digits}`;
  }

  // Si tiene 11 dígitos y empieza con 9 (ej: 92664689173)
  if (digits.length === 11 && digits.startsWith("9")) {
    return `54${digits}`;
  }

  // Si ya es un número internacional largo (ej: 11 o más dígitos de otro país)
  if (digits.length >= 11) {
    return digits;
  }

  return digits;
};

/**
 * Genera el enlace oficial de WhatsApp Web / App para iniciar chat con mensaje precargado.
 * Se usa api.whatsapp.com para garantizar máxima compatibilidad con emojis y caracteres especiales UTF-8.
 */
export const buildWhatsAppUrl = (phone: string, text: string): string => {
  const cleanPhone = cleanPhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(text);
  return `https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${encodedText}`;
};

/**
 * Abre el chat de WhatsApp en una nueva pestaña
 */
export const openWhatsAppChat = (phone: string, text: string): void => {
  const url = buildWhatsAppUrl(phone, text);
  window.open(url, "_blank", "noopener,noreferrer");
};

/**
 * Genera el mensaje formateado en Markdown de WhatsApp para un Ticket de Venta comercial
 */
export const formatWhatsAppTicket = (
  receipt: Receipt,
  invoice?: Invoice | null,
  businessInfo?: BusinessSettings | null
): string => {
  const businessName = businessInfo?.trade_name || businessInfo?.legal_name || "Comercio";
  const businessAddress = businessInfo?.address;
  const businessPhone = businessInfo?.phone;

  const headerLines = [
    "🧾 *TICKET DE VENTA*",
    businessName ? `🏢 *${businessName}*` : "",
    businessAddress ? `📍 ${businessAddress}` : "",
    businessPhone ? `📞 ${businessPhone}` : "",
    "----------------------------------------",
    `*N° Ticket:* ${formatDisplayReceiptNumber(receipt.receipt_number)}`,
    `*Fecha:* ${new Date(receipt.issued_at).toLocaleString("es-AR")}`,
    `*Venta:* ${formatDisplaySaleNumber(receipt.sale_number)}`,
    `*Cliente:* ${receipt.customer_name ?? "Consumidor Final"}`,
    `*Medio de Pago:* ${getPaymentMethodLabel(receipt.payment_method)}`,
    receipt.notes ? `*Detalle:* ${formatDisplayNotes(receipt.notes)}` : "",
    "----------------------------------------",
    "🛒 *ITEMS:*",
  ].filter(Boolean);

  const itemsLines = receipt.items.map(
    (item) =>
      `• *${item.name}*\n  ${item.quantity.toLocaleString("es-AR")} x ${formatCurrency(
        item.unit_price
      )} = *${formatCurrency(item.subtotal)}*`
  );

  const totalLines = [
    "----------------------------------------",
    `💰 *TOTAL: ${formatCurrency(receipt.total)}*`,
  ];

  const fiscalLines: string[] = [];
  if (invoice?.cae || invoice?.arca_reference) {
    fiscalLines.push(
      "----------------------------------------",
      "✅ *DATOS FISCALES ARCA:*",
      `• *Factura:* ${invoice.document_type} ${invoice.document_number}`,
      `• *CAE:* ${invoice.cae || invoice.arca_reference}`,
      `• *Vto. CAE:* ${invoice.cae_due_date ?? "-"}`,
      invoice.qr_data_url ? `• *Verificador Oficial ARCA:* ${invoice.qr_data_url}` : ""
    );
  }

  const footerLines = [
    "----------------------------------------",
    `_¡Muchas gracias por su compra en ${businessName}!_`,
  ];

  return [...headerLines, ...itemsLines, ...totalLines, ...fiscalLines.filter(Boolean), ...footerLines].join(
    "\n"
  );
};

/**
 * Genera el mensaje formateado en Markdown de WhatsApp para una Factura Electrónica ARCA
 */
export const formatWhatsAppInvoice = (
  invoice: Invoice,
  facturacion?: FacturacionSettings | null,
  businessInfo?: BusinessSettings | null
): string => {
  const issuerName =
    facturacion?.issuer_tax_name ||
    businessInfo?.legal_name ||
    businessInfo?.trade_name ||
    "Comercio";
  const cuit = facturacion?.issuer_cuit || businessInfo?.cuit;
  const fiscalCondition = facturacion?.issuer_fiscal_condition;

  const headerLines = [
    `🧾 *FACTURA ELECTRÓNICA '${invoice.document_type}'*`,
    `🏢 *${issuerName}*`,
    cuit ? `CUIT: ${cuit}${fiscalCondition ? ` · ${fiscalCondition}` : ""}` : "",
    facturacion?.issuer_address ? `📍 ${facturacion.issuer_address}` : "",
    "----------------------------------------",
    `*Comprobante:* Factura ${invoice.document_type} ${invoice.document_number}`,
    `*Fecha de Emisión:* ${new Date(invoice.issue_date).toLocaleString("es-AR")}`,
    "----------------------------------------",
    `*Cliente:* ${
      invoice.customer_snapshot?.business_name ??
      invoice.customer_snapshot?.full_name ??
      "Consumidor Final"
    }`,
    `*Documento:* ${
      invoice.customer_snapshot?.document_type?.toUpperCase() ?? "DNI"
    } ${invoice.customer_snapshot?.document_number ?? "0"}`,
    `*Condición IVA:* ${invoice.customer_snapshot?.fiscal_condition ?? "Consumidor Final"}`,
    invoice.customer_snapshot?.address ? `*Domicilio:* ${invoice.customer_snapshot.address}` : "",
    "----------------------------------------",
    "🛒 *DETALLE DE ITEMS:*",
  ].filter(Boolean);

  const itemsLines = invoice.items_snapshot.map(
    (item) =>
      `• *${item.product_name}*\n  ${item.quantity.toLocaleString("es-AR")} x ${formatCurrency(
        item.unit_price
      )} = *${formatCurrency(item.total)}*`
  );

  const totalsLines = [
    "----------------------------------------",
    `Subtotal: ${formatCurrency(invoice.subtotal)}`,
    invoice.tax_total > 0 ? `Impuestos: ${formatCurrency(invoice.tax_total)}` : "",
    `💰 *TOTAL FACTURA: ${formatCurrency(invoice.total)}*`,
  ].filter(Boolean);

  const fiscalLines: string[] = [];
  if (invoice.cae || invoice.arca_reference) {
    fiscalLines.push(
      "----------------------------------------",
      "✅ *DATOS FISCALES ARCA:*",
      `• *Estado:* ${
        invoice.arca_status === "accepted" ? "Autorizado por ARCA" : invoice.arca_status
      }`,
      `• *CAE:* ${invoice.cae || invoice.arca_reference}`,
      invoice.cae_due_date ? `• *Fecha Vto. CAE:* ${invoice.cae_due_date}` : "",
      invoice.qr_data_url ? `• *Verificador Oficial:* ${invoice.qr_data_url}` : ""
    );
  }

  const footerLines = [
    "----------------------------------------",
    "_Comprobante fiscal emitido electrónicamente._",
  ];

  return [...headerLines, ...itemsLines, ...totalsLines, ...fiscalLines.filter(Boolean), ...footerLines].join(
    "\n"
  );
};

export interface WhatsAppDebtMovementItem {
  date: string;
  description: string;
  amount: number;
  type: "debt" | "payment" | string;
}

export interface WhatsAppDebtStatementParams {
  customerName: string;
  currentBalance: number;
  creditLimit?: number | null;
  lastMovements?: WhatsAppDebtMovementItem[];
  businessName?: string;
  bankAlias?: string | null;
  bankCbu?: string | null;
  bankName?: string | null;
}

/**
 * Limpia descripciones de movimientos para WhatsApp, removiendo números internos de venta (ej: VTA-...)
 * y manteniendo solo descripciones manuales útiles (ej: "alfajores galletas") o conceptos de pago.
 */
export const cleanMovementDescriptionForWhatsApp = (desc?: string | null, type?: string): string => {
  if (!desc) return type === "payment" ? "Pago" : "";
  let cleaned = desc.trim();
  cleaned = cleaned.replace(/^(?:Venta\s+(?:POS\s+)?#?|Cobro\s+venta\s+|Cancelación\s+de\s+deuda\s+en\s+Venta\s+#?)?(?:VTA-[\w-]+|#\d+|\b\d{5,}\b)(?:\s*\([^)]*\))?/gi, "").trim();
  cleaned = cleaned.replace(/^Venta\s*$/i, "").trim();
  cleaned = cleaned.replace(/^\(?Parcial\s+cta\.?\s*cte\.?\)?/i, "").trim();
  cleaned = cleaned.replace(/^[-–—:•|/\s]+|[-–—:•|/\s]+$/g, "").trim();
  return cleaned;
};

/**
 * Genera el mensaje formateado en Markdown de WhatsApp para el Resumen de Cuenta Corriente (Cobranzas)
 */
export const formatWhatsAppDebtStatement = (params: WhatsAppDebtStatementParams): string => {
  const business = params.businessName || "Comercio";
  const balance = params.currentBalance;
  const isDebt = balance > 0;
  const balanceStatus = isDebt
    ? `🔴 *Saldo adeudado: ${formatCurrency(balance)}*`
    : balance < 0
    ? `🟢 *Saldo a favor: ${formatCurrency(Math.abs(balance))}*`
    : `⚪ *Saldo al día: $ 0,00*`;

  const headerLines = [
    "📋 *RESUMEN DE CUENTA CORRIENTE*",
    `🏢 *${business}*`,
    "----------------------------------------",
    `Estimado/a *${params.customerName}*, le acercamos el estado actualizado de su cuenta:`,
    "",
    balanceStatus,
    params.creditLimit != null && Number.isFinite(params.creditLimit)
      ? `• *Límite de crédito asignado:* ${formatCurrency(params.creditLimit)}\n• *Disponible para compras:* ${formatCurrency(
          Math.max(0, params.creditLimit - balance)
        )}`
      : "",
  ].filter(Boolean);

  const movementsLines: string[] = [];
  if (params.lastMovements && params.lastMovements.length > 0) {
    movementsLines.push(
      "----------------------------------------",
      "📌 *ÚLTIMOS MOVIMIENTOS REGISTRADOS:*"
    );
    params.lastMovements.slice(0, 5).forEach((m) => {
      const sign = m.type === "payment" ? "(-)" : "(+)";
      const icon = m.type === "payment" ? "🟢" : "🛒";
      let cleanDesc = cleanMovementDescriptionForWhatsApp(m.description, m.type);
      if (!cleanDesc && m.type === "payment") {
        cleanDesc = "Pago";
      }

      if (cleanDesc) {
        movementsLines.push(
          `${icon} ${m.date}: ${cleanDesc} -> ${sign} ${formatCurrency(m.amount)}`
        );
      } else {
        movementsLines.push(
          `${icon} ${m.date} -> ${sign} ${formatCurrency(m.amount)}`
        );
      }
    });
  }

  const bankLines: string[] = [];
  if (isDebt && (params.bankAlias || params.bankCbu)) {
    bankLines.push(
      "----------------------------------------",
      "🏦 *DATOS BANCARIOS PARA TRANSFERIR:*",
      params.bankName ? `• *Banco:* ${params.bankName}` : "",
      params.bankAlias ? `• *Alias:* ${params.bankAlias}` : "",
      params.bankCbu ? `• *CBU:* ${params.bankCbu}` : "",
      "_Al transferir, por favor envíenos el comprobante por este chat._"
    );
  }

  const footerLines = [
    "----------------------------------------",
    `_Cualquier duda o consulta estamos a su entera disposición._`,
  ];

  return [...headerLines, ...movementsLines, ...bankLines.filter(Boolean), ...footerLines].join("\n");
};

export interface WhatsAppCashCloseParams {
  sessionNumber: string;
  cashierName: string;
  openedAt: string;
  closedAt: string;
  openingAmount: number;
  totalSales: number;
  salesByPaymentMethod?: Record<string, number>;
  cashExpected: number;
  cashCounted: number;
  cashDifference: number;
  userNotes?: string | null;
  businessName?: string;
}

/**
 * Genera el mensaje formateado en Markdown de WhatsApp para el Cierre de Caja Formal al Dueño
 */
export const formatWhatsAppCashClose = (params: WhatsAppCashCloseParams): string => {
  const business = params.businessName || "Sucursal";
  const diff = params.cashDifference;
  const diffStatus =
    Math.abs(diff) < 0.01
      ? "✅ *Caja Exacta ($ 0,00)*"
      : diff > 0
      ? `🟢 *Sobrante de caja:* +${formatCurrency(diff)}`
      : `🔴 *Faltante de caja:* -${formatCurrency(Math.abs(diff))}`;

  const headerLines = [
    "📊 *CIERRE FORMAL DE CAJA*",
    `🏢 *${business}*`,
    "----------------------------------------",
    `*Sesión / Turno:* #${params.sessionNumber}`,
    `*Cajero/a:* ${params.cashierName}`,
    `*Apertura:* ${new Date(params.openedAt).toLocaleString("es-AR")}`,
    `*Cierre:* ${new Date(params.closedAt).toLocaleString("es-AR")}`,
    "----------------------------------------",
    `💵 *Fondo Inicial:* ${formatCurrency(params.openingAmount)}`,
    `💰 *Total Facturado:* ${formatCurrency(params.totalSales)}`,
  ];

  const methodsLines: string[] = [];
  if (params.salesByPaymentMethod && Object.keys(params.salesByPaymentMethod).length > 0) {
    methodsLines.push("----------------------------------------", "💳 *VENTAS POR MEDIO DE PAGO:*");
    Object.entries(params.salesByPaymentMethod).forEach(([method, amount]) => {
      methodsLines.push(`• ${getPaymentMethodLabel(method)}: *${formatCurrency(amount)}*`);
    });
  }

  const cashLines = [
    "----------------------------------------",
    "🪙 *ARQUEO DE EFECTIVO EN GAVETA:*",
    `• Efectivo esperado: ${formatCurrency(params.cashExpected)}`,
    `• Efectivo contado: ${formatCurrency(params.cashCounted)}`,
    `• Diferencia: ${diffStatus}`,
    params.userNotes ? `\n📝 *Observaciones:* ${params.userNotes}` : "",
    "----------------------------------------",
    "_Reporte automático de auditoría POS_",
  ].filter(Boolean);

  return [...headerLines, ...methodsLines, ...cashLines].join("\n");
};
