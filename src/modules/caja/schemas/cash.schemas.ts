import { z } from "zod";

export const openCashSchema = z.object({
  openingAmount: z.coerce.number().min(0, "El monto inicial no puede ser negativo"),
  notes: z.string().max(240, "Maximo 240 caracteres").optional().or(z.literal("")),
  billCounts: z.record(z.coerce.number(), z.number()).optional(),
  coinsAmount: z.number().optional(),
});

export const closeCashSchema = z.object({
  realAmount: z.coerce.number().min(0, "El monto real no puede ser negativo"),
  notes: z.string().max(240, "Maximo 240 caracteres").optional().or(z.literal("")),
  billCounts: z.record(z.coerce.number(), z.number()).optional(),
  coinsAmount: z.number().optional(),
});

export const cashMovementSchema = z
  .object({
    amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
    paymentMethodId: z.string().optional(),
    paymentType: z.enum(["cash", "transfer"]).optional(),
    bankAccountId: z.string().optional(),
    voucherNumber: z.string().max(60, "Máximo 60 caracteres").optional().or(z.literal("")),
    notes: z.string().max(240, "Máximo 240 caracteres").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.paymentType === "transfer" && (!data.bankAccountId || !data.bankAccountId.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankAccountId"],
        message: "Seleccioná la cuenta bancaria de débito",
      });
    }
  });

export type OpenCashValues = z.infer<typeof openCashSchema>;
export type CloseCashValues = z.infer<typeof closeCashSchema>;
export type CashMovementValues = z.infer<typeof cashMovementSchema>;

