import { create } from "zustand";
import { bankAccountsService } from "@/services/bank-accounts.service";
import { cashService } from "@/services/cash.service";
import { productsService } from "@/services/products.service";
import { purchasesService } from "@/services/purchases.service";
import { suppliersService } from "@/services/suppliers.service";
import { useProductsStore } from "@/features/products/store/products.store";
import type {
  BankAccount,
  CashSession,
  Product,
  ProductBarcode,
  Purchase,
  PurchaseItem,
  Supplier,
} from "@/types/entities";

export type EnrichedPurchase = Purchase & {
  items: (PurchaseItem & { product?: Product | null; sale_price?: number })[];
};

interface PurchasesStoreState {
  products: Product[];
  productBarcodes: ProductBarcode[];
  suppliers: Supplier[];
  purchases: EnrichedPurchase[];
  bankAccounts: BankAccount[];
  openCashSession: CashSession | null;
  loadedTenantId: string | null;
  lastLoadedAt: number | null;
  isLoading: boolean;
  isBackgroundRefreshing: boolean;
  error: string | null;

  loadPurchasesData: (tenantId: string, userId?: string | null, force?: boolean) => Promise<void>;
  clearCache: () => void;
  setSuppliers: (updater: Supplier[] | ((prev: Supplier[]) => Supplier[])) => void;
  setProducts: (updater: Product[] | ((prev: Product[]) => Product[])) => void;
  setProductBarcodes: (updater: ProductBarcode[] | ((prev: ProductBarcode[]) => ProductBarcode[])) => void;
  setPurchases: (updater: EnrichedPurchase[] | ((prev: EnrichedPurchase[]) => EnrichedPurchase[])) => void;
}

export const usePurchasesStore = create<PurchasesStoreState>()((set, get) => ({
  products: [],
  productBarcodes: [],
  suppliers: [],
  purchases: [],
  bankAccounts: [],
  openCashSession: null,
  loadedTenantId: null,
  lastLoadedAt: null,
  isLoading: false,
  isBackgroundRefreshing: false,
  error: null,

  setSuppliers: (updater) => {
    set((state) => ({
      suppliers: typeof updater === "function" ? updater(state.suppliers) : updater,
    }));
  },

  setProducts: (updater) => {
    set((state) => ({
      products: typeof updater === "function" ? updater(state.products) : updater,
    }));
  },

  setProductBarcodes: (updater) => {
    set((state) => ({
      productBarcodes: typeof updater === "function" ? updater(state.productBarcodes) : updater,
    }));
  },

  setPurchases: (updater) => {
    set((state) => ({
      purchases: typeof updater === "function" ? updater(state.purchases) : updater,
    }));
  },

  clearCache: () => {
    set({
      products: [],
      productBarcodes: [],
      suppliers: [],
      purchases: [],
      bankAccounts: [],
      openCashSession: null,
      loadedTenantId: null,
      lastLoadedAt: null,
      isLoading: false,
      isBackgroundRefreshing: false,
      error: null,
    });
  },

  loadPurchasesData: async (tenantId: string, userId?: string | null, force = false) => {
    if (!tenantId) {
      get().clearCache();
      return;
    }

    const state = get();
    const isSameTenant = state.loadedTenantId === tenantId;
    const hasData = state.purchases.length > 0 || state.suppliers.length > 0;

    // Si ya tenemos datos del mismo comercio en memoria y no es forzado:
    // mostramos los datos inmediatamente (0ms) y sincronizamos en segundo plano
    if (isSameTenant && hasData && !force) {
      set({ isBackgroundRefreshing: true });
    } else {
      set({ isLoading: true, error: null });
    }

    // Si el catálogo de productos ya está en useProductsStore, lo aprovechamos de inmediato
    const cachedProductsStore = useProductsStore.getState();
    if (cachedProductsStore.loadedTenantId === tenantId && cachedProductsStore.products.length > 0) {
      set({
        products: cachedProductsStore.products,
        productBarcodes: cachedProductsStore.allBarcodes,
      });
    }

    try {
      const [
        allProducts,
        allProductBarcodes,
        allSuppliers,
        allPurchases,
        allPurchaseItems,
        allBankAccounts,
        activeCashSession,
      ] = await Promise.all([
        productsService.getAllByTenant(tenantId),
        productsService.getBarcodesByTenant(tenantId),
        suppliersService.getAllByTenant(tenantId),
        purchasesService.getAllByTenant(tenantId),
        purchasesService.getAllItemsByTenant(tenantId),
        bankAccountsService.getActiveByTenant(tenantId),
        userId != null
          ? cashService.getOpenSessionByUser(tenantId, userId).then((s) => s ?? cashService.getOpenSession(tenantId))
          : cashService.getOpenSession(tenantId),
      ]);

      const purchaseItemsByPurchaseId = allPurchaseItems.reduce<Map<string, PurchaseItem[]>>(
        (acc, item) => {
          const list = acc.get(item.purchase_id) ?? [];
          list.push(item);
          acc.set(item.purchase_id, list);
          return acc;
        },
        new Map<string, PurchaseItem[]>()
      );

      const productsByIdMap = new Map(allProducts.map((p) => [p.id, p]));

      const enrichedPurchases: EnrichedPurchase[] = allPurchases
        .map((purchase) => ({
          ...purchase,
          items: (purchaseItemsByPurchaseId.get(purchase.id) ?? []).map((item) => {
            const matchedProd = productsByIdMap.get(item.product_id);
            return {
              ...item,
              product: matchedProd ?? null,
              sale_price: matchedProd?.price ?? undefined,
            };
          }),
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      set({
        products: allProducts,
        productBarcodes: allProductBarcodes,
        bankAccounts: allBankAccounts,
        openCashSession: activeCashSession,
        suppliers: allSuppliers.filter((supplier) => supplier.is_active),
        purchases: enrichedPurchases,
        loadedTenantId: tenantId,
        lastLoadedAt: Date.now(),
        isLoading: false,
        isBackgroundRefreshing: false,
        error: null,
      });
    } catch (err) {
      console.error("[usePurchasesStore] Error al cargar datos de compras:", err);
      set({
        isLoading: false,
        isBackgroundRefreshing: false,
        error: "No se pudieron cargar datos de compras",
      });
    }
  },
}));
