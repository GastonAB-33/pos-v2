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
  isLoading: false,
  isBackgroundRefreshing: false,
  error: null,

  clearCache: () => {
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
      isLoading: false,
      isBackgroundRefreshing: false,
      error: null,
    });
  },

  loadCashData: async (tenantId: string, force = false) => {
    if (!tenantId) {
      get().clearCache();
      return;
    }

    const state = get();
    const isSameTenant = state.loadedTenantId === tenantId;
    const hasData = state.sessions.length > 0 || state.movements.length > 0;

    // Si ya tenemos datos del mismo comercio en memoria y no es forzado:
    // mostramos los datos inmediatamente (0ms) y sincronizamos en segundo plano
    if (isSameTenant && hasData && !force) {
      set({ isBackgroundRefreshing: true });
    } else {
      set({ isLoading: true, error: null });
    }

    try {
      const [
        allSessions,
        allMovements,
        tenantSettings,
        allUsers,
        allPaymentMethods,
        allCurrentAccountMovements,
        allCustomers,
        allSales,
        allBankAccounts,
        allSalePayments,
        allInvoices,
      ] = await Promise.all([
        cashService.getAllByTenant(tenantId),
        cashService.getAllMovementsByTenant(tenantId),
        settingsService.getByTenant(tenantId),
        usersService.getAllByTenant(tenantId),
        paymentMethodsService.getAllByTenant(tenantId),
        currentAccountsService.getAllByTenant(tenantId),
        customersService.getAllByTenant(tenantId),
        salesService.getAllByTenant(tenantId),
        bankAccountsService.getActiveByTenant(tenantId).catch(() => []),
        salesService.getAllPaymentsByTenant(tenantId).catch(() => []),
        invoicesService.getAllByTenant(tenantId).catch(() => []),
      ]);

      const sortedSessions = allSessions.sort((a, b) => b.opened_at.localeCompare(a.opened_at));
      const sortedMovements = allMovements.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const sortedCurrentAccountMovements = allCurrentAccountMovements.sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );

      const customersMap = allCustomers.reduce<Record<string, Customer>>((acc, customer) => {
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
    }
  },
}));
