import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/UiStates";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { useDashboardAnalytics } from "@/modules/dashboard/hooks/useDashboardAnalytics";

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
    <PagePlaceholder
      title="Estadisticas"
      description="KPIs y visualizaciones operativas en tiempo real"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Panel consolidado de ventas, stock, caja, compras y clientes</p>
          <button
            type="button"
            onClick={() => {
              void reload();
            }}
            className="ui-btn-ghost"
            disabled={isLoading}
          >
            Recargar
          </button>
        </div>

        {error ? <ErrorState message={error} /> : null}

        <section className="ui-summary-grid md:grid-cols-4">
          <article className="ui-summary-card">
            <p className="ui-summary-label">Ventas del dia</p>
            <p className="ui-kpi">{currency.format(data.kpis.salesToday)}</p>
          </article>
          <article className="ui-summary-card">
            <p className="ui-summary-label">Ventas del mes</p>
            <p className="ui-kpi">{currency.format(data.kpis.salesMonth)}</p>
          </article>
          <article className="ui-summary-card">
            <p className="ui-summary-label">Transacciones</p>
            <p className="ui-kpi">{number.format(data.kpis.transactionsMonth)}</p>
          </article>
          <article className="ui-summary-card">
            <p className="ui-summary-label">Ticket promedio</p>
            <p className="ui-kpi">{currency.format(data.kpis.averageTicketMonth)}</p>
          </article>
          <article className="ui-summary-card">
            <p className="ui-summary-label">Productos activos</p>
            <p className="ui-kpi">{number.format(data.kpis.activeProducts)}</p>
          </article>
          <article className="ui-summary-card">
            <p className="ui-summary-label">Stock bajo</p>
            <p className="ui-kpi">{number.format(data.kpis.lowStockProducts)}</p>
          </article>
          <article className="ui-summary-card">
            <p className="ui-summary-label">Clientes con deuda</p>
            <p className="ui-kpi">{number.format(data.kpis.customersInDebt)}</p>
          </article>
          <article className="ui-summary-card">
            <p className="ui-summary-label">Compras del mes</p>
            <p className="ui-kpi">{currency.format(data.kpis.purchasesMonth)}</p>
          </article>
        </section>

        {isLoading ? <LoadingState message="Cargando estadisticas..." /> : null}

        {!isLoading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <article className="ui-card">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Ventas ultimos 7 dias
                </h2>
              </header>
              {!data.salesLast7Days.length ? (
                <EmptyState message="Sin ventas registradas en el periodo." />
              ) : (
                <div className="flex h-48 items-end gap-2">
                  {data.salesLast7Days.map((point) => {
                    const max = Math.max(...data.salesLast7Days.map((row) => row.value), 1);
                    const height = Math.max(8, (point.value / max) * 100);

                    return (
                      <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                        <span className="text-[11px] text-slate-500">{formatCompact(point.value)}</span>
                        <div className="w-full rounded-md bg-brand-600/80" style={{ height: `${height}%` }} />
                        <span className="text-[11px] font-mono text-slate-500">{point.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="ui-card">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Ventas por medio de pago (mes)
                </h2>
              </header>
              {!data.salesByPaymentMethod.length ? (
                <EmptyState message="Sin datos de medios de pago para este mes." />
              ) : (
                <div className="space-y-2">
                  {data.salesByPaymentMethod.map((row) => {
                    const max = Math.max(...data.salesByPaymentMethod.map((item) => item.value), 1);
                    const width = Math.max(4, (row.value / max) * 100);
                    return (
                      <div key={row.label}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-slate-600">{row.label}</span>
                          <span className="font-mono text-slate-700">{currency.format(row.value)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="ui-card">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Top productos vendidos (mes)
                </h2>
              </header>
              {!data.topProducts.length ? (
                <EmptyState message="Sin productos vendidos en el mes." />
              ) : (
                <div className="space-y-2">
                  {data.topProducts.map((row, index) => (
                    <div key={`${row.product_id}-${index}`} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{row.product_name}</p>
                        <span className="ui-badge ui-badge--info">{number.format(row.quantity)}</span>
                      </div>
                      <p className="text-xs text-slate-500">Total vendido: {currency.format(row.total)}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="ui-card">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Stock critico
                </h2>
              </header>
              {!data.stockCritical.length ? (
                <EmptyState message="No hay productos en estado critico." />
              ) : (
                <div className="space-y-2">
                  {data.stockCritical.map((row) => (
                    <div key={row.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-500">
                          Stock: {number.format(row.stock_current)}
                          {row.stock_min != null ? ` | Min: ${number.format(row.stock_min)}` : ""}
                        </p>
                      </div>
                      {row.is_no_stock ? (
                        <span className="ui-badge ui-badge--danger">Sin stock</span>
                      ) : (
                        <span className="ui-badge ui-badge--warn">Bajo minimo</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="ui-card xl:col-span-2">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Compras por periodo (ultimos 6 meses)
                </h2>
              </header>
              {!data.purchasesByPeriod.length ? (
                <EmptyState message="No hay compras para graficar." />
              ) : (
                <div className="flex h-40 items-end gap-2">
                  {data.purchasesByPeriod.map((point) => {
                    const max = Math.max(...data.purchasesByPeriod.map((row) => row.value), 1);
                    const height = Math.max(8, (point.value / max) * 100);

                    return (
                      <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
                        <span className="text-[11px] text-slate-500">{formatCompact(point.value)}</span>
                        <div className="w-full rounded-md bg-amber-500/80" style={{ height: `${height}%` }} />
                        <span className="text-[11px] font-mono text-slate-500">{point.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </div>
        ) : null}
      </div>
    </PagePlaceholder>
  );
};
