import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useProductsStore } from "@/features/products/store/products.store";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { productsService } from "@/services/products.service";
import { salesService } from "@/services/sales.service";
import {
  calculateRecipeFinancials,
  productionService,
  type RecipeFinancialSummary,
  type SaveRecipePayload,
} from "@/services/production.service";
import { formatErrorMessage } from "@/utils/errors";
import type {
  Product,
  ProductionInputMode,
  ProductionOrder,
  Recipe,
  RecipeItem,
  SaleItem,
} from "@/types/entities";

export interface RecipeSalesStats {
  soldUnits: number;
  soldRevenue: number;
  soldProfit: number;
  profitPerSoldUnit: number;
}

export interface EnrichedRecipe {
  recipe: Recipe;
  items: RecipeItem[];
  finishedProduct: Product | undefined;
  financials: RecipeFinancialSummary;
  salesStats: RecipeSalesStats;
}

export const useProductionModule = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((s) => s.user);
  const storeProducts = useProductsStore((s) => s.products);
  const loadedTenantId = useProductsStore((s) => s.loadedTenantId);
  const loadCatalog = useProductsStore((s) => s.loadCatalog);
  const upsertProduct = useProductsStore((s) => s.upsertProduct);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const loadData = useCallback(
    async (options?: { forceCatalog?: boolean; silent?: boolean }) => {
      if (!tenantId) {
        setIsLoading(false);
        return;
      }

      if (!options?.silent && !hasLoadedOnceRef.current) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const needsCatalog =
          options?.forceCatalog ||
          loadedTenantId !== tenantId ||
          useProductsStore.getState().products.length === 0;

        const [recipeList, itemList, orderList] = await Promise.all([
          productionService.getRecipesByTenant(tenantId),
          productionService.getRecipeItemsByTenant(tenantId),
          productionService.getOrdersByTenant(tenantId, 120),
          needsCatalog ? loadCatalog(tenantId, Boolean(options?.forceCatalog)) : Promise.resolve(),
        ]);

        setRecipes(recipeList);
        setRecipeItems(itemList);
        setOrders(orderList);
        hasLoadedOnceRef.current = true;

        // Consultar ventas solo de los productos con receta (liviano y en paralelo en background)
        const recipeProductIds = Array.from(
          new Set(recipeList.map((r) => r.product_id).filter(Boolean))
        );
        if (recipeProductIds.length > 0) {
          salesService
            .getItemsByProductIds(tenantId, recipeProductIds)
            .then((items) => setSaleItems(items))
            .catch(() => {
              // No bloquear el módulo si falla la métrica de ventas
            });
        } else {
          setSaleItems([]);
        }
      } catch (err) {
        setError(formatErrorMessage(err, "No se pudo cargar el módulo de producción"));
      } finally {
        setIsLoading(false);
      }
    },
    [tenantId, loadedTenantId, loadCatalog]
  );

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    void loadData();
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const products = useMemo(
    () => storeProducts.filter((p) => p.is_active !== false),
    [storeProducts]
  );

  const productsById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const recipeProductIdsSet = useMemo(
    () => new Set(recipes.map((r) => r.product_id)),
    [recipes]
  );

  const itemsByRecipeId = useMemo(() => {
    const map = new Map<string, RecipeItem[]>();
    for (const item of recipeItems) {
      const list = map.get(item.recipe_id) ?? [];
      list.push(item);
      map.set(item.recipe_id, list);
    }
    return map;
  }, [recipeItems]);

  const salesByProductId = useMemo(() => {
    const map = new Map<string, { units: number; revenue: number }>();
    for (const item of saleItems) {
      const prev = map.get(item.product_id) ?? { units: 0, revenue: 0 };
      map.set(item.product_id, {
        units: prev.units + (Number(item.quantity) || 0),
        revenue: prev.revenue + (Number(item.line_total) || 0),
      });
    }
    return map;
  }, [saleItems]);

  const enrichedRecipes = useMemo<EnrichedRecipe[]>(() => {
    return recipes.map((recipe) => {
      const items = itemsByRecipeId.get(recipe.id) ?? [];
      const finishedProduct = productsById.get(recipe.product_id);
      const financials = calculateRecipeFinancials(
        recipe,
        items,
        finishedProduct,
        productsById
      );

      const salesAgg = salesByProductId.get(recipe.product_id) ?? { units: 0, revenue: 0 };
      const soldUnits = Number(salesAgg.units.toFixed(3));
      const soldRevenue = Number(salesAgg.revenue.toFixed(2));
      const soldCost = Number((soldUnits * financials.unitCost).toFixed(2));
      const soldProfit = Number((soldRevenue - soldCost).toFixed(2));
      const profitPerSoldUnit =
        soldUnits > 0
          ? Number((soldProfit / soldUnits).toFixed(2))
          : financials.unitProfit;

      return {
        recipe,
        items,
        finishedProduct,
        financials,
        salesStats: {
          soldUnits,
          soldRevenue,
          soldProfit,
          profitPerSoldUnit,
        },
      };
    });
  }, [recipes, itemsByRecipeId, productsById, salesByProductId]);

  const createFinishedProduct = useCallback(
    async (input: {
      name: string;
      category: string;
      price: number;
      saleMode: "unit" | "weight";
      code?: string;
    }): Promise<Product | null> => {
      if (!tenantId) return null;
      const created = await productsService.create(tenantId, {
        code: input.code?.trim() || null,
        name: input.name.trim(),
        image_url: null,
        brand: null,
        supplier: null,
        is_favorite: false,
        description: "Producto elaborado",
        price: Number(input.price) || 0,
        cost_price: 0,
        stock_current: 0,
        stock_min: null,
        stock_max: null,
        category: input.category.trim() || "Elaborados",
        subcategory: null,
        sale_mode: input.saleMode,
        currency_code: "ARS",
        vat_percent: 21,
        profit_percent: 0,
        price_without_vat: Number(((Number(input.price) || 0) / 1.21).toFixed(2)),
        is_active: true,
      });
      upsertProduct(created);
      return created;
    },
    [tenantId, upsertProduct]
  );

  const saveRecipe = useCallback(
    async (payload: SaveRecipePayload): Promise<boolean> => {
      if (!tenantId) return false;
      setIsMutating(true);
      try {
        await productionService.saveRecipeWithItems(tenantId, payload, productsById);
        await loadData({ forceCatalog: Boolean(payload.syncProductPricing), silent: true });
        return true;
      } catch (err) {
        setError(formatErrorMessage(err, "Error al guardar la receta"));
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [tenantId, productsById, loadData]
  );

  const deleteRecipe = useCallback(
    async (recipeId: string): Promise<boolean> => {
      if (!tenantId) return false;
      setIsMutating(true);
      try {
        await productionService.deleteRecipe(tenantId, recipeId);
        await loadData({ silent: true });
        return true;
      } catch (err) {
        setError(formatErrorMessage(err, "No se pudo eliminar la receta (puede tener órdenes asociadas)"));
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [tenantId, loadData]
  );

  const produceOrder = useCallback(
    async (params: {
      enriched: EnrichedRecipe;
      inputMode: ProductionInputMode;
      amount: number;
      wasteUnits?: number;
      notes?: string;
    }): Promise<ProductionOrder | null> => {
      if (!tenantId || !params.enriched.finishedProduct) return null;
      setIsMutating(true);
      try {
        const order = await productionService.executeProductionOrder(tenantId, {
          recipe: params.enriched.recipe,
          items: params.enriched.items,
          finishedProduct: params.enriched.finishedProduct,
          productsById,
          inputMode: params.inputMode,
          amount: params.amount,
          wasteUnits: params.wasteUnits,
          notes: params.notes,
          userId: user?.id ?? null,
        });
        await loadData({ forceCatalog: true, silent: true });
        return order;
      } catch (err) {
        setError(formatErrorMessage(err, "No se pudo registrar la producción"));
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [tenantId, productsById, user?.id, loadData]
  );

  const cancelOrder = useCallback(
    async (order: ProductionOrder): Promise<boolean> => {
      if (!tenantId) return false;
      setIsMutating(true);
      try {
        await productionService.cancelProductionOrder(
          tenantId,
          order,
          productsById,
          user?.id ?? null
        );
        await loadData({ forceCatalog: true, silent: true });
        return true;
      } catch (err) {
        setError(formatErrorMessage(err, "No se pudo anular el lote de producción"));
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [tenantId, productsById, user?.id, loadData]
  );

  const categories = useMemo(() => {
    const set = new Set<string>(["Elaborados"]);
    for (const p of products) {
      if (p.category) set.add(p.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  return {
    tenantId,
    products,
    productsById,
    recipeProductIdsSet,
    categories,
    enrichedRecipes,
    orders,
    isLoading,
    isMutating,
    error,
    setError,
    loadData,
    createFinishedProduct,
    saveRecipe,
    deleteRecipe,
    produceOrder,
    cancelOrder,
  };
};
