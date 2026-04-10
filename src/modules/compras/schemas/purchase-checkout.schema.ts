import { z } from "zod";

export const purchaseCheckoutSchema = z.object({
  supplierId: z.string().min(1, "Proveedor obligatorio"),
  notes: z.string().max(240, "Maximo 240 caracteres").optional().or(z.literal("")),
});

export type PurchaseCheckoutValues = z.infer<typeof purchaseCheckoutSchema>;

