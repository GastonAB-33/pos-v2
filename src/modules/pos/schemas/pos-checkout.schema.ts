import { z } from "zod";

export const posPaymentSplitItemSchema = z.object({
  id: z.string(),
  paymentMethodId: z.string().min(1, "Medio de pago obligatorio"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  paymentDetails: z.record(z.unknown()).optional().nullable(),
});

export type PosPaymentSplitItem = z.infer<typeof posPaymentSplitItemSchema>;

export const posCheckoutSchema = z.object({
  customerId: z.string().optional(),
  paymentMethodId: z.string().min(1, "Medio de pago obligatorio"),
  issueInvoice: z.boolean().default(false),
  notes: z.string().max(240, "Maximo 240 caracteres").optional().or(z.literal("")),
  paymentDetails: z.record(z.unknown()).optional().nullable(),
  isSplitPayment: z.boolean().default(false),
  payments: z.array(posPaymentSplitItemSchema).optional(),
});

export type PosCheckoutValues = z.infer<typeof posCheckoutSchema>;
