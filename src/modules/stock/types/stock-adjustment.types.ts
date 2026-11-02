export interface StockBatchAdjustmentEntry {
  productId: string;
  quantityIn: number;
  quantityOut: number;
}

export interface StockBatchAdjustmentValues {
  adjustments: StockBatchAdjustmentEntry[];
  notes: string;
}
