import { z } from "zod";

export const openCashSchema = z.object({
  openingAmount: z.coerce.number().min(0, "El monto inicial no puede ser negativo"),
  notes: z.string().max(240, "Maximo 240 caracteres").optional().or(z.literal("")),
});

export const closeCashSchema = z.object({
  realAmount: z.coerce.number().min(0, "El monto real no puede ser negativo"),
  notes: z.string().max(240, "Maximo 240 caracteres").optional().or(z.literal("")),
});

export const cashMovementSchema = z.object({
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  paymentMethodId: z.string().optional(),
  notes: z.string().max(240, "Maximo 240 caracteres").optional().or(z.literal("")),
});

export type OpenCashValues = z.infer<typeof openCashSchema>;
export type CloseCashValues = z.infer<typeof closeCashSchema>;
export type CashMovementValues = z.infer<typeof cashMovementSchema>;

