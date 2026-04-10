import { z } from "zod";

export const supplierFormSchema = z.object({
  name: z.string().min(2, "El nombre es obligatorio"),
  phone: z.string().max(30, "Maximo 30 caracteres").optional().or(z.literal("")),
  email: z.string().email("Email invalido").optional().or(z.literal("")),
  address: z.string().max(240, "Maximo 240 caracteres").optional().or(z.literal("")),
  observations: z.string().max(500, "Maximo 500 caracteres").optional().or(z.literal("")),
});

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

