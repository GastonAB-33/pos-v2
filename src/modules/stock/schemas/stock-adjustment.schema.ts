import { z } from "zod";

export const stockAdjustmentSchema = z.object({
  productId: z.string().min(1, "Producto obligatorio"),
  quantity: z.coerce.number().refine((value) => value !== 0, "La cantidad no puede ser 0"),
  notes: z.string().max(240, "Maximo 240 caracteres").optional().or(z.literal("")),
});

export type StockAdjustmentValues = z.infer<typeof stockAdjustmentSchema>;

