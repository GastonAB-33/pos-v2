import { z } from "zod";

export const customerFormSchema = z.object({
  fullName: z.string().min(2, "El nombre es obligatorio"),
  documentType: z.enum(["dni", "cuit"]),
  documentNumber: z.string().min(6, "Documento invalido").max(20, "Documento invalido"),
  fiscalBusinessName: z.string().max(120, "Maximo 120 caracteres").optional().or(z.literal("")),
  fiscalAddress: z.string().max(200, "Maximo 200 caracteres").optional().or(z.literal("")),
  fiscalCondition: z.string().max(80, "Maximo 80 caracteres").optional().or(z.literal("")),
  priceListId: z.string().optional().or(z.literal("")),
  phone: z.string().max(30, "Maximo 30 caracteres").optional().or(z.literal("")),
  email: z.string().email("Email invalido").optional().or(z.literal("")),
  address: z.string().max(200, "Maximo 200 caracteres").optional().or(z.literal("")),
  observations: z.string().max(500, "Maximo 500 caracteres").optional().or(z.literal("")),
  currentAccountEnabled: z.boolean().default(false),
  currentAccountLimit: z.string().optional().or(z.literal("")),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
