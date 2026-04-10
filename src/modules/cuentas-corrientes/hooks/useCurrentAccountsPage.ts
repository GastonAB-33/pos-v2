import { useCallback, useEffect, useMemo, useState } from "react";
import { customersService } from "@/services/customers.service";
import type { Customer } from "@/types/entities";

type FeedbackType = "success" | "error";

interface CurrentAccountsPageFeedback {
  type: FeedbackType;
  message: string;
}

export const useCurrentAccountsPage = (
  tenantId: string | null,
  initialCustomerId: string | null = null
) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<CurrentAccountsPageFeedback | null>(null);

  const clearFeedback = () => setFeedback(null);

  const loadCustomers = useCallback(async () => {
    if (!tenantId) {
      setCustomers([]);
      setSelectedCustomerId(null);
      return;
    }

    setIsLoading(true);

    try {
      const rows = await customersService.getAllByTenant(tenantId);

      const sorted = [...rows].sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
      setCustomers(sorted);

      const normalizedInitialCustomerId = initialCustomerId?.trim() || null;

      setSelectedCustomerId((current) => {
        if (
          normalizedInitialCustomerId &&
          sorted.some((customer) => customer.id === normalizedInitialCustomerId)
        ) {
          return normalizedInitialCustomerId;
        }

        if (current && sorted.some((customer) => customer.id === current)) {
          return current;
        }

        return sorted[0]?.id ?? null;
      });
    } catch {
      setFeedback({ type: "error", message: "No se pudieron cargar los clientes" });
    } finally {
      setIsLoading(false);
    }
  }, [initialCustomerId, tenantId]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) return customers;

    return customers.filter((customer) => {
      const haystack = [
        customer.full_name,
        customer.document_number,
        customer.email ?? "",
        customer.phone ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [customers, search]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  useEffect(() => {
    const normalizedInitialCustomerId = initialCustomerId?.trim() || null;
    if (!normalizedInitialCustomerId || !customers.length) return;
    if (!customers.some((customer) => customer.id === normalizedInitialCustomerId)) return;

    setSelectedCustomerId(normalizedInitialCustomerId);
  }, [customers, initialCustomerId]);

  return {
    customers,
    filteredCustomers,
    selectedCustomer,
    selectedCustomerId,
    setSelectedCustomerId,
    search,
    setSearch,
    isLoading,
    feedback,
    clearFeedback,
    reload: loadCustomers,
  };
};
