import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { usePermissions } from "@/features/auth/hooks/usePermissions";
import { useTenant } from "@/features/tenant/hooks/useTenant";
import { CashCloseForm } from "@/modules/caja/components/CashCloseForm";
import { CashMovementForm } from "@/modules/caja/components/CashMovementForm";
import { CashMovementsTable } from "@/modules/caja/components/CashMovementsTable";
import { CashOpenForm } from "@/modules/caja/components/CashOpenForm";
import { CashSessionHistoryTable } from "@/modules/caja/components/CashSessionHistoryTable";
import { CashSummaryCards } from "@/modules/caja/components/CashSummaryCards";
import { useCashModule } from "@/modules/caja/hooks/useCashModule";

export const CajaPage = () => {
  const { tenantId } = useTenant();
  const user = useAuthStore((state) => state.user);
  const { canRead, canWrite } = usePermissions();
  const canReadCaja = canRead("caja");
  const canWriteCaja = canWrite("caja");

  const {
    currentSession,
    sessionHistory,
    currentSessionMovements,
    cashSettings,
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
    openCash,
    closeCash,
    registerIncome,
    registerExpense,
  } = useCashModule(tenantId, user?.id ?? null);

  if (!tenantId) {
    return (
      <PagePlaceholder
        title="Caja"
        description="No hay tenant activo para operar el modulo"
      />
    );
  }

  if (!canReadCaja) {
    return (
      <PagePlaceholder
        title="Caja"
        description="No tenes permisos de lectura para este modulo"
      />
    );
  }

  return (
    <PagePlaceholder title="Caja" description="Sesion actual, movimientos e historial simple">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Sesion actual: {currentSession ? "Abierta" : "Sin sesion abierta"}
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
          Politica: {cashSettings.require_open_session_for_sale ? "caja obligatoria para venta" : "caja opcional para venta"} |{" "}
          {cashSettings.allow_manual_movements ? "movimientos manuales habilitados" : "movimientos manuales deshabilitados"}
          {cashSettings.require_notes_on_manual_movements ? " | observacion obligatoria" : ""}
        </p>

        {feedback ? <div className={feedback.type === "success" ? "ui-success-state" : "ui-error-state"}>{feedback.message}</div> : null}

        <CashSummaryCards
          openingAmount={summary.openingAmount}
          incomes={summary.incomes}
          expenses={summary.expenses}
          expectedBalance={summary.expectedBalance}
        />

        {!currentSession ? (
          <CashOpenForm
            canWrite={canWriteCaja}
            disabled={isSubmitting}
            defaultOpeningAmount={cashSettings.default_opening_amount}
            onSubmit={openCash}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {cashSettings.allow_manual_movements ? (
              <>
                <CashMovementForm
                  mode="income"
                  canWrite={canWriteCaja}
                  disabled={isSubmitting}
                  onSubmit={registerIncome}
                />
                <CashMovementForm
                  mode="expense"
                  canWrite={canWriteCaja}
                  disabled={isSubmitting}
                  onSubmit={registerExpense}
                />
              </>
            ) : (
              <div className="lg:col-span-2 ui-empty-state">
                Los movimientos manuales de caja estan deshabilitados por configuracion.
              </div>
            )}
            <CashCloseForm
              canWrite={canWriteCaja}
              disabled={isSubmitting}
              expectedBalance={summary.expectedBalance}
              onSubmit={closeCash}
            />
          </div>
        )}

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
          <h2 className="text-base font-semibold text-slate-900">Movimientos de la sesion actual</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={movementTypeFilter}
              onChange={(event) =>
                setMovementTypeFilter(event.target.value as typeof movementTypeFilter)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Todos los tipos</option>
              <option value="sale_payment">Sale payment</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="adjustment">Adjustment</option>
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
              Cargando caja...
            </div>
          ) : (
            <CashMovementsTable movements={currentSessionMovements} />
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
          <h2 className="text-base font-semibold text-slate-900">Historial de sesiones</h2>
          {isLoading ? (
            <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
              Cargando historial...
            </div>
          ) : (
            <CashSessionHistoryTable sessions={sessionHistory} />
          )}
        </section>
      </div>
    </PagePlaceholder>
  );
};
