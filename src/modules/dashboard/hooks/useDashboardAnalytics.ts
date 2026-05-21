import { useCallback, useEffect, useMemo, useState } from "react";
import { cashService } from "@/services/cash.service";
import { customersService } from "@/services/customers.service";
import { paymentMethodsService } from "@/services/payment-methods.service";
import { productsService } from "@/services/products.service";
import { purchasesService } from "@/services/purchases.service";
import { salesService } from "@/services/sales.service";
import type { CashMovement, Product } from "@/types/entities";

interface DashboardKpis {
  salesToday: number;
  salesMonth: number;
  transactionsMonth: number;
  averageTicketMonth: number;
  activeProducts: number;
  lowStockProducts: number;
  customersInDebt: number;
  purchasesMonth: number;
  cashIncomeToday: number;
  cashExpenseToday: number;
  cashNetToday: number;
  cashIncomeMonth: number;
  manualCashMovementsToday: number;
  openCashSessions: number;
}

interface SeriesPoint {
  label: string;
  value: number;
}

interface TopProductRow {
  product_id: string;
  product_name: string;
  quantity: number;
  total: number;
}

interface StockCriticalRow {
  id: string;
  name: string;
  stock_current: number;
  stock_min: number | null;
  is_no_stock: boolean;
  is_low_stock: boolean;
}

interface DashboardAnalyticsData {
  kpis: DashboardKpis;
  salesLast7Days: SeriesPoint[];
  salesByPaymentMethod: SeriesPoint[];
  topProducts: TopProductRow[];
  stockCritical: StockCriticalRow[];
  purchasesByPeriod: SeriesPoint[];
  cashMovementsBySource: SeriesPoint[];
}

interface DashboardAnalyticsState {
  isLoading: boolean;
  error: string | null;
  data: DashboardAnalyticsData;
  reload: () => Promise<void>;
}

const roundAmount = (value: number) => Number(value.toFixed(2));

const getDayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const getMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const isOnOrAfter = (dateValue: string, target: Date) => new Date(dateValue).getTime() >= target.getTime();

const formatDayLabel = (date: Date) =>
  date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString("es-AR", {
    month: "short",
    year: "2-digit",
  });

const initialData: DashboardAnalyticsData = {
  kpis: {
    salesToday: 0,
    salesMonth: 0,
    transactionsMonth: 0,
    averageTicketMonth: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    customersInDebt: 0,
    purchasesMonth: 0,
    cashIncomeToday: 0,
    cashExpenseToday: 0,
    cashNetToday: 0,
    cashIncomeMonth: 0,
    manualCashMovementsToday: 0,
    openCashSessions: 0,
  },
  salesLast7Days: [],
  salesByPaymentMethod: [],
  topProducts: [],
  stockCritical: [],
  purchasesByPeriod: [],
  cashMovementsBySource: [],
};

const normalizeKey = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

const defaultPaymentMethodLabels: Record<string, string> = {
  cash: "Efectivo",
  card_debit: "Tarjeta de debito",
  card_credit: "Tarjeta de credito",
  transfer: "Transferencia bancaria",
  mercado_pago: "Mercado Pago",
  cheque: "Cheque",
  current_account: "Cuenta corriente",
  manual_income: "Ingreso manual",
  manual_expense: "Egreso manual",
};

const isCashIncome = (movement: CashMovement): boolean => {
  if (movement.movement_type === "expense") return false;
  if (movement.movement_type === "adjustment") return movement.amount > 0;
  return true;
};

const getCashSignedAmount = (movement: CashMovement): number => {
  const amount = Math.abs(movement.amount);
  if (movement.movement_type === "expense") return -amount;
  if (movement.movement_type === "adjustment" && movement.amount < 0) return -amount;
  return amount;
};

const buildStockCriticalRows = (products: Product[]): StockCriticalRow[] => {
  return products
    .filter((product) => product.is_active)
    .map((product) => {
      const isNoStock = product.stock_current <= 0;
      const isLow = !isNoStock && product.stock_min != null && product.stock_current <= product.stock_min;
      return {
        id: product.id,
        name: product.name,
        stock_current: product.stock_current,
        stock_min: product.stock_min,
        is_no_stock: isNoStock,
        is_low_stock: isLow,
      };
    })
    .filter((row) => row.is_no_stock || row.is_low_stock)
    .sort((a, b) => a.stock_current - b.stock_current)
    .slice(0, 8);
};

export const useDashboardAnalytics = (tenantId: string | null): DashboardAnalyticsState => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardAnalyticsData>(initialData);

  const load = useCallback(async () => {
    if (!tenantId) {
      setData(initialData);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [
        sales,
        saleItems,
        salePayments,
        products,
        customers,
        purchases,
        paymentMethods,
        cashSessions,
        cashMovements,
      ] = await Promise.all([
        salesService.getAllByTenant(tenantId),
        salesService.getAllItemsByTenant(tenantId),
        salesService.getAllPaymentsByTenant(tenantId),
        productsService.getAllByTenant(tenantId),
        customersService.getAllByTenant(tenantId),
        purchasesService.getAllByTenant(tenantId),
        paymentMethodsService.getAllByTenant(tenantId),
        cashService.getAllByTenant(tenantId),
        cashService.getAllMovementsByTenant(tenantId),
      ]);

      const now = new Date();
      const startToday = getDayStart(now);
      const startMonth = getMonthStart(now);

      const completedSales = sales.filter((sale) => sale.status === "completed");
      const completedSalesToday = completedSales.filter((sale) => isOnOrAfter(sale.created_at, startToday));
      const completedSalesMonth = completedSales.filter((sale) => isOnOrAfter(sale.created_at, startMonth));

      const salesToday = roundAmount(completedSalesToday.reduce((acc, sale) => acc + sale.total, 0));
      const salesMonth = roundAmount(completedSalesMonth.reduce((acc, sale) => acc + sale.total, 0));
      const transactionsMonth = completedSalesMonth.length;
      const averageTicketMonth = transactionsMonth
        ? roundAmount(salesMonth / transactionsMonth)
        : 0;

      const activeProducts = products.filter((product) => product.is_active).length;
      const lowStockProducts = products.filter(
        (product) => product.is_active && (product.stock_current <= 0 || (product.stock_min != null && product.stock_current <= product.stock_min))
      ).length;
      const customersInDebt = customers.filter((customer) => customer.current_balance > 0).length;

      const confirmedPurchasesMonth = purchases.filter(
        (purchase) => purchase.status === "confirmed" && isOnOrAfter(purchase.created_at, startMonth)
      );
      const purchasesMonth = roundAmount(
        confirmedPurchasesMonth.reduce((acc, purchase) => acc + purchase.total, 0)
      );

      const cashMovementsToday = cashMovements.filter((movement) => isOnOrAfter(movement.created_at, startToday));
      const cashMovementsMonth = cashMovements.filter((movement) => isOnOrAfter(movement.created_at, startMonth));
      const cashIncomeToday = roundAmount(
        cashMovementsToday
          .filter(isCashIncome)
          .reduce((acc, movement) => acc + Math.abs(movement.amount), 0)
      );
      const cashExpenseToday = roundAmount(
        cashMovementsToday
          .filter((movement) => !isCashIncome(movement))
          .reduce((acc, movement) => acc + Math.abs(movement.amount), 0)
      );
      const cashNetToday = roundAmount(
        cashMovementsToday.reduce((acc, movement) => acc + getCashSignedAmount(movement), 0)
      );
      const cashIncomeMonth = roundAmount(
        cashMovementsMonth
          .filter(isCashIncome)
          .reduce((acc, movement) => acc + Math.abs(movement.amount), 0)
      );
      const manualCashMovementsToday = cashMovementsToday.filter(
        (movement) => movement.movement_type === "income" || movement.movement_type === "expense"
      ).length;
      const openCashSessions = cashSessions.filter((session) => session.status === "open").length;

      const last7Dates = Array.from({ length: 7 }).map((_, offset) => {
        const date = new Date(startToday);
        date.setDate(startToday.getDate() - (6 - offset));
        return date;
      });

      const salesLast7Days = last7Dates.map((date) => {
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);

        const total = completedSales
          .filter((sale) => {
            const saleDate = new Date(sale.created_at).getTime();
            return saleDate >= date.getTime() && saleDate < nextDay.getTime();
          })
          .reduce((acc, sale) => acc + sale.total, 0);

        return {
          label: formatDayLabel(date),
          value: roundAmount(total),
        };
      });

      const paymentMethodNameByCode = new Map(
        paymentMethods.map((method) => [method.code, method.name])
      );
      const monthSaleIds = new Set(completedSalesMonth.map((sale) => sale.id));

      const salesByPaymentMap = new Map<string, number>();
      for (const payment of salePayments) {
        if (!monthSaleIds.has(payment.sale_id)) continue;
        if (payment.status === "rejected") continue;

        const label = paymentMethodNameByCode.get(payment.payment_method_code) ?? payment.payment_method_code;
        salesByPaymentMap.set(label, (salesByPaymentMap.get(label) ?? 0) + payment.amount);
      }

      const salesByPaymentMethod = [...salesByPaymentMap.entries()]
        .map(([label, amount]) => ({ label, value: roundAmount(amount) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      const cashMovementsBySourceMap = new Map<string, number>();
      for (const movement of cashMovementsMonth) {
        if (!isCashIncome(movement)) continue;
        const referenceKey = normalizeKey(movement.reference_type);
        const label =
          paymentMethodNameByCode.get(referenceKey) ??
          defaultPaymentMethodLabels[referenceKey] ??
          (referenceKey ? referenceKey : "Ingreso");
        cashMovementsBySourceMap.set(
          label,
          (cashMovementsBySourceMap.get(label) ?? 0) + Math.abs(movement.amount)
        );
      }

      const cashMovementsBySource = [...cashMovementsBySourceMap.entries()]
        .map(([label, amount]) => ({ label, value: roundAmount(amount) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      const monthItems = saleItems.filter((item) => monthSaleIds.has(item.sale_id));
      const topProductsMap = new Map<string, TopProductRow>();
      for (const item of monthItems) {
        const current = topProductsMap.get(item.product_id);
        if (!current) {
          topProductsMap.set(item.product_id, {
            product_id: item.product_id,
            product_name: item.product_name_snapshot,
            quantity: item.quantity,
            total: item.line_total,
          });
          continue;
        }

        current.quantity += item.quantity;
        current.total += item.line_total;
      }

      const topProducts = [...topProductsMap.values()]
        .map((row) => ({
          ...row,
          quantity: Number(row.quantity.toFixed(3)),
          total: roundAmount(row.total),
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 8);

      const stockCritical = buildStockCriticalRows(products);

      const purchasesByMonthMap = new Map<string, number>();
      const last6MonthKeys = Array.from({ length: 6 }).map((_, index) => {
        const cursor = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        purchasesByMonthMap.set(key, 0);
        return {
          key,
          label: formatMonthLabel(cursor),
        };
      });

      for (const purchase of purchases) {
        if (purchase.status !== "confirmed") continue;
        const purchaseDate = new Date(purchase.created_at);
        const key = `${purchaseDate.getFullYear()}-${purchaseDate.getMonth()}`;
        if (!purchasesByMonthMap.has(key)) continue;

        purchasesByMonthMap.set(key, (purchasesByMonthMap.get(key) ?? 0) + purchase.total);
      }

      const purchasesByPeriod = last6MonthKeys.map((month) => ({
        label: month.label,
        value: roundAmount(purchasesByMonthMap.get(month.key) ?? 0),
      }));

      setData({
        kpis: {
          salesToday,
          salesMonth,
          transactionsMonth,
          averageTicketMonth,
          activeProducts,
          lowStockProducts,
          customersInDebt,
          purchasesMonth,
          cashIncomeToday,
          cashExpenseToday,
          cashNetToday,
          cashIncomeMonth,
          manualCashMovementsToday,
          openCashSessions,
        },
        salesLast7Days,
        salesByPaymentMethod,
        topProducts,
        stockCritical,
        purchasesByPeriod,
        cashMovementsBySource,
      });
    } catch {
      setError("No se pudieron cargar las estadisticas");
      setData(initialData);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({
      isLoading,
      error,
      data,
      reload: load,
    }),
    [isLoading, error, data, load]
  );
};
