import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { StockAdjustmentForm } from "@/modules/stock/components/StockAdjustmentForm";
import { StockMovementsTable } from "@/modules/stock/components/StockMovementsTable";
import { StockSummaryCards } from "@/modules/stock/components/StockSummaryCards";
import { useStockModule } from "@/modules/stock/hooks/useStockModule";

export const StockPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadStock = canRead("stock");
  const canWriteStock = canWrite("stock");

  const {
    products,
    stockSettings,
    productsById,
    alertRows,
    movementRows,
    summary,
    movementTypeFilter,
    setMovementTypeFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    isLoading,
    isSubmitting,
    feedback,
    clearFeedback,
    reload,
    applyManualAdjustment,
  } = useStockModule(tenantId, user?.id ?? null);

  const movementViewRows = movementRows.map((movement) => ({
    movement,
    product: productsById.get(movement.product_id) ?? null,
  }));

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Stock"
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadStock) {
    return (
      <PagePlaceholder
        title="Stock"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder title="Stock" description="Movimientos reales y ajustes manuales">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Movimientos: {movementRows.length} | Productos activos: {summary.activeProducts}
          </p>
          <button
            type="button"
            onClick={() => {
              clearFeedback();
              void reload();
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={isLoading || isSubmitting}
          >
            Recargar
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Politica: {stockSettings.alerts_active ? "alertas activas" : "alertas desactivadas"} |{" "}
          {stockSettings.allow_negative_stock ? "stock negativo permitido" : "stock negativo bloqueado"} |{" "}
          {stockSettings.allow_manual_adjustments ? "ajustes manuales habilitados" : "ajustes manuales deshabilitados"}
        </p>

        <StockSummaryCards
          activeProducts={summary.activeProducts}
          lowStock={summary.lowStock}
          noStock={summary.noStock}
          overMax={summary.overMax}
        />

        {feedback ? (
          <div
            className={[
              "rounded-lg border px-3 py-2 text-sm",
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {feedback.message}
          </div>
        ) : null}

        {canWriteStock && stockSettings.allow_manual_adjustments ? (
          <StockAdjustmentForm
            products={products}
            canWrite={canWriteStock}
            disabled={isSubmitting}
            onSubmit={applyManualAdjustment}
          />
        ) : null}

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
          <h2 className="text-base font-semibold text-slate-900">Alertas de stock</h2>
          {!alertRows.length ? (
            <p className="text-sm text-slate-500">No hay alertas activas.</p>
          ) : (
            <div className="space-y-2">
              {alertRows.map(({ product, isNoStock, isLow, isOver }) => (
                <article
                  key={product.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      Stock actual: {product.stock_current.toLocaleString("es-AR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isNoStock ? (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                        Sin stock
                      </span>
                    ) : null}
                    {isLow ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                        Bajo minimo
                      </span>
                    ) : null}
                    {isOver ? (
                      <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700">
                        Sobre maximo
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={movementTypeFilter}
              onChange={(event) =>
                setMovementTypeFilter(event.target.value as typeof movementTypeFilter)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Todos los tipos</option>
              <option value="sale">Sale</option>
              <option value="purchase">Purchase</option>
              <option value="adjustment">Adjustment</option>
              <option value="in">In</option>
              <option value="out">Out</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {isLoading ? (
            <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
              Cargando stock...
            </div>
          ) : (
            <StockMovementsTable rows={movementViewRows} />
          )}
        </section>
      </div>
    </PagePlaceholder>
  );
};
