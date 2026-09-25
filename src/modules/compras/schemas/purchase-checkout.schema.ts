import { z } from "zod";

export const purchaseHeaderSchema = z.object({
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
  notes: z.string().max(240, "Máximo 240 caracteres").optional().or(z.literal("")),
});

export type PurchaseHeaderValues = z.infer<typeof purchaseHeaderSchema>;

export const purchasePaymentMethodSchema = z.enum([
  "cash_daily",
  "cash_general",
  "cash",
  "transfer",
  "current_account",
  "card_debit",
  "card_credit",
  "other",
]);

export type PurchasePaymentMethod = z.infer<typeof purchasePaymentMethodSchema>;

export const purchasePaymentSplitItemSchema = z.object({
  id: z.string(),
  paymentMethod: purchasePaymentMethodSchema,
  amount: z.number().positive("El monto debe ser mayor a 0"),
  bankAccountId: z.string().optional().or(z.literal("")),
  voucherNumber: z.string().max(50, "Máximo 50 caracteres").optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  paymentNotes: z.string().max(240, "Máximo 240 caracteres").optional().or(z.literal("")),
});

export type PurchasePaymentSplitItem = z.infer<typeof purchasePaymentSplitItemSchema>;

export const purchasePaymentSchema = z.object({
  paymentMethod: purchasePaymentMethodSchema.default("cash_daily"),
  bankAccountId: z.string().optional().or(z.literal("")),
  voucherNumber: z.string().max(50, "Máximo 50 caracteres").optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  paymentNotes: z.string().max(240, "Máximo 240 caracteres").optional().or(z.literal("")),
  isSplitPayment: z.boolean().default(false),
  payments: z.array(purchasePaymentSplitItemSchema).optional(),
});

export type PurchasePaymentValues = z.infer<typeof purchasePaymentSchema>;

export const purchaseCheckoutSchema = purchaseHeaderSchema.extend({
  paymentMethod: purchasePaymentMethodSchema.default("cash_daily"),
  bankAccountId: z.string().optional().or(z.literal("")),
  voucherNumber: z.string().max(50, "Máximo 50 caracteres").optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  paymentNotes: z.string().max(240, "Máximo 240 caracteres").optional().or(z.literal("")),
  isSplitPayment: z.boolean().default(false),
  payments: z.array(purchasePaymentSplitItemSchema).optional(),
});

export type PurchaseCheckoutValues = z.infer<typeof purchaseCheckoutSchema>;

