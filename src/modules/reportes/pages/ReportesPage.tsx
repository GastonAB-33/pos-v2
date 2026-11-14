import { useMemo } from "react";
import { Download, RefreshCw, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";
import { routePaths } from "@/config/routes";
import { ErrorState, LoadingState } from "@/components/ui/UiStates";
import { useToast } from "@/components/ui/useToast";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { ReportTable, type ReportTableColumn } from "@/modules/reportes/components/ReportTable";
import { ReportsFilters } from "@/modules/reportes/components/ReportsFilters";
import { ReportsSummaryCards } from "@/modules/reportes/components/ReportsSummaryCards";
import { ReportTypeTabs } from "@/modules/reportes/components/ReportTypeTabs";
import { cn } from "@/utils/cn";
import {
  type CashReportRow,
  type DebtorReportRow,
  type PurchasesReportRow,
  type ReportType,
  type SalesReportRow,
  type StockReportRow,
  useReportsModule,
} from "@/modules/reportes/hooks/useReportsModule";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const reportTitleByType: Record<ReportType, string> = {
  ventas: "Reporte de ventas",
  caja: "Reporte de caja",
  stock: "Reporte de stock",
  deudores: "Reporte de deudores",
  compras: "Reporte de compras",
};

const reportDescriptionByType: Record<ReportType, string> = {
  ventas: "Ventas con cliente, ítems, medio de pago y estado de cobro.",
  caja: "Movimientos de caja vinculados al flujo real del POS y cierres.",
  stock: "Estado de productos con niveles de alerta y última actividad.",
  deudores: "Clientes con saldo deudor en cuenta corriente.",
  compras: "Compras registradas a proveedores con detalle de comprobante.",
};

const renderStatusBadge = (value: string) => {
  if (value === "completed" || value === "confirmed" || value === "active" || value === "open") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 font-mono">
        {value}
      </span>
    );
  }

  if (value === "cancelled" || value === "inactive") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200/60 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60 font-mono">
        {value}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 font-mono">
      {value}
    </span>
  );
};

const renderStockAlertBadge = (value: StockReportRow["alert_level"], label: string) => {
  if (value === "no_stock") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200/60 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/60">
        {label}
      </span>
    );
  }
  if (value === "low_stock") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60">
        {label}
      </span>
    );
  }
  if (value === "over_max") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/60 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {label}
    </span>
  );
};

export const ReportesPage = () => {
  const { tenantId } = useTenant();
  const { canRead } = usePermissions();
  const toast = useToast();
  const canReadReportes = canRead("reportes");
  const {
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
    reload,
    exportActiveReport,
  } = useReportsModule(tenantId);

  const salesColumns = useMemo<ReportTableColumn<SalesReportRow>[]>(
    () => [
      {
        id: "date",
        header: "Fecha",
        cell: (row) => formatDateTime(row.created_at),
      },
      {
        id: "number",
        header: "Número",
        cell: (row) => <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{row.sale_number}</span>,
      },
      {
        id: "customer",
        header: "Cliente",
        cell: (row) => <span className="font-medium text-slate-900 dark:text-slate-100">{row.customer_name}</span>,
      },
      {
        id: "items",
        header: "Ítems",
        align: "right",
        cell: (row) => <span className="font-mono font-medium">{row.item_count}</span>,
      },
      {
        id: "payment",
        header: "Medio de pago",
        cell: (row) => row.payment_method_name,
      },
      {
        id: "status",
        header: "Estado",
        cell: (row) => renderStatusBadge(row.status),
      },
      {
        id: "total",
        header: "Total",
        align: "right",
        cell: (row) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currency.format(row.total)}</span>,
      },
    ],
    [formatDateTime]
  );

  const cashColumns = useMemo<ReportTableColumn<CashReportRow>[]>(
    () => [
      {
        id: "date",
        header: "Fecha",
        cell: (row) => formatDateTime(row.created_at),
      },
      {
        id: "type",
        header: "Tipo",
        cell: (row) => <span className="font-medium text-slate-900 dark:text-slate-100">{row.movement_type}</span>,
      },
      {
        id: "reference",
        header: "Referencia",
        cell: (row) => row.reference_type,
      },
      {
        id: "session",
        header: "Sesión",
        cell: (row) => renderStatusBadge(row.session_status),
      },
      {
        id: "amount",
        header: "Monto",
        align: "right",
        cell: (row) => <span className="font-mono font-medium">{currency.format(row.amount)}</span>,
      },
      {
        id: "net",
        header: "Neto",
        align: "right",
        cell: (row) => (
          <span className={cn("font-mono font-bold", row.signed_amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
            {currency.format(row.signed_amount)}
          </span>
        ),
      },
    ],
    [formatDateTime]
  );

  const stockColumns = useMemo<ReportTableColumn<StockReportRow>[]>(
    () => [
      {
        id: "product",
        header: "Producto",
        cell: (row) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{row.product_name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.category}</p>
          </div>
        ),
      },
      {
        id: "stock",
        header: "Stock actual",
        align: "right",
        cell: (row) => <span className="font-mono font-bold">{row.stock_current.toLocaleString("es-AR")}</span>,
      },
      {
        id: "limits",
        header: "Mín / Máx",
        align: "center",
        cell: (row) => <span className="font-mono text-xs">{`${row.stock_min ?? "-"} / ${row.stock_max ?? "-"}`}</span>,
      },
      {
        id: "alert",
        header: "Alerta",
        cell: (row) => renderStockAlertBadge(row.alert_level, row.alert_label),
      },
      {
        id: "movements",
        header: "Movimientos",
        align: "right",
        cell: (row) => <span className="font-mono">{row.movement_count.toLocaleString("es-AR")}</span>,
      },
      {
        id: "last",
        header: "Último movimiento",
        cell: (row) => (row.last_movement_at ? formatDateTime(row.last_movement_at) : "-"),
      },
      {
        id: "status",
        header: "Estado",
        cell: (row) => renderStatusBadge(row.is_active ? "active" : "inactive"),
      },
    ],
    [formatDateTime]
  );

  const debtorsColumns = useMemo<ReportTableColumn<DebtorReportRow>[]>(
    () => [
      {
        id: "customer",
        header: "Cliente",
        cell: (row) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{row.customer_name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{row.document}</p>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contacto",
        cell: (row) => (
          <div className="space-y-0.5 text-xs">
            <p className="font-mono text-slate-700 dark:text-slate-300">{row.phone ?? "-"}</p>
            <p className="text-slate-500 dark:text-slate-400">{row.email ?? "-"}</p>
          </div>
        ),
      },
      {
        id: "balance",
        header: "Saldo",
        align: "right",
        cell: (row) => <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{currency.format(row.current_balance)}</span>,
      },
      {
        id: "last",
        header: "Último movimiento",
        cell: (row) => (row.last_movement_at ? formatDateTime(row.last_movement_at) : "-"),
      },
      {
        id: "status",
        header: "Estado",
        cell: (row) => renderStatusBadge(row.is_active ? "active" : "inactive"),
      },
    ],
    [formatDateTime]
  );

  const purchasesColumns = useMemo<ReportTableColumn<PurchasesReportRow>[]>(
    () => [
      {
        id: "date",
        header: "Fecha",
        cell: (row) => formatDateTime(row.created_at),
      },
      {
        id: "number",
        header: "Número",
        cell: (row) => <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{row.purchase_number}</span>,
      },
      {
        id: "supplier",
        header: "Proveedor",
        cell: (row) => <span className="font-medium text-slate-900 dark:text-slate-100">{row.supplier_name}</span>,
      },
      {
        id: "items",
        header: "Ítems",
        align: "right",
        cell: (row) => <span className="font-mono">{row.item_count.toLocaleString("es-AR")}</span>,
      },
      {
        id: "status",
        header: "Estado",
        cell: (row) => renderStatusBadge(row.status),
      },
      {
        id: "total",
        header: "Total",
        align: "right",
        cell: (row) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{currency.format(row.total)}</span>,
      },
    ],
    [formatDateTime]
  );

  const activeReportStats = useMemo(() => {
    if (reportType === "ventas") return { count: salesRows.length, canExport: true };
    if (reportType === "caja") return { count: cashRows.length, canExport: false };
    if (reportType === "stock") return { count: stockRows.length, canExport: true };
    if (reportType === "deudores") return { count: debtorsRows.length, canExport: true };
    return { count: purchasesRows.length, canExport: true };
  }, [cashRows.length, debtorsRows.length, purchasesRows.length, reportType, salesRows.length, stockRows.length]);

  const activeReportTable = () => {
    if (reportType === "ventas") {
      return (
        <ReportTable
          rows={salesRows}
          columns={salesColumns}
          getRowId={(row) => row.id}
          emptyMessage="No hay ventas para los filtros seleccionados."
        />
      );
    }

    if (reportType === "caja") {
      return (
        <ReportTable
          rows={cashRows}
          columns={cashColumns}
          getRowId={(row) => row.id}
          emptyMessage="No hay movimientos de caja para los filtros seleccionados."
        />
      );
    }

    if (reportType === "stock") {
      return (
        <ReportTable
          rows={stockRows}
          columns={stockColumns}
          getRowId={(row) => row.id}
          emptyMessage="No hay productos de stock para los filtros seleccionados."
        />
      );
    }

    if (reportType === "deudores") {
      return (
        <ReportTable
          rows={debtorsRows}
          columns={debtorsColumns}
          getRowId={(row) => row.id}
          emptyMessage="No hay deudores para los filtros seleccionados."
        />
      );
    }

    return (
      <ReportTable
        rows={purchasesRows}
        columns={purchasesColumns}
        getRowId={(row) => row.id}
        emptyMessage="No hay compras para los filtros seleccionados."
      />
    );
  };

  const handleExport = () => {
    const result = exportActiveReport();
    if (result.ok) {
      toast.success(result.message);
      return;
    }
    toast.info(result.message);
  };

  if (!tenantId) {
    return (
      <section className="ui-panel p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No hay un comercio activo.
      </section>
    );
  }

  if (!canReadReportes) {
    return (
      <section className="ui-panel p-8 text-center text-sm text-slate-500 dark:text-slate-400">
        No tienes permisos de lectura para este módulo.
      </section>
    );
  }

  return (
    <div className="ui-page operational-page reportes-page space-y-4 w-full min-w-0 max-w-full">
      {/* Encabezado Principal Flotante Moderno */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">ANÁLISIS</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">REPORTES GENERALES</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Reportes
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Vistas reales de ventas, caja, stock, deudores y compras con exportación CSV.
          </p>
        </div>

        {/* Fila de Botones Píldora */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => {
              void reload();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <RefreshCw className={cn("h-4 w-4 text-slate-500 dark:text-slate-400", isLoading && "animate-spin")} />
            <span>Actualizar</span>
          </button>

          <Link
            to={`${routePaths.facturacion}?tab=libro-iva`}
            className="inline-flex items-center gap-2 rounded-2xl border border-blue-200/80 bg-blue-50/70 px-4 py-2 text-sm font-semibold text-blue-700 shadow-xs hover:bg-blue-100/80 active:scale-95 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-all"
          >
            <FileSpreadsheet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>Libro IVA Digital (ARCA)</span>
          </Link>

          <button
            type="button"
            onClick={handleExport}
            disabled={!activeReportStats.canExport || isLoading}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </header>

      {/* Selector de Pestañas de Reporte */}
      <ReportTypeTabs value={reportType} counts={reportCounts} onChange={setReportType} />

      {/* Filtros */}
      <ReportsFilters
        filters={filters}
        statusOptions={statusOptions}
        customerOptions={customerOptions}
        productOptions={productOptions}
        paymentMethodOptions={paymentMethodOptions}
        onChange={updateFilters}
        onReset={resetFilters}
        disabled={isLoading}
      />

      {/* Tarjetas de Resumen */}
      <ReportsSummaryCards
        salesCount={summary.salesCount}
        salesTotal={summary.salesTotal}
        purchasesTotal={summary.purchasesTotal}
        debtorsTotal={summary.debtorsTotal}
        cashNet={summary.cashNet}
        stockCriticalCount={summary.stockCriticalCount}
      />

      {error ? <ErrorState message={error} /> : null}
      {isLoading ? <LoadingState message="Cargando reportes..." /> : null}

      {!isLoading ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {reportTitleByType[reportType]}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{reportDescriptionByType[reportType]}</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80 font-mono">
              Filas: {activeReportStats.count.toLocaleString("es-AR")}
            </span>
          </div>

          {activeReportTable()}
        </section>
      ) : null}
    </div>
  );
};