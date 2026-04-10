import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { productsService } from "@/services/products.service";
import { settingsService } from "@/services/settings.service";
import { stockService } from "@/services/stock.service";
import type { Product, StockMovement, StockSettings } from "@/types/entities";
import type { StockAdjustmentValues } from "@/modules/stock/schemas/stock-adjustment.schema";

type FeedbackType = "success" | "error";

interface StockFeedback {
  type: FeedbackType;
  message: string;
}

type StockMovementFilter = "all" | StockMovement["movement_type"];

const roundQty = (value: number): number => Number(value.toFixed(3));

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

  const loadStockData = useCallback(async () => {
    if (!tenantId) {
      setProducts([]);
      setMovements([]);
      setStockSettings(defaultStockSettings);
      return;
    }

    setIsLoading(true);
    try {
      const [allProducts, allMovements, tenantSettings] = await Promise.all([
        productsService.getAllByTenant(tenantId),
        stockService.getAllByTenant(tenantId),
        settingsService.getByTenant(tenantId),
      ]);

      setProducts(allProducts);
      setMovements(allMovements.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setStockSettings(tenantSettings.stock ?? defaultStockSettings);
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar datos de stock" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadStockData();
  }, [loadStockData]);

  const applyManualAdjustment = async (values: StockAdjustmentValues) => {
    if (!tenantId) return;

    if (!stockSettings.allow_manual_adjustments) {
      setFeedback({ type: "error", message: "Los ajustes manuales estan desactivados en configuracion" });
      return;
    }

    const product = products.find((item) => item.id === values.productId);
    if (!product) {
      setFeedback({ type: "error", message: "Producto no encontrado" });
      return;
    }

    const nextStock = roundQty(product.stock_current + values.quantity);
    if (!stockSettings.allow_negative_stock && nextStock < 0) {
      setFeedback({
        type: "error",
        message: "El ajuste deja el stock en negativo",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const movement = await stockService.create(tenantId, {
        product_id: product.id,
        movement_type: "adjustment",
        quantity: values.quantity,
        reference_type: "manual_adjustment",
        reference_id: null,
        notes: values.notes?.trim() || null,
        created_by: userId,
      });

      await productsService.update(tenantId, product.id, {
        stock_current: nextStock,
      });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "stock",
        action: "manual_adjustment",
        entity_type: "stock_movement",
        entity_id: movement.id,
        description: `Ajuste manual de stock: ${product.name}`,
        metadata: {
          product_id: product.id,
          quantity: values.quantity,
          previous_stock: product.stock_current,
          next_stock: nextStock,
          notes: values.notes?.trim() || null,
        },
      });

      setFeedback({ type: "success", message: `Ajuste aplicado a ${product.name}` });
      await loadStockData();
    } catch {
      setFeedback({ type: "error", message: "No se pudo aplicar el ajuste de stock" });
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

  const activeProducts = useMemo(
    () => products.filter((product) => product.is_active),
    [products]
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
    applyManualAdjustment,
  };
};
