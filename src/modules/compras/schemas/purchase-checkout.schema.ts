import { z } from "zod";

export const purchaseCheckoutSchema = z.object({
  supplierId: z.string().min(1, "Proveedor obligatorio"),
  documentType: z.enum([
    "FACTURA_A",
    "FACTURA_B",
    "FACTURA_C",
    "REMITO",
    "TICKET",
    "PRESUPUESTO",
    "OTRO",
  ]).default("FACTURA_A"),
  documentNumber: z.string().max(50, "Máximo 50 caracteres").optional().or(z.literal("")),
  issueDate: z.string().min(1, "Fecha obligatoria"),
  paymentMethod: z.enum([
    "cash",
    "transfer",
    "current_account",
    "card_debit",
    "card_credit",
    "other",
  ]).default("cash"),
  notes: z.string().max(240, "Máximo 240 caracteres").optional().or(z.literal("")),
});

export type PurchaseCheckoutValues = z.infer<typeof purchaseCheckoutSchema>;

