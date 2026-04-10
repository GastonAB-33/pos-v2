import { z } from "zod";

export const paymentMovementSchema = z.object({
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  notes: z.string().max(300, "Maximo 300 caracteres").optional().or(z.literal("")),
});

export const adjustmentMovementSchema = z.object({
  amount: z.coerce.number().refine((value) => value !== 0, "El ajuste no puede ser 0"),
  notes: z.string().max(300, "Maximo 300 caracteres").optional().or(z.literal("")),
});

export type PaymentMovementValues = z.infer<typeof paymentMovementSchema>;
export type AdjustmentMovementValues = z.infer<typeof adjustmentMovementSchema>;

