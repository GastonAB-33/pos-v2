import { z } from "zod";

export const productFormSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  brand: z.string().max(120, "Maximo 120 caracteres").optional().or(z.literal("")),
  supplier: z.string().max(160, "Maximo 160 caracteres").optional().or(z.literal("")),
  barcode: z
    .string()
    .max(64, "Maximo 64 caracteres")
    .regex(/^[A-Za-z0-9\-\._]*$/, "Solo letras, numeros, guion, punto o guion bajo")
    .optional()
    .or(z.literal("")),
  description: z.string().max(500, "Maximo 500 caracteres").optional().or(z.literal("")),
  price: z.coerce.number().min(0, "El precio debe ser mayor o igual a 0"),
  cost: z.coerce.number().min(0, "El costo debe ser mayor o igual a 0"),
  stockInitial: z.coerce.number().min(0, "El stock inicial debe ser mayor o igual a 0"),
  category: z.string().min(2, "La categoria es obligatoria"),
  subcategory: z.string().max(120, "Maximo 120 caracteres").optional().or(z.literal("")),
  saleMode: z.enum(["unit", "weight"]),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
