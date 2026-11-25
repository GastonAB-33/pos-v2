import { useCallback, useEffect, useMemo, useState } from "react";
import { customersService } from "@/services/customers.service";
import { parseCustomerPackageDebts } from "@/utils/returnable-packages";
import type { Customer, CurrentAccountMovement } from "@/types/entities";
import { currentAccountsService } from "@/services/current-accounts.service";

type FeedbackType = "success" | "error";

interface CurrentAccountsPageFeedback {
  type: FeedbackType;
  message: string;
}

export type CurrentAccountsFilterMode = "all" | "debt" | "packages" | "both" | "zero";

export type CustomerSortColumn = "name" | "contact" | "status" | "balance";
export type CustomerSortDirection = "asc" | "desc";

const normalizeMovementAmount = (
  type: CurrentAccountMovement["type"],
  amount: number
): number => {
  const absAmount = Math.abs(amount);
  if (type === "debt") return absAmount;
  if (type === "payment") return -absAmount;
  return amount;
};

export const useCurrentAccountsPage = (
  tenantId: string | null,
  initialCustomerId: string | null = null
) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initialCustomerId?.trim() || null
  );
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<CurrentAccountsFilterMode>("debt");
  const [sortColumn, setSortColumn] = useState<CustomerSortColumn>("name");
  const [sortDirection, setSortDirection] = useState<CustomerSortDirection>("asc");

  const handleSort = useCallback((column: CustomerSortColumn) => {
    setSortColumn((prevCol) => {
      if (prevCol === column) {
        setSortDirection((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevCol;
      }
      setSortDirection(column === "balance" || column === "status" ? "desc" : "asc");
      return column;
    });
  }, []);
  const [isLoading, setIsLoading] = useState(Boolean(tenantId));
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
      const [rows, movements] = await Promise.all([
        customersService.getAllByTenant(tenantId),
        currentAccountsService.getAllByTenant(tenantId).catch(() => [] as CurrentAccountMovement[]),
      ]);

      const ledgerBalancesByCustomerId = new Map<string, number>();
      for (const movement of movements) {
        if (!movement.customer_id) continue;
        const delta = normalizeMovementAmount(movement.type, movement.amount);
        const prev = ledgerBalancesByCustomerId.get(movement.customer_id) ?? 0;
        ledgerBalancesByCustomerId.set(
          movement.customer_id,
          Number((prev + delta).toFixed(2))
        );
      }

      const reconciledRows = rows.map((c) => {
        const hasLedger = ledgerBalancesByCustomerId.has(c.id);
        const authoritativeBalance = hasLedger
          ? (ledgerBalancesByCustomerId.get(c.id) ?? 0)
          : (c.current_balance ?? 0);

        if (hasLedger && Math.abs((c.current_balance ?? 0) - authoritativeBalance) > 0.009) {
          void customersService
            .update(tenantId, c.id, { current_balance: authoritativeBalance })
            .catch((err) => {
              console.warn(`[useCurrentAccountsPage] Error al auto-reconciliar cliente ${c.id}:`, err);
            });
        }

        return {
          ...c,
          current_balance: authoritativeBalance,
        };
      });
      const sorted = [...reconciledRows].sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
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

    const filtered = customers.filter((customer) => {
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

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortColumn === "name") {
        comparison = a.full_name.localeCompare(b.full_name, "es", { sensitivity: "base" });
      } else if (sortColumn === "contact") {
        const contactA = (a.phone || a.email || a.document_number || "").toLowerCase();
        const contactB = (b.phone || b.email || b.document_number || "").toLowerCase();
        comparison = contactA.localeCompare(contactB, "es");
      } else if (sortColumn === "status") {
        const pkgA = customerPackagesMap.get(a.id)?.count ?? 0;
        const pkgB = customerPackagesMap.get(b.id)?.count ?? 0;
        if (pkgA !== pkgB) {
          comparison = pkgA - pkgB;
        } else {
          const balA = a.current_balance ?? 0;
          const balB = b.current_balance ?? 0;
          comparison = balA - balB;
        }
      } else if (sortColumn === "balance") {
        const balA = a.current_balance ?? 0;
        const balB = b.current_balance ?? 0;
        comparison = balA - balB;
      }

      if (comparison === 0 && sortColumn !== "name") {
        comparison = a.full_name.localeCompare(b.full_name, "es", { sensitivity: "base" });
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [customers, customerPackagesMap, filterMode, search, sortColumn, sortDirection]);

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
    sortColumn,
    setSortColumn,
    sortDirection,
    setSortDirection,
    handleSort,
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
