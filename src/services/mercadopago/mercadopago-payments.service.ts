import { storageKeys } from "@/utils/local-storage";
import type { MercadoPagoMode, MercadoPagoSettings } from "@/types/entities";

export type MercadoPagoProviderStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired";

export type MercadoPagoRuntimeMode = MercadoPagoMode | "not_configured";

export interface MercadoPagoPaymentIntent {
  id: string;
  tenant_id: string;
  amount: number;
  currency_code: string;
  reference: string;
  status: MercadoPagoProviderStatus;
  metadata: Record<string, unknown> | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MercadoPagoOperationalStatus {
  mode: MercadoPagoRuntimeMode;
  configured: boolean;
  available: boolean;
  can_start_payment: boolean;
  requires_backend: boolean;
  backend_ready: boolean;
  reason: string | null;
}

interface CreatePaymentIntentInput {
  tenantId: string;
  amount: number;
  currencyCode: string;
  description?: string;
  customerId?: string | null;
  saleNumberHint?: string | null;
  metadata?: Record<string, unknown> | null;
  settings?: MercadoPagoSettings | null;
}

const DEFAULT_SETTINGS: MercadoPagoSettings = {
  enabled: true,
  mode: "mock",
  access_token: "",
  public_key: "",
  force_unavailable: false,
};

const nowIso = (): string => new Date().toISOString();

const roundAmount = (value: number): number => Number(value.toFixed(2));

const generateIntentId = (): string =>
  `mpi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const generateReference = (): string =>
  `MP-MOCK-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const readAll = (): MercadoPagoPaymentIntent[] => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(storageKeys.mercadoPagoIntents);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as MercadoPagoPaymentIntent[];
  } catch {
    return [];
  }
};

const writeAll = (rows: MercadoPagoPaymentIntent[]): void => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(storageKeys.mercadoPagoIntents, JSON.stringify(rows));
};

const replaceIntent = (intent: MercadoPagoPaymentIntent): MercadoPagoPaymentIntent => {
  const rows = readAll();
  const index = rows.findIndex(
    (row) => row.id === intent.id && row.tenant_id === intent.tenant_id
  );
  if (index < 0) {
    rows.push(intent);
  } else {
    rows[index] = intent;
  }
  writeAll(rows);
  return intent;
};

const findIntent = (tenantId: string, intentId: string): MercadoPagoPaymentIntent | null => {
  return readAll().find((row) => row.tenant_id === tenantId && row.id === intentId) ?? null;
};

const updateIntentStatus = (
  tenantId: string,
  intentId: string,
  status: MercadoPagoProviderStatus
): MercadoPagoPaymentIntent => {
  const current = findIntent(tenantId, intentId);
  if (!current) {
    throw new Error("Intent de Mercado Pago no encontrado");
  }

  const updated: MercadoPagoPaymentIntent = {
    ...current,
    status,
    updated_at: nowIso(),
  };

  return replaceIntent(updated);
};

const normalizeStatus = (value: unknown): MercadoPagoProviderStatus => {
  if (typeof value !== "string") return "pending";

  switch (value) {
    case "approved":
    case "rejected":
    case "cancelled":
    case "expired":
      return value;
    default:
      return "pending";
  }
};

const resolveBackendBaseUrl = (): string | null => {
  const fromMp =
    typeof import.meta.env.VITE_MP_API_BASE_URL === "string"
      ? import.meta.env.VITE_MP_API_BASE_URL.trim()
      : "";
  const fromGeneric =
    typeof import.meta.env.VITE_PAYMENTS_API_BASE_URL === "string"
      ? import.meta.env.VITE_PAYMENTS_API_BASE_URL.trim()
      : "";
  const base = fromMp || fromGeneric;
  return base ? base.replace(/\/$/, "") : null;
};

const backendBaseUrl = resolveBackendBaseUrl();

const sanitizeSettings = (settings?: MercadoPagoSettings | null): MercadoPagoSettings => ({
  ...DEFAULT_SETTINGS,
  ...(settings ?? {}),
  access_token: settings?.access_token?.trim() ?? "",
  public_key: settings?.public_key?.trim() ?? "",
});

const getOnlineStatus = (): boolean => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
};

const hasCredentials = (settings: MercadoPagoSettings): boolean =>
  Boolean(settings.access_token && settings.public_key);

const resolveOperationalStatus = (input?: {
  settings?: MercadoPagoSettings | null;
  isOnline?: boolean;
}): MercadoPagoOperationalStatus => {
  const settings = sanitizeSettings(input?.settings);
  const isOnline = input?.isOnline ?? getOnlineStatus();

  if (!settings.enabled) {
    return {
      mode: "not_configured",
      configured: false,
      available: false,
      can_start_payment: false,
      requires_backend: false,
      backend_ready: false,
      reason: "Mercado Pago no configurado",
    };
  }

  if (settings.force_unavailable) {
    return {
      mode: settings.mode,
      configured: false,
      available: false,
      can_start_payment: false,
      requires_backend: settings.mode !== "mock",
      backend_ready: settings.mode === "mock" || Boolean(backendBaseUrl),
      reason: "Mercado Pago deshabilitado temporalmente",
    };
  }

  if (!isOnline) {
    return {
      mode: settings.mode,
      configured: true,
      available: false,
      can_start_payment: false,
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
      can_start_payment: true,
      requires_backend: false,
      backend_ready: true,
      reason: null,
    };
  }

  if (!hasCredentials(settings)) {
    return {
      mode: settings.mode,
      configured: false,
      available: false,
      can_start_payment: false,
      requires_backend: true,
      backend_ready: Boolean(backendBaseUrl),
      reason: "Mercado Pago no configurado: faltan credenciales",
    };
  }

  if (!backendBaseUrl) {
    return {
      mode: settings.mode,
      configured: true,
      available: false,
      can_start_payment: false,
      requires_backend: true,
      backend_ready: false,
      reason: "Modo sandbox/real preparado. Configura backend o edge function",
    };
  }

  return {
    mode: settings.mode,
    configured: true,
    available: true,
    can_start_payment: true,
    requires_backend: true,
    backend_ready: true,
    reason: null,
  };
};

const buildIntentFromBackend = (
  payload: Record<string, unknown>,
  tenantId: string,
  fallbackAmount: number,
  fallbackCurrency: string
): MercadoPagoPaymentIntent => {
  const now = nowIso();

  return {
    id: typeof payload.id === "string" && payload.id ? payload.id : generateIntentId(),
    tenant_id: tenantId,
    amount:
      typeof payload.amount === "number" && Number.isFinite(payload.amount)
        ? roundAmount(payload.amount)
        : roundAmount(fallbackAmount),
    currency_code:
      typeof payload.currency_code === "string" && payload.currency_code
        ? payload.currency_code
        : fallbackCurrency,
    reference:
      typeof payload.reference === "string" && payload.reference
        ? payload.reference
        : generateReference(),
    status: normalizeStatus(payload.status),
    metadata:
      payload.metadata && typeof payload.metadata === "object"
        ? (payload.metadata as Record<string, unknown>)
        : null,
    expires_at:
      typeof payload.expires_at === "string" && payload.expires_at
        ? payload.expires_at
        : null,
    created_at:
      typeof payload.created_at === "string" && payload.created_at
        ? payload.created_at
        : now,
    updated_at:
      typeof payload.updated_at === "string" && payload.updated_at
        ? payload.updated_at
        : now,
  };
};

const requestBackend = async <TResponse>(
  path: string,
  init: RequestInit
): Promise<TResponse> => {
  if (!backendBaseUrl) {
    throw new Error("Backend de Mercado Pago no configurado");
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
    throw new Error(detail || `Error Mercado Pago (${response.status})`);
  }

  return (await response.json()) as TResponse;
};

const createIntentMock = async (
  input: CreatePaymentIntentInput
): Promise<MercadoPagoPaymentIntent> => {
  const now = nowIso();
  const intent: MercadoPagoPaymentIntent = {
    id: generateIntentId(),
    tenant_id: input.tenantId,
    amount: roundAmount(input.amount),
    currency_code: input.currencyCode,
    reference: generateReference(),
    status: "pending",
    metadata: {
      description: input.description ?? null,
      customer_id: input.customerId ?? null,
      sale_number_hint: input.saleNumberHint ?? null,
      provider_mode: "mock",
      ...(input.metadata ?? {}),
    },
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    created_at: now,
    updated_at: now,
  };

  return replaceIntent(intent);
};

const createIntentFromBackend = async (
  input: CreatePaymentIntentInput,
  mode: Exclude<MercadoPagoMode, "mock">
): Promise<MercadoPagoPaymentIntent> => {
  const payload = await requestBackend<Record<string, unknown>>(
    "/mercadopago/intents",
    {
      method: "POST",
      body: JSON.stringify({
        tenant_id: input.tenantId,
        amount: roundAmount(input.amount),
        currency_code: input.currencyCode,
        description: input.description ?? null,
        customer_id: input.customerId ?? null,
        sale_number_hint: input.saleNumberHint ?? null,
        mode,
        metadata: input.metadata ?? null,
      }),
    }
  );

  return buildIntentFromBackend(payload, input.tenantId, input.amount, input.currencyCode);
};

const getIntentFromBackend = async (
  tenantId: string,
  intentId: string
): Promise<MercadoPagoPaymentIntent> => {
  const payload = await requestBackend<Record<string, unknown>>(
    `/mercadopago/intents/${intentId}?tenant_id=${encodeURIComponent(tenantId)}`,
    {
      method: "GET",
    }
  );

  return buildIntentFromBackend(payload, tenantId, 0, "ARS");
};

const cancelIntentFromBackend = async (
  tenantId: string,
  intentId: string
): Promise<MercadoPagoPaymentIntent> => {
  const payload = await requestBackend<Record<string, unknown>>(
    `/mercadopago/intents/${intentId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ tenant_id: tenantId }),
    }
  );

  return buildIntentFromBackend(payload, tenantId, 0, "ARS");
};

const resolveModeFromSettings = (settings?: MercadoPagoSettings | null): MercadoPagoRuntimeMode =>
  resolveOperationalStatus({ settings }).mode;

export const mercadoPagoPaymentsService = {
  getOperationalStatus: (input?: {
    settings?: MercadoPagoSettings | null;
    isOnline?: boolean;
  }): MercadoPagoOperationalStatus => {
    return resolveOperationalStatus(input);
  },

  isAvailable: (input?: {
    settings?: MercadoPagoSettings | null;
    isOnline?: boolean;
  }): boolean => {
    return resolveOperationalStatus(input).available;
  },

  createPaymentIntent: async (
    input: CreatePaymentIntentInput
  ): Promise<MercadoPagoPaymentIntent> => {
    const status = resolveOperationalStatus({ settings: input.settings });
    if (!status.can_start_payment) {
      throw new Error(status.reason ?? "Mercado Pago no disponible");
    }

    if (status.mode === "not_configured") {
      throw new Error("Mercado Pago no configurado");
    }

    if (status.mode === "mock") {
      return createIntentMock(input);
    }

    return createIntentFromBackend(input, status.mode);
  },

  createPreference: async (
    input: CreatePaymentIntentInput
  ): Promise<MercadoPagoPaymentIntent> => {
    return mercadoPagoPaymentsService.createPaymentIntent(input);
  },

  getPaymentStatus: async (
    tenantId: string,
    intentId: string,
    options?: { settings?: MercadoPagoSettings | null }
  ): Promise<MercadoPagoPaymentIntent> => {
    const mode = resolveModeFromSettings(options?.settings);

    if (mode === "mock" || mode === "not_configured") {
      const intent = findIntent(tenantId, intentId);
      if (!intent) {
        throw new Error("Cobro de Mercado Pago no encontrado");
      }

      if (intent.status === "pending" && intent.expires_at && intent.expires_at <= nowIso()) {
        return updateIntentStatus(tenantId, intentId, "expired");
      }

      return intent;
    }

    return getIntentFromBackend(tenantId, intentId);
  },

  cancelPayment: async (
    tenantId: string,
    intentId: string,
    options?: { settings?: MercadoPagoSettings | null }
  ): Promise<MercadoPagoPaymentIntent> => {
    const mode = resolveModeFromSettings(options?.settings);
    if (mode === "mock" || mode === "not_configured") {
      return updateIntentStatus(tenantId, intentId, "cancelled");
    }

    return cancelIntentFromBackend(tenantId, intentId);
  },

  simulateApproval: async (
    tenantId: string,
    intentId: string,
    options?: { settings?: MercadoPagoSettings | null }
  ): Promise<MercadoPagoPaymentIntent> => {
    const mode = resolveModeFromSettings(options?.settings);
    if (mode !== "mock") {
      throw new Error("La aprobacion mock solo aplica en modo mock");
    }

    return updateIntentStatus(tenantId, intentId, "approved");
  },

  simulateRejection: async (
    tenantId: string,
    intentId: string,
    options?: { settings?: MercadoPagoSettings | null }
  ): Promise<MercadoPagoPaymentIntent> => {
    const mode = resolveModeFromSettings(options?.settings);
    if (mode !== "mock") {
      throw new Error("El rechazo mock solo aplica en modo mock");
    }

    return updateIntentStatus(tenantId, intentId, "rejected");
  },
};
