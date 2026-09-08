import { create } from "zustand";
import { priceListsService } from "@/services/price-lists.service";
import { productsService } from "@/services/products.service";
import type { PriceList, Product, ProductBarcode } from "@/types/entities";

const normalizeBarcode = (value: string | null | undefined): string =>
  (value ?? "").trim().replace(/\s+/g, "");

const sortByName = (rows: Product[]): Product[] =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name));

const CACHE_TTL_MS = 60 * 1000; // 60 segundos de frescura antes de revalidación silenciosa

interface ProductsCatalogState {
  products: Product[];
  allBarcodes: ProductBarcode[];
  primaryBarcodes: Record<string, string>;
  priceLists: PriceList[];
  loadedTenantId: string | null;
  lastLoadedAt: number | null;
  isLoading: boolean;
  isBackgroundRefreshing: boolean;
  error: string | null;

  loadCatalog: (tenantId: string, force?: boolean) => Promise<void>;
  upsertProduct: (product: Product) => void;
  removeProduct: (productId: string) => void;
  patchPrimaryBarcode: (productId: string, barcode: string) => void;
  updateProductStock: (productId: string, newStock: number) => void;
  clearCatalog: () => void;
}

export const useProductsStore = create<ProductsCatalogState>((set, get) => ({
  products: [],
  allBarcodes: [],
  primaryBarcodes: {},
  priceLists: [],
  loadedTenantId: null,
  lastLoadedAt: null,
  isLoading: false,
  isBackgroundRefreshing: false,
  error: null,

  loadCatalog: async (tenantId: string, force = false) => {
    if (!tenantId) {
      get().clearCatalog();
      return;
    }

    const state = get();
    const isSameTenant = state.loadedTenantId === tenantId;
    const hasData = state.products.length > 0;
    const isFresh = state.lastLoadedAt && Date.now() - state.lastLoadedAt < CACHE_TTL_MS;

    // Si ya tenemos datos del mismo tenant y no se forzó recarga:
    if (isSameTenant && hasData && !force) {
      if (isFresh) {
        // Datos frescos: carga instantánea en 0ms
        return;
      }
      // Datos existentes pero expiraron los 60s: revalidar silenciosamente en segundo plano sin mostrar spinner
      set({ isBackgroundRefreshing: true });
    } else {
      // Primera carga o cambio de tenant o recarga forzada: mostrar indicador
      set({ isLoading: true, error: null });
    }

    try {
      const [list, barcodeMap, barcodes, lists] = await Promise.all([
        productsService.getAllByTenant(tenantId),
        productsService.getPrimaryBarcodesMapByTenant(tenantId),
        productsService.getBarcodesByTenant(tenantId),
        priceListsService.getAllByTenant(tenantId),
      ]);

      set({
        products: sortByName(list),
        allBarcodes: barcodes,
        primaryBarcodes: barcodeMap,
        priceLists: lists.sort((a, b) => a.name.localeCompare(b.name)),
        loadedTenantId: tenantId,
        lastLoadedAt: Date.now(),
        isLoading: false,
        isBackgroundRefreshing: false,
        error: null,
      });
    } catch {
      set({
        isLoading: false,
        isBackgroundRefreshing: false,
        error: "No se pudieron cargar los productos",
      });
    }
  },

  upsertProduct: (product: Product) => {
    set((state) => {
      const safeProduct = { ...product };
      const withoutCurrent = state.products.filter((item) => item.id !== safeProduct.id);
      return {
        products: sortByName([...withoutCurrent, safeProduct]),
      };
    });
  },

  removeProduct: (productId: string) => {
    set((state) => {
      const nextPrimary = { ...state.primaryBarcodes };
      delete nextPrimary[productId];

      return {
        products: state.products.filter((item) => item.id !== productId),
        primaryBarcodes: nextPrimary,
        allBarcodes: state.allBarcodes.filter((row) => row.product_id !== productId),
      };
    });
  },

  patchPrimaryBarcode: (productId: string, barcodeValue: string) => {
    const normalized = normalizeBarcode(barcodeValue);

    set((state) => {
      const nextPrimary = { ...state.primaryBarcodes };
      if (!normalized) {
        delete nextPrimary[productId];
      } else {
        nextPrimary[productId] = normalized;
      }

      // Actualizar o crear fila en allBarcodes
      const filtered = state.allBarcodes.filter(
        (row) => !(row.product_id === productId && row.is_primary)
      );

      const nextAll = normalized
        ? [
            ...filtered,
            {
              id: `temp-${productId}`,
              tenant_id: state.loadedTenantId ?? "",
              product_id: productId,
              barcode: normalized,
              is_primary: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]
        : filtered;

      return {
        primaryBarcodes: nextPrimary,
        allBarcodes: nextAll,
      };
    });
  },

  updateProductStock: (productId: string, newStock: number) => {
    set((state) => ({
      products: state.products.map((item) =>
        item.id === productId
          ? { ...item, stock_current: newStock, stock: newStock }
          : item
      ),
    }));
  },

  clearCatalog: () => {
    set({
      products: [],
      allBarcodes: [],
      primaryBarcodes: {},
      priceLists: [],
      loadedTenantId: null,
      lastLoadedAt: null,
      isLoading: false,
      isBackgroundRefreshing: false,
      error: null,
    });
  },
}));
