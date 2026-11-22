import { create } from "zustand";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { cashService } from "@/services/cash.service";
import { currentAccountsService } from "@/services/current-accounts.service";
import { customersService } from "@/services/customers.service";
import { paymentMethodsService } from "@/services/payment-methods.service";
import { salesService } from "@/services/sales.service";
import { settingsService } from "@/services/settings.service";
import { usersService } from "@/services/users.service";
import { invoicesService } from "@/services/invoices.service";
import type {
  BankAccount,
  CashMovement,
  CashSession,
  CashSettings,
  CurrentAccountMovement,
  Customer,
  PaymentMethod,
  Sale,
  SalePayment,
  Invoice,
} from "@/types/entities";

// TTL de frescura de caché: 45 segundos para evitar egreso innecesario hacia Supabase
const CASH_CACHE_TTL_MS = 45_000;

// Candado en vuelo para deduplicar peticiones concurrentes
let activeLoadPromise: { tenantId: string; isForced: boolean; promise: Promise<void> } | null = null;

const normalizeKey = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase();

export const defaultCashSettings: CashSettings = {
  require_open_session_for_sale: false,
  default_opening_amount: 0,
  allow_manual_movements: true,
  require_notes_on_manual_movements: false,
  blind_cash_closing: false,
  cash_reconciliation_mode: "cash_only",
};

interface CashStoreState {
  sessions: CashSession[];
  movements: CashMovement[];
  currentAccountMovements: CurrentAccountMovement[];
  customersById: Record<string, Customer>;
  paymentMethods: PaymentMethod[];
  paymentMethodsByCode: Record<string, string>;
  bankAccounts: BankAccount[];
  salePayments: SalePayment[];
  salesById: Record<string, Sale>;
  invoicesBySaleId: Record<string, Invoice[]>;
  usersById: Record<string, string>;
  cashSettings: CashSettings;
  loadedTenantId: string | null;
  lastLoadedAt: number | null;
  isLoading: boolean;
  isBackgroundRefreshing: boolean;
  error: string | null;

  loadCashData: (tenantId: string, force?: boolean) => Promise<void>;
  clearCache: () => void;
}

export const useCashStore = create<CashStoreState>()((set, get) => ({
  sessions: [],
  movements: [],
  currentAccountMovements: [],
  customersById: {},
  paymentMethods: [],
  paymentMethodsByCode: {},
  bankAccounts: [],
  salePayments: [],
  salesById: {},
  invoicesBySaleId: {},
  usersById: {},
  cashSettings: defaultCashSettings,
  loadedTenantId: null,
  lastLoadedAt: null,
  isLoading: true,
  isBackgroundRefreshing: false,
  error: null,

  clearCache: () => {
    activeLoadPromise = null;
    set({
      sessions: [],
      movements: [],
      currentAccountMovements: [],
      customersById: {},
      invoicesBySaleId: {},
      paymentMethods: [],
      paymentMethodsByCode: {},
      bankAccounts: [],
      salePayments: [],
      salesById: {},
      usersById: {},
      cashSettings: defaultCashSettings,
      loadedTenantId: null,
      lastLoadedAt: null,
      isLoading: true,
      isBackgroundRefreshing: false,
      error: null,
    });
  },

  loadCashData: async (tenantId: string, force = false): Promise<void> => {
    if (!tenantId) {
      get().clearCache();
      return;
    }

    // 1. Deduplicación de peticiones en vuelo:
    // Si ya hay una consulta en curso para el mismo comercio, la reutilizamos para no duplicar egress
    if (activeLoadPromise && activeLoadPromise.tenantId === tenantId) {
      if (!force || activeLoadPromise.isForced) {
        return activeLoadPromise.promise;
      }
      // Si la llamada es forzada (ej. mutación/cierre de caja), esperamos a que termine la anterior para ejecutar la forzada limpia
      try {
        await activeLoadPromise.promise;
      } catch {
        // Ignorar error previo para continuar con la carga forzada
      }
    }

    const state = get();
    const isSameTenant = state.loadedTenantId === tenantId;
    const hasData = state.sessions.length > 0 || state.movements.length > 0;
    const isFresh = Boolean(
      state.lastLoadedAt && Date.now() - state.lastLoadedAt < CASH_CACHE_TTL_MS
    );

    // 2. Control de frescura: si ya tenemos datos del mismo comercio en memoria, son frescos y no es forzado, no hacemos egress
    if (isSameTenant && hasData && isFresh && !force) {
      return;
    }

    // 3. Indicador de carga: background refresh si ya hay datos, isLoading si no hay datos o es forzado
    if (isSameTenant && hasData && !force) {
      set({ isBackgroundRefreshing: true });
    } else {
      set({ isLoading: true, error: null });
    }

    let currentPromise: Promise<void> | null = null;

    currentPromise = (async () => {
      try {
        // Optimizacion radical de egress: Cargar solo jornadas recientes y catalogos
        const [
          recentSessions,
          tenantSettings,
          allUsers,
          allPaymentMethods,
          allBankAccounts,
          recentCurrentAccountMovements,
        ] = await Promise.all([
          cashService.getRecentSessions(tenantId, 60),
          settingsService.getByTenant(tenantId),
          usersService.getAllByTenant(tenantId),
          paymentMethodsService.getAllByTenant(tenantId),
          bankAccountsService.getActiveByTenant(tenantId).catch(() => []),
          currentAccountsService.getRecentByTenant(tenantId, 200).catch(() => []),
        ]);

        const sessionIds = recentSessions.map((s) => s.id);

        // Cargar movimientos indexados unicamente de las jornadas activas/recientes
        const allMovements = sessionIds.length
          ? await cashService.getMovementsBySessionIds(tenantId, sessionIds)
          : [];

        // Identificar ventas referenciadas en los movimientos de caja para no escanear toda la tabla de ventas
        const saleIds = Array.from(
          new Set([
            ...allMovements
              .filter(
                (m) =>
                  m.reference_id &&
                  (m.movement_type === "sale_payment" ||
                    m.reference_type === "sale" ||
                    m.reference_type === "transfer" ||
                    m.reference_type === "card")
              )
              .map((m) => m.reference_id as string),
            ...recentCurrentAccountMovements.map((m) => m.sale_id).filter(Boolean) as string[],
          ])
        );

        // Cargar unicamente los clientes referenciados en los movimientos recientes para evitar descargar toda la tabla
        const referencedCustomerIds = Array.from(
          new Set(recentCurrentAccountMovements.map((m) => m.customer_id).filter(Boolean))
        ) as string[];

        const [allSales, allSalePayments, allInvoices, relevantCustomers] = await Promise.all([
          saleIds.length ? salesService.getByIds(tenantId, saleIds).catch(() => []) : [],
          saleIds.length ? salesService.getPaymentsBySaleIds(tenantId, saleIds).catch(() => []) : [],
          saleIds.length ? invoicesService.getBySaleIds(tenantId, saleIds).catch(() => []) : [],
          referencedCustomerIds.length
            ? customersService.getByIds(tenantId, referencedCustomerIds).catch(() => [])
            : [],
        ]);

        const sortedSessions = recentSessions.sort((a, b) => b.opened_at.localeCompare(a.opened_at));
        const sortedMovements = allMovements.sort((a, b) => b.created_at.localeCompare(a.created_at));
        const sortedCurrentAccountMovements = recentCurrentAccountMovements.sort((a, b) =>
          b.created_at.localeCompare(a.created_at)
        );

        const customersMap = relevantCustomers.reduce<Record<string, Customer>>((acc, customer) => {
          acc[customer.id] = customer;
          return acc;
        }, {});

        const paymentMethodsMap = allPaymentMethods.reduce<Record<string, string>>((acc, method) => {
          const key = normalizeKey(method.code);
          if (!key) return acc;
          acc[key] = method.name;
          return acc;
        }, {});

        const salesMap = allSales.reduce<Record<string, Sale>>((acc, sale) => {
          acc[sale.id] = sale;
          return acc;
        }, {});

        const invoicesMap = (allInvoices ?? []).reduce<Record<string, Invoice[]>>((acc, inv) => {
          if (inv.sale_id) {
            if (!acc[inv.sale_id]) acc[inv.sale_id] = [];
            acc[inv.sale_id].push(inv);
          }
          return acc;
        }, {});

        const usersMap = allUsers.reduce<Record<string, string>>((acc, user) => {
          const fullName = user.full_name?.trim() ?? "";
          if (fullName) {
            acc[user.id] = fullName;
            return acc;
          }
          const fallback = user.email?.trim() || user.username?.trim() || user.id;
          acc[user.id] = fallback;
          return acc;
        }, {});

        set({
          sessions: sortedSessions,
          movements: sortedMovements,
          currentAccountMovements: sortedCurrentAccountMovements,
          customersById: customersMap,
          paymentMethods: allPaymentMethods,
          paymentMethodsByCode: paymentMethodsMap,
          bankAccounts: allBankAccounts,
          salePayments: allSalePayments,
          salesById: salesMap,
          invoicesBySaleId: invoicesMap,
          usersById: usersMap,
          cashSettings: tenantSettings.caja ?? defaultCashSettings,
          loadedTenantId: tenantId,
          lastLoadedAt: Date.now(),
          isLoading: false,
          isBackgroundRefreshing: false,
          error: null,
        });
      } catch (err) {
        console.error("[useCashStore] Error al cargar informacion de caja:", err);
        set({
          isLoading: false,
          isBackgroundRefreshing: false,
          error: "No se pudo cargar informacion de caja",
        });
      } finally {
        if (activeLoadPromise?.promise === currentPromise) {
          activeLoadPromise = null;
        }
      }
    })();

    activeLoadPromise = { tenantId, isForced: force, promise: currentPromise };
    return currentPromise;
  },
}));
