import { z } from "zod";

export const productFormSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio"),
  codigoBarras: z
    .string()
    .max(64, "Maximo 64 caracteres")
    .regex(/^$|^[A-Za-z0-9\-\._]*$/, "Solo letras, numeros, guion, punto o guion bajo")
    .transform((value) => value.trim()),
  codigoProducto: z
    .string()
    .max(80, "Maximo 80 caracteres")
    .transform((value) => value.trim()),
  stock: z.coerce.number().min(0, "El stock debe ser mayor o igual a 0"),
  categoria: z.string().min(2, "La categoria es obligatoria"),
  subcategoria: z.string().max(120, "Maximo 120 caracteres").optional().or(z.literal("")),
  precioCosto: z.coerce.number().min(0, "El precio costo debe ser mayor o igual a 0"),
  porcentajeGanancia: z.coerce.number().min(0, "La ganancia debe ser mayor o igual a 0"),
  precioSinIva: z.coerce.number().min(0, "El precio sin IVA debe ser mayor o igual a 0"),
  porcentajeIva: z.coerce.number().min(0, "El IVA debe ser mayor o igual a 0"),
  precioFinal: z.coerce.number().min(0, "El precio final debe ser mayor o igual a 0"),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
