import type {
  ArcaFiscalEnvironment,
  ArcaMode,
  ArcaSettings,
  FiscalCustomerSnapshot,
  Invoice,
} from "@/types/entities";

export interface TaxValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ArcaInvoicePayload {
  documentType: Invoice["document_type"];
  documentNumber: string;
  issueDate: string;
  customer: FiscalCustomerSnapshot | null;
  emitter: {
    cuit: string;
    pointOfSale: number;
    certificateAlias: string;
    fiscalEnvironment: ArcaFiscalEnvironment;
  };
  totals: {
    subtotal: number;
    taxTotal: number;
    total: number;
  };
  items: Invoice["items_snapshot"];
}

export interface SendInvoiceResult {
  accepted: boolean;
  status: Invoice["arca_status"];
  reference: string | null;
  message: string;
  rawResponse: Record<string, unknown>;
}

export interface ArcaMockOptions {
  forcedStatus?: "accepted" | "rejected";
  delayMs?: number;
}

export type ArcaRuntimeMode = ArcaMode | "not_configured";

export interface ArcaOperationalStatus {
  mode: ArcaRuntimeMode;
  configured: boolean;
  available: boolean;
  can_send: boolean;
  requires_backend: boolean;
  backend_ready: boolean;
  reason: string | null;
}

export interface ArcaSendOptions extends ArcaMockOptions {
  settings?: ArcaSettings | null;
}

export interface ArcaStatusCheckOptions extends ArcaMockOptions {
  settings?: ArcaSettings | null;
  tenantId?: string | null;
}

const hasMeaningfulValue = (value: string | null | undefined): boolean =>
  Boolean(value && value.trim().length > 0);

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const resolveMockStatus = (options?: ArcaMockOptions): "accepted" | "rejected" => {
  if (options?.forcedStatus) return options.forcedStatus;
  return Math.random() < 0.8 ? "accepted" : "rejected";
};

const resolveBackendBaseUrl = (): string | null => {
  const fromArca =
    typeof import.meta.env.VITE_ARCA_API_BASE_URL === "string"
      ? import.meta.env.VITE_ARCA_API_BASE_URL.trim()
      : "";
  const fromInvoices =
    typeof import.meta.env.VITE_INVOICES_API_BASE_URL === "string"
      ? import.meta.env.VITE_INVOICES_API_BASE_URL.trim()
      : "";
  const base = fromArca || fromInvoices;
  return base ? base.replace(/\/$/, "") : null;
};

const backendBaseUrl = resolveBackendBaseUrl();

const defaultArcaSettings: ArcaSettings = {
  enabled: false,
  mode: "mock",
  cuit_emisor: "",
  punto_venta: 1,
  certificado_alias: "",
  fiscal_environment: "homologacion",
  force_unavailable: false,
  allow_internal_fallback: true,
};

const sanitizeSettings = (settings?: ArcaSettings | null): ArcaSettings => ({
  ...defaultArcaSettings,
  ...(settings ?? {}),
  cuit_emisor: settings?.cuit_emisor?.trim() ?? "",
  certificado_alias: settings?.certificado_alias?.trim() ?? "",
});

const getOnlineStatus = (): boolean => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
};

const resolveOperationalStatus = (input?: {
  settings?: ArcaSettings | null;
  isOnline?: boolean;
}): ArcaOperationalStatus => {
  const settings = sanitizeSettings(input?.settings);
  const isOnline = input?.isOnline ?? getOnlineStatus();

  if (!settings.enabled) {
    return {
      mode: "not_configured",
      configured: false,
      available: false,
      can_send: false,
      requires_backend: false,
      backend_ready: false,
      reason: "ARCA no configurado",
    };
  }

  if (settings.force_unavailable) {
    return {
      mode: settings.mode,
      configured: false,
      available: false,
      can_send: false,
      requires_backend: settings.mode !== "mock",
      backend_ready: settings.mode === "mock" || Boolean(backendBaseUrl),
      reason: "ARCA marcado como no disponible",
    };
  }

  if (!isOnline) {
    return {
      mode: settings.mode,
      configured: true,
      available: false,
      can_send: false,
      requires_backend: settings.mode !== "mock",
      backend_ready: settings.mode === "mock" || Boolean(backendBaseUrl),
      reason: "Sin conexion",
    };
  }

  if (settings.mode === "mock") {
    return {
      mode: "mock",
      configured: true,
      available: true,
      can_send: true,
      requires_backend: false,
      backend_ready: true,
      reason: null,
    };
  }

  if (!hasMeaningfulValue(settings.cuit_emisor) || settings.punto_venta <= 0) {
    return {
      mode: settings.mode,
      configured: false,
      available: false,
      can_send: false,
      requires_backend: true,
      backend_ready: Boolean(backendBaseUrl),
      reason: "ARCA no configurado: faltan CUIT emisor o punto de venta",
    };
  }

  if (!hasMeaningfulValue(settings.certificado_alias)) {
    return {
      mode: settings.mode,
      configured: false,
      available: false,
      can_send: false,
      requires_backend: true,
      backend_ready: Boolean(backendBaseUrl),
      reason: "ARCA no configurado: falta referencia de certificado",
    };
  }

  if (!backendBaseUrl) {
    return {
      mode: settings.mode,
      configured: true,
      available: false,
      can_send: false,
      requires_backend: true,
      backend_ready: false,
      reason: "Modo sandbox/real preparado. Configura backend o edge function",
    };
  }

  return {
    mode: settings.mode,
    configured: true,
    available: true,
    can_send: true,
    requires_backend: true,
    backend_ready: true,
    reason: null,
  };
};

const requestBackend = async <TResponse>(
  path: string,
  init: RequestInit
): Promise<TResponse> => {
  if (!backendBaseUrl) {
    throw new Error("Backend ARCA no configurado");
  }

  const response = await fetch(`${backendBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Error ARCA (${response.status})`);
  }

  return (await response.json()) as TResponse;
};

const mapBackendStatus = (rawStatus: unknown): Invoice["arca_status"] => {
  if (rawStatus === "accepted" || rawStatus === "rejected" || rawStatus === "pending") {
    return rawStatus;
  }
  return "pending";
};

export const arcaInvoicesService = {
  getOperationalStatus: (input?: {
    settings?: ArcaSettings | null;
    isOnline?: boolean;
  }): ArcaOperationalStatus => resolveOperationalStatus(input),

  isAvailable: (input?: { settings?: ArcaSettings | null; isOnline?: boolean }): boolean =>
    resolveOperationalStatus(input).available,

  validateCustomerTaxData: (
    customerSnapshot: FiscalCustomerSnapshot | null
  ): TaxValidationResult => {
    const errors: string[] = [];

    if (!customerSnapshot) {
      errors.push("Falta snapshot fiscal del cliente");
      return { valid: false, errors };
    }

    if (!hasMeaningfulValue(customerSnapshot.document_number)) {
      errors.push("Falta documento fiscal");
    }

    if (!hasMeaningfulValue(customerSnapshot.document_type)) {
      errors.push("Falta tipo de documento fiscal");
    }

    if (!hasMeaningfulValue(customerSnapshot.business_name ?? customerSnapshot.full_name)) {
      errors.push("Falta razon social o nombre fiscal");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  buildArcaPayload: (
    invoice: Invoice,
    settings?: ArcaSettings | null
  ): ArcaInvoicePayload => {
    const resolved = sanitizeSettings(settings);

    return {
      documentType: invoice.document_type,
      documentNumber: invoice.document_number,
      issueDate: invoice.issue_date,
      customer: invoice.customer_snapshot,
      emitter: {
        cuit: resolved.cuit_emisor,
        pointOfSale: resolved.punto_venta,
        certificateAlias: resolved.certificado_alias,
        fiscalEnvironment: resolved.fiscal_environment,
      },
      totals: {
        subtotal: invoice.subtotal,
        taxTotal: invoice.tax_total,
        total: invoice.total,
      },
      items: invoice.items_snapshot,
    };
  },

  sendInvoice: async (
    invoice: Invoice,
    options?: ArcaSendOptions
  ): Promise<SendInvoiceResult> => {
    const operational = resolveOperationalStatus({ settings: options?.settings });
    if (!operational.can_send) {
      throw new Error(operational.reason ?? "ARCA no disponible");
    }

    const payload = arcaInvoicesService.buildArcaPayload(invoice, options?.settings);

    if (operational.mode === "mock") {
      await wait(options?.delayMs ?? 1000);
      const status = resolveMockStatus(options);
      const reference = `ARCA-MOCK-${status.toUpperCase()}-${Date.now()}`;
      const accepted = status === "accepted";
      const message = accepted
        ? "Factura aprobada por ARCA (mock)"
        : "Factura rechazada por ARCA (mock)";

      return {
        accepted,
        status,
        reference,
        message,
        rawResponse: {
          adapter: "mock",
          sentAt: new Date().toISOString(),
          status,
          message,
          payload,
          mode: operational.mode,
        },
      };
    }

    const backendResponse = await requestBackend<Record<string, unknown>>(
      "/arca/invoices/send",
      {
        method: "POST",
        body: JSON.stringify({
          tenant_id: invoice.tenant_id,
          invoice_id: invoice.id,
          mode: operational.mode,
          payload,
        }),
      }
    );

    const status = mapBackendStatus(backendResponse.status);
    const accepted = status === "accepted";

    return {
      accepted,
      status,
      reference:
        typeof backendResponse.reference === "string" && backendResponse.reference
          ? backendResponse.reference
          : null,
      message:
        typeof backendResponse.message === "string" && backendResponse.message
          ? backendResponse.message
          : accepted
            ? "Factura enviada a ARCA"
            : "Factura enviada a ARCA y pendiente/rechazada",
      rawResponse: {
        adapter: "backend",
        mode: operational.mode,
        response: backendResponse,
      },
    };
  },

  checkInvoiceStatus: async (
    arcaReference: string,
    options?: ArcaStatusCheckOptions
  ): Promise<{ status: Invoice["arca_status"]; rawResponse: Record<string, unknown> }> => {
    const operational = resolveOperationalStatus({ settings: options?.settings });

    if (operational.mode === "mock" || operational.mode === "not_configured") {
      await wait(options?.delayMs ?? 700);
      let status: Invoice["arca_status"];

      if (options?.forcedStatus) {
        status = options.forcedStatus;
      } else if (arcaReference.includes("REJECTED")) {
        status = "rejected";
      } else if (arcaReference.includes("ACCEPTED")) {
        status = "accepted";
      } else {
        status = resolveMockStatus(options);
      }

      return {
        status,
        rawResponse: {
          adapter: "mock",
          checkedAt: new Date().toISOString(),
          reference: arcaReference,
          status,
        },
      };
    }

    if (!operational.available) {
      throw new Error(operational.reason ?? "ARCA no disponible");
    }

    const backendResponse = await requestBackend<Record<string, unknown>>(
      `/arca/invoices/status?reference=${encodeURIComponent(arcaReference)}&tenant_id=${encodeURIComponent(options?.tenantId ?? "")}`,
      {
        method: "GET",
      }
    );

    const status = mapBackendStatus(backendResponse.status);

    return {
      status,
      rawResponse: {
        adapter: "backend",
        mode: operational.mode,
        checkedAt: new Date().toISOString(),
        response: backendResponse,
      },
    };
  },
};
