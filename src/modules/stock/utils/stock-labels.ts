import type { Product, StockMovementType } from "@/types/entities";

export type StockStatus = "low" | "normal" | "over" | "unassigned";
export type StockStatusFilter = "all" | StockStatus;

export const stockStatusLabel: Record<StockStatusFilter, string> = {
  all: "Todos",
  low: "Stock bajo",
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
  max: number | null
): StockStatus => {
  const normalizedMax = normalizeMax(max);

  if (min == null && normalizedMax == null) return "unassigned";
  if (min != null && stockCurrent <= min) return "low";
  if (normalizedMax != null && stockCurrent > normalizedMax) return "over";
  return "normal";
};

export const getStockStatus = (product: Product): StockStatus =>
  getStockStatusFromValues(product.stock_current, product.stock_min, product.stock_max);
