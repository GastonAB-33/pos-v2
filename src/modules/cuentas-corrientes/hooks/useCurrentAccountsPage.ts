import { useCallback, useEffect, useMemo, useState } from "react";
import { customersService } from "@/services/customers.service";
import { parseCustomerPackageDebts } from "@/utils/returnable-packages";
import type { Customer } from "@/types/entities";

type FeedbackType = "success" | "error";

interface CurrentAccountsPageFeedback {
  type: FeedbackType;
  message: string;
}

export type CurrentAccountsFilterMode = "all" | "debt" | "packages" | "both" | "zero";

export const useCurrentAccountsPage = (
  tenantId: string | null,
  initialCustomerId: string | null = null
) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initialCustomerId?.trim() || null
  );
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<CurrentAccountsFilterMode>("all");
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

        return null;
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

  const customerPackagesMap = useMemo(() => {
    const map = new Map<string, { count: number; debts: Record<string, number> }>();
    for (const c of customers) {
      const debts = parseCustomerPackageDebts(c.observations);
      const count = Object.values(debts).reduce((a, b) => a + b, 0);
      map.set(c.id, { count, debts });
    }
    return map;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const balance = customer.current_balance ?? 0;
      const hasDebt = balance > 0;
      const pkgInfo = customerPackagesMap.get(customer.id);
      const hasPackages = (pkgInfo?.count ?? 0) > 0;

      if (filterMode === "debt" && !hasDebt) return false;
      if (filterMode === "packages" && !hasPackages) return false;
      if (filterMode === "both" && (!hasDebt || !hasPackages)) return false;
      if (filterMode === "zero" && (hasDebt || hasPackages)) return false;

      if (!normalized) return true;

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
  }, [customers, customerPackagesMap, filterMode, search]);

  const totalDebt = useMemo(() => {
    return customers.reduce((sum, c) => {
      const bal = c.current_balance ?? 0;
      return bal > 0 ? sum + bal : sum;
    }, 0);
  }, [customers]);

  const customersWithDebtCount = useMemo(() => {
    return customers.filter((c) => (c.current_balance ?? 0) > 0).length;
  }, [customers]);

  const customersWithPackagesCount = useMemo(() => {
    let count = 0;
    for (const info of customerPackagesMap.values()) {
      if (info.count > 0) count++;
    }
    return count;
  }, [customerPackagesMap]);

  const totalPackagesOwedCount = useMemo(() => {
    let sum = 0;
    for (const info of customerPackagesMap.values()) {
      sum += info.count;
    }
    return sum;
  }, [customerPackagesMap]);

  const customersWithBothCount = useMemo(() => {
    return customers.filter((c) => {
      const hasDebt = (c.current_balance ?? 0) > 0;
      const pkgInfo = customerPackagesMap.get(c.id);
      return hasDebt && (pkgInfo?.count ?? 0) > 0;
    }).length;
  }, [customers, customerPackagesMap]);

  const customersUpToDateCount = useMemo(() => {
    return customers.filter((c) => {
      const hasDebt = (c.current_balance ?? 0) > 0;
      const pkgInfo = customerPackagesMap.get(c.id);
      return !hasDebt && (pkgInfo?.count ?? 0) === 0;
    }).length;
  }, [customers, customerPackagesMap]);

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
    customerPackagesMap,
    selectedCustomer,
    selectedCustomerId,
    setSelectedCustomerId,
    search,
    setSearch,
    filterMode,
    setFilterMode,
    totalDebt,
    customersWithDebtCount,
    customersWithPackagesCount,
    totalPackagesOwedCount,
    customersWithBothCount,
    customersUpToDateCount,
    isLoading,
    feedback,
    clearFeedback,
    reload: loadCustomers,
  };
};
