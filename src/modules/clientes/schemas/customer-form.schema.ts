import { z } from "zod";
import type { CustomerRequiredFieldsSettings } from "@/types/entities";

export const buildCustomerFormSchema = (req?: CustomerRequiredFieldsSettings) => {
  const isDocRequired = req?.document_number ?? true;
  const isPhoneRequired = req?.phone ?? false;
  const isEmailRequired = req?.email ?? false;
  const isAddressRequired = req?.address ?? false;

  return z.object({
    fullName: z.string().min(2, "El nombre es obligatorio"),
    documentType: z.enum(["dni", "cuit"]),
    documentNumber: isDocRequired
      ? z.string().min(6, "Documento inválido (mínimo 6 caracteres)").max(20, "Documento inválido")
      : z.string().max(20, "Máximo 20 caracteres").optional().or(z.literal("")),
    fiscalBusinessName: z.string().max(120, "Máximo 120 caracteres").optional().or(z.literal("")),
    fiscalAddress: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
    fiscalCondition: z.string().max(80, "Máximo 80 caracteres").optional().or(z.literal("")),
    priceListId: z.string().optional().or(z.literal("")),
    phone: isPhoneRequired
      ? z.string().min(6, "Teléfono obligatorio (mínimo 6 caracteres)").max(30, "Máximo 30 caracteres")
      : z.string().max(30, "Máximo 30 caracteres").optional().or(z.literal("")),
    email: isEmailRequired
      ? z.string().min(1, "Email obligatorio").email("Email inválido")
      : z.string().email("Email inválido").optional().or(z.literal("")),
    address: isAddressRequired
      ? z.string().min(3, "Dirección obligatoria (mínimo 3 caracteres)").max(200, "Máximo 200 caracteres")
      : z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal("")),
    observations: z.string().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
    currentAccountEnabled: z.boolean().default(false),
    currentAccountLimit: z.string().optional().or(z.literal("")),
  });
};

export const customerFormSchema = buildCustomerFormSchema({
  document_number: true,
  phone: false,
  email: false,
  address: false,
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
