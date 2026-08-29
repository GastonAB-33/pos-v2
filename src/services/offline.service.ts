import { auditService } from "@/services/audit.service";
import { cashService } from "@/services/cash.service";
import { currentAccountsService } from "@/services/current-accounts.service";
import { productsService } from "@/services/products.service";
import { receiptsService } from "@/services/receipts.service";
import { salesService } from "@/services/sales.service";
import { stockService } from "@/services/stock.service";
import { offlineDatabase, type OfflineDatabaseState } from "@/services/offline-database.service";
import type {
  ArcaSettings,
  BankAccount,
  BarcodeScaleSettings,
  CashSession,
  Customer,
  InstallmentPlan,
  MercadoPagoSettings,
  OriginBank,
  PaymentMethod,
  PosSettings,
  PriceList,
  Product,
  ProductBarcode,
} from "@/types/entities";
import type { PromotionWithDetails } from "@/services/promotions.service";
import type { CashMovementType, PaymentMethodType, Sale } from "@/types/entities";
import { storageKeys } from "@/utils/local-storage";

export type PendingStatus = "pending_sync";

export interface PendingSaleItemInput {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  discount_total: number;
  metadata: Record<string, unknown> | null;
}

export interface PendingSaleTotalsInput {
  subtotal_before_promotions: number;
  product_promotion_discount_total: number;
  cart_promotion_discount_total: number;
  subtotal_after_promotions: number;
  surcharge_total: number;
  payment_discount_total: number;
  payment_adjustment: number;
  total: number;
}

export interface PendingSalePaymentMethodSnapshot {
  id: string;
  code: string;
  name: string;
  type: PaymentMethodType;
  affects_cash: boolean;
  surcharge_percent: number;
  discount_percent: number;
}

export interface SavePendingSaleInput {
  tenant_id: string;
  created_by: string | null;
  sale_number: string;
  customer_id: string | null;
  currency_code: string;
  notes: string | null;
  allow_negative_stock: boolean;
  items: PendingSaleItemInput[];
  totals: PendingSaleTotalsInput;
  payment_method: PendingSalePaymentMethodSnapshot;
  payment_details: Record<string, unknown> | null;
}

export interface PendingSaleRecord extends SavePendingSaleInput {
  local_id: string;
  status: PendingStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavePendingCashMovementInput {
  tenant_id: string;
  created_by: string | null;
  cash_session_id: string | null;
  movement_type: CashMovementType;
  amount: number;
  currency_code: string;
  reference_type: string;
  reference_id: string | null;
  source_local_sale_id: string | null;
  notes: string | null;
}

export interface PendingCashMovementRecord extends SavePendingCashMovementInput {
  local_id: string;
  status: PendingStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingCounts {
  sales: number;
  cashMovements: number;
}

export interface SyncSummary {
  processed: number;
  synced: number;
  failed: number;
  errors: string[];
}

export interface OfflineSyncMeta {
  tenant_id: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  last_synced_operations: number;
  updated_at: string;
}

export interface PosOfflineSnapshot {
  tenant_id: string;
  saved_at: string;
  products: Product[];
  product_barcodes: ProductBarcode[];
  customers: Customer[];
  payment_methods: PaymentMethod[];
  bank_accounts: BankAccount[];
  origin_banks: OriginBank[];
  installment_plans: InstallmentPlan[];
  price_lists: PriceList[];
  promotions: PromotionWithDetails[];
  pos_settings: PosSettings;
  scale_settings: BarcodeScaleSettings;
  mercado_pago_settings: MercadoPagoSettings;
  arca_settings: ArcaSettings;
  require_open_session_for_sale: boolean;
  default_invoice_document_type: "A" | "B" | "C" | "PRESUPUESTO";
  open_cash_session: CashSession | null;
}

const roundQty = (value: number): number => Number(value.toFixed(3));
const roundAmount = (value: number): number => Number(value.toFixed(2));

const nowIso = (): string => new Date().toISOString();

const generateLocalId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getSafeLocalStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

let memoryState: OfflineDatabaseState = offlineDatabase.emptyState();
let hydrated = false;
let persistTimer: number | null = null;

const legacyState = (): OfflineDatabaseState => ({
  pendingSales: readLegacyQueue<PendingSaleRecord>(storageKeys.pendingSales),
  pendingCashMovements: readLegacyQueue<PendingCashMovementRecord>(storageKeys.pendingCashMovements),
  syncMeta: readLegacyQueue<OfflineSyncMeta>(storageKeys.offlineSyncMeta),
  posSnapshots: [],
});

const schedulePersist = (): void => {
  if (typeof window === "undefined") return;
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void offlineDatabase.write(memoryState).catch(() => undefined);
  }, 0);
};

const readLegacyQueue = <T>(key: string): T[] => {
  const storage = getSafeLocalStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const saleOfflineMarker = (localId: string): string => `[offline:${localId}]`;
const cashOfflineMarker = (localId: string): string => `[offline-cash:${localId}]`;

const withAttemptsError = <T extends { attempts: number; last_error: string | null; updated_at: string }>(
  row: T,
  message: string
): T => ({
  ...row,
  attempts: row.attempts + 1,
  last_error: message,
  updated_at: nowIso(),
});

const appendMarkerToNotes = (notes: string | null | undefined, marker: string): string => {
  const clean = (notes ?? "").trim();
  if (!clean) return marker;
  if (clean.includes(marker)) return clean;
  return `${clean} | ${marker}`;
};

const getAllPendingSales = (): PendingSaleRecord[] => memoryState.pendingSales as PendingSaleRecord[];
const getAllPendingCashMovements = (): PendingCashMovementRecord[] =>
  memoryState.pendingCashMovements as PendingCashMovementRecord[];
const getAllSyncMeta = (): OfflineSyncMeta[] => memoryState.syncMeta as OfflineSyncMeta[];

const replacePendingSalesForTenant = (
  tenantId: string,
  nextTenantRows: PendingSaleRecord[]
): void => {
  const otherTenants = getAllPendingSales().filter((row) => row.tenant_id !== tenantId);
  memoryState = { ...memoryState, pendingSales: [...otherTenants, ...nextTenantRows] };
  schedulePersist();
};

const replacePendingCashMovementsForTenant = (
  tenantId: string,
  nextTenantRows: PendingCashMovementRecord[]
): void => {
  const otherTenants = getAllPendingCashMovements().filter((row) => row.tenant_id !== tenantId);
  memoryState = { ...memoryState, pendingCashMovements: [...otherTenants, ...nextTenantRows] };
  schedulePersist();
};

const upsertSyncMeta = (
  tenantId: string,
  patch: Partial<Omit<OfflineSyncMeta, "tenant_id" | "updated_at">>
): OfflineSyncMeta => {
  const allRows = getAllSyncMeta();
  const existing = allRows.find((row) => row.tenant_id === tenantId);
  const nextRow: OfflineSyncMeta = {
    tenant_id: tenantId,
    last_attempt_at: existing?.last_attempt_at ?? null,
    last_success_at: existing?.last_success_at ?? null,
    last_error: existing?.last_error ?? null,
    last_synced_operations: existing?.last_synced_operations ?? 0,
    ...patch,
    updated_at: nowIso(),
  };

  const nextRows = allRows.filter((row) => row.tenant_id !== tenantId);
  nextRows.push(nextRow);
  memoryState = { ...memoryState, syncMeta: nextRows };
  schedulePersist();
  return nextRow;
};

const clearSyncMeta = (tenantId?: string | null): void => {
  if (!tenantId) {
    memoryState = { ...memoryState, syncMeta: [] };
    schedulePersist();
    return;
  }

  memoryState = { ...memoryState, syncMeta: getAllSyncMeta().filter((row) => row.tenant_id !== tenantId) };
  schedulePersist();
};

const linkPendingCashMovementsToSale = (
  tenantId: string,
  sourceLocalSaleId: string,
  saleId: string
): number => {
  const rows = getAllPendingCashMovements();
  let linked = 0;

  const nextRows = rows.map((row) => {
    if (row.tenant_id !== tenantId) return row;
    if (row.source_local_sale_id !== sourceLocalSaleId) return row;
    if (row.reference_id) return row;

    linked += 1;
    return {
      ...row,
      reference_id: saleId,
      updated_at: nowIso(),
      last_error: null,
    } satisfies PendingCashMovementRecord;
  });

  memoryState = { ...memoryState, pendingCashMovements: nextRows };
  schedulePersist();
  return linked;
};

const savePendingCashMovementInternal = (
  input: SavePendingCashMovementInput
): PendingCashMovementRecord => {
  const now = nowIso();
  const row: PendingCashMovementRecord = {
    ...input,
    local_id: generateLocalId("pcash"),
    status: "pending_sync",
    attempts: 0,
    last_error: null,
    created_at: now,
    updated_at: now,
  };

  memoryState = { ...memoryState, pendingCashMovements: [...getAllPendingCashMovements(), row] };
  schedulePersist();
  return row;
};

const syncPendingSaleRecord = async (record: PendingSaleRecord): Promise<Sale> => {
  const marker = saleOfflineMarker(record.local_id);
  const openSession = record.payment_method.affects_cash
    ? record.created_by
      ? await cashService.getOpenSessionByUser(record.tenant_id, record.created_by)
      : await cashService.getOpenSession(record.tenant_id)
    : null;

  const sale = await salesService.create(record.tenant_id, {
    sale_number: record.sale_number,
    customer_id: record.customer_id,
    cash_session_id: record.payment_method.affects_cash ? openSession?.id ?? null : null,
    status: "completed",
    subtotal: roundAmount(record.totals.subtotal_after_promotions),
    discount_total: roundAmount(
      record.totals.product_promotion_discount_total +
        record.totals.cart_promotion_discount_total +
        record.totals.payment_discount_total
    ),
    tax_total: 0,
    total: roundAmount(record.totals.total),
    currency_code: record.currency_code,
    notes: appendMarkerToNotes(record.notes, marker),
    current_account_id: null,
    arca_document_id: null,
    mercado_pago_preference_id: null,
    items: [],
    payments: [],
    customer: null,
  });

  for (const item of record.items) {
    const isManualSaleItem =
      item.metadata?.is_manual_sale_item === true || item.product_id.startsWith("manual-");

    if (isManualSaleItem) {
      await salesService.createItem(record.tenant_id, {
        sale_id: sale.id,
        product_id: item.product_id,
        product_name_snapshot: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_total: roundAmount(item.discount_total),
        tax_total: 0,
        line_total: roundAmount(item.line_total),
        metadata: {
          ...(item.metadata ?? {}),
          offline_sync: {
            local_sale_id: record.local_id,
            synced_at: nowIso(),
          },
        },
      });
      continue;
    }

    const product = await productsService.getById(record.tenant_id, item.product_id);
    if (!product) {
      throw new Error(`Producto inexistente durante sync: ${item.name}`);
    }

    const nextStock = roundQty(product.stock_current - item.quantity);
    if (!record.allow_negative_stock && nextStock < 0) {
      throw new Error(`Stock insuficiente al sincronizar: ${item.name}`);
    }

    await salesService.createItem(record.tenant_id, {
      sale_id: sale.id,
      product_id: item.product_id,
      product_name_snapshot: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_total: roundAmount(item.discount_total),
      tax_total: 0,
      line_total: roundAmount(item.line_total),
      metadata: {
        ...(item.metadata ?? {}),
        offline_sync: {
          local_sale_id: record.local_id,
          synced_at: nowIso(),
        },
      },
    });

    await stockService.create(record.tenant_id, {
      product_id: item.product_id,
      movement_type: "sale",
      quantity: item.quantity,
      reference_type: "sale",
      reference_id: sale.id,
      notes: `Sync offline ${sale.sale_number}`,
      created_by: record.created_by,
    });

    await productsService.update(record.tenant_id, item.product_id, {
      stock_current: record.allow_negative_stock ? nextStock : Math.max(0, nextStock),
    });
  }

  const isMercadoPagoManual =
    record.payment_method.type === "mercado_pago" &&
    record.payment_details &&
    record.payment_details.kind === "mercado_pago_manual";

  await salesService.createPayment(record.tenant_id, {
    sale_id: sale.id,
    payment_method_code: record.payment_method.code,
    provider: record.payment_method.type === "mercado_pago" ? "mercado_pago" : "internal",
    provider_code:
      record.payment_method.type === "mercado_pago"
        ? isMercadoPagoManual
          ? "mercado_pago_manual"
          : "mercado_pago"
        : "internal",
    amount: roundAmount(record.totals.total),
    currency_code: record.currency_code,
    status: record.payment_method.type === "current_account" ? "pending" : "approved",
    provider_status:
      record.payment_method.type === "current_account" ? "pending" : "approved",
    provider_reference:
      isMercadoPagoManual && typeof record.payment_details?.operation_id === "string"
        ? record.payment_details.operation_id
        : null,
    provider_metadata:
      record.payment_method.type === "mercado_pago"
        ? ({
            mode: isMercadoPagoManual ? "manual" : "offline_sync",
          } as Record<string, unknown>)
        : null,
    external_reference:
      isMercadoPagoManual && typeof record.payment_details?.operation_id === "string"
        ? record.payment_details.operation_id
        : null,
    metadata: {
      payment_method_snapshot: {
        ...record.payment_method,
      },
      payment_details: record.payment_details ?? null,
      payment_captured_at:
        typeof record.payment_details?.captured_at === "string"
          ? record.payment_details.captured_at
          : nowIso(),
      totals_snapshot: {
        ...record.totals,
      },
      offline_sync: {
        local_sale_id: record.local_id,
      },
    },
  });

  if (record.payment_method.type === "current_account") {
    if (!record.customer_id) {
      throw new Error("Venta offline en cuenta corriente sin cliente");
    }

    await currentAccountsService.createMovement(record.tenant_id, {
      customer_id: record.customer_id,
      sale_id: sale.id,
      type: "debt",
      amount: roundAmount(record.totals.total),
      notes: `Sync offline ${sale.sale_number}`,
      created_by: record.created_by,
    });
  }

  await receiptsService.create(record.tenant_id, {
    sale_id: sale.id,
    sale_number: sale.sale_number,
    receipt_number: `TCK-SYNC-${Date.now()}`,
    issued_at: nowIso(),
    customer_name: null,
    payment_method: record.payment_method.type,
    items: record.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: roundAmount(item.quantity > 0 ? item.line_total / item.quantity : item.unit_price),
      subtotal: roundAmount(item.line_total),
    })),
    total: roundAmount(record.totals.total),
    notes: appendMarkerToNotes(record.notes, marker),
    created_by: record.created_by,
  });

  const linkedCount = linkPendingCashMovementsToSale(record.tenant_id, record.local_id, sale.id);
  if (record.payment_method.affects_cash && linkedCount === 0) {
    savePendingCashMovementInternal({
      tenant_id: record.tenant_id,
      created_by: record.created_by,
      cash_session_id: openSession?.id ?? null,
      movement_type: "sale_payment",
      amount: roundAmount(record.totals.total),
      currency_code: record.currency_code,
      reference_type: record.payment_method.code,
      reference_id: sale.id,
      source_local_sale_id: record.local_id,
      notes: `Cobro sync ${sale.sale_number} - ${record.payment_method.name}`,
    });
  }

  await auditService.createSafe(record.tenant_id, {
    user_id: record.created_by,
    module: "pos",
    action: "sale_sync",
    entity_type: "sale",
    entity_id: sale.id,
    description: `Venta sincronizada desde offline: ${sale.sale_number}`,
    metadata: {
      local_sale_id: record.local_id,
      total: sale.total,
      payment_method_code: record.payment_method.code,
    },
  });

  return sale;
};

export const offlineService = {
  hydrate: async (): Promise<void> => {
    if (hydrated) return;
    try {
      const saved = await offlineDatabase.read();
      memoryState = saved ?? legacyState();
      if (!saved) schedulePersist();
    } catch {
      memoryState = legacyState();
    } finally {
      hydrated = true;
    }
  },

  isOnline: (): boolean => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  },

  savePendingSale: (input: SavePendingSaleInput): PendingSaleRecord => {
    const now = nowIso();
    const row: PendingSaleRecord = {
      ...input,
      local_id: generateLocalId("psale"),
      status: "pending_sync",
      attempts: 0,
      last_error: null,
      created_at: now,
      updated_at: now,
    };

    memoryState = { ...memoryState, pendingSales: [...getAllPendingSales(), row] };
    schedulePersist();
    return row;
  },

  getPendingSales: (tenantId?: string | null): PendingSaleRecord[] => {
    const rows = getAllPendingSales();
    if (!tenantId) return rows;
    return rows.filter((row) => row.tenant_id === tenantId);
  },

  savePendingCashMovement: (input: SavePendingCashMovementInput): PendingCashMovementRecord =>
    savePendingCashMovementInternal(input),

  getPendingCashMovements: (tenantId?: string | null): PendingCashMovementRecord[] => {
    const rows = getAllPendingCashMovements();
    if (!tenantId) return rows;
    return rows.filter((row) => row.tenant_id === tenantId);
  },

  getPendingCounts: (tenantId?: string | null): PendingCounts => ({
    sales: offlineService.getPendingSales(tenantId).length,
    cashMovements: offlineService.getPendingCashMovements(tenantId).length,
  }),

  getSyncMeta: (tenantId: string): OfflineSyncMeta | null =>
    getAllSyncMeta().find((row) => row.tenant_id === tenantId) ?? null,

  setSyncMeta: (
    tenantId: string,
    patch: Partial<Omit<OfflineSyncMeta, "tenant_id" | "updated_at">>
  ): OfflineSyncMeta => upsertSyncMeta(tenantId, patch),

  clearPendingById: (queue: "sales" | "cash_movements", localId: string): void => {
    if (queue === "sales") {
      memoryState = { ...memoryState, pendingSales: getAllPendingSales().filter((row) => row.local_id !== localId) };
      schedulePersist();
      return;
    }

    memoryState = { ...memoryState, pendingCashMovements: getAllPendingCashMovements().filter((row) => row.local_id !== localId) };
    schedulePersist();
  },

  clearAllPending: (tenantId?: string | null): void => {
    if (!tenantId) {
      memoryState = { ...memoryState, pendingSales: [], pendingCashMovements: [] };
      schedulePersist();
      clearSyncMeta();
      return;
    }

    memoryState = {
      ...memoryState,
      pendingSales: getAllPendingSales().filter((row) => row.tenant_id !== tenantId),
      pendingCashMovements: getAllPendingCashMovements().filter((row) => row.tenant_id !== tenantId),
    };
    schedulePersist();
    clearSyncMeta(tenantId);
  },

  syncPendingSales: async (tenantId: string): Promise<SyncSummary> => {
    const summary: SyncSummary = {
      processed: 0,
      synced: 0,
      failed: 0,
      errors: [],
    };

    const tenantRows = offlineService.getPendingSales(tenantId);
    if (!tenantRows.length) return summary;

    const existingSales = await salesService.getAllByTenant(tenantId);
    const remainingRows: PendingSaleRecord[] = [];

    for (const row of tenantRows) {
      summary.processed += 1;

      try {
        const marker = saleOfflineMarker(row.local_id);
        const existing = existingSales.find((sale) => (sale.notes ?? "").includes(marker));

        if (existing) {
          const [existingItems, existingPayments] = await Promise.all([
            salesService.getItemsBySaleId(tenantId, existing.id),
            salesService.getPaymentsBySaleId(tenantId, existing.id),
          ]);
          if (existingItems.length < row.items.length || existingPayments.length === 0) {
            throw new Error(
              `La venta ${row.sale_number} quedo incompleta durante una sincronizacion anterior. Requiere revision antes de reintentar.`
            );
          }
          linkPendingCashMovementsToSale(tenantId, row.local_id, existing.id);
          summary.synced += 1;
          continue;
        }

        const syncedSale = await syncPendingSaleRecord(row);
        existingSales.push(syncedSale);
        summary.synced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido al sincronizar venta";
        summary.failed += 1;
        summary.errors.push(message);
        remainingRows.push(withAttemptsError(row, message));
      }
    }

    replacePendingSalesForTenant(tenantId, remainingRows);
    return summary;
  },

  syncPendingCashMovements: async (tenantId: string): Promise<SyncSummary> => {
    const summary: SyncSummary = {
      processed: 0,
      synced: 0,
      failed: 0,
      errors: [],
    };

    const tenantRows = offlineService.getPendingCashMovements(tenantId);
    if (!tenantRows.length) return summary;

    const existingMovements = await cashService.getAllMovementsByTenant(tenantId);
    const remainingRows: PendingCashMovementRecord[] = [];

    for (const row of tenantRows) {
      summary.processed += 1;

      try {
        const marker = cashOfflineMarker(row.local_id);
        const alreadySynced = existingMovements.find((movement) => (movement.notes ?? "").includes(marker));
        if (alreadySynced) {
          summary.synced += 1;
          continue;
        }

        if (!row.reference_id) {
          const message = "Movimiento de caja pendiente de venta sincronizada";
          summary.failed += 1;
          summary.errors.push(message);
          remainingRows.push(withAttemptsError(row, message));
          continue;
        }

        const resolvedSessionId =
          row.cash_session_id ??
          (row.created_by
            ? (await cashService.getOpenSessionByUser(tenantId, row.created_by))?.id
            : (await cashService.getOpenSession(tenantId))?.id) ??
          null;

        if (!resolvedSessionId) {
          const message = "No hay caja abierta para sincronizar el movimiento";
          summary.failed += 1;
          summary.errors.push(message);
          remainingRows.push(withAttemptsError(row, message));
          continue;
        }

        const movement = await cashService.createMovement(tenantId, {
          cash_session_id: resolvedSessionId,
          movement_type: row.movement_type,
          amount: roundAmount(row.amount),
          currency_code: row.currency_code,
          reference_type: row.reference_type,
          reference_id: row.reference_id,
          notes: appendMarkerToNotes(row.notes, marker),
          created_by: row.created_by,
        });

        existingMovements.push(movement);

        await auditService.createSafe(tenantId, {
          user_id: row.created_by,
          module: "caja",
          action: "cash_movement_sync",
          entity_type: "cash_movement",
          entity_id: movement.id,
          description: `Movimiento de caja sincronizado desde offline (${row.reference_type})`,
          metadata: {
            local_cash_movement_id: row.local_id,
            source_local_sale_id: row.source_local_sale_id,
            amount: row.amount,
          },
        });

        summary.synced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido al sincronizar caja";
        summary.failed += 1;
        summary.errors.push(message);
        remainingRows.push(withAttemptsError(row, message));
      }
    }

    replacePendingCashMovementsForTenant(tenantId, remainingRows);
    return summary;
  },

  savePosSnapshot: (snapshot: PosOfflineSnapshot): void => {
    const remaining = (memoryState.posSnapshots as PosOfflineSnapshot[]).filter(
      (row) => row.tenant_id !== snapshot.tenant_id
    );
    memoryState = { ...memoryState, posSnapshots: [...remaining, snapshot] };
    schedulePersist();
  },

  getPosSnapshot: (tenantId: string): PosOfflineSnapshot | null =>
    ((memoryState.posSnapshots as PosOfflineSnapshot[]).find((row) => row.tenant_id === tenantId) ?? null),

  updateCachedCashSession: (tenantId: string, session: CashSession | null): void => {
    const current = offlineService.getPosSnapshot(tenantId);
    if (!current) return;
    offlineService.savePosSnapshot({ ...current, open_cash_session: session, saved_at: nowIso() });
  },
};
