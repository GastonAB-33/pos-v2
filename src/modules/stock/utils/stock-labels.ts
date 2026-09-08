import type { Product, StockMovementType } from "@/types/entities";

export type StockStatus = "low" | "no_stock" | "normal" | "over" | "unassigned";
export type StockStatusFilter = "all" | StockStatus;

export const stockStatusLabel: Record<StockStatusFilter, string> = {
  all: "Todos",
  low: "Bajo mínimo",
  no_stock: "Sin stock",
  normal: "Normal",
  over: "Sobrestock",
  unassigned: "Sin asignar",
};

export const movementTypeLabel: Record<StockMovementType, string> = {
  sale: "Venta",
  purchase: "Compra",
  adjustment: "Ajuste manual",
  in: "Ingreso",
  out: "Salida",
};

const normalizeMax = (max: number | null): number | null => {
  if (max == null) return null;
  if (max <= 0) return null;
  return max;
};

export const getStockStatusFromValues = (
  stockCurrent: number,
  min: number | null,
  max: number | null,
  globalLowThreshold = 5
): StockStatus => {
  const normalizedMax = normalizeMax(max);

  // 1. Sin stock (0 o negativo)
  if (stockCurrent <= 0) return "no_stock";

  // 2. Stock bajo por mínimo configurado
  if (min != null && min > 0 && stockCurrent <= min) return "low";

  // 3. Stock bajo por umbral global cuando no tiene mínimo configurado
  if (min == null && globalLowThreshold > 0 && stockCurrent <= globalLowThreshold) return "low";

  // 4. Sobrestock
  if (normalizedMax != null && stockCurrent > normalizedMax) return "over";

  // 5. Sin asignar (si no tiene límites)
  if (min == null && normalizedMax == null) return "unassigned";

  return "normal";
};

export const getStockStatus = (product: Product, globalLowThreshold = 5): StockStatus =>
  getStockStatusFromValues(product.stock_current, product.stock_min, product.stock_max, globalLowThreshold);
