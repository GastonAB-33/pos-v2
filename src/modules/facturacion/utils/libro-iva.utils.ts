import type {
  Invoice,
  CreditNote,
  Purchase,
  Supplier,
  BusinessSettings,
  FacturacionSettings,
} from "@/types/entities";
import type {
  LibroIvaPeriod,
  LibroIvaVentaItem,
  LibroIvaCompraItem,
  LibroIvaConsolidado,
} from "../types/libro-iva.types";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const round2 = (val: number): number => Math.round((val + Number.EPSILON) * 100) / 100;

export const formatCurrency = (val: number): string =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0);

export const buildPeriod = (year: number, month: number): LibroIvaPeriod => {
  const paddedMonth = String(month).padStart(2, "0");
  return {
    year,
    month,
    key: `${year}-${paddedMonth}`,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    periodCode: `${year}${paddedMonth}`,
  };
};

export const generateAvailablePeriods = (count = 12): LibroIvaPeriod[] => {
  const periods: LibroIvaPeriod[] = [];
  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth() + 1; // 1-12

  for (let i = 0; i < count; i++) {
    periods.push(buildPeriod(currentYear, currentMonth));
    currentMonth -= 1;
    if (currentMonth < 1) {
      currentMonth = 12;
      currentYear -= 1;
    }
  }
  return periods;
};

export const isDateInPeriod = (dateStr: string | null | undefined, period: LibroIvaPeriod): boolean => {
  if (!dateStr) return false;
  const clean = dateStr.slice(0, 7); // "YYYY-MM"
  return clean === period.key;
};

const parseVoucherNumbers = (docNumber: string, defaultPtoVta = 1) => {
  const clean = (docNumber || "").replace(/[^\d-]/g, "");
  if (clean.includes("-")) {
    const parts = clean.split("-");
    const pto = parseInt(parts[0], 10) || defaultPtoVta;
    const nro = parseInt(parts[1], 10) || 1;
    return {
      posNumber: pto,
      voucherNumber: nro,
      formatted: `${String(pto).padStart(4, "0")}-${String(nro).padStart(8, "0")}`,
    };
  }
  const nro = parseInt(clean, 10) || 1;
  return {
    posNumber: defaultPtoVta,
    voucherNumber: nro,
    formatted: `${String(defaultPtoVta).padStart(4, "0")}-${String(nro).padStart(8, "0")}`,
  };
};

export const calculateLibroIvaData = (params: {
  period: LibroIvaPeriod;
  invoices: Invoice[];
  creditNotes: CreditNote[];
  purchases: Purchase[];
  suppliers: Supplier[];
  businessSettings?: BusinessSettings | null;
  facturacionSettings?: FacturacionSettings | null;
}): {
  consolidado: LibroIvaConsolidado;
  ventas: LibroIvaVentaItem[];
  compras: LibroIvaCompraItem[];
} => {
  const {
    period,
    invoices,
    creditNotes,
    purchases,
    suppliers,
    businessSettings,
    facturacionSettings,
  } = params;

  const cuitEmisor =
    facturacionSettings?.issuer_cuit ||
    facturacionSettings?.arca?.cuit_emisor ||
    businessSettings?.cuit ||
    "27-27138097-1";

  const razonSocial =
    facturacionSettings?.issuer_tax_name ||
    businessSettings?.legal_name ||
    businessSettings?.trade_name ||
    "MARTINEZ PATRICIA ELIANA";

  const puntoVentaDefault = facturacionSettings?.arca?.punto_venta || 5;

  const supplierMap = new Map<string, Supplier>();
  suppliers.forEach((s) => supplierMap.set(s.id, s));

  // ==========================================
  // 1. VENTAS
  // ==========================================
  const ventas: LibroIvaVentaItem[] = [];

  // Facturas emitidas (excluimos presupuestos y borradores no fiscales)
  invoices.forEach((inv) => {
    if (inv.document_type === "PRESUPUESTO") return;
    if (inv.status === "draft") return;
    if (!isDateInPeriod(inv.issue_date, period)) return;

    const { posNumber, voucherNumber, formatted } = parseVoucherNumbers(
      inv.document_number,
      puntoVentaDefault
    );

    const docTypeLabel =
      inv.document_type === "A"
        ? "Factura A"
        : inv.document_type === "B"
          ? "Factura B"
          : "Factura C";

    const customerSnapshot = inv.customer_snapshot;
    const customerDocType = customerSnapshot?.document_type || (inv.document_type === "A" ? "CUIT" : "Consumidor Final");
    const customerDocNumber = customerSnapshot?.document_number || (inv.document_type === "A" ? "30000000007" : "0");
    const customerName = customerSnapshot?.full_name || (inv.document_type === "A" ? "Cliente Responsable Inscripto" : "Consumidor Final");
    const fiscalCondition = customerSnapshot?.fiscal_condition || (inv.document_type === "A" ? "IVA Responsable Inscripto" : "Consumidor Final");

    // Desglose de base imponible e IVA
    const total = round2(inv.total);
    const taxTotal = round2(inv.tax_total);
    const subtotal = round2(inv.subtotal || total - taxTotal);

    ventas.push({
      id: inv.id,
      issueDate: inv.issue_date.slice(0, 10),
      documentType: docTypeLabel as LibroIvaVentaItem["documentType"],
      rawDocumentType: inv.document_type,
      posNumber,
      voucherNumber,
      formattedVoucher: formatted,
      customerDocType,
      customerDocNumber,
      customerName,
      fiscalCondition,
      netoGravado21: subtotal,
      iva21: taxTotal,
      netoGravado105: 0,
      iva105: 0,
      exento: 0,
      total,
      cae: inv.cae,
      caeVto: inv.cae_due_date,
      isCreditNote: false,
    });
  });

  // Notas de Crédito de Ventas emitidas
  creditNotes.forEach((nc) => {
    if (nc.status === "draft") return;
    if (!isDateInPeriod(nc.issue_date, period)) return;

    const { posNumber, voucherNumber, formatted } = parseVoucherNumbers(
      nc.document_number,
      puntoVentaDefault
    );

    const total = round2(nc.total);
    const taxTotal = round2(nc.tax_total);
    const subtotal = round2(nc.subtotal || total - taxTotal);

    ventas.push({
      id: nc.id,
      issueDate: nc.issue_date.slice(0, 10),
      documentType: "Nota de Crédito A",
      rawDocumentType: "NC",
      posNumber,
      voucherNumber,
      formattedVoucher: formatted,
      customerDocType: "CUIT",
      customerDocNumber: "-",
      customerName: "Nota de Crédito Cliente",
      fiscalCondition: "IVA Responsable Inscripto",
      netoGravado21: subtotal,
      iva21: taxTotal,
      netoGravado105: 0,
      iva105: 0,
      exento: 0,
      total,
      cae: nc.cae,
      caeVto: nc.cae_due_date,
      isCreditNote: true,
    });
  });

  // Ordenar ventas por fecha y comprobante ascendente
  ventas.sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.voucherNumber - b.voucherNumber);

  // Consolidación de Ventas
  let opVentaNeto = 0;
  let opVentaExento = 0;
  let opVentaDebito = 0;
  let ncVentaNeto = 0;
  let ncVentaExento = 0;
  let ncVentaDebito = 0;
  let neto21V = 0;
  let debito21V = 0;
  let neto105V = 0;
  let debito105V = 0;

  ventas.forEach((v) => {
    if (v.isCreditNote) {
      ncVentaNeto += v.netoGravado21 + v.netoGravado105;
      ncVentaExento += v.exento;
      ncVentaDebito += v.iva21 + v.iva105;
    } else {
      opVentaNeto += v.netoGravado21 + v.netoGravado105;
      opVentaExento += v.exento;
      opVentaDebito += v.iva21 + v.iva105;
      neto21V += v.netoGravado21;
      debito21V += v.iva21;
      neto105V += v.netoGravado105;
      debito105V += v.iva105;
    }
  });

  // ==========================================
  // 2. COMPRAS
  // ==========================================
  const compras: LibroIvaCompraItem[] = [];

  purchases.forEach((p) => {
    if (p.status === "cancelled") return;
    const purchaseDate = p.issue_date || p.created_at;
    if (!isDateInPeriod(purchaseDate, period)) return;

    const supplier = supplierMap.get(p.supplier_id);
    const supplierCuit = supplier?.tax_id || "-";
    const supplierName = supplier?.name || "Proveedor Varios";

    const rawType = (p.document_type || "FACTURA_A").toUpperCase();
    const isCreditNote =
      rawType.includes("NOTA_CREDITO") ||
      rawType.includes("NC") ||
      p.returned_total && p.returned_total > 0 && p.total <= 0;

    const docTypeLabel = isCreditNote
      ? "Nota de Crédito"
      : rawType === "FACTURA_A"
        ? "Factura A"
        : rawType === "FACTURA_B"
          ? "Factura B"
          : rawType === "FACTURA_C"
            ? "Factura C (Monotributo)"
            : rawType === "REMITO"
              ? "Remito"
              : rawType === "TICKET"
                ? "Ticket"
                : "Otro Comprobante";

    const total = round2(Math.abs(p.total));
    const vatTotal = round2(Math.abs(p.vat_total || 0));
    const subtotal = round2(Math.abs(p.subtotal || total - vatTotal));

    // Determinar si genera crédito fiscal o va a "no genera crédito fiscal" (Factura C / tickets)
    let neto21 = 0;
    let iva21 = 0;
    let neto105 = 0;
    let iva105 = 0;
    let noGravado = 0;

    if (rawType === "FACTURA_C" || rawType === "REMITO" || rawType === "PRESUPUESTO" || (vatTotal === 0 && !isCreditNote)) {
      noGravado = total;
    } else {
      // Por defecto alícuota 21% a menos que especifique 10.5%
      // Si el purchase tiene items con 10.5%:
      const has105 = p.items?.some((it) => it.vat_percent === 10.5);
      if (has105) {
        let n105 = 0;
        let i105 = 0;
        let n21 = 0;
        let i21 = 0;
        p.items?.forEach((it) => {
          if (it.vat_percent === 10.5) {
            n105 += it.line_total || 0;
            i105 += it.vat_amount || round2((it.line_total || 0) * 0.105);
          } else if (it.vat_percent === 21) {
            n21 += it.line_total || 0;
            i21 += it.vat_amount || round2((it.line_total || 0) * 0.21);
          } else {
            noGravado += it.line_total || 0;
          }
        });
        neto105 = round2(n105);
        iva105 = round2(i105);
        neto21 = round2(n21);
        iva21 = round2(i21);
      } else {
        neto21 = subtotal;
        iva21 = vatTotal;
      }
    }

    compras.push({
      id: p.id,
      issueDate: (purchaseDate || "").slice(0, 10),
      documentType: docTypeLabel,
      rawDocumentType: rawType,
      documentNumber: p.document_number || p.purchase_number || "-",
      supplierId: p.supplier_id,
      supplierCuit,
      supplierName,
      netoGravado21: neto21,
      iva21: iva21,
      netoGravado105: neto105,
      iva105: iva105,
      noGravadoOExento: noGravado,
      iibbPerception: 0,
      total,
      isCreditNote: Boolean(isCreditNote),
      notes: p.notes,
    });
  });

  // Ordenar compras por fecha
  compras.sort((a, b) => a.issueDate.localeCompare(b.issueDate));

  // Consolidación de Compras
  let opCompraNeto = 0;
  let opCompraExento = 0;
  let opCompraCredito = 0;
  let ncCompraNeto = 0;
  let ncCompraExento = 0;
  let ncCompraCreditoRestituir = 0;
  let comprasNoGeneranCredito = 0;
  let neto21C = 0;
  let credito21C = 0;
  let neto105C = 0;
  let credito105C = 0;
  let percepcionesIibbTotal = 0;

  compras.forEach((c) => {
    percepcionesIibbTotal += c.iibbPerception;
    if (c.isCreditNote) {
      ncCompraNeto += c.netoGravado21 + c.netoGravado105;
      ncCompraExento += c.noGravadoOExento;
      ncCompraCreditoRestituir += c.iva21 + c.iva105;
    } else {
      if (c.noGravadoOExento > 0 && c.netoGravado21 === 0 && c.netoGravado105 === 0) {
        comprasNoGeneranCredito += c.noGravadoOExento;
      } else {
        opCompraNeto += c.netoGravado21 + c.netoGravado105;
        opCompraExento += c.noGravadoOExento;
        opCompraCredito += c.iva21 + c.iva105;
        neto21C += c.netoGravado21;
        credito21C += c.iva21;
        neto105C += c.netoGravado105;
        credito105C += c.iva105;
      }
    }
  });

  // ==========================================
  // 3. POSICIÓN TÉCNICA MENSUAL (F. 2002)
  // ==========================================
  // Débito total = Débito facturado ventas + Crédito a restituir por NC compras - Débito anulado por NC ventas
  const totalDebitoFiscal = round2(opVentaDebito + ncCompraCreditoRestituir - ncVentaDebito);
  const totalCreditoFiscal = round2(opCompraCredito);
  const diferencia = round2(totalDebitoFiscal - totalCreditoFiscal);
  const esSaldoAFavor = diferencia < 0;
  const saldoIva = round2(Math.abs(diferencia));

  const mensajeEstado = esSaldoAFavor
    ? `Saldo técnico provisorio a favor del contribuyente: ${formatCurrency(saldoIva)}`
    : `Saldo técnico provisorio estimado a ingresar (pagar): ${formatCurrency(saldoIva)}`;

  const consolidado: LibroIvaConsolidado = {
    period,
    cuitEmisor,
    razonSocial,
    puntoVenta: puntoVentaDefault,
    ventas: {
      operacionesVentaNeto: round2(opVentaNeto),
      operacionesVentaExento: round2(opVentaExento),
      operacionesVentaDebito: round2(opVentaDebito),
      notasCreditoNeto: round2(ncVentaNeto),
      notasCreditoExento: round2(ncVentaExento),
      notasCreditoDebito: round2(ncVentaDebito),
      totalNetoGravado: round2(opVentaNeto - ncVentaNeto),
      totalDebitoFiscal: round2(opVentaDebito - ncVentaDebito),
      netoGravado21: round2(neto21V),
      debitoFiscal21: round2(debito21V),
      netoGravado105: round2(neto105V),
      debitoFiscal105: round2(debito105V),
      cantidadComprobantes: ventas.length,
    },
    compras: {
      operacionesCompraNeto: round2(opCompraNeto),
      operacionesCompraExento: round2(opCompraExento),
      operacionesCompraCredito: round2(opCompraCredito),
      notasCreditoNeto: round2(ncCompraNeto),
      notasCreditoExento: round2(ncCompraExento),
      notasCreditoCreditoRestituir: round2(ncCompraCreditoRestituir),
      operacionesNoGeneranCredito: round2(comprasNoGeneranCredito),
      totalNetoGravado: round2(opCompraNeto - ncCompraNeto),
      totalCreditoFiscal: round2(opCompraCredito),
      netoGravado21: round2(neto21C),
      creditoFiscal21: round2(credito21C),
      netoGravado105: round2(neto105C),
      creditoFiscal105: round2(credito105C),
      totalPercepcionesIibb: round2(percepcionesIibbTotal),
      cantidadComprobantes: compras.length,
    },
    posicion: {
      totalDebitoFiscal,
      totalCreditoFiscal,
      saldoIva,
      esSaldoAFavor,
      mensajeEstado,
    },
  };

  return { consolidado, ventas, compras };
};

// ==========================================
// EXCEL & CSV EXPORT BUILDERS
// ==========================================

export const buildVentasExportRows = (ventas: LibroIvaVentaItem[]) => {
  return ventas.map((v) => ({
    "Fecha": v.issueDate,
    "Tipo": v.documentType,
    "Punto de Venta": v.posNumber,
    "Número": v.voucherNumber,
    "Comprobante": v.formattedVoucher,
    "Doc. Tipo": v.customerDocType,
    "Doc. Número": v.customerDocNumber,
    "Cliente / Razón Social": v.customerName,
    "Condición Fiscal": v.fiscalCondition,
    "Neto Gravado (21%)": v.netoGravado21,
    "IVA Débito (21%)": v.iva21,
    "Neto Gravado (10.5%)": v.netoGravado105,
    "IVA Débito (10.5%)": v.iva105,
    "Exento / No Gravado": v.exento,
    "Total Facturado": v.total,
    "CAE": v.cae || "-",
    "Vto. CAE": v.caeVto || "-",
  }));
};

export const buildComprasExportRows = (compras: LibroIvaCompraItem[]) => {
  return compras.map((c) => ({
    "Fecha": c.issueDate,
    "Tipo Comprobante": c.documentType,
    "Nº Comprobante": c.documentNumber,
    "CUIT Proveedor": c.supplierCuit,
    "Proveedor / Razón Social": c.supplierName,
    "Neto Gravado (21%)": c.netoGravado21,
    "IVA Crédito (21%)": c.iva21,
    "Neto Gravado (10.5%)": c.netoGravado105,
    "IVA Crédito (10.5%)": c.iva105,
    "No Gravado / Factura C": c.noGravadoOExento,
    "Percepciones IIBB": c.iibbPerception,
    "Total": c.total,
    "Es Nota de Crédito": c.isCreditNote ? "SÍ" : "NO",
  }));
};

export const buildConsolidadoExportRows = (c: LibroIvaConsolidado) => {
  return [
    { "Concepto": "=== INFORMACIÓN GENERAL ===", "Detalle": "", "Monto": "" },
    { "Concepto": "Período Fiscal", "Detalle": c.period.label, "Monto": c.period.periodCode },
    { "Concepto": "Razón Social Emisor", "Detalle": c.razonSocial, "Monto": "" },
    { "Concepto": "CUIT Emisor", "Detalle": c.cuitEmisor, "Monto": "" },
    { "Concepto": "", "Detalle": "", "Monto": "" },

    { "Concepto": "=== LIBRO IVA VENTAS ===", "Detalle": "", "Monto": "" },
    { "Concepto": "Operaciones de Venta - Neto Gravado", "Detalle": "21% y 10.5%", "Monto": c.ventas.operacionesVentaNeto },
    { "Concepto": "Operaciones de Venta - Débito Fiscal", "Detalle": "Total Débito Facturado", "Monto": c.ventas.operacionesVentaDebito },
    { "Concepto": "Operaciones de Venta - Exento / No Gravado", "Detalle": "", "Monto": c.ventas.operacionesVentaExento },
    { "Concepto": "Notas de Crédito de Venta - Neto", "Detalle": "Descuentos / Anulaciones", "Monto": c.ventas.notasCreditoNeto },
    { "Concepto": "Notas de Crédito de Venta - Débito", "Detalle": "Resta Débito Fiscal", "Monto": c.ventas.notasCreditoDebito },
    { "Concepto": "", "Detalle": "", "Monto": "" },

    { "Concepto": "=== LIBRO IVA COMPRAS ===", "Detalle": "", "Monto": "" },
    { "Concepto": "Operaciones de Compra - Neto Gravado", "Detalle": "Facturas A recibidas", "Monto": c.compras.operacionesCompraNeto },
    { "Concepto": "Operaciones de Compra - Crédito Fiscal", "Detalle": "Total Crédito Fiscal Computable", "Monto": c.compras.operacionesCompraCredito },
    { "Concepto": "Operaciones de Compra - Exento / No Gravado", "Detalle": "", "Monto": c.compras.operacionesCompraExento },
    { "Concepto": "Operaciones que no generan Crédito Fiscal", "Detalle": "Facturas C Monotributo / Gastos", "Monto": c.compras.operacionesNoGeneranCredito },
    { "Concepto": "Notas de Crédito de Compras - Neto", "Detalle": "Bonificaciones Proveedores", "Monto": c.compras.notasCreditoNeto },
    { "Concepto": "Notas de Crédito de Compras - Crédito a Restituir", "Detalle": "Suma al Débito Fiscal", "Monto": c.compras.notasCreditoCreditoRestituir },
    { "Concepto": "", "Detalle": "", "Monto": "" },

    { "Concepto": "=== LIQUIDACIÓN TÉCNICA ESTIMADA (F. 2002) ===", "Detalle": "", "Monto": "" },
    { "Concepto": "Total Débito Fiscal", "Detalle": "Ventas + Restituciones NC Compras", "Monto": c.posicion.totalDebitoFiscal },
    { "Concepto": "Total Crédito Fiscal", "Detalle": "Compras Computables", "Monto": c.posicion.totalCreditoFiscal },
    { "Concepto": c.posicion.esSaldoAFavor ? "SALDO A FAVOR DEL CONTRIBUYENTE" : "SALDO TÉCNICO A PAGAR", "Detalle": c.posicion.mensajeEstado, "Monto": c.posicion.saldoIva },
  ];
};

// ==========================================
// ARCA RG 4597/2019 TXT GENERATORS
// ==========================================

export const downloadPlainTxt = (fileName: string, content: string): boolean => {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const blob = new Blob([content], { type: "text/plain;charset=ISO-8859-1" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};

/**
 * Genera el archivo LIBRO_IVA_DIGITAL_VENTAS_CBTE.txt según RG 4597/2019
 */
export const generateArcaVentasCbteTxt = (ventas: LibroIvaVentaItem[]): string => {
  return ventas
    .map((v) => {
      const fecha = v.issueDate.replace(/-/g, ""); // AAAAMMDD (8)
      // Tipo cbte: Factura A=001, Factura B=006, Factura C=011, NC A=003, NC B=008, NC C=013
      const tipo = v.isCreditNote
        ? v.rawDocumentType === "A"
          ? "003"
          : "008"
        : v.rawDocumentType === "A"
          ? "001"
          : v.rawDocumentType === "B"
            ? "006"
            : "011";

      const ptoVta = String(v.posNumber).padStart(5, "0");
      const nro = String(v.voucherNumber).padStart(20, "0");
      const nroHasta = nro;
      const docTipo = v.customerDocType === "CUIT" ? "80" : v.customerDocType === "DNI" ? "96" : "99";
      const cleanDocNro = (v.customerDocNumber || "0").replace(/\D/g, "") || "0";
      const docNro = cleanDocNro.padStart(20, "0");
      const nombre = (v.customerName || "CONSUMIDOR FINAL").slice(0, 30).padEnd(30, " ");
      const totalCents = String(Math.round(v.total * 100)).padStart(15, "0");
      const noGravadoCents = "".padStart(15, "0");
      const exentoCents = String(Math.round(v.exento * 100)).padStart(15, "0");
      const percNac = "".padStart(15, "0");
      const percIibb = "".padStart(15, "0");
      const percMun = "".padStart(15, "0");
      const impInt = "".padStart(15, "0");
      const monId = "PES";
      const tipoCambio = "0001000000"; // 1.000000 (10)
      const cantAlic = "1";
      const codOp = "0";
      const otrosTrib = "".padStart(15, "0");
      const vtoCae = (v.caeVto || "").replace(/-/g, "").padEnd(8, "0");

      return `${fecha}${tipo}${ptoVta}${nro}${nroHasta}${docTipo}${docNro}${nombre}${totalCents}${noGravadoCents}${exentoCents}${percNac}${percIibb}${percMun}${impInt}${monId}${tipoCambio}${cantAlic}${codOp}${otrosTrib}${vtoCae}`;
    })
    .join("\r\n");
};

/**
 * Genera el archivo LIBRO_IVA_DIGITAL_VENTAS_ALICUOTAS.txt según RG 4597/2019
 */
export const generateArcaVentasAlicuotasTxt = (ventas: LibroIvaVentaItem[]): string => {
  return ventas
    .filter((v) => v.netoGravado21 > 0 || v.netoGravado105 > 0)
    .map((v) => {
      const tipo = v.isCreditNote
        ? v.rawDocumentType === "A"
          ? "003"
          : "008"
        : v.rawDocumentType === "A"
          ? "001"
          : v.rawDocumentType === "B"
            ? "006"
            : "011";

      const ptoVta = String(v.posNumber).padStart(5, "0");
      const nro = String(v.voucherNumber).padStart(20, "0");
      const netoCents = String(Math.round(v.netoGravado21 * 100)).padStart(15, "0");
      const alicIva = "0005"; // 21%
      const ivaLiquidadoCents = String(Math.round(v.iva21 * 100)).padStart(15, "0");

      return `${tipo}${ptoVta}${nro}${netoCents}${alicIva}${ivaLiquidadoCents}`;
    })
    .join("\r\n");
};

/**
 * Genera el archivo LIBRO_IVA_DIGITAL_COMPRAS_CBTE.txt según RG 4597/2019
 */
export const generateArcaComprasCbteTxt = (compras: LibroIvaCompraItem[]): string => {
  return compras
    .map((c) => {
      const fecha = c.issueDate.replace(/-/g, ""); // AAAAMMDD
      const tipo = c.isCreditNote
        ? "003"
        : c.rawDocumentType.includes("FACTURA_A")
          ? "001"
          : c.rawDocumentType.includes("FACTURA_B")
            ? "006"
            : "011";

      const { posNumber, voucherNumber } = parseVoucherNumbers(c.documentNumber, 1);
      const ptoVta = String(posNumber).padStart(5, "0");
      const nro = String(voucherNumber).padStart(20, "0");
      const despacho = "".padEnd(16, " ");
      const docTipo = "80"; // CUIT
      const cleanDocNro = (c.supplierCuit || "0").replace(/\D/g, "") || "0";
      const docNro = cleanDocNro.padStart(20, "0");
      const nombre = (c.supplierName || "PROVEEDOR").slice(0, 30).padEnd(30, " ");
      const totalCents = String(Math.round(c.total * 100)).padStart(15, "0");
      const noGravadoCents = String(Math.round(c.noGravadoOExento * 100)).padStart(15, "0");
      const exentoCents = "".padStart(15, "0");
      const percIva = "".padStart(15, "0");
      const percNac = "".padStart(15, "0");
      const percIibb = String(Math.round(c.iibbPerception * 100)).padStart(15, "0");
      const percMun = "".padStart(15, "0");
      const impInt = "".padStart(15, "0");
      const monId = "PES";
      const tipoCambio = "0001000000";
      const cantAlic = c.noGravadoOExento > 0 && c.netoGravado21 === 0 ? "0" : "1";
      const codOp = "0";
      const creditoComputableCents = String(Math.round((c.iva21 + c.iva105) * 100)).padStart(15, "0");
      const otrosTrib = "".padStart(15, "0");
      const cuitEmisorDoc = cleanDocNro.padStart(11, "0");
      const denominacionEmisor = nombre;
      const ivaComision = "".padStart(15, "0");

      return `${fecha}${tipo}${ptoVta}${nro}${despacho}${docTipo}${docNro}${nombre}${totalCents}${noGravadoCents}${exentoCents}${percIva}${percNac}${percIibb}${percMun}${impInt}${monId}${tipoCambio}${cantAlic}${codOp}${creditoComputableCents}${otrosTrib}${cuitEmisorDoc}${denominacionEmisor}${ivaComision}`;
    })
    .join("\r\n");
};

/**
 * Genera el archivo LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS.txt según RG 4597/2019
 */
export const generateArcaComprasAlicuotasTxt = (compras: LibroIvaCompraItem[]): string => {
  return compras
    .filter((c) => c.netoGravado21 > 0 || c.netoGravado105 > 0)
    .map((c) => {
      const tipo = c.isCreditNote
        ? "003"
        : c.rawDocumentType.includes("FACTURA_A")
          ? "001"
          : c.rawDocumentType.includes("FACTURA_B")
            ? "006"
            : "011";

      const { posNumber, voucherNumber } = parseVoucherNumbers(c.documentNumber, 1);
      const ptoVta = String(posNumber).padStart(5, "0");
      const nro = String(voucherNumber).padStart(20, "0");
      const docTipo = "80"; // CUIT
      const cleanDocNro = (c.supplierCuit || "0").replace(/\D/g, "") || "0";
      const docNro = cleanDocNro.padStart(20, "0");
      const netoCents = String(Math.round(c.netoGravado21 * 100)).padStart(15, "0");
      const alicIva = "0005"; // 21%
      const ivaLiquidadoCents = String(Math.round(c.iva21 * 100)).padStart(15, "0");

      return `${tipo}${ptoVta}${nro}${docTipo}${docNro}${netoCents}${alicIva}${ivaLiquidadoCents}`;
    })
    .join("\r\n");
};
