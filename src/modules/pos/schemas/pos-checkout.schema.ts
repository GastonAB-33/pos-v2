import { z } from "zod";

export const posCheckoutSchema = z.object({
  customerId: z.string().optional(),
  paymentMethodId: z.string().min(1, "Medio de pago obligatorio"),
  issueInvoice: z.boolean().default(false),
  notes: z.string().max(240, "Maximo 240 caracteres").optional().or(z.literal("")),
  paymentDetails: z.record(z.unknown()).optional().nullable(),
});

export type PosCheckoutValues = z.infer<typeof posCheckoutSchema>;
