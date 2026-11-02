export interface LibroIvaPeriod {
  year: number;
  month: number; // 1 - 12
  key: string; // "2026-09"
  label: string; // "Septiembre 2026"
  periodCode: string; // "202609" (código oficial ARCA)
}

export interface LibroIvaVentaItem {
  id: string;
  issueDate: string; // "YYYY-MM-DD"
  documentType: "Factura A" | "Factura B" | "Factura C" | "Nota de Crédito A" | "Nota de Crédito B" | "Nota de Crédito C";
  rawDocumentType: string;
  posNumber: number;
  voucherNumber: number;
  formattedVoucher: string; // "0005-00000123"
  customerDocType: string; // "CUIT", "DNI", "Consumidor Final"
  customerDocNumber: string;
  customerName: string;
  fiscalCondition: string;
  netoGravado21: number;
  iva21: number;
  netoGravado105: number;
  iva105: number;
  exento: number;
  total: number;
  cae?: string | null;
  caeVto?: string | null;
  isCreditNote: boolean;
}

export interface LibroIvaCompraItem {
  id: string;
  issueDate: string; // "YYYY-MM-DD"
  documentType: string; // "Factura A", "Factura B", "Factura C", "Nota de Crédito", etc.
  rawDocumentType: string;
  documentNumber: string; // "0001-00045612"
  supplierId: string;
  supplierCuit: string;
  supplierName: string;
  netoGravado21: number;
  iva21: number;
  netoGravado105: number;
  iva105: number;
  noGravadoOExento: number; // Facturas C de monotributistas, tickets, etc.
  iibbPerception: number;
  total: number;
  isCreditNote: boolean;
  notes?: string | null;
}

export interface LibroIvaConsolidadoVentas {
  operacionesVentaNeto: number;
  operacionesVentaExento: number;
  operacionesVentaDebito: number;
  notasCreditoNeto: number;
  notasCreditoExento: number;
  notasCreditoDebito: number;
  totalNetoGravado: number;
  totalDebitoFiscal: number;
  netoGravado21: number;
  debitoFiscal21: number;
  netoGravado105: number;
  debitoFiscal105: number;
  cantidadComprobantes: number;
}

export interface LibroIvaConsolidadoCompras {
  operacionesCompraNeto: number;
  operacionesCompraExento: number;
  operacionesCompraCredito: number;
  notasCreditoNeto: number;
  notasCreditoExento: number;
  notasCreditoCreditoRestituir: number;
  operacionesNoGeneranCredito: number; // Facturas C monotributistas
  totalNetoGravado: number;
  totalCreditoFiscal: number;
  netoGravado21: number;
  creditoFiscal21: number;
  netoGravado105: number;
  creditoFiscal105: number;
  totalPercepcionesIibb: number;
  cantidadComprobantes: number;
}

export interface LibroIvaPosicionMensual {
  totalDebitoFiscal: number; // Débito facturado + Crédito a restituir por NC compras - Débito NC ventas
  totalCreditoFiscal: number; // Crédito computable compras
  saldoIva: number; // Math.abs(debito - credito)
  esSaldoAFavor: boolean; // Si credito > debito -> a favor
  mensajeEstado: string;
}

export interface LibroIvaConsolidado {
  period: LibroIvaPeriod;
  cuitEmisor: string;
  razonSocial: string;
  puntoVenta: number;
  ventas: LibroIvaConsolidadoVentas;
  compras: LibroIvaConsolidadoCompras;
  posicion: LibroIvaPosicionMensual;
}
