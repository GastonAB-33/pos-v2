import { RefreshCw } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/UiStates";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useDashboardAnalytics } from "@/modules/dashboard/hooks/useDashboardAnalytics";
import { cn } from "@/utils/cn";

const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("es-AR");

const formatCompact = (value: number) => {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return number.format(value);
};

export const DashboardPage = () => {
  const { tenantId } = useTenant();
  const { isLoading, error, data, reload } = useDashboardAnalytics(tenantId);

  return (
    <div className="ui-page operational-page dashboard-page space-y-4 w-full min-w-0 max-w-full">
      {/* Encabezado Principal Flotante Moderno */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">ANÁLISIS</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">ESTADÍSTICAS OPERATIVAS</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Estadísticas
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            KPIs y visualizaciones operativas en tiempo real de tu comercio.
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
        </div>
      </header>

      {error ? <ErrorState message={error} /> : null}

      {/* Grid de KPIs principales */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Ventas del día
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
            {currency.format(data.kpis.salesToday)}
          </p>
        </article>
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Ventas del mes
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
            {currency.format(data.kpis.salesMonth)}
          </p>
        </article>
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Transacciones
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
            {number.format(data.kpis.transactionsMonth)}
          </p>
        </article>
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Ticket promedio
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
            {currency.format(data.kpis.averageTicketMonth)}
          </p>
        </article>
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Productos activos
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
            {number.format(data.kpis.activeProducts)}
          </p>
        </article>
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Stock bajo
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
            {number.format(data.kpis.lowStockProducts)}
          </p>
        </article>
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Clientes con deuda
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
            {number.format(data.kpis.customersInDebt)}
          </p>
        </article>
        <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Compras del mes
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
            {currency.format(data.kpis.purchasesMonth)}
          </p>
        </article>
      </section>

      {/* Sección Caja Real */}
      <section className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">Caja real</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Movimientos registrados desde ventas, cuenta corriente e ingresos/egresos manuales.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80">
            Cajas abiertas: {number.format(data.kpis.openCashSessions)}
          </span>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          <article className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ingresos hoy</p>
            <p className="mt-2 text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {currency.format(data.kpis.cashIncomeToday)}
            </p>
          </article>
          <article className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Egresos hoy</p>
            <p className="mt-2 text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">
              {currency.format(data.kpis.cashExpenseToday)}
            </p>
          </article>
          <article className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Neto hoy</p>
            <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
              {currency.format(data.kpis.cashNetToday)}
            </p>
          </article>
          <article className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ingresos mes</p>
            <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
              {currency.format(data.kpis.cashIncomeMonth)}
            </p>
          </article>
          <article className="rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700/80 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Manual hoy</p>
            <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
              {number.format(data.kpis.manualCashMovementsToday)}
            </p>
          </article>
        </div>
      </section>

      {isLoading ? <LoadingState message="Cargando estadísticas..." /> : null}

      {!isLoading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {/* Ventas últimos 7 días */}
          <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <header className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ventas últimos 7 días
              </h2>
            </header>
            {!data.salesLast7Days.length ? (
              <EmptyState message="Sin ventas registradas en el período." />
            ) : (
              <div className="flex h-48 items-end gap-2 pt-4">
                {data.salesLast7Days.map((point) => {
                  const max = Math.max(...data.salesLast7Days.map((row) => row.value), 1);
                  const height = Math.max(8, (point.value / max) * 100);

                  return (
                    <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {formatCompact(point.value)}
                      </span>
                      <div
                        className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 transition-all shadow-xs"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-semibold">
                        {point.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          {/* Caja por origen */}
          <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <header className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Caja por origen (mes)
              </h2>
            </header>
            {!data.cashMovementsBySource.length ? (
              <EmptyState message="Sin movimientos de caja registrados en el mes." />
            ) : (
              <div className="space-y-3 pt-2">
                {data.cashMovementsBySource.map((row) => {
                  const max = Math.max(...data.cashMovementsBySource.map((item) => item.value), 1);
                  const width = Math.max(4, (row.value / max) * 100);
                  return (
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="truncate font-medium text-slate-700 dark:text-slate-300">{row.label}</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {currency.format(row.value)}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          {/* Ventas por medio de pago */}
          <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <header className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Ventas por medio de pago (mes)
              </h2>
            </header>
            {!data.salesByPaymentMethod.length ? (
              <EmptyState message="Sin datos de medios de pago para este mes." />
            ) : (
              <div className="space-y-3 pt-2">
                {data.salesByPaymentMethod.map((row) => {
                  const max = Math.max(...data.salesByPaymentMethod.map((item) => item.value), 1);
                  const width = Math.max(4, (row.value / max) * 100);
                  return (
                    <div key={row.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{row.label}</span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {currency.format(row.value)}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          {/* Top productos vendidos */}
          <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <header className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Top productos vendidos (mes)
              </h2>
            </header>
            {!data.topProducts.length ? (
              <EmptyState message="Sin productos vendidos en el mes." />
            ) : (
              <div className="space-y-2.5">
                {data.topProducts.map((row, index) => (
                  <div
                    key={`${row.product_id}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 dark:border-slate-700/80 dark:bg-slate-800/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {row.product_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Total vendido: <span className="font-mono font-medium">{currency.format(row.total)}</span>
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80 font-mono">
                      {number.format(row.quantity)} un.
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>

          {/* Stock crítico */}
          <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <header className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Stock crítico
              </h2>
            </header>
            {!data.stockCritical.length ? (
              <EmptyState message="No hay productos en estado crítico." />
            ) : (
              <div className="space-y-2.5">
                {data.stockCritical.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 dark:border-slate-700/80 dark:bg-slate-800/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        Stock: {number.format(row.stock_current)}
                        {row.stock_min != null ? ` | Mín: ${number.format(row.stock_min)}` : ""}
                      </p>
                    </div>
                    {row.is_no_stock ? (
                      <span className="shrink-0 inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 border border-red-200/70 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/80">
                        Sin stock
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200/70 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80">
                        Bajo mínimo
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>

          {/* Compras por período */}
          <article className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4 xl:col-span-2">
            <header className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Compras por período (últimos 6 meses)
              </h2>
            </header>
            {!data.purchasesByPeriod.length ? (
              <EmptyState message="No hay compras para graficar." />
            ) : (
              <div className="flex h-44 items-end gap-2 pt-4">
                {data.purchasesByPeriod.map((point) => {
                  const max = Math.max(...data.purchasesByPeriod.map((row) => row.value), 1);
                  const height = Math.max(8, (point.value / max) * 100);

                  return (
                    <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {formatCompact(point.value)}
                      </span>
                      <div
                        className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 dark:bg-amber-500/90 dark:hover:bg-amber-400 transition-all shadow-xs"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-semibold">
                        {point.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </div>
      ) : null}
    </div>
  );
};