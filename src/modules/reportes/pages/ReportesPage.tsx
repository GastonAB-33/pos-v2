import { useMemo } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { IconButton } from "@/components/ui/IconButton";
import { Download, RefreshCw } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/ui/UiStates";
import { useToast } from "@/components/ui/useToast";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { ReportTable, type ReportTableColumn } from "@/modules/reportes/components/ReportTable";
import { ReportsFilters } from "@/modules/reportes/components/ReportsFilters";
import { ReportsSummaryCards } from "@/modules/reportes/components/ReportsSummaryCards";
import { ReportTypeTabs } from "@/modules/reportes/components/ReportTypeTabs";
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
  ventas: "Ventas con cliente, items, medio de pago y estado",
  caja: "Movimientos de caja vinculados al flujo real del POS",
  stock: "Estado de productos con alertas y ultima actividad",
  deudores: "Clientes con saldo en cuenta corriente",
  compras: "Compras registradas con proveedor y total",
};

const renderStatusBadge = (value: string) => {
  if (value === "completed" || value === "confirmed" || value === "active" || value === "open") {
    return <span className="ui-badge ui-badge--success">{value}</span>;
  }

  if (value === "cancelled" || value === "inactive") {
    return <span className="ui-badge ui-badge--danger">{value}</span>;
  }

  return <span className="ui-badge ui-badge--warn">{value}</span>;
};

const renderStockAlertBadge = (value: StockReportRow["alert_level"], label: string) => {
  if (value === "no_stock") return <span className="ui-badge ui-badge--danger">{label}</span>;
  if (value === "low_stock") return <span className="ui-badge ui-badge--warn">{label}</span>;
  if (value === "over_max") return <span className="ui-badge ui-badge--info">{label}</span>;
  return <span className="ui-badge">{label}</span>;
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
    meta,
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
        header: "Numero",
        cell: (row) => <span className="font-kpi text-xs">{row.sale_number}</span>,
      },
      {
        id: "customer",
        header: "Cliente",
        cell: (row) => row.customer_name,
      },
      {
        id: "items",
        header: "Items",
        align: "right",
        cell: (row) => row.item_count,
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
        cell: (row) => <span className="font-kpi">{currency.format(row.total)}</span>,
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
        cell: (row) => row.movement_type,
      },
      {
        id: "reference",
        header: "Referencia",
        cell: (row) => row.reference_type,
      },
      {
        id: "session",
        header: "Sesion",
        cell: (row) => renderStatusBadge(row.session_status),
      },
      {
        id: "amount",
        header: "Monto",
        align: "right",
        cell: (row) => <span className="font-kpi">{currency.format(row.amount)}</span>,
      },
      {
        id: "net",
        header: "Neto",
        align: "right",
        cell: (row) => (
          <span className={row.signed_amount >= 0 ? "text-emerald-700 font-kpi" : "text-red-700 font-kpi"}>
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
            <p className="font-medium text-slate-900">{row.product_name}</p>
            <p className="text-xs text-slate-500">{row.category}</p>
          </div>
        ),
      },
      {
        id: "stock",
        header: "Stock actual",
        align: "right",
        cell: (row) => <span className="font-kpi">{row.stock_current.toLocaleString("es-AR")}</span>,
      },
      {
        id: "limits",
        header: "Min / Max",
        align: "center",
        cell: (row) => `${row.stock_min ?? "-"} / ${row.stock_max ?? "-"}`,
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
        cell: (row) => row.movement_count.toLocaleString("es-AR"),
      },
      {
        id: "last",
        header: "Ultimo movimiento",
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
            <p className="font-medium text-slate-900">{row.customer_name}</p>
            <p className="text-xs text-slate-500">{row.document}</p>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contacto",
        cell: (row) => (
          <div className="space-y-1">
            <p>{row.phone ?? "-"}</p>
            <p className="text-xs text-slate-500">{row.email ?? "-"}</p>
          </div>
        ),
      },
      {
        id: "balance",
        header: "Saldo",
        align: "right",
        cell: (row) => <span className="font-kpi">{currency.format(row.current_balance)}</span>,
      },
      {
        id: "last",
        header: "Ultimo movimiento",
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
        header: "Numero",
        cell: (row) => <span className="font-kpi text-xs">{row.purchase_number}</span>,
      },
      {
        id: "supplier",
        header: "Proveedor",
        cell: (row) => row.supplier_name,
      },
      {
        id: "items",
        header: "Items",
        align: "right",
        cell: (row) => row.item_count.toLocaleString("es-AR"),
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
        cell: (row) => <span className="font-kpi">{currency.format(row.total)}</span>,
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
      <PagePlaceholder
        title="Reportes"
        description="No hay un comercio activo"
      />
    );
  }

  if (!canReadReportes) {
    return (
      <PagePlaceholder
        title="Reportes"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder
      title="Reportes"
      description="Vistas reales de ventas, caja, stock, deudores y compras con exportacion CSV"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Productos: {meta.totalProducts} | Clientes: {meta.totalCustomers} | Mov. cta cte:{" "}
            {meta.currentAccountMovementsCount}
          </p>
          <div className="flex items-center gap-2">
            <IconButton
              icon={RefreshCw}
              label="Recargar reportes"
              onClick={() => {
                void reload();
              }}
              loading={isLoading}
            />
            <button
              type="button"
              className="ui-btn-primary"
              onClick={handleExport}
              disabled={!activeReportStats.canExport || isLoading}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        <ReportTypeTabs value={reportType} counts={reportCounts} onChange={setReportType} />

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
          <section className="ui-card space-y-3">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {reportTitleByType[reportType]}
                </h2>
                <p className="text-sm text-slate-500">{reportDescriptionByType[reportType]}</p>
              </div>
              <span className="ui-badge ui-badge--info">
                Filas: {activeReportStats.count.toLocaleString("es-AR")}
              </span>
            </header>

            {activeReportTable()}
          </section>
        ) : null}
      </div>
    </PagePlaceholder>
  );
};
