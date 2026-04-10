import { z } from "zod";

export const budgetFormSchema = z.object({
  customerId: z.string().optional().or(z.literal("")),
  subtotal: z.coerce.number().min(0, "Subtotal invalido"),
  taxTotal: z.coerce.number().min(0, "Impuesto invalido"),
  notes: z.string().max(400, "Maximo 400 caracteres").optional().or(z.literal("")),
});

export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export const generateFromSaleSchema = z.object({
  saleId: z.string().min(1, "Debe seleccionar una venta"),
  documentType: z.enum(["A", "B", "C", "PRESUPUESTO"]),
  notes: z.string().max(400, "Maximo 400 caracteres").optional().or(z.literal("")),
});

export type GenerateFromSaleValues = z.infer<typeof generateFromSaleSchema>;
