import type { SupplierFormValues } from "@/modules/proveedores/schemas/supplier-form.schema";

const buildSupplierCode = (name: string): string => {
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((part) => part.slice(0, 3))
    .join("");

  return `${normalized || "SUP"}-${Date.now().toString().slice(-6)}`;
};

const normalizeEmpty = (value?: string) => (value?.trim() ? value.trim() : null);

export const toSupplierServiceInput = (
  values: SupplierFormValues,
  options?: { existingCode?: string; isActive?: boolean }
) => ({
  code: options?.existingCode ?? buildSupplierCode(values.name),
  name: values.name,
  phone: normalizeEmpty(values.phone),
  email: normalizeEmpty(values.email),
  address: normalizeEmpty(values.address),
  observations: normalizeEmpty(values.observations),
  is_active: options?.isActive ?? true,
});
