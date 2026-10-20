import { supabase } from "@/lib/supabase/client";
import type {
  ArcaSettings,
  InvoiceDocumentType,
} from "@/types/entities";

/**
 * Códigos oficiales de comprobantes según tablas de ARCA / AFIP
 */
export const ARCA_DOCUMENT_TYPE_CODES: Record<InvoiceDocumentType, number> = {
  A: 1, // Factura A
  B: 6, // Factura B
  C: 11, // Factura C
  PRESUPUESTO: 0, // No fiscal
};

export const ARCA_CREDIT_NOTE_CODES: Record<InvoiceDocumentType, number> = {
  A: 3, // Nota de Crédito A
  B: 8, // Nota de Crédito B
  C: 13, // Nota de Crédito C
  PRESUPUESTO: 0,
};

export const ARCA_RECEIVER_DOC_TYPE_CODES = {
  cuit: 80,
  cuil: 86,
  cdi: 87,
  dni: 96,
  pasaporte: 94,
  ci: 90,
  otro: 99,
} as const;

export interface ArcaAuthorizationResult {
  success: boolean;
  cae?: string;
  caeDueDate?: string;
  voucherNumber?: number;
  qrUrl?: string;
  formattedDocumentNumber?: string;
  errorMessage?: string;
}

export interface ArcaInvoicePayload {
  tenantId: string;
  documentType: InvoiceDocumentType;
  puntoVenta: number;
  cuitEmisor: string;
  receiverDocType?: string | null;
  receiverDocNumber?: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

export interface ArcaCreditNotePayload {
  tenantId: string;
  documentType: InvoiceDocumentType;
  puntoVenta: number;
  cuitEmisor: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  associatedVoucher: {
    tipo: number;
    puntoVenta: number;
    numero: number;
    cuit?: string;
  };
  receiverDocType?: string | null;
  receiverDocNumber?: string | null;
}

/**
 * Genera la URL oficial de ARCA para el Código QR
 * según normativa de la Resolución General AFIP 4291/2018 y RG 4892/2020.
 */
export function buildArcaQrUrl(params: {
  cuitEmisor: string | number;
  puntoVenta: number;
  tipoComprobanteCode: number;
  numeroComprobante: number;
  total: number;
  cae: string | number;
  fechaEmisionIso: string;
  tipoDocReceptorCode?: number;
  docReceptor?: string | number;
}): string {
  const cleanCuit = Number(String(params.cuitEmisor).replace(/\D/g, "")) || 0;
  const fechaYmd = params.fechaEmisionIso.slice(0, 10);
  const cleanDocRec = params.docReceptor
    ? Number(String(params.docReceptor).replace(/\D/g, "")) || 0
    : 0;

  const qrData = {
    ver: 1,
    fecha: fechaYmd,
    cuit: cleanCuit,
    ptoVta: params.puntoVenta,
    tipoCmp: params.tipoComprobanteCode,
    nroCmp: params.numeroComprobante,
    importe: Number(params.total.toFixed(2)),
    moneda: "PES",
    ctz: 1,
    tipoDocRec: params.tipoDocReceptorCode ?? (cleanDocRec > 0 ? 80 : 99),
    nroDocRec: cleanDocRec,
    tipoCodAut: "E", // E = Código de Autorización Electrónica (CAE)
    codAut: Number(params.cae) || params.cae,
  };

  const jsonStr = JSON.stringify(qrData);
  const base64 = window.btoa(jsonStr);
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
}

/**
 * Generador de respuesta simulada para Modo Mock (pruebas locales ágiles)
 */
function generateMockAuthorization(
  payload: ArcaInvoicePayload,
  nextVoucherNumber: number
): ArcaAuthorizationResult {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 10); // CAE vence 10 días luego de emitido

  // Generar un CAE de 14 dígitos numéricos que comience con 74 (habitual de AFIP)
  const randomSuffix = Math.floor(100000000000 + Math.random() * 900000000000).toString();
  const mockCae = `74${randomSuffix.slice(2)}`;
  const caeDueDateStr = dueDate.toISOString().slice(0, 10);

  const cmpCode = ARCA_DOCUMENT_TYPE_CODES[payload.documentType] || 6;
  const qrUrl = buildArcaQrUrl({
    cuitEmisor: payload.cuitEmisor,
    puntoVenta: payload.puntoVenta,
    tipoComprobanteCode: cmpCode,
    numeroComprobante: nextVoucherNumber,
    total: payload.total,
    cae: mockCae,
    fechaEmisionIso: today.toISOString(),
    docReceptor: payload.receiverDocNumber ?? undefined,
  });

  const formattedDocNumber = `${payload.documentType}-${String(payload.puntoVenta).padStart(
    4,
    "0"
  )}-${String(nextVoucherNumber).padStart(8, "0")}`;

  return {
    success: true,
    cae: mockCae,
    caeDueDate: caeDueDateStr,
    voucherNumber: nextVoucherNumber,
    qrUrl,
    formattedDocumentNumber: formattedDocNumber,
  };
}

/**
 * Invoca el servicio de facturación ARCA:
 * 1. Intenta vía Supabase Edge Function si está desplegada.
 * 2. Si falla o estamos en entorno local, utiliza el endpoint local (/functions/v1/arca-billing)
 *    atendido por el servidor de desarrollo, eliminando problemas de CORS o falta de Edge Function remota.
 */
async function callArcaBillingFunction(payload: Record<string, unknown>): Promise<{
  data: any;
  error: { message: string } | null;
}> {
  try {
    const { data, error } = await supabase.functions.invoke("arca-billing", {
      body: payload,
    });
    if (!error && data) {
      return { data, error: null };
    }
  } catch {
    // Continuar al fallback local
  }

  try {
    const res = await fetch("/functions/v1/arca-billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data?.success !== false) {
      return { data, error: null };
    }
    return {
      data,
      error: {
        message: data?.error || `Error en servidor ARCA (HTTP ${res.status})`,
      },
    };
  } catch (err) {
    return {
      data: null,
      error: {
        message:
          err instanceof Error
            ? err.message
            : "No se pudo comunicar con el servicio de facturación ARCA.",
      },
    };
  }
}

export const arcaService = {
  /**
   * Envía a autorizar una factura ante ARCA (o la simula si está en modo mock)
   */
  async authorizeInvoice(
    arcaConfig: ArcaSettings,
    payload: ArcaInvoicePayload,
    currentSequenceNumber = 1
  ): Promise<ArcaAuthorizationResult> {
    if (!arcaConfig.enabled) {
      return {
        success: false,
        errorMessage: "La facturación con ARCA está deshabilitada en la configuración.",
      };
    }

    // Modo Mock: Simulación local instantánea
    if (arcaConfig.mode === "mock") {
      return generateMockAuthorization(payload, currentSequenceNumber);
    }

    // Modo Sandbox o Real
    try {
      const { data, error } = await callArcaBillingFunction({
        action: "create-invoice",
        mode: arcaConfig.mode,
        fiscal_environment: arcaConfig.fiscal_environment,
        punto_venta: payload.puntoVenta,
        cuit_emisor: payload.cuitEmisor,
        certificate_crt: arcaConfig.certificate_crt,
        certificate_key: arcaConfig.certificate_key,
        document_type: payload.documentType,
        subtotal: payload.subtotal,
        tax_total: payload.taxTotal,
        total: payload.total,
        receiver_doc_type: payload.receiverDocType,
        receiver_doc_number: payload.receiverDocNumber,
        items: payload.items,
      });

      if (error) {
        console.warn("Fallo al conectar con servicio arca-billing:", error);
        if (arcaConfig.allow_internal_fallback) {
          return {
            success: false,
            errorMessage: `No se pudo conectar con ARCA (${error.message}). Podés emitir comprobante interno de contingencia.`,
          };
        }
        return {
          success: false,
          errorMessage: error.message || "Error al comunicar con ARCA.",
        };
      }

      if (data && data.success) {
        return {
          success: true,
          cae: data.cae,
          caeDueDate: data.cae_due_date,
          voucherNumber: data.voucher_number,
          qrUrl: data.qr_url,
          formattedDocumentNumber: `${payload.documentType}-${String(
            payload.puntoVenta
          ).padStart(4, "0")}-${String(data.voucher_number).padStart(8, "0")}`,
        };
      }

      return {
        success: false,
        errorMessage: data?.error || "ARCA rechazó el comprobante sin motivo especificado.",
      };
    } catch (err) {
      console.error("Excepción al autorizar con ARCA:", err);
      return {
        success: false,
        errorMessage:
          err instanceof Error
            ? err.message
            : "Error de red o conexión al intentar autorizar factura con ARCA.",
      };
    }
  },

  /**
   * Prueba de conectividad con los servidores de ARCA
   */
  async testConnection(
    arcaConfig: ArcaSettings,
    cuit: string,
    puntoVenta: number
  ): Promise<{ success: boolean; message: string }> {
    if (arcaConfig.mode === "mock") {
      return {
        success: true,
        message: `Servidores ARCA simulados operativos (Modo MOCK). CUIT ${cuit} y PV ${puntoVenta} listos para facturación local.`,
      };
    }

    if (!arcaConfig.certificate_crt || !arcaConfig.certificate_key) {
      return {
        success: false,
        message: "Falta vincular el Certificado Digital (.crt) y la Clave Privada (.key).",
      };
    }

    try {
      const { data, error } = await callArcaBillingFunction({
        action: "test-connection",
        mode: arcaConfig.mode,
        cuit,
        punto_venta: puntoVenta,
        certificate_crt: arcaConfig.certificate_crt,
        certificate_key: arcaConfig.certificate_key,
      });

      if (error) {
        return {
          success: false,
          message: `Error al conectar con ARCA: ${error.message}`,
        };
      }

      if (data && data.success) {
        return {
          success: true,
          message: data.message || "Conexión exitosa con los servidores de ARCA.",
        };
      }

      return {
        success: false,
        message: data?.error || "ARCA no respondió positivamente a la consulta.",
      };
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : "No se pudo establecer conexión con los servidores de ARCA.",
      };
    }
  },

  /**
   * Envía a autorizar una Nota de Crédito ante ARCA para anular una factura previa
   */
  async authorizeCreditNote(
    arcaConfig: ArcaSettings,
    payload: ArcaCreditNotePayload,
    currentSequenceNumber = 1
  ): Promise<ArcaAuthorizationResult> {
    if (!arcaConfig.enabled) {
      return {
        success: false,
        errorMessage: "La facturación con ARCA está deshabilitada en la configuración.",
      };
    }

    // Modo Mock: Simulación local instantánea
    if (arcaConfig.mode === "mock") {
      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + 10);

      const randomSuffix = Math.floor(100000000000 + Math.random() * 900000000000).toString();
      const mockCae = `74${randomSuffix.slice(2)}`;
      const caeDueDateStr = dueDate.toISOString().slice(0, 10);
      const cmpCode = ARCA_CREDIT_NOTE_CODES[payload.documentType] || 13;

      const qrUrl = buildArcaQrUrl({
        cuitEmisor: payload.cuitEmisor,
        puntoVenta: payload.puntoVenta,
        tipoComprobanteCode: cmpCode,
        numeroComprobante: currentSequenceNumber,
        total: payload.total,
        cae: mockCae,
        fechaEmisionIso: today.toISOString(),
        docReceptor: payload.receiverDocNumber ?? undefined,
      });

      const formattedDocNumber = `NC-${payload.documentType}-${String(payload.puntoVenta).padStart(
        4,
        "0"
      )}-${String(currentSequenceNumber).padStart(8, "0")}`;

      return {
        success: true,
        cae: mockCae,
        caeDueDate: caeDueDateStr,
        voucherNumber: currentSequenceNumber,
        qrUrl,
        formattedDocumentNumber: formattedDocNumber,
      };
    }

    // Modo Sandbox o Real
    try {
      const { data, error } = await callArcaBillingFunction({
        action: "create-credit-note",
        mode: arcaConfig.mode,
        fiscal_environment: arcaConfig.fiscal_environment,
        punto_venta: payload.puntoVenta,
        cuit_emisor: payload.cuitEmisor,
        certificate_crt: arcaConfig.certificate_crt,
        certificate_key: arcaConfig.certificate_key,
        document_type: payload.documentType,
        subtotal: payload.subtotal,
        tax_total: payload.taxTotal,
        total: payload.total,
        receiver_doc_type: payload.receiverDocType,
        receiver_doc_number: payload.receiverDocNumber,
        associated_voucher: {
          tipo: payload.associatedVoucher.tipo,
          punto_venta: payload.associatedVoucher.puntoVenta,
          numero: payload.associatedVoucher.numero,
          cuit: payload.associatedVoucher.cuit,
        },
      });

      if (error) {
        return {
          success: false,
          errorMessage: error.message || "Error al emitir Nota de Crédito en ARCA.",
        };
      }

      if (data && data.success) {
        return {
          success: true,
          cae: data.cae,
          caeDueDate: data.cae_due_date,
          voucherNumber: data.voucher_number,
          qrUrl: data.qr_url,
          formattedDocumentNumber: `NC-${payload.documentType}-${String(
            payload.puntoVenta
          ).padStart(4, "0")}-${String(data.voucher_number).padStart(8, "0")}`,
        };
      }

      return {
        success: false,
        errorMessage: data?.error || "ARCA rechazó la Nota de Crédito.",
      };
    } catch (err) {
      return {
        success: false,
        errorMessage:
          err instanceof Error
            ? err.message
            : "Error de red al autorizar Nota de Crédito con ARCA.",
      };
    }
  },
};
