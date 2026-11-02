import { z } from "zod";
import type { SupplierRequiredFieldsSettings } from "@/types/entities";

export const buildSupplierFormSchema = (req?: SupplierRequiredFieldsSettings) => {
  const isTaxIdRequired = req?.tax_id ?? false;
  const isPhoneRequired = req?.phone ?? false;
  const isEmailRequired = req?.email ?? false;
  const isAddressRequired = req?.address ?? false;

  return z.object({
    name: z.string().min(2, "El nombre es obligatorio"),
    taxId: isTaxIdRequired
      ? z.string().min(6, "Identificación fiscal requerida (mínimo 6 caracteres)").max(30, "Máximo 30 caracteres")
      : z.string().max(30, "Máximo 30 caracteres").optional().or(z.literal("")),
    phone: isPhoneRequired
      ? z.string().min(6, "Teléfono obligatorio (mínimo 6 caracteres)").max(30, "Máximo 30 caracteres")
      : z.string().max(30, "Máximo 30 caracteres").optional().or(z.literal("")),
    email: isEmailRequired
      ? z.string().min(1, "Email obligatorio").email("Email inválido")
      : z.string().email("Email inválido").optional().or(z.literal("")),
    address: isAddressRequired
      ? z.string().min(3, "Dirección obligatoria (mínimo 3 caracteres)").max(240, "Máximo 240 caracteres")
      : z.string().max(240, "Máximo 240 caracteres").optional().or(z.literal("")),
    observations: z.string().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
  });
};

export const supplierFormSchema = buildSupplierFormSchema();

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
