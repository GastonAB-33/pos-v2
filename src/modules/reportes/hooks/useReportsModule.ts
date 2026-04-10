import { useCallback, useEffect, useMemo, useState } from "react";
import { cashService } from "@/services/cash.service";
import { currentAccountsService } from "@/services/current-accounts.service";
import { customersService } from "@/services/customers.service";
import { paymentMethodsService } from "@/services/payment-methods.service";
import { productsService } from "@/services/products.service";
import { purchasesService } from "@/services/purchases.service";
import { salesService } from "@/services/sales.service";
import { stockService } from "@/services/stock.service";
import { suppliersService } from "@/services/suppliers.service";
import type {
  CashMovement,
  CashSession,
  Customer,
  CurrentAccountMovement,
  PaymentMethod,
  Product,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  SalePayment,
  StockMovement,
  Supplier,
} from "@/types/entities";
import { downloadCsv, type CsvRow } from "@/utils/csv";

export type ReportType = "ventas" | "caja" | "stock" | "deudores" | "compras";
export type ReportStatusFilter = "all" | "completed" | "draft" | "cancelled" | "confirmed" | "open" | "closed" | "active" | "inactive";

export interface ReportsFiltersState {
  dateFrom: string;
  dateTo: string;
  customerId: string;
  productId: string;
  paymentMethodCode: string;
  status: ReportStatusFilter;
}

interface SelectOption {
  value: string;
  label: string;
}

export interface SalesReportRow {
  id: string;
  created_at: string;
  sale_number: string;
  customer_name: string;
  item_count: number;
  payment_method_code: string | null;
  payment_method_name: string;
  status: Sale["status"];
  total: number;
}

export interface CashReportRow {
  id: string;
  created_at: string;
  session_status: CashSession["status"] | "closed";
  movement_type: CashMovement["movement_type"];
  reference_type: string;
  amount: number;
  signed_amount: number;
  notes: string | null;
}

type StockAlertLevel = "ok" | "no_stock" | "low_stock" | "over_max";

export interface StockReportRow {
  id: string;
  product_name: string;
  category: string;
  stock_current: number;
  stock_min: number | null;
  stock_max: number | null;
  alert_level: StockAlertLevel;
  alert_label: string;
  movement_count: number;
  last_movement_at: string | null;
  is_active: boolean;
}

export interface DebtorReportRow {
  id: string;
  customer_name: string;
  document: string;
  phone: string | null;
  email: string | null;
  current_balance: number;
  is_active: boolean;
  last_movement_at: string | null;
}

export interface PurchasesReportRow {
  id: string;
  created_at: string;
  purchase_number: string;
  supplier_name: string;
  item_count: number;
  status: Purchase["status"];
  total: number;
}

interface ReportsSummary {
  salesCount: number;
  salesTotal: number;
  purchasesCount: number;
  purchasesTotal: number;
  debtorsCount: number;
  debtorsTotal: number;
  cashNet: number;
  stockCriticalCount: number;
}

interface ReportsDataState {
  sales: Sale[];
  saleItems: SaleItem[];
  salePayments: SalePayment[];
  stockMovements: StockMovement[];
  products: Product[];
  customers: Customer[];
  currentAccountMovements: CurrentAccountMovement[];
  paymentMethods: PaymentMethod[];
  purchases: Purchase[];
  purchaseItems: PurchaseItem[];
  suppliers: Supplier[];
  cashSessions: CashSession[];
  cashMovements: CashMovement[];
}

const roundAmount = (value: number) => Number(value.toFixed(2));
const formatDateTime = (value: string) => new Date(value).toLocaleString("es-AR");
const todayStamp = () => new Date().toISOString().slice(0, 10);

const initialData: ReportsDataState = {
  sales: [],
  saleItems: [],
  salePayments: [],
  stockMovements: [],
  products: [],
  customers: [],
  currentAccountMovements: [],
  paymentMethods: [],
  purchases: [],
  purchaseItems: [],
  suppliers: [],
  cashSessions: [],
  cashMovements: [],
};

const initialFilters: ReportsFiltersState = {
  dateFrom: "",
  dateTo: "",
  customerId: "",
  productId: "",
  paymentMethodCode: "",
  status: "all",
};

const statusOptionsByType: Record<ReportType, SelectOption[]> = {
  ventas: [
    { value: "all", label: "Todos los estados" },
    { value: "completed", label: "Completada" },
    { value: "draft", label: "Borrador" },
    { value: "cancelled", label: "Cancelada" },
  ],
  caja: [
    { value: "all", label: "Todas las sesiones" },
    { value: "open", label: "Sesion abierta" },
    { value: "closed", label: "Sesion cerrada" },
  ],
  stock: [
    { value: "all", label: "Todos los productos" },
    { value: "active", label: "Activos" },
    { value: "inactive", label: "Inactivos" },
  ],
  deudores: [
    { value: "all", label: "Todos los deudores" },
    { value: "active", label: "Clientes activos" },
    { value: "inactive", label: "Clientes inactivos" },
  ],
  compras: [
    { value: "all", label: "Todos los estados" },
    { value: "confirmed", label: "Confirmada" },
    { value: "cancelled", label: "Cancelada" },
  ],
};

const isWithinDateRange = (rawDate: string, from: string, to: string): boolean => {
  const value = rawDate.slice(0, 10);
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
};

const calculateSignedCashAmount = (
  movementType: CashMovement["movement_type"],
  amount: number
): number => {
  if (movementType === "expense") return -Math.abs(amount);
  return amount;
};

const getStockAlertLevel = (product: Product): StockAlertLevel => {
  if (product.stock_current <= 0) return "no_stock";
  if (product.stock_min != null && product.stock_current <= product.stock_min) return "low_stock";
  if (product.stock_max != null && product.stock_current > product.stock_max) return "over_max";
  return "ok";
};

const getStockAlertLabel = (alertLevel: StockAlertLevel): string => {
  if (alertLevel === "no_stock") return "Sin stock";
  if (alertLevel === "low_stock") return "Bajo minimo";
  if (alertLevel === "over_max") return "Sobre maximo";
  return "Normal";
};

const buildCsvFilename = (prefix: string) => `${prefix}-${todayStamp()}.csv`;

export const useReportsModule = (tenantId: string | null) => {
  const [reportType, setReportType] = useState<ReportType>("ventas");
  const [filters, setFilters] = useState<ReportsFiltersState>(initialFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportsDataState>(initialData);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  const updateFilters = useCallback((patch: Partial<ReportsFiltersState>) => {
    setFilters((previous) => ({
      ...previous,
      ...patch,
    }));
  }, []);

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
        stockMovements,
        products,
        customers,
        paymentMethods,
        purchases,
        purchaseItems,
        suppliers,
        cashSessions,
        cashMovements,
        currentAccountMovements,
      ] = await Promise.all([
        salesService.getAllByTenant(tenantId),
        salesService.getAllItemsByTenant(tenantId),
        salesService.getAllPaymentsByTenant(tenantId),
        stockService.getAllByTenant(tenantId),
        productsService.getAllByTenant(tenantId),
        customersService.getAllByTenant(tenantId),
        paymentMethodsService.getAllByTenant(tenantId),
        purchasesService.getAllByTenant(tenantId),
        purchasesService.getAllItemsByTenant(tenantId),
        suppliersService.getAllByTenant(tenantId),
        cashService.getAllByTenant(tenantId),
        cashService.getAllMovementsByTenant(tenantId),
        currentAccountsService.getAllByTenant(tenantId),
      ]);

      setData({
        sales,
        saleItems,
        salePayments,
        stockMovements,
        products,
        customers,
        currentAccountMovements,
        paymentMethods,
        purchases,
        purchaseItems,
        suppliers,
        cashSessions,
        cashMovements,
      });
    } catch {
      setError("No se pudieron cargar los reportes");
      setData(initialData);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusOptions = useMemo(() => statusOptionsByType[reportType], [reportType]);

  useEffect(() => {
    const allowedValues = new Set(statusOptions.map((option) => option.value));
    if (allowedValues.has(filters.status)) return;
    setFilters((previous) => ({ ...previous, status: "all" }));
  }, [filters.status, statusOptions]);

  const customerOptions = useMemo<SelectOption[]>(
    () => data.customers.map((customer) => ({ value: customer.id, label: customer.full_name })),
    [data.customers]
  );

  const productOptions = useMemo<SelectOption[]>(
    () => data.products.map((product) => ({ value: product.id, label: product.name })),
    [data.products]
  );

  const paymentMethodOptions = useMemo<SelectOption[]>(
    () =>
      data.paymentMethods.map((paymentMethod) => ({
        value: paymentMethod.code,
        label: paymentMethod.name,
      })),
    [data.paymentMethods]
  );

  const customersById = useMemo(
    () => new Map(data.customers.map((customer) => [customer.id, customer])),
    [data.customers]
  );

  const productsById = useMemo(
    () => new Map(data.products.map((product) => [product.id, product])),
    [data.products]
  );

  const suppliersById = useMemo(
    () => new Map(data.suppliers.map((supplier) => [supplier.id, supplier])),
    [data.suppliers]
  );

  const paymentMethodNameByCode = useMemo(
    () => new Map(data.paymentMethods.map((method) => [method.code, method.name])),
    [data.paymentMethods]
  );

  const cashSessionsById = useMemo(
    () => new Map(data.cashSessions.map((session) => [session.id, session])),
    [data.cashSessions]
  );

  const saleItemsBySaleId = useMemo(() => {
    const map = new Map<string, SaleItem[]>();
    for (const item of data.saleItems) {
      const current = map.get(item.sale_id) ?? [];
      current.push(item);
      map.set(item.sale_id, current);
    }
    return map;
  }, [data.saleItems]);

  const salePaymentsBySaleId = useMemo(() => {
    const map = new Map<string, SalePayment[]>();
    for (const payment of data.salePayments) {
      const current = map.get(payment.sale_id) ?? [];
      current.push(payment);
      map.set(payment.sale_id, current);
    }
    return map;
  }, [data.salePayments]);

  const purchaseItemsByPurchaseId = useMemo(() => {
    const map = new Map<string, PurchaseItem[]>();
    for (const item of data.purchaseItems) {
      const current = map.get(item.purchase_id) ?? [];
      current.push(item);
      map.set(item.purchase_id, current);
    }
    return map;
  }, [data.purchaseItems]);

  const stockMovementStatsByProductId = useMemo(() => {
    const map = new Map<string, { movement_count: number; last_movement_at: string | null }>();

    for (const movement of data.stockMovements) {
      const current = map.get(movement.product_id);
      if (!current) {
        map.set(movement.product_id, {
          movement_count: 1,
          last_movement_at: movement.created_at,
        });
        continue;
      }

      map.set(movement.product_id, {
        movement_count: current.movement_count + 1,
        last_movement_at:
          current.last_movement_at && current.last_movement_at > movement.created_at
            ? current.last_movement_at
            : movement.created_at,
      });
    }

    return map;
  }, [data.stockMovements]);

  const lastCurrentAccountMovementByCustomerId = useMemo(() => {
    const map = new Map<string, string>();

    for (const movement of data.currentAccountMovements) {
      const current = map.get(movement.customer_id);
      if (!current || movement.created_at > current) {
        map.set(movement.customer_id, movement.created_at);
      }
    }

    return map;
  }, [data.currentAccountMovements]);

  const salesRows = useMemo<SalesReportRow[]>(() => {
    return data.sales
      .filter((sale) => isWithinDateRange(sale.created_at, filters.dateFrom, filters.dateTo))
      .filter((sale) => (filters.customerId ? sale.customer_id === filters.customerId : true))
      .filter((sale) => {
        if (!filters.productId) return true;
        const items = saleItemsBySaleId.get(sale.id) ?? [];
        return items.some((item) => item.product_id === filters.productId);
      })
      .filter((sale) => {
        const salePayments = salePaymentsBySaleId.get(sale.id) ?? [];
        if (!filters.paymentMethodCode) return true;
        return salePayments.some((payment) => payment.payment_method_code === filters.paymentMethodCode);
      })
      .filter((sale) => (filters.status === "all" ? true : sale.status === filters.status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((sale) => {
        const items = saleItemsBySaleId.get(sale.id) ?? [];
        const salePayments = salePaymentsBySaleId.get(sale.id) ?? [];
        const prioritizedPayment =
          salePayments.find((payment) => payment.status === "approved") ??
          salePayments.find((payment) => payment.status !== "rejected") ??
          salePayments[0];

        const customerName = sale.customer_id
          ? customersById.get(sale.customer_id)?.full_name ?? "Cliente eliminado"
          : "Consumidor final";

        const paymentMethodCode = prioritizedPayment?.payment_method_code ?? null;
        const paymentMethodName = paymentMethodCode
          ? paymentMethodNameByCode.get(paymentMethodCode) ?? paymentMethodCode
          : "Sin medio";

        return {
          id: sale.id,
          created_at: sale.created_at,
          sale_number: sale.sale_number,
          customer_name: customerName,
          item_count: items.length,
          payment_method_code: paymentMethodCode,
          payment_method_name: paymentMethodName,
          status: sale.status,
          total: sale.total,
        };
      });
  }, [
    customersById,
    data.sales,
    filters.customerId,
    filters.dateFrom,
    filters.dateTo,
    filters.paymentMethodCode,
    filters.productId,
    filters.status,
    paymentMethodNameByCode,
    saleItemsBySaleId,
    salePaymentsBySaleId,
  ]);

  const cashRows = useMemo<CashReportRow[]>(() => {
    return data.cashMovements
      .filter((movement) => isWithinDateRange(movement.created_at, filters.dateFrom, filters.dateTo))
      .filter((movement) =>
        filters.paymentMethodCode ? movement.reference_type === filters.paymentMethodCode : true
      )
      .filter((movement) => {
        if (filters.status === "all") return true;
        const session = cashSessionsById.get(movement.cash_session_id);
        const sessionStatus = session?.status ?? "closed";
        return sessionStatus === filters.status;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((movement) => {
        const session = cashSessionsById.get(movement.cash_session_id);
        const referenceLabel =
          paymentMethodNameByCode.get(movement.reference_type) ?? movement.reference_type;

        return {
          id: movement.id,
          created_at: movement.created_at,
          session_status: session?.status ?? "closed",
          movement_type: movement.movement_type,
          reference_type: referenceLabel,
          amount: movement.amount,
          signed_amount: calculateSignedCashAmount(movement.movement_type, movement.amount),
          notes: movement.notes,
        };
      });
  }, [
    cashSessionsById,
    data.cashMovements,
    filters.dateFrom,
    filters.dateTo,
    filters.paymentMethodCode,
    filters.status,
    paymentMethodNameByCode,
  ]);

  const stockRows = useMemo<StockReportRow[]>(() => {
    return data.products
      .filter((product) => (filters.productId ? product.id === filters.productId : true))
      .filter((product) => {
        if (filters.status === "all") return true;
        if (filters.status === "active") return product.is_active;
        if (filters.status === "inactive") return !product.is_active;
        return true;
      })
      .map((product) => {
        const movementStats = stockMovementStatsByProductId.get(product.id);
        const lastMovementAt = movementStats?.last_movement_at ?? product.updated_at;
        const alertLevel = getStockAlertLevel(product);

        return {
          id: product.id,
          product_name: product.name,
          category: product.category,
          stock_current: product.stock_current,
          stock_min: product.stock_min,
          stock_max: product.stock_max,
          alert_level: alertLevel,
          alert_label: getStockAlertLabel(alertLevel),
          movement_count: movementStats?.movement_count ?? 0,
          last_movement_at: movementStats?.last_movement_at ?? null,
          is_active: product.is_active,
          updated_at: lastMovementAt,
        };
      })
      .filter((row) => isWithinDateRange(row.updated_at, filters.dateFrom, filters.dateTo))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(({ updated_at: _updatedAt, ...row }) => row);
  }, [
    data.products,
    filters.dateFrom,
    filters.dateTo,
    filters.productId,
    filters.status,
    stockMovementStatsByProductId,
  ]);

  const debtorsRows = useMemo<DebtorReportRow[]>(() => {
    return data.customers
      .filter((customer) => customer.current_balance > 0)
      .filter((customer) => (filters.customerId ? customer.id === filters.customerId : true))
      .filter((customer) => {
        if (filters.status === "all") return true;
        if (filters.status === "active") return customer.is_active;
        if (filters.status === "inactive") return !customer.is_active;
        return true;
      })
      .map((customer) => {
        const lastMovementAt = lastCurrentAccountMovementByCustomerId.get(customer.id) ?? null;
        return {
          id: customer.id,
          customer_name: customer.full_name,
          document: `${customer.document_type.toUpperCase()} ${customer.document_number}`,
          phone: customer.phone,
          email: customer.email,
          current_balance: customer.current_balance,
          is_active: customer.is_active,
          last_movement_at: lastMovementAt,
          updated_at: lastMovementAt ?? customer.updated_at,
        };
      })
      .filter((row) => isWithinDateRange(row.updated_at, filters.dateFrom, filters.dateTo))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(({ updated_at: _updatedAt, ...row }) => row);
  }, [
    data.customers,
    filters.customerId,
    filters.dateFrom,
    filters.dateTo,
    filters.status,
    lastCurrentAccountMovementByCustomerId,
  ]);

  const purchasesRows = useMemo<PurchasesReportRow[]>(() => {
    return data.purchases
      .filter((purchase) => isWithinDateRange(purchase.created_at, filters.dateFrom, filters.dateTo))
      .filter((purchase) => {
        if (!filters.productId) return true;
        const items = purchaseItemsByPurchaseId.get(purchase.id) ?? [];
        return items.some((item) => item.product_id === filters.productId);
      })
      .filter((purchase) => (filters.status === "all" ? true : purchase.status === filters.status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((purchase) => {
        const items = purchaseItemsByPurchaseId.get(purchase.id) ?? [];
        const supplierName = suppliersById.get(purchase.supplier_id)?.name ?? "Proveedor eliminado";

        return {
          id: purchase.id,
          created_at: purchase.created_at,
          purchase_number: purchase.purchase_number,
          supplier_name: supplierName,
          item_count: items.length,
          status: purchase.status,
          total: purchase.total,
        };
      });
  }, [
    data.purchases,
    filters.dateFrom,
    filters.dateTo,
    filters.productId,
    filters.status,
    purchaseItemsByPurchaseId,
    suppliersById,
  ]);

  const summary = useMemo<ReportsSummary>(
    () => ({
      salesCount: salesRows.length,
      salesTotal: roundAmount(salesRows.reduce((acc, row) => acc + row.total, 0)),
      purchasesCount: purchasesRows.length,
      purchasesTotal: roundAmount(purchasesRows.reduce((acc, row) => acc + row.total, 0)),
      debtorsCount: debtorsRows.length,
      debtorsTotal: roundAmount(debtorsRows.reduce((acc, row) => acc + row.current_balance, 0)),
      cashNet: roundAmount(cashRows.reduce((acc, row) => acc + row.signed_amount, 0)),
      stockCriticalCount: stockRows.filter((row) => row.alert_level !== "ok").length,
    }),
    [cashRows, debtorsRows, purchasesRows, salesRows, stockRows]
  );

  const reportCounts = useMemo(
    () => ({
      ventas: salesRows.length,
      caja: cashRows.length,
      stock: stockRows.length,
      deudores: debtorsRows.length,
      compras: purchasesRows.length,
    }),
    [cashRows.length, debtorsRows.length, purchasesRows.length, salesRows.length, stockRows.length]
  );

  const formatCsvDate = (value: string) => value.slice(0, 19).replace("T", " ");

  const exportRowsByType = useMemo<Record<ReportType, CsvRow[]>>(
    () => ({
      ventas: salesRows.map((row) => ({
        fecha: formatCsvDate(row.created_at),
        numero_venta: row.sale_number,
        cliente: row.customer_name,
        items: row.item_count,
        medio_pago: row.payment_method_name,
        estado: row.status,
        total: roundAmount(row.total),
      })),
      caja: cashRows.map((row) => ({
        fecha: formatCsvDate(row.created_at),
        tipo: row.movement_type,
        referencia: row.reference_type,
        sesion: row.session_status,
        monto: roundAmount(row.amount),
        monto_neto: roundAmount(row.signed_amount),
        observacion: row.notes ?? "",
      })),
      stock: stockRows.map((row) => ({
        producto: row.product_name,
        categoria: row.category,
        stock_actual: row.stock_current,
        stock_min: row.stock_min ?? "",
        stock_max: row.stock_max ?? "",
        alerta: row.alert_label,
        movimientos: row.movement_count,
        ultimo_movimiento: row.last_movement_at ? formatCsvDate(row.last_movement_at) : "",
        estado: row.is_active ? "active" : "inactive",
      })),
      deudores: debtorsRows.map((row) => ({
        cliente: row.customer_name,
        documento: row.document,
        telefono: row.phone ?? "",
        email: row.email ?? "",
        saldo: roundAmount(row.current_balance),
        estado: row.is_active ? "active" : "inactive",
        ultimo_movimiento: row.last_movement_at ? formatCsvDate(row.last_movement_at) : "",
      })),
      compras: purchasesRows.map((row) => ({
        fecha: formatCsvDate(row.created_at),
        numero_compra: row.purchase_number,
        proveedor: row.supplier_name,
        items: row.item_count,
        estado: row.status,
        total: roundAmount(row.total),
      })),
    }),
    [cashRows, debtorsRows, purchasesRows, salesRows, stockRows]
  );

  const canExportByType: Record<ReportType, boolean> = {
    ventas: true,
    caja: false,
    stock: true,
    deudores: true,
    compras: true,
  };

  const exportActiveReport = useCallback(() => {
    if (!canExportByType[reportType]) {
      return {
        ok: false,
        message: "Este reporte no tiene exportacion CSV en esta etapa",
      };
    }

    const rows = exportRowsByType[reportType];
    const ok = downloadCsv(buildCsvFilename(reportType), rows);

    if (!ok) {
      return { ok: false, message: "No hay datos para exportar" };
    }

    return { ok: true, message: `CSV generado: ${reportType}` };
  }, [exportRowsByType, reportType]);

  return {
    isLoading,
    error,
    reportType,
    setReportType,
    filters,
    updateFilters,
    resetFilters,
    statusOptions,
    customerOptions,
    productOptions,
    paymentMethodOptions,
    salesRows,
    cashRows,
    stockRows,
    debtorsRows,
    purchasesRows,
    reportCounts,
    summary,
    formatDateTime,
    reload: load,
    exportActiveReport,
    meta: {
      currentAccountMovementsCount: data.currentAccountMovements.length,
      totalProducts: productsById.size,
      totalCustomers: customersById.size,
    },
  };
};
