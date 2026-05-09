import { useCallback, useEffect, useMemo, useState } from "react";
import { auditService } from "@/services/audit.service";
import { customersService } from "@/services/customers.service";
import { priceListsService } from "@/services/price-lists.service";
import type { Customer, PriceList } from "@/types/entities";
import type { CustomerFormValues } from "@/modules/clientes/schemas/customer-form.schema";

type FeedbackType = "success" | "error";

interface CrudFeedback {
  type: FeedbackType;
  message: string;
}

const buildCustomerCode = (name: string): string => {
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((part) => part.slice(0, 3))
    .join("");

  return `${normalized || "CLI"}-${Date.now().toString().slice(-6)}`;
};

const normalizeEmpty = (value?: string) => (value?.trim() ? value.trim() : null);
const normalizeNullableId = (value?: string) => (value?.trim() ? value.trim() : null);

const toServiceInput = (
  values: CustomerFormValues,
  options?: { existingCode?: string; isActive?: boolean; currentBalance?: number }
) => ({
  code: options?.existingCode ?? buildCustomerCode(values.fullName),
  full_name: values.fullName,
  document_type: values.documentType,
  document_number: values.documentNumber.trim(),
  fiscal_business_name: normalizeEmpty(values.fiscalBusinessName),
  fiscal_address: normalizeEmpty(values.fiscalAddress),
  fiscal_condition: normalizeEmpty(values.fiscalCondition),
  price_list_id: normalizeNullableId(values.priceListId),
  phone: normalizeEmpty(values.phone),
  email: normalizeEmpty(values.email),
  address: normalizeEmpty(values.address),
  observations: normalizeEmpty(values.observations),
  current_balance: options?.currentBalance ?? 0,
  is_active: options?.isActive ?? true,
});

export const useCustomersCrud = (tenantId: string | null, userId: string | null) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadCustomers = useCallback(async () => {
    if (!tenantId) {
      setCustomers([]);
      setPriceLists([]);
      return;
    }

    setIsLoading(true);
    try {
      const [list, allPriceLists] = await Promise.all([
        customersService.getAllByTenant(tenantId),
        priceListsService.getAllByTenant(tenantId),
      ]);

      setCustomers(list);
      setPriceLists([...allPriceLists].sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar los clientes" });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const createCustomer = async (values: CustomerFormValues) => {
    if (!tenantId) return null;

    setIsSubmitting(true);
    try {
      const created = await customersService.create(tenantId, toServiceInput(values));
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "clientes",
        action: "create",
        entity_type: "customer",
        entity_id: created.id,
        description: `Cliente creado: ${created.full_name}`,
        metadata: {
          document_type: created.document_type,
          document_number: created.document_number,
          is_active: created.is_active,
        },
      });
      setFeedback({ type: "success", message: "Cliente creado" });
      await loadCustomers();
      return created;
    } catch {
      setFeedback({ type: "error", message: "Error al crear cliente" });
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateCustomer = async (customerId: string, values: CustomerFormValues) => {
    if (!tenantId) return;

    const existing = customers.find((customer) => customer.id === customerId);
    if (!existing) return;

    setIsSubmitting(true);
    try {
      const updated = await customersService.update(
        tenantId,
        customerId,
        toServiceInput(values, {
          existingCode: existing.code,
          isActive: existing.is_active,
          currentBalance: existing.current_balance,
        })
      );
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "clientes",
        action: "update",
        entity_type: "customer",
        entity_id: updated?.id ?? customerId,
        description: `Cliente actualizado: ${values.fullName}`,
        metadata: {
          previous_name: existing.full_name,
          next_name: values.fullName,
          previous_document: existing.document_number,
          next_document: values.documentNumber.trim(),
          previous_price_list_id: existing.price_list_id,
          next_price_list_id: normalizeNullableId(values.priceListId),
        },
      });
      setFeedback({ type: "success", message: "Cliente actualizado" });
      await loadCustomers();
    } catch {
      setFeedback({ type: "error", message: "Error al actualizar cliente" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCustomer = async (customerId: string) => {
    if (!tenantId) return;
    const target = customers.find((customer) => customer.id === customerId);

    setIsSubmitting(true);
    try {
      await customersService.delete(tenantId, customerId);
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "clientes",
        action: "delete",
        entity_type: "customer",
        entity_id: customerId,
        description: `Cliente eliminado${target ? `: ${target.full_name}` : ""}`,
        metadata: target
          ? {
              document_number: target.document_number,
              current_balance: target.current_balance,
            }
          : null,
      });
      setFeedback({ type: "success", message: "Cliente eliminado" });
      await loadCustomers();
    } catch {
      setFeedback({ type: "error", message: "Error al eliminar cliente" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCustomerActive = async (customerId: string) => {
    if (!tenantId) return;

    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return;
    const nextIsActive = !customer.is_active;

    setIsSubmitting(true);
    try {
      await customersService.update(tenantId, customerId, { is_active: nextIsActive });
      await auditService.createSafe(tenantId, {
        user_id: userId,
        module: "clientes",
        action: "toggle_active",
        entity_type: "customer",
        entity_id: customerId,
        description: `Cliente ${nextIsActive ? "activado" : "desactivado"}: ${customer.full_name}`,
        metadata: {
          previous_is_active: customer.is_active,
          next_is_active: nextIsActive,
        },
      });
      setFeedback({
        type: "success",
        message: customer.is_active ? "Cliente desactivado" : "Cliente activado",
      });
      await loadCustomers();
    } catch {
      setFeedback({ type: "error", message: "Error al cambiar estado del cliente" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    const baseList = [...customers].sort((a, b) => a.full_name.localeCompare(b.full_name));
    if (!term) return baseList;

    return baseList.filter((customer) => {
      const candidate = [
        customer.full_name,
        customer.document_number,
        customer.phone ?? "",
        customer.email ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return candidate.includes(term);
    });
  }, [customers, search]);

  return {
    customers: filteredCustomers,
    priceLists,
    search,
    setSearch,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload: loadCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    toggleCustomerActive,
  };
};
