import { dbTables } from "@/lib/database/tables";
import {
  TenantCrudService,
  type CreateEntityInput,
  type UpdateEntityInput,
} from "@/services/base/tenant-crud.service";
import type { PaymentMethod, PaymentMethodType } from "@/types/entities";

const crud = new TenantCrudService<PaymentMethod>(dbTables.payment_methods);

export type CreatePaymentMethodInput = CreateEntityInput<PaymentMethod>;
export type UpdatePaymentMethodInput = UpdateEntityInput<PaymentMethod>;

export interface PaymentMethodPosConfig {
  ask_destination_bank: boolean;
  destination_bank_account_ids: string[];
  ask_coupon_number: boolean;
  ask_approval_number: boolean;
  ask_operation_number: boolean;
  ask_voucher_number: boolean;
  ask_origin_bank: boolean;
  allow_new_origin_bank: boolean;
  ask_origin_account_holder: boolean;
  ask_card_brand: boolean;
  ask_installment_plan: boolean;
  ask_cheque_number: boolean;
  ask_cheque_due_date: boolean;
}

interface SystemPaymentMethodTemplate {
  code: PaymentMethodType;
  name: string;
  type: PaymentMethodType;
  affects_cash: boolean;
  default_note: string;
  default_config: PaymentMethodPosConfig;
}

interface ConflictLikeError {
  code?: string;
  status?: number;
  message?: string;
  details?: string;
}

const paymentMethodConfigMarker = "[[pm_config]]";

export const paymentMethodSystemOrder: PaymentMethodType[] = [
  "cash",
  "card_debit",
  "card_credit",
  "transfer",
  "mercado_pago",
  "cheque",
  "current_account",
];

const baseConfigDefaults: PaymentMethodPosConfig = {
  ask_destination_bank: false,
  destination_bank_account_ids: [],
  ask_coupon_number: false,
  ask_approval_number: false,
  ask_operation_number: false,
  ask_voucher_number: false,
  ask_origin_bank: false,
  allow_new_origin_bank: false,
  ask_origin_account_holder: false,
  ask_card_brand: false,
  ask_installment_plan: false,
  ask_cheque_number: false,
  ask_cheque_due_date: false,
};

const systemPaymentMethodTemplates: Record<PaymentMethodType, SystemPaymentMethodTemplate> = {
  cash: {
    code: "cash",
    name: "Efectivo",
    type: "cash",
    affects_cash: true,
    default_note: "Medio predefinido del sistema",
    default_config: {
      ...baseConfigDefaults,
    },
  },
  card_debit: {
    code: "card_debit",
    name: "Tarjeta de debito",
    type: "card_debit",
    affects_cash: false,
    default_note: "Medio predefinido del sistema",
    default_config: {
      ...baseConfigDefaults,
      ask_destination_bank: true,
      ask_coupon_number: true,
      ask_approval_number: true,
    },
  },
  card_credit: {
    code: "card_credit",
    name: "Tarjeta de credito",
    type: "card_credit",
    affects_cash: false,
    default_note: "Medio predefinido del sistema",
    default_config: {
      ...baseConfigDefaults,
      ask_destination_bank: true,
      ask_coupon_number: true,
      ask_approval_number: true,
      ask_card_brand: true,
      ask_installment_plan: true,
    },
  },
  transfer: {
    code: "transfer",
    name: "Transferencia bancaria",
    type: "transfer",
    affects_cash: false,
    default_note: "Medio predefinido del sistema",
    default_config: {
      ...baseConfigDefaults,
      ask_destination_bank: true,
      ask_voucher_number: true,
      ask_origin_bank: true,
      allow_new_origin_bank: true,
      ask_origin_account_holder: true,
    },
  },
  mercado_pago: {
    code: "mercado_pago",
    name: "Mercado Pago",
    type: "mercado_pago",
    affects_cash: false,
    default_note: "Medio predefinido del sistema",
    default_config: {
      ...baseConfigDefaults,
      ask_destination_bank: true,
      ask_operation_number: true,
    },
  },
  cheque: {
    code: "cheque",
    name: "Cheque",
    type: "cheque",
    affects_cash: false,
    default_note: "Medio predefinido del sistema",
    default_config: {
      ...baseConfigDefaults,
      ask_destination_bank: true,
      ask_origin_bank: true,
      allow_new_origin_bank: true,
      ask_origin_account_holder: true,
      ask_cheque_number: true,
      ask_cheque_due_date: true,
    },
  },
  current_account: {
    code: "current_account",
    name: "Cuenta corriente",
    type: "current_account",
    affects_cash: false,
    default_note: "Medio predefinido del sistema",
    default_config: {
      ...baseConfigDefaults,
    },
  },
};

const paymentMethodTypeLabels: Record<PaymentMethodType, string> = {
  cash: "Efectivo",
  card_debit: "Tarjeta de debito",
  card_credit: "Tarjeta de credito",
  transfer: "Transferencia bancaria",
  mercado_pago: "Mercado Pago",
  cheque: "Cheque",
  current_account: "Cuenta corriente",
};

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!normalized) continue;
    unique.add(normalized);
  }

  return [...unique];
};

const normalizeNumber = (value: number | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizeText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
};

export const normalizePaymentMethodCode = (code: string | null | undefined): string =>
  (code ?? "").trim().toLowerCase().replace(/\s+/g, "_");

export const isSystemPaymentMethodCode = (code: string): code is PaymentMethodType =>
  (paymentMethodSystemOrder as string[]).includes(code);

const getTemplateForCode = (code: PaymentMethodType): SystemPaymentMethodTemplate =>
  systemPaymentMethodTemplates[code];

const splitNotesAndConfig = (
  notes: string | null | undefined
): {
  baseNotes: string | null;
  config: Partial<PaymentMethodPosConfig> | null;
} => {
  const normalizedNotes = normalizeText(notes);
  if (!normalizedNotes) {
    return {
      baseNotes: null,
      config: null,
    };
  }

  const markerIndex = normalizedNotes.lastIndexOf(paymentMethodConfigMarker);
  if (markerIndex < 0) {
    return {
      baseNotes: normalizedNotes,
      config: null,
    };
  }

  const baseCandidate = normalizeText(normalizedNotes.slice(0, markerIndex));
  const payload = normalizedNotes.slice(markerIndex + paymentMethodConfigMarker.length).trim();
  if (!payload) {
    return {
      baseNotes: baseCandidate,
      config: null,
    };
  }

  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {
        baseNotes: normalizedNotes,
        config: null,
      };
    }

    return {
      baseNotes: baseCandidate,
      config: parsed as Partial<PaymentMethodPosConfig>,
    };
  } catch {
    return {
      baseNotes: normalizedNotes,
      config: null,
    };
  }
};

const mergeConfigWithDefaults = (
  code: PaymentMethodType,
  partial?: Partial<PaymentMethodPosConfig> | null
): PaymentMethodPosConfig => {
  const defaults = getTemplateForCode(code).default_config;
  const source = partial ?? {};
  const destinationBankAccountIds = normalizeStringList(source.destination_bank_account_ids);

  return {
    ask_destination_bank: normalizeBoolean(source.ask_destination_bank, defaults.ask_destination_bank),
    destination_bank_account_ids: destinationBankAccountIds.length
      ? destinationBankAccountIds
      : defaults.destination_bank_account_ids,
    ask_coupon_number: normalizeBoolean(source.ask_coupon_number, defaults.ask_coupon_number),
    ask_approval_number: normalizeBoolean(source.ask_approval_number, defaults.ask_approval_number),
    ask_operation_number: normalizeBoolean(source.ask_operation_number, defaults.ask_operation_number),
    ask_voucher_number: normalizeBoolean(source.ask_voucher_number, defaults.ask_voucher_number),
    ask_origin_bank: normalizeBoolean(source.ask_origin_bank, defaults.ask_origin_bank),
    allow_new_origin_bank: normalizeBoolean(source.allow_new_origin_bank, defaults.allow_new_origin_bank),
    ask_origin_account_holder: normalizeBoolean(
      source.ask_origin_account_holder,
      defaults.ask_origin_account_holder
    ),
    ask_card_brand: normalizeBoolean(source.ask_card_brand, defaults.ask_card_brand),
    ask_installment_plan: normalizeBoolean(source.ask_installment_plan, defaults.ask_installment_plan),
    ask_cheque_number: normalizeBoolean(source.ask_cheque_number, defaults.ask_cheque_number),
    ask_cheque_due_date: normalizeBoolean(source.ask_cheque_due_date, defaults.ask_cheque_due_date),
  };
};

export const getPaymentMethodTypeLabel = (type: PaymentMethodType): string =>
  paymentMethodTypeLabels[type];

export const getPaymentMethodBaseNotes = (notes: string | null | undefined): string | null =>
  splitNotesAndConfig(notes).baseNotes;

export const getPaymentMethodPosConfigFromNotes = (
  code: PaymentMethodType,
  notes: string | null | undefined
): PaymentMethodPosConfig => {
  const { config } = splitNotesAndConfig(notes);
  return mergeConfigWithDefaults(code, config);
};

export const getPaymentMethodPosConfig = (
  paymentMethod: Pick<PaymentMethod, "code" | "notes">
): PaymentMethodPosConfig => {
  const normalizedCode = normalizePaymentMethodCode(paymentMethod.code);
  const code: PaymentMethodType = isSystemPaymentMethodCode(normalizedCode)
    ? normalizedCode
    : "cash";

  return getPaymentMethodPosConfigFromNotes(code, paymentMethod.notes);
};

export const composePaymentMethodNotes = (
  code: PaymentMethodType,
  baseNotes: string | null | undefined,
  config?: Partial<PaymentMethodPosConfig> | null
): string => {
  const normalizedBaseNotes = normalizeText(baseNotes);
  const normalizedConfig = mergeConfigWithDefaults(code, config);
  const serializedConfig = `${paymentMethodConfigMarker}${JSON.stringify(normalizedConfig)}`;

  return normalizedBaseNotes ? `${normalizedBaseNotes}\n${serializedConfig}` : serializedConfig;
};

const isUniqueConflictError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const conflict = error as ConflictLikeError;
  if (conflict.code === "23505" || conflict.status === 409) return true;
  const text = `${conflict.message ?? ""} ${conflict.details ?? ""}`.toLowerCase();
  return text.includes("duplicate key") || text.includes("unique constraint");
};

const sortRowsByPriority = (rows: PaymentMethod[]): PaymentMethod[] =>
  [...rows].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });

const pickSystemRows = (rows: PaymentMethod[]): PaymentMethod[] => {
  const grouped = rows.reduce<Map<PaymentMethodType, PaymentMethod[]>>((acc, row) => {
    const normalizedCode = normalizePaymentMethodCode(row.code);
    if (!isSystemPaymentMethodCode(normalizedCode)) return acc;
    const current = acc.get(normalizedCode) ?? [];
    current.push(row);
    acc.set(normalizedCode, current);
    return acc;
  }, new Map());

  const preferredByCode = new Map<PaymentMethodType, PaymentMethod>();
  for (const code of paymentMethodSystemOrder) {
    const group = grouped.get(code) ?? [];
    if (!group.length) continue;
    preferredByCode.set(code, sortRowsByPriority(group)[0]);
  }

  return paymentMethodSystemOrder
    .map((code) => preferredByCode.get(code))
    .filter((row): row is PaymentMethod => Boolean(row));
};

const buildSystemCreateInput = (code: PaymentMethodType): CreatePaymentMethodInput => {
  const template = getTemplateForCode(code);
  return {
    name: template.name,
    code: template.code,
    type: template.type,
    is_active: true,
    affects_cash: template.affects_cash,
    surcharge_percent: 0,
    discount_percent: 0,
    notes: composePaymentMethodNotes(code, template.default_note, template.default_config),
  };
};

export const paymentMethodsService = {
  getAllByTenant: async (tenantId: string) => {
    await paymentMethodsService.ensureDefaultMethods(tenantId);
    const rows = await crud.getAllByTenant(tenantId);
    return pickSystemRows(rows);
  },

  getActiveByTenant: async (tenantId: string) => {
    const all = await paymentMethodsService.getAllByTenant(tenantId);
    return all.filter((method) => method.is_active);
  },

  getById: async (tenantId: string, id: string) => {
    const row = await crud.getById(tenantId, id);
    if (!row) return null;
    const code = normalizePaymentMethodCode(row.code);
    return isSystemPaymentMethodCode(code) ? row : null;
  },

  create: async () => {
    throw new Error("Los medios de pago estan predefinidos por el sistema.");
  },

  update: async (tenantId: string, id: string, input: UpdatePaymentMethodInput) => {
    const existing = await crud.getById(tenantId, id);
    if (!existing) return null;

    const normalizedCode = normalizePaymentMethodCode(existing.code);
    if (!isSystemPaymentMethodCode(normalizedCode)) {
      throw new Error("Solo se pueden editar medios de pago del catalogo del sistema.");
    }

    const template = getTemplateForCode(normalizedCode);
    const nextConfig = getPaymentMethodPosConfigFromNotes(
      normalizedCode,
      input.notes ?? existing.notes
    );
    const nextBaseNotes = normalizeText(
      getPaymentMethodBaseNotes(input.notes ?? existing.notes) ?? template.default_note
    );

    const payload: UpdatePaymentMethodInput = {
      name: template.name,
      code: template.code,
      type: template.type,
      affects_cash: template.affects_cash,
      notes: composePaymentMethodNotes(normalizedCode, nextBaseNotes, nextConfig),
      is_active: typeof input.is_active === "boolean" ? input.is_active : existing.is_active,
      surcharge_percent: normalizeNumber(input.surcharge_percent, existing.surcharge_percent),
      discount_percent: normalizeNumber(input.discount_percent, existing.discount_percent),
    };

    return crud.update(tenantId, id, payload);
  },

  delete: async () => {
    throw new Error("No se pueden eliminar medios de pago del catalogo del sistema.");
  },

  ensureDefaultMethods: async (tenantId: string) => {
    const rows = await crud.getAllByTenant(tenantId);
    const groupedByCode = rows.reduce<Map<string, PaymentMethod[]>>((acc, row) => {
      const code = normalizePaymentMethodCode(row.code);
      const group = acc.get(code) ?? [];
      group.push(row);
      acc.set(code, group);
      return acc;
    }, new Map());

    const touched: PaymentMethod[] = [];
    const inactivePatches: Promise<PaymentMethod | null>[] = [];

    for (const code of paymentMethodSystemOrder) {
      const template = getTemplateForCode(code);
      const group = sortRowsByPriority(groupedByCode.get(code) ?? []);
      const preferred = group[0] ?? null;

      if (!preferred) {
        try {
          const created = await crud.create(tenantId, buildSystemCreateInput(code));
          touched.push(created);
        } catch (error) {
          if (!isUniqueConflictError(error)) throw error;
        }
      } else {
        const currentConfig = getPaymentMethodPosConfigFromNotes(code, preferred.notes);
        const baseNotes = normalizeText(
          getPaymentMethodBaseNotes(preferred.notes) ?? template.default_note
        );
        const expectedNotes = composePaymentMethodNotes(code, baseNotes, currentConfig);

        const payload: UpdatePaymentMethodInput = {};
        if (preferred.name !== template.name) payload.name = template.name;
        if (preferred.code !== template.code) payload.code = template.code;
        if (preferred.type !== template.type) payload.type = template.type;
        if (preferred.affects_cash !== template.affects_cash) {
          payload.affects_cash = template.affects_cash;
        }
        if (preferred.notes !== expectedNotes) payload.notes = expectedNotes;

        if (Object.keys(payload).length > 0) {
          const updated = await crud.update(tenantId, preferred.id, payload);
          if (updated) touched.push(updated);
        }

        for (const duplicate of group.slice(1)) {
          if (!duplicate.is_active) continue;
          inactivePatches.push(
            crud.update(tenantId, duplicate.id, {
              is_active: false,
            })
          );
        }
      }
    }

    for (const row of rows) {
      const code = normalizePaymentMethodCode(row.code);
      if (isSystemPaymentMethodCode(code)) continue;
      if (!row.is_active) continue;
      inactivePatches.push(
        crud.update(tenantId, row.id, {
          is_active: false,
        })
      );
    }

    if (inactivePatches.length) {
      await Promise.allSettled(inactivePatches);
    }

    return touched;
  },

  toggleActive: async (tenantId: string, id: string) => {
    const paymentMethod = await crud.getById(tenantId, id);
    if (!paymentMethod) return null;

    const code = normalizePaymentMethodCode(paymentMethod.code);
    if (!isSystemPaymentMethodCode(code)) {
      throw new Error("Solo se pueden activar/desactivar medios de pago del sistema.");
    }

    return crud.update(tenantId, id, {
      is_active: !paymentMethod.is_active,
    });
  },
};
