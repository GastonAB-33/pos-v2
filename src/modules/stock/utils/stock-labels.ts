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

export const getStockStatus = (product: Product): StockStatus => {
  const min = product.stock_min;
  const max = product.stock_max;

  if (min == null && max == null) return "unassigned";
  if (min != null && product.stock_current <= min) return "low";
  if (max != null && product.stock_current > max) return "over";
  return "normal";
};
