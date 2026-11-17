import { useMemo, useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { LoadingState } from "@/components/ui/UiStates";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { StockAdjustmentModal } from "@/modules/stock/components/StockAdjustmentModal";
import { StockMovementsTable } from "@/modules/stock/components/StockMovementsTable";
import { StockTrackingTable } from "@/modules/stock/components/StockTrackingTable";
import { StockSummaryCards } from "@/modules/stock/components/StockSummaryCards";
import { useStockModule } from "@/modules/stock/hooks/useStockModule";
import { movementTypeLabel, type StockStatusFilter } from "@/modules/stock/utils/stock-labels";
import { downloadXlsx } from "@/utils/xlsx";
import type { StockMovement } from "@/types/entities";

interface DateFilterInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const DateFilterInput = ({ label, value, onChange }: DateFilterInputProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;

    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={openPicker}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 cursor-pointer"
      />
    </div>
  );
};

const movementTypeOptions: Array<{ value: "all" | StockMovement["movement_type"]; label: string }> = [
  { value: "all", label: "Todos los tipos" },
  { value: "sale", label: movementTypeLabel.sale },
  { value: "purchase", label: movementTypeLabel.purchase },
  { value: "adjustment", label: movementTypeLabel.adjustment },
  { value: "in", label: movementTypeLabel.in },
  { value: "out", label: movementTypeLabel.out },
];

const formatCsvDateStamp = (): string => new Date().toISOString().slice(0, 10);

export const StockPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadStock = canRead("stock");
  const canWriteStock = canWrite("stock");
  const canWriteManualAdjustments = canWrite("stock_ajustes_manuales");
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>("all");

  const {
    products,
    stockSettings,
    productsById,
    movementRows,
    summary,
    categoryOptions,
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
    applyManualAdjustmentsBulk,
    updateStockThreshold,
    updateStockThresholdBulk,
  } = useStockModule(tenantId, user?.id ?? null);

  const movementViewRows = useMemo(
    () =>
      movementRows.map((movement) => ({
        movement,
        product: productsById.get(movement.product_id) ?? null,
      })),
    [movementRows, productsById]
  );

  const handleDownloadMovementHistory = async () => {
    const reportRows = movementViewRows.map(({ movement, product }) => ({
      fecha: new Date(movement.created_at).toLocaleString("es-AR"),
      producto: product?.name ?? "Producto eliminado",
      codigo: product?.code ?? "",
      tipo_movimiento: movementTypeLabel[movement.movement_type] ?? movement.movement_type,
      cantidad: Number(movement.quantity.toFixed(3)),
      tipo_referencia: movement.reference_type,
      referencia: movement.reference_id ?? "",
      usuario: movement.created_by ?? "",
      observacion: movement.notes ?? "",
    }));

    void downloadXlsx(
      `historial-stock-${formatCsvDateStamp()}.xlsx`,
      "Historial stock",
      reportRows
    );
  };

  if (!tenantId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No hay un comercio activo.
      </div>
    );
  }

  if (!canReadStock) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No tenés permisos de lectura para este módulo.
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full min-w-0 max-w-full">
      {/* Encabezado Principal de Stock */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Breadcrumb con formato estándar de la skill */}
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
            <span className="text-slate-400 dark:text-slate-500">INVENTARIO</span>
            <span className="text-slate-400 dark:text-slate-500 font-bold">›</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">CONTROL DE STOCK</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Stock
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Control de existencias, umbrales y movimientos de inventario en tiempo real.
          </p>
        </div>

        {/* Acciones superiores con botones píldora */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => {
              clearFeedback();
              void reload();
            }}
            disabled={isLoading || isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/80 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title="Recargar stock desde el servidor"
            aria-label="Recargar stock"
          >
            <RefreshCw
              size={15}
              className={isLoading ? "animate-spin text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}
            />
            <span className="hidden sm:inline">Recargar</span>
          </button>

          {canWriteManualAdjustments ? (
            <button
              type="button"
              onClick={() => {
                clearFeedback();
                setIsAdjustmentModalOpen(true);
              }}
              disabled={isLoading || isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 transition-all cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Ajustar stock</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* Franja de 4 Tarjetas KPI Redondeadas */}
      <StockSummaryCards
        activeProducts={summary.activeProducts}
        lowStock={summary.lowStock}
        overMax={summary.overMax}
        unassigned={summary.unassigned}
        activeFilter={statusFilter}
        onSelectFilter={setStatusFilter}
        onConfigureUnassigned={() => setStatusFilter("unassigned")}
      />

      {feedback ? (
        <div className={`rounded-2xl ${feedback.type === "success" ? "ui-success-state" : "ui-error-state"}`}>
          {feedback.message}
        </div>
      ) : null}

      {/* Tabla y Tarjetas de Seguimiento de Stock */}
      <StockTrackingTable
        products={products}
        categories={categoryOptions}
        disabled={isSubmitting || !canWriteStock}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        globalLowThreshold={stockSettings.global_low_stock_threshold}
        onUpdateOne={updateStockThreshold}
        onUpdateBulk={updateStockThresholdBulk}
        summary={summary}
      />

      {/* Sección Historial de Movimientos Redondeada */}
      <section className="space-y-4 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Historial de movimientos</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{movementRows.length} movimientos registrados</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all active:scale-95 disabled:opacity-50"
            onClick={handleDownloadMovementHistory}
            disabled={!movementViewRows.length}
          >
            <span>Descargar historial (XLSX)</span>
          </button>
        </div>

        {/* Filtros de Historial en Panel Redondeado */}
        <div className="grid gap-2.5 sm:grid-cols-3 rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Tipo de movimiento</label>
            <select
              value={movementTypeFilter}
              onChange={(event) =>
                setMovementTypeFilter(event.target.value as typeof movementTypeFilter)
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200"
            >
              {movementTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <DateFilterInput label="Desde" value={dateFrom} onChange={setDateFrom} />
          <DateFilterInput label="Hasta" value={dateTo} onChange={setDateTo} />
        </div>

        {isLoading ? (
          <LoadingState
            message="Cargando movimientos de stock..."
            description="Sincronizando ingresos, egresos y ajustes de inventario..."
          />
        ) : (
          <StockMovementsTable rows={movementViewRows} />
        )}
      </section>

      <StockAdjustmentModal
        open={isAdjustmentModalOpen}
        products={products}
        canWrite={canWriteStock}
        disabled={isSubmitting}
        onClose={() => setIsAdjustmentModalOpen(false)}
        onSubmit={applyManualAdjustmentsBulk}
      />
    </div>
  );
};

