import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { productsService } from "@/services/products.service";
import { settingsService } from "@/services/settings.service";
import { stockService } from "@/services/stock.service";
import type { Product, StockMovement, StockSettings } from "@/types/entities";
import type { StockBatchAdjustmentValues } from "@/modules/stock/types/stock-adjustment.types";

type FeedbackType = "success" | "error";

interface StockFeedback {
  type: FeedbackType;
  message: string;
}

type StockMovementFilter = "all" | StockMovement["movement_type"];

const roundQty = (value: number): number => Number(value.toFixed(3));
const sortMovementsDesc = (rows: StockMovement[]): StockMovement[] =>
  [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeMaxForRules = (value: number | null | undefined): number | null => {
  if (value == null) return null;
  if (value === 0) return null;
  return value;
};

const defaultStockSettings: StockSettings = {
  use_min_max: true,
  alerts_active: true,
  global_low_stock_threshold: 5,
  allow_manual_adjustments: true,
  allow_negative_stock: false,
};

export const useStockModule = (tenantId: string | null, userId: string | null) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [stockSettings, setStockSettings] = useState<StockSettings>(defaultStockSettings);
  const [movementTypeFilter, setMovementTypeFilter] = useState<StockMovementFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<StockFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const patchProductInState = useCallback((productId: string, patch: Partial<Product>) => {
    setProducts((current) =>
      current.map((item) =>
        item.id === productId ? { ...item, ...patch, updated_at: new Date().toISOString() } : item
      )
    );
  }, []);

  const appendMovementInState = useCallback((movement: StockMovement) => {
    setMovements((current) => sortMovementsDesc([movement, ...current]));
  }, []);

  const loadStockData = useCallback(async () => {
    if (!tenantId) {
      setProducts([]);
      setMovements([]);
      setStockSettings(defaultStockSettings);
      return;
    }

    setIsLoading(true);
    try {
      const [productsResult, movementsResult, settingsResult] = await Promise.allSettled([
        productsService.getAllByTenant(tenantId),
        stockService.getAllByTenant(tenantId),
        settingsService.getByTenant(tenantId),
      ]);

      if (productsResult.status === "fulfilled") {
        setProducts(productsResult.value);
      } else {
        setProducts([]);
      }

      if (movementsResult.status === "fulfilled") {
        setMovements(sortMovementsDesc(movementsResult.value));
      } else {
        setMovements([]);
      }

      if (settingsResult.status === "fulfilled") {
        setStockSettings(settingsResult.value.stock ?? defaultStockSettings);
      } else {
        setStockSettings(defaultStockSettings);
      }

      if (productsResult.status === "rejected" && movementsResult.status === "rejected") {
        setFeedback({ type: "error", message: "No se pudieron cargar datos de stock" });
      }
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar datos de stock" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadStockData();
  }, [loadStockData]);

  const applyManualAdjustmentsBulk = async (
    values: StockBatchAdjustmentValues
  ): Promise<boolean> => {
    if (!tenantId) return false;

    if (!stockSettings.allow_manual_adjustments) {
      setFeedback({
        type: "error",
        message: "Los ajustes manuales estan desactivados en configuracion",
      });
      return false;
    }

    const normalizedAdjustments = values.adjustments
      .map((item) => {
        const quantityIn = roundQty(Math.max(0, item.quantityIn));
        const quantityOut = roundQty(Math.max(0, item.quantityOut));
        return {
          productId: item.productId,
          quantityIn,
          quantityOut,
          netQuantity: roundQty(quantityIn - quantityOut),
        };
      })
      .filter((item) => item.quantityIn > 0 || item.quantityOut > 0);

    if (!normalizedAdjustments.length) {
      setFeedback({
        type: "error",
        message: "No hay cantidades validas para aplicar",
      });
      return false;
    }

    const productsMap = new Map(products.map((product) => [product.id, product]));
    const notes = values.notes.trim() || null;
    const skippedProducts: string[] = [];
    const movementCreatedBy = userId && uuidPattern.test(userId) ? userId : null;

    let applied = 0;
    let skipped = 0;
    setIsSubmitting(true);

    try {
      for (const adjustment of normalizedAdjustments) {
        const product = productsMap.get(adjustment.productId);
        if (!product) {
          skipped += 1;
          continue;
        }

        const nextStock = roundQty(product.stock_current + adjustment.netQuantity);
        if (!stockSettings.allow_negative_stock && nextStock < 0) {
          skipped += 1;
          skippedProducts.push(product.name);
          continue;
        }

        try {
          if (adjustment.quantityIn > 0) {
            const movementIn = await stockService.create(tenantId, {
              product_id: product.id,
              movement_type: "adjustment",
              quantity: adjustment.quantityIn,
              reference_type: "adjustment",
              reference_id: null,
              notes: notes ? `${notes} | Ajuste manual (+)` : "Ajuste manual (+)",
              created_by: movementCreatedBy,
            });
            appendMovementInState(movementIn);
          }

          if (adjustment.quantityOut > 0) {
            const movementOut = await stockService.create(tenantId, {
              product_id: product.id,
              movement_type: "adjustment",
              quantity: adjustment.quantityOut,
              reference_type: "adjustment",
              reference_id: null,
              notes: notes ? `${notes} | Ajuste manual (-)` : "Ajuste manual (-)",
              created_by: movementCreatedBy,
            });
            appendMovementInState(movementOut);
          }

          await productsService.updateStock(tenantId, product.id, nextStock);

          patchProductInState(product.id, { stock_current: nextStock });

          productsMap.set(product.id, {
            ...product,
            stock_current: nextStock,
            updated_at: new Date().toISOString(),
          });

          applied += 1;
        } catch {
          skipped += 1;
        }
      }

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "stock",
        action: "manual_adjustment_bulk",
        entity_type: "stock_movement",
        entity_id: null,
        description: "Ajuste manual de stock en lote",
        metadata: {
          adjustments: normalizedAdjustments,
          applied,
          skipped,
          skipped_products: skippedProducts,
          notes,
        },
      });

      if (!applied) {
        setFeedback({
          type: "error",
          message: "No se pudo aplicar ningun ajuste",
        });
        return false;
      }

      if (skipped > 0) {
        setFeedback({
          type: "error",
          message: `Ajuste parcial aplicado. Ajustados: ${applied} | Omitidos: ${skipped}`,
        });
      } else {
        setFeedback({
          type: "success",
          message: `Ajuste manual aplicado en ${applied} producto(s)`,
        });
      }

      return true;
    } catch {
      setFeedback({ type: "error", message: "No se pudo aplicar el ajuste de stock" });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStockThreshold = async (
    productId: string,
    values: { stockMin: number | null; stockMax: number | null }
  ) => {
    if (!tenantId) return;

    const product = products.find((item) => item.id === productId);
    if (!product) {
      setFeedback({ type: "error", message: "Producto no encontrado" });
      return;
    }

    const normalizedMax = normalizeMaxForRules(values.stockMax);
    if (values.stockMin != null && normalizedMax != null && values.stockMin > normalizedMax) {
      setFeedback({ type: "error", message: "El stock minimo no puede ser mayor al maximo" });
      return;
    }

    setIsSubmitting(true);
    try {
      await productsService.update(tenantId, productId, {
        stock_min: values.stockMin,
        stock_max: values.stockMax,
      });
      patchProductInState(productId, {
        stock_min: values.stockMin,
        stock_max: values.stockMax,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "stock",
        action: "threshold_update",
        entity_type: "product",
        entity_id: productId,
        description: `Umbrales de stock actualizados: ${product.name}`,
        metadata: {
          previous_stock_min: product.stock_min,
          next_stock_min: values.stockMin,
          previous_stock_max: product.stock_max,
          next_stock_max: values.stockMax,
        },
      });
      setFeedback({ type: "success", message: `Minimo/maximo actualizado en ${product.name}` });
    } catch {
      setFeedback({ type: "error", message: "No se pudo actualizar minimo/maximo" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStockThresholdBulk = async (
    productIds: string[],
    values: { stockMin?: number | null; stockMax?: number | null }
  ) => {
    if (!tenantId) return;
    const uniqueIds = [...new Set(productIds)];
    if (!uniqueIds.length) {
      setFeedback({ type: "error", message: "Selecciona productos para aplicar cambios masivos" });
      return;
    }

    const normalizedMax = normalizeMaxForRules(values.stockMax);
    if (values.stockMin != null && normalizedMax != null && values.stockMin > normalizedMax) {
      setFeedback({ type: "error", message: "El stock minimo no puede ser mayor al maximo" });
      return;
    }

    const payload: Partial<Product> = {};
    if ("stockMin" in values) payload.stock_min = values.stockMin ?? null;
    if ("stockMax" in values) payload.stock_max = values.stockMax ?? null;

    if (!Object.keys(payload).length) {
      setFeedback({ type: "error", message: "Indica al menos minimo o maximo para aplicar" });
      return;
    }

    setIsSubmitting(true);
    let updated = 0;
    let failed = 0;
    try {
      for (const productId of uniqueIds) {
        try {
          await productsService.update(tenantId, productId, payload);
          patchProductInState(productId, payload);
          updated += 1;
        } catch {
          failed += 1;
        }
      }

      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "stock",
        action: "bulk_threshold_update",
        entity_type: "product",
        entity_id: null,
        description: "Actualizacion masiva de umbrales de stock",
        metadata: {
          product_ids: uniqueIds,
          stock_min: payload.stock_min ?? null,
          stock_max: payload.stock_max ?? null,
          updated,
          failed,
        },
      });

      if (failed > 0) {
        setFeedback({
          type: "error",
          message: `Actualizacion parcial. Actualizados: ${updated} | Errores: ${failed}`,
        });
      } else {
        setFeedback({
          type: "success",
          message: `Umbrales actualizados en ${updated} producto(s)`,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const movementRows = useMemo(() => {
    return movements.filter((movement) => {
      if (movementTypeFilter !== "all" && movement.movement_type !== movementTypeFilter) {
        return false;
      }

      if (dateFrom && movement.created_at.slice(0, 10) < dateFrom) return false;
      if (dateTo && movement.created_at.slice(0, 10) > dateTo) return false;

      return true;
    });
  }, [movements, movementTypeFilter, dateFrom, dateTo]);

  const activeProducts = useMemo(() => products.filter((product) => product.is_active), [products]);

  const categoryOptions = useMemo(
    () =>
      [...new Set(activeProducts.map((product) => product.category).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [activeProducts]
  );

  const alertRows = useMemo(() => {
    if (!stockSettings.alerts_active) {
      return [] as Array<{ product: Product; isNoStock: boolean; isLow: boolean; isOver: boolean }>;
    }

    return activeProducts
      .map((product) => {
        const threshold = stockSettings.use_min_max
          ? product.stock_min ?? stockSettings.global_low_stock_threshold
          : stockSettings.global_low_stock_threshold;

        const isNoStock = product.stock_current <= 0;
        const isLow = !isNoStock && threshold > 0 && product.stock_current <= threshold;
        const isOver =
          stockSettings.use_min_max &&
          product.stock_max != null &&
          product.stock_max > 0 &&
          product.stock_current > product.stock_max;

        return { product, isNoStock, isLow, isOver };
      })
      .filter((row) => row.isNoStock || row.isLow || row.isOver);
  }, [
    activeProducts,
    stockSettings.alerts_active,
    stockSettings.global_low_stock_threshold,
    stockSettings.use_min_max,
  ]);

  const summary = useMemo(() => {
    const noStock = alertRows.filter((row) => row.isNoStock).length;
    const lowStock = alertRows.filter((row) => row.isLow).length;
    const overMax = alertRows.filter((row) => row.isOver).length;

    return {
      activeProducts: activeProducts.length,
      lowStock,
      noStock,
      overMax,
    };
  }, [activeProducts.length, alertRows]);

  return {
    products,
    stockSettings,
    productsById,
    alertRows,
    movementRows,
    summary,
    movementTypeFilter,
    setMovementTypeFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadStockData,
    applyManualAdjustmentsBulk,
    updateStockThreshold,
    updateStockThresholdBulk,
    categoryOptions,
  };
};
