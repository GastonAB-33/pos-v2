import { useRef, useState } from "react";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { StockAdjustmentModal } from "@/modules/stock/components/StockAdjustmentModal";
import { StockMovementsTable } from "@/modules/stock/components/StockMovementsTable";
import { StockTrackingTable } from "@/modules/stock/components/StockTrackingTable";
import { StockSummaryCards } from "@/modules/stock/components/StockSummaryCards";
import { useStockModule } from "@/modules/stock/hooks/useStockModule";
import { movementTypeLabel } from "@/modules/stock/utils/stock-labels";
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
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={openPicker}
        className="ui-input ui-input--date cursor-pointer"
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
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);

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

  const movementViewRows = movementRows.map((movement) => ({
    movement,
    product: productsById.get(movement.product_id) ?? null,
  }));

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
    <PagePlaceholder title="Stock">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-badge ui-badge--info">Movimientos: {movementRows.length}</span>
            <span className="ui-badge ui-badge--success">Activos: {summary.activeProducts}</span>
          </div>
          <div className="flex items-center gap-2">
            {canWriteStock && stockSettings.allow_manual_adjustments ? (
              <button
                type="button"
                onClick={() => {
                  clearFeedback();
                  setIsAdjustmentModalOpen(true);
                }}
                className="ui-btn-primary"
                disabled={isLoading || isSubmitting}
              >
                Ajuste manual
              </button>
            ) : null}
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
        </div>

        <StockSummaryCards
          activeProducts={summary.activeProducts}
          lowStock={summary.lowStock}
          noStock={summary.noStock}
          overMax={summary.overMax}
        />

        {feedback ? <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>{feedback.message}</div> : null}

        <StockTrackingTable
          products={products}
          categories={categoryOptions}
          disabled={isSubmitting || !canWriteStock}
          onUpdateOne={updateStockThreshold}
          onUpdateBulk={updateStockThresholdBulk}
        />

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid flex-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Tipo de movimiento</label>
                <select
                  value={movementTypeFilter}
                  onChange={(event) =>
                    setMovementTypeFilter(event.target.value as typeof movementTypeFilter)
                  }
                  className="ui-input"
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

            <button
              type="button"
              className="ui-btn-ghost"
              onClick={handleDownloadMovementHistory}
              disabled={!movementViewRows.length}
            >
              Descargar historial
            </button>
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

      <StockAdjustmentModal
        open={isAdjustmentModalOpen}
        products={products}
        canWrite={canWriteStock}
        disabled={isSubmitting}
        onClose={() => setIsAdjustmentModalOpen(false)}
        onSubmit={applyManualAdjustmentsBulk}
      />
    </PagePlaceholder>
  );
};
